"""Installer encoding/assembly tests; no native or CAS correctness claim."""
from pathlib import Path
import contextlib
import importlib.util
import io
import json
import re
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('installer_build', ROOT / 'tools/build_installer.py')
build = importlib.util.module_from_spec(SPEC)
# dataclasses looks up its defining module while resolving annotations.
import sys
sys.modules[SPEC.name] = build
SPEC.loader.exec_module(build)


def decode_assignment(lines):
    result = []
    for line in lines:
        literal = line[len('  xsis:='):] if line.startswith('  xsis:=') else line.strip()
        if literal[-1] not in '+;':
            raise AssertionError('unexpected PPL concatenation line')
        literal = literal[:-1]
        if not (literal.startswith('"') and literal.endswith('"')):
            raise AssertionError('unexpected generated PPL literal')
        result.append(build.ppl_unescape(literal[1:-1]))
    return ''.join(result)


def decode_inline_command(command):
    prefix, suffix = '(type((', '))==DOM_FUNC)'
    if not command.startswith(prefix) or not command.endswith(suffix):
        raise AssertionError('function value must stay inside numeric CAS wrapper')
    return command[len(prefix):-len(suffix)]


class InstallerTests(unittest.TestCase):
    def test_comment_scanner_keeps_strings_unicode_and_line_boundaries(self):
        source = r'''// leading
demo(x):=BEGIN
  LOCAL y; /* block
   comment */ y:=x;
  // another comment
  RETURN ["//", "/*", "*/", "\\", "\"", "汉字√α", "END; BEGIN"];
END;
'''
        clean = build.compact(source)
        self.assertEqual(build.token_values(clean), build.token_values(source))
        self.assertEqual(clean.count('\n'), source.count('\n'))
        self.assertNotIn('leading', clean)
        self.assertNotIn('another comment', clean)
        for literal in ('"//"', '"/*"', '"*/"', '"汉字√α"'):
            self.assertIn(literal, clean)

    def test_compaction_does_not_merge_operator_or_numeric_tokens(self):
        source = 'x / /* gap */ / y; x < /* gap */ = y; 1 . 2; 1 e + 2; a : /*gap*/ = b;'
        clean = build.compact(source)
        self.assertEqual(build.token_values(clean), build.token_values(source))
        self.assertIn('/ /', clean)
        self.assertIn('< =', clean)
        self.assertIn(': =', clean)
        self.assertEqual([t.text for t in build.lex('1..2<=3!=4:=5e-2')],
                         ['1', '..', '2', '<=', '3', '!=', '4', ':=', '5e-2'])

    def test_split_nested_blocks_and_ignore_keywords_in_strings(self):
        source = '''a(x):=BEGIN
 IFERR
  IF x>0 THEN FOR k FROM 1 TO 2 DO x:=x+1; END;
  ELSE RETURN "END; BEGIN IF"; END;
 THEN RETURN 0; END;
 RETURN x;
END;
b():=BEGIN RETURN 2; END;
'''
        definitions = build.split_definitions(source)
        self.assertEqual([item['name'] for item in definitions], ['a', 'b'])
        reconstructed = ';\n'.join(item['definition'] for item in definitions) + ';'
        self.assertEqual(build.token_values(reconstructed), build.token_values(source))
        self.assertTrue(definitions[0]['definition'].endswith('END'))
        self.assertIn('\n', definitions[0]['definition'])

    def test_reject_unclosed_or_non_function_input(self):
        bad = [
            'x:=1;',
            'f(x):=BEGIN RETURN "unterminated; END;',
            'f(x):=BEGIN /* unterminated',
            'f(x):=BEGIN IF x THEN RETURN 1; END;',
            'f(x):=BEGIN RETURN [x); END;',
            'f(x):=BEGIN RETURN x; END',
            'f(x,):=BEGIN RETURN x; END;',
            'f(x):=BEGIN RETURN x; END; junk',
            'f(x):=BEGIN RETURN x; END; f(x):=BEGIN RETURN x; END;',
            '',
        ]
        for source in bad:
            with self.subTest(source=source), self.assertRaises(ValueError):
                build.split_definitions(source)
        for source in ('a\0b', 'a\rb', '\ufeffa'):
            with self.subTest(source=source), self.assertRaises(ValueError):
                build.lex(source)
        with patch.object(build, 'MAX_SOURCE_CHARS', 5), self.assertRaises(ValueError):
            build.lex('abcdef')
        with patch.object(build, 'MAX_FUNCTION_CHARS', 10), self.assertRaises(ValueError):
            build.split_definitions('f(x):=BEGIN RETURN x; END;')

    def test_ppl_round_trip_distinguishes_actual_lf_and_literal_escape(self):
        samples = ['"', '\\', '\n', r'\n', r'\"', '汉字√α',
                   'first\nsecond\\n"quote"\\tail', '""\\\\\n']
        for raw in samples:
            with self.subTest(raw=raw):
                encoded = build.ppl_escape(raw)
                self.assertEqual(build.ppl_unescape(encoded), raw)
                self.assertNotIn('\n', encoded)
        self.assertNotEqual(build.ppl_escape('\n'), build.ppl_escape(r'\n'))
        for bad in ('"', '\\', r'\q', '\n'):
            with self.subTest(encoded=bad), self.assertRaises(ValueError):
                build.ppl_unescape(bad)

    def test_chunks_are_cut_before_encoding_and_decode_exactly(self):
        command = ('"\\汉\n' * 151) + 'tail'
        lines = build.assignment_lines(command)
        self.assertEqual(decode_assignment(lines), command)
        self.assertTrue(all(len(line) <= 270 for line in lines))
        chunks = [command[i:i + 120] for i in range(0, len(command), 120)]
        for line, raw in zip(lines, chunks):
            self.assertIn(build.ppl_escape(raw), line)
        with self.assertRaises(ValueError):
            build.assignment_lines('')

    def test_inline_decode_restores_exact_multiline_cas_definition(self):
        source = r'''sample(x):=BEGIN
 RETURN ["//", "/*", "\\", "\"", "\n", "汉字"];
END'''
        command = build.wrap_definition(source)
        outer_decoded = decode_assignment(build.assignment_lines(command))
        inner_decoded = decode_inline_command(outer_decoded)
        self.assertEqual(outer_decoded, command)
        self.assertEqual(inner_decoded, source)
        self.assertEqual(build.token_values(inner_decoded), build.token_values(source))
        self.assertTrue(inner_decoded.endswith('END'))
        self.assertTrue(command.startswith('(type((sample(x):=BEGIN'))

    def test_saved_empty_list_initializers_require_runtime_construction(self):
        # Saved literal empty lists can be mutated after native reload. Reject
        # both direct and nested literals, while keeping strings/comments data.
        for body in ('LOCAL r;r:=[];RETURN append(r,x);', 'RETURN [1,[[],2]];'):
            with self.subTest(body=body), self.assertRaisesRegex(ValueError, 'empty list literal'):
                build.wrap_definition('f(x):=BEGIN ' + body + 'END')
        accepted = 'f(x):=BEGIN /* [] */ LOCAL r;r:=mid([0],1,0);RETURN [r,"[]"];END'
        self.assertEqual(decode_inline_command(build.wrap_definition(accepted)), accepted)
        for module in build.MODULES:
            definitions = build.split_definitions((ROOT / 'src' / (module + '.cas')).read_text())
            for item in definitions:
                tokens = build.lex(item['definition'])
                empty_count = sum(a.text == '[' and b.text == ']' for a, b in zip(tokens, tokens[1:]))
                self.assertEqual(empty_count, 1 if item['name'] == 'xsinitok' else 0, item['name'])
        probe = 'xsinitok(xsarg):=BEGIN LOCAL xslist;xslist:=[];RETURN string(append(xslist,17))=="[17]";END'
        self.assertEqual(decode_inline_command(build.wrap_definition(probe)), probe)
        for invalid in (probe.replace('xslist:=[];', 'xslist:=mid([0],1,0);'), probe.replace('RETURN string', 'xslist:=[];RETURN string')):
            with self.assertRaisesRegex(ValueError, 'exactly one'):
                build.wrap_definition(invalid)

    def test_readiness_guards_preserve_index_priority_and_probe_is_local(self):
        _, commands, _ = build.build(ROOT / 'src')
        definitions = {item['name']: item['definition'] for item in commands}
        public = ['XFAST', 'XREWRITE', 'XRECT', 'XEXP', 'XEXPT', 'XPOW',
                  'XSIN', 'XCOS', 'XSIMP', 'XSCHECK', 'XSDIAG', 'xsucorecheck']
        prompt = 'XSIMP 1.8.7: run XSIMPKIT187 from Program Catalog to refresh CAS functions'
        for name in public:
            definition = definitions[name]
            type_guard = definition.index('type(xsinitok)')
            readiness_call = definition.index('xsinitok(0)')
            self.assertLess(type_guard, readiness_call, name)
            self.assertEqual(definition.count(prompt), 2, name)
            if name in ('XSIMP', 'xsucorecheck'):
                self.assertLess(definition.index('xsuindexok(0)'), type_guard, name)
        probe = definitions['xsinitok']
        self.assertIn('LOCAL xsinitlist;', probe)
        self.assertIn('IFERR', probe)
        self.assertIn('append(xsinitlist,17)', probe)
        self.assertIn('RETURN string(xsinitlist)=="[17]"', probe)
        self.assertNotRegex(probe, r'\b(?:purge|restart|angle_radian|complex_variables|sto|store)\s*\(')

    def test_actual_modules_preserve_every_token_and_numeric_bridge(self):
        ppl, commands, manifest = build.build(ROOT / 'src')
        expected_names = []
        for module in build.MODULES:
            source = (ROOT / 'src' / (module + '.cas')).read_text(encoding='utf-8')
            items = [item for item in commands if item['module'] == module + '.cas']
            rebuilt = ';\n'.join(item['definition'] for item in items) + ';'
            self.assertEqual(build.token_values(rebuilt), build.token_values(source), module)
            expected_names.extend(re.findall(r'^(\w+)\([^\n()]*\):=BEGIN', source, re.M))
            self.assertEqual(manifest['modulehash'][module + '.cas'],
                             build.sha(source.encode('utf-8')))
        self.assertEqual([item['name'] for item in commands], expected_names)
        self.assertEqual(manifest['functions'], len(expected_names))
        self.assertEqual(manifest['sourcehash'], build.sha(ppl.encode('utf-8')))
        self.assertEqual(manifest['compactchar'], sum(len(item['definition']) for item in commands))
        self.assertEqual(manifest['linecount'], len(ppl.splitlines()))
        for item in commands:
            raw = decode_assignment(build.assignment_lines(item['command']))
            self.assertEqual(raw, item['command'])
            self.assertEqual(decode_inline_command(raw), item['definition'])
            self.assertEqual(item['verification_command'], 'type(' + item['name'] + ')==DOM_FUNC')
            self.assertIn('stage:define:' + item['name'], ppl)
            self.assertIn('stage:verify:' + item['name'], ppl)
            self.assertIn('xsis:="type(' + item['name'] + ')==DOM_FUNC";', ppl)
        self.assertTrue(ppl.startswith('EXPORT XSIMPKIT187()\nBEGIN\n  LOCAL xsis,xsik;'))
        self.assertNotRegex(ppl, r'(?im)^\s*#(?:cas|end)\b')
        self.assertLess(ppl.index('\nBEGIN\n'), ppl.index('CAS.expr('))
        self.assertNotRegex(ppl, r'\bCAS\s*\(')
        self.assertEqual(ppl.count('xsis:="of:=1";'), 1)
        self.assertIn('xsis:="([17,23])[1]==17";', ppl)
        self.assertIn('stage:index:set', ppl)
        self.assertIn('stage:index:verify', ppl)
        self.assertNotIn('IF xsik<>1 THEN RETURN "stage:index:set"', ppl)
        self.assertEqual(ppl.count('CAS.expr(xsis)'), 2 * len(commands) + 3)
        self.assertIn('xsis:="XSCHECK(0)";\n  RETURN CAS.expr(xsis);\nEND;', ppl)
        self.assertTrue(all(len(line) <= 270 for line in ppl.splitlines()))
        self.assertLess(ppl.rindex('stage:define:'), ppl.index('stage:verify:'))
        self.assertLess(ppl.rindex('stage:verify:'), ppl.index('xsis:="XSCHECK(0)";'))
        native = next(item['definition'] for item in commands if item['name'] == 'xspnative')
        self.assertIn('xspch==char(92)', native)
        self.assertIn('xspch==char(34)', native)

    def test_cli_outputs_are_utf8_and_reproducible(self):
        with tempfile.TemporaryDirectory() as temp, contextlib.redirect_stdout(io.StringIO()):
            args = ['--source-dir', str(ROOT / 'src'), '--output-dir', temp]
            self.assertEqual(build.main(args), 0)
            first = {p.name: p.read_bytes() for p in Path(temp).iterdir()}
            self.assertEqual(build.main(args), 0)
            self.assertEqual(first, {p.name: p.read_bytes() for p in Path(temp).iterdir()})
            self.assertEqual(set(first), {'XSIMPKIT187.ppl', 'installer_commands.json',
                                          'INSTALLER_MANIFEST.json'})
            manifest = json.loads(first['INSTALLER_MANIFEST.json'])
            self.assertEqual(manifest['sourcehash'], build.sha(first['XSIMPKIT187.ppl']))
            self.assertNotIn(b'\r', first['XSIMPKIT187.ppl'])
            self.assertFalse(first['XSIMPKIT187.ppl'].startswith(b'\xef\xbb\xbf'))

    def test_cli_rejects_source_or_frozen_output_directories(self):
        for folder in ('src', 'tools', 'native', 'baseline', 'baseline/v1.7'):
            with self.subTest(folder=folder), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as result:
                    build.main(['--output-dir', str(ROOT / folder)])
                self.assertEqual(result.exception.code, 2)


if __name__ == '__main__':
    unittest.main()

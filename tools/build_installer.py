"""Build an ordinary PPL installer; never evaluate or alter CAS mathematics.

Every CAS definition is installed inside XSIMPKIT187(), with a numeric wrapper
so a DOM_FUNC value never crosses the CAS/Home return bridge. Native packaging
and execution are separate steps; use tools/build_native.py on the generated PPL.
"""
from dataclasses import dataclass
from pathlib import Path
import argparse
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
MODULES = ('scalar', 'matrix', 'presentation', 'posthoc', 'unified')
INSTALLER_NAME = 'XSIMPKIT187'
CHUNK_LIMIT = 120
LINE_LIMIT = 270
MAX_SOURCE_CHARS = 300_000
MAX_FUNCTION_CHARS = 50_000
OPERATORS = (':=', '<=', '>=', '<>', '!=', '==', '..', '&&', '||',
             '->', '**', '::')
BLOCK_OPENERS = {'BEGIN', 'IF', 'IFERR', 'FOR', 'WHILE', 'CASE'}


@dataclass(frozen=True)
class Token:
    kind: str
    text: str
    start: int
    end: int


def sha(data):
    return hashlib.sha256(data).hexdigest()


def identifier_start(char):
    return char == '_' or char.isalpha()


def identifier_part(char):
    return char == '_' or char.isalnum()


def lex(source):
    """Return exact non-comment tokens; quoted strings are opaque lexemes.

    Token offsets retain the original newlines, including those inside comments.
    Unknown punctuation remains an individual token instead of being rewritten.
    """
    if len(source) > MAX_SOURCE_CHARS:
        raise ValueError('source exceeds character limit')
    if '\0' in source or '\r' in source or source.startswith('\ufeff'):
        raise ValueError('source must be NUL-free UTF-8 without BOM and use LF')
    tokens = []
    i = 0
    while i < len(source):
        char = source[i]
        if char.isspace():
            i += 1
            continue
        if source.startswith('//', i):
            end = source.find('\n', i + 2)
            i = len(source) if end < 0 else end
            continue
        if source.startswith('/*', i):
            end = source.find('*/', i + 2)
            if end < 0:
                raise ValueError('unterminated block comment')
            i = end + 2
            continue
        start = i
        if char == '"':
            i += 1
            while i < len(source):
                if source[i] == '\\':
                    i += 2
                    continue
                if source[i] == '"':
                    i += 1
                    break
                i += 1
            else:
                raise ValueError('unterminated string literal')
            if i > len(source):
                raise ValueError('unterminated string escape')
            kind = 'string'
        elif identifier_start(char):
            i += 1
            while i < len(source) and identifier_part(source[i]):
                i += 1
            kind = 'identifier'
        elif char.isdigit() or (char == '.' and i + 1 < len(source)
                                and source[i + 1].isdigit()):
            i += 1
            while i < len(source) and source[i].isdigit():
                i += 1
            if i < len(source) and source[i] == '.' and not source.startswith('..', i):
                i += 1
                while i < len(source) and source[i].isdigit():
                    i += 1
            if i < len(source) and source[i] in 'eE':
                exponent = i + 1
                if exponent < len(source) and source[exponent] in '+-':
                    exponent += 1
                end = exponent
                while end < len(source) and source[end].isdigit():
                    end += 1
                if end > exponent:
                    i = end
            kind = 'number'
        else:
            operator = next((op for op in OPERATORS if source.startswith(op, i)), char)
            i += len(operator)
            kind = 'operator'
        tokens.append(Token(kind, source[start:i], start, i))
    return tokens


def token_values(source):
    return [(token.kind, token.text) for token in lex(source)]


def needs_space(context, fragments, right):
    # Numeric exponent notation can merge across four lexemes (1 e + 2), so a
    # two-token boundary check alone is insufficient. Preserve the actual
    # spacing of the last four tokens while testing the next boundary.
    try:
        joined = token_values(''.join(fragments) + right.text)
    except ValueError:
        return True
    return joined != [(token.kind, token.text) for token in context + [right]]


def compact(source):
    """Remove comments and redundant horizontal space, preserving every LF.

    A lexical round trip is mandatory. Line boundaries are retained because
    Prime's parser can treat escaped-string definitions differently when flat.
    """
    tokens = lex(source)
    output = []
    context, fragments = [], []
    end = 0
    for token in tokens:
        gap = source[end:token.start]
        newlines = gap.count('\n')
        if newlines:
            output.append('\n' * newlines)
            context, fragments = [], []
        # Retain one separator where the original text had whitespace/comment.
        # In particular avoid depending on a firmware lexer accepting 0AND or
        # 1TO merely because this conservative scanner sees separate tokens.
        separator = ' ' if context and (gap or needs_space(context, fragments, token)) else ''
        output.append(separator)
        output.append(token.text)
        context.append(token)
        fragments.append(separator + token.text)
        context, fragments = context[-4:], fragments[-4:]
        end = token.end
    output.append('\n' * source[end:].count('\n'))
    result = ''.join(output)
    if token_values(result) != [(token.kind, token.text) for token in tokens]:
        raise ValueError('compaction changed CAS token sequence')
    if result.count('\n') != source.count('\n'):
        raise ValueError('compaction changed source line boundaries')
    return result


def split_definitions(source):
    """Accept only top-level fn(args):=BEGIN ... END; declarations.

    The final semicolon is removed for expression wrapping; all body tokens and
    newlines remain intact. Top-level initialization or trailing text is rejected.
    """
    clean = compact(source)
    tokens = lex(clean)
    definitions = []
    seen = set()
    i = 0
    while i < len(tokens):
        start = i
        if tokens[i].kind != 'identifier':
            raise ValueError('expected top-level function name')
        name = tokens[i].text
        if name in seen:
            raise ValueError('duplicate function: ' + name)
        i += 1
        if i >= len(tokens) or tokens[i].text != '(':
            raise ValueError('expected function parameter list: ' + name)
        i += 1
        expect_parameter = True
        while i < len(tokens) and tokens[i].text != ')':
            if expect_parameter:
                if tokens[i].kind != 'identifier':
                    raise ValueError('invalid function parameter: ' + name)
            elif tokens[i].text != ',':
                raise ValueError('invalid parameter separator: ' + name)
            expect_parameter = not expect_parameter
            i += 1
        if i >= len(tokens) or (expect_parameter and tokens[i - 1].text == ','):
            raise ValueError('unterminated function parameters: ' + name)
        i += 1
        if i + 1 >= len(tokens) or tokens[i].text != ':=' or tokens[i + 1].text != 'BEGIN':
            raise ValueError('expected :=BEGIN: ' + name)
        i += 2
        depth = 1
        brackets = []
        while i < len(tokens) and depth:
            token = tokens[i]
            if token.kind == 'identifier':
                keyword = token.text.upper()
                if keyword in BLOCK_OPENERS:
                    depth += 1
                elif keyword == 'END':
                    depth -= 1
            elif token.kind == 'operator':
                if token.text in ('(', '[', '{'):
                    brackets.append(token.text)
                elif token.text in (')', ']', '}'):
                    opener = {')': '(', ']': '[', '}': '{'}[token.text]
                    if not brackets or brackets.pop() != opener:
                        raise ValueError('unbalanced brackets: ' + name)
            i += 1
        if depth or brackets:
            raise ValueError('unterminated function body: ' + name)
        if i >= len(tokens) or tokens[i].text != ';':
            raise ValueError('missing final function semicolon: ' + name)
        definition = clean[tokens[start].start:tokens[i - 1].end]
        if len(definition) > MAX_FUNCTION_CHARS:
            raise ValueError('function exceeds character limit: ' + name)
        definitions.append({'name': name, 'definition': definition})
        seen.add(name)
        i += 1
    if not definitions:
        raise ValueError('no CAS functions found')
    return definitions


def ppl_escape(raw):
    """Encode PPL literal contents, distinguishing LF from literal backslash-n."""
    mapping = {'\\': '\\\\', '"': '""', '\n': '\\n'}
    if '\r' in raw or '\0' in raw:
        raise ValueError('unsupported PPL literal control character')
    return ''.join(mapping.get(char, char) for char in raw)


def ppl_unescape(encoded):
    """Strict inverse for generated literal contents, used by round-trip checks."""
    output = []
    i = 0
    while i < len(encoded):
        char = encoded[i]
        if char == '"':
            if encoded[i:i + 2] != '""':
                raise ValueError('unpaired PPL quote')
            output.append('"')
            i += 2
        elif char == '\\':
            if i + 1 >= len(encoded) or encoded[i + 1] not in ('\\', 'n'):
                raise ValueError('invalid generated PPL escape')
            output.append('\\' if encoded[i + 1] == '\\' else '\n')
            i += 2
        else:
            if char in '\n\r\0':
                raise ValueError('raw line/control character inside PPL literal')
            output.append(char)
            i += 1
    return ''.join(output)


def wrap_definition(definition):
    # Keep the function definition directly inside type. Nested expr parsing
    # can return DOM_FUNC without globally registering the definition on Prime.
    # Final per-name verification checks the installed namespace separately.
    tokens = lex(definition)
    if not tokens or tokens[0].kind != 'identifier' or tokens[-1].text != 'END':
        raise ValueError('expected function definition without final semicolon')
    empty_count = sum(left.kind == right.kind == 'operator' and left.text == '[' and right.text == ']'
                      for left, right in zip(tokens, tokens[1:]))
    # The readiness probe deliberately exercises one saved empty-list literal.
    # All mathematical definitions must retain runtime-created empty lists.
    if tokens[0].text == 'xsinitok' and empty_count != 1:
        raise ValueError('xsinitok requires exactly one readiness-probe empty list')
    if empty_count and not (tokens[0].text == 'xsinitok' and empty_count == 1):
        raise ValueError('bare empty list literal is unsafe in a saved CAS definition')
    return '(type((' + definition + '))==DOM_FUNC)'


def assignment_lines(command):
    # Cut raw CAS text first, so escaped quotes/backslashes are never split.
    chunks = [command[i:i + CHUNK_LIMIT] for i in range(0, len(command), CHUNK_LIMIT)]
    if not chunks:
        raise ValueError('empty installer command')
    encoded = [ppl_escape(chunk) for chunk in chunks]
    if ''.join(ppl_unescape(chunk) for chunk in encoded) != command:
        raise ValueError('PPL command encoding failed round trip')
    lines = []
    for i, value in enumerate(encoded):
        prefix = '  xsis:=' if i == 0 else '    '
        lines.append(prefix + '"' + value + '"' + ('+' if i + 1 < len(encoded) else ';'))
    if any(len(line) > LINE_LIMIT for line in lines):
        raise ValueError('generated PPL line exceeds limit')
    return lines


def build(source_dir):
    commands = []
    module_hashes = {}
    names = set()
    for module in MODULES:
        path = Path(source_dir) / (module + '.cas')
        raw = path.read_bytes()
        text = raw.decode('utf-8')
        module_hashes[path.name] = sha(raw)
        for item in split_definitions(text):
            if item['name'] in names:
                raise ValueError('duplicate function across modules: ' + item['name'])
            command = wrap_definition(item['definition'])
            verification = 'type(' + item['name'] + ')==DOM_FUNC'
            commands.append(dict(item, module=path.name, command=command,
                                 command_sha256=sha(command.encode('utf-8')),
                                 verification_command=verification))
            names.add(item['name'])
    if 'XSCHECK' not in names:
        raise ValueError('XSCHECK is required for installer self-check')
    lines = ['EXPORT ' + INSTALLER_NAME + '()', 'BEGIN', '  LOCAL xsis,xsik;',
             '  xsis:="of:=1";',
             '  IFERR', '    xsik:=CAS.expr(xsis);', '  THEN',
             '    RETURN "stage:index:set";', '  END;',
             # The setter may return a string through this bridge. Verify the
             # actual indexing semantics independently instead of its display.
             '  xsis:="([17,23])[1]==17";',
             '  IFERR', '    xsik:=CAS.expr(xsis);', '  THEN',
             '    RETURN "stage:index:verify";', '  END;',
             '  IF xsik<>1 THEN RETURN "stage:index:verify"; END;']
    for item in commands:
        lines.extend(assignment_lines(item['command']))
        message = 'stage:define:' + item['name']
        lines.extend(['  IFERR', '    xsik:=CAS.expr(xsis);', '  THEN',
                      '    RETURN "' + ppl_escape(message) + '";', '  END;',
                      '  IF xsik<>1 THEN RETURN "' + ppl_escape(message) + '"; END;'])
    # Recheck the entire namespace only after every definition is installed.
    # A later declaration must not silently remove a name installed earlier.
    for item in commands:
        lines.extend(assignment_lines(item['verification_command']))
        message = 'stage:verify:' + item['name']
        lines.extend(['  IFERR', '    xsik:=CAS.expr(xsis);', '  THEN',
                      '    RETURN "' + ppl_escape(message) + '";', '  END;',
                      '  IF xsik<>1 THEN RETURN "' + ppl_escape(message) + '"; END;'])
    lines.extend(['  xsis:="XSCHECK(0)";', '  RETURN CAS.expr(xsis);', 'END;', ''])
    if any(len(line) > LINE_LIMIT for line in lines):
        raise ValueError('generated PPL line exceeds limit')
    ppl = '\n'.join(lines)
    if re.search(r'^\s*#(?:cas|end)\b', ppl, re.I | re.M):
        raise ValueError('installer contains a forbidden CAS block')
    manifest = {
        'schema_version': 1,
        'installer_name': INSTALLER_NAME,
        'functions': len(commands),
        'function_names': [item['name'] for item in commands],
        'modulehash': module_hashes,
        'sourcehash': sha(ppl.encode('utf-8')),
        'compactchar': sum(len(item['definition']) for item in commands),
        'linecount': len(ppl.splitlines()),
        'chunk_limit': CHUNK_LIMIT,
        'line_limit': LINE_LIMIT,
        'wrapper': '(type((definition-without-final-semicolon))==DOM_FUNC)',
        'registration_verification': 'per definition result and complete second pass',
        'bridge': 'CAS.expr(PPL local string)',
        'index_setter': 'of:=1',
        'index_verification': '([17,23])[1]==17',
        'native_validation': 'not_executed',
    }
    return ppl, commands, manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=ROOT / 'src')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'dist/v1.8.7-installer')
    args = parser.parse_args(argv)
    output = args.output_dir.resolve()
    for protected in (ROOT / 'src', ROOT / 'native', ROOT / 'baseline', ROOT / 'tools'):
        if output == protected or protected in output.parents:
            parser.error('installer output must not overwrite source, tools or frozen artifacts')
    ppl, commands, manifest = build(args.source_dir)
    output.mkdir(parents=True, exist_ok=True)
    (output / (INSTALLER_NAME + '.ppl')).write_bytes(ppl.encode('utf-8'))
    (output / 'installer_commands.json').write_text(
        json.dumps(commands, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (output / 'INSTALLER_MANIFEST.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Built ordinary PPL installer: ' + str(output))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

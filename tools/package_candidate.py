"""Create a curated, reproducible XSIMPKIT 1.8.7 candidate archive.

The builder never executes CAS code or changes validation results. Evidence is
included only when explicitly selected with --evidence SOURCE=ARCHIVE_PATH.
"""
from pathlib import Path, PurePosixPath
import argparse
import datetime
import hashlib
import json
import tempfile
import zipfile


ROOT = Path(__file__).resolve().parents[1]
VERSION = '1.8.7'
INSTALLER = 'XSIMPKIT187'
MODULES = ('scalar', 'matrix', 'presentation', 'posthoc', 'unified')
BUILD_DIR = Path('dist/v1.8.7-installer')
FILES = (
    'README.md', 'RELEASE_NOTES.md', 'CHANGELOG.md',
    'docs/API.md', 'docs/TESTING.md', 'docs/README.zh-CN.md',
    'docs/DEVELOPMENT.md',
    'docs/INSTALL.zh-CN.md', 'docs/VALIDATION.md',
    'docs/EXPRESSION_TREES.zh-CN.md',
    'tools/build_installer.py', 'tools/build_native.py',
    'tools/package_candidate.py', 'tools/run_regression187.py', 'tools/templates/code.hpprgm',
    'tools/templates/README.md', 'tools/templates/LICENSE',
    'tests/test_installer.py', 'tests/performance_runtime.cjs',
    'tests/imaginary_alias_runtime.cjs',
    'tests/imaginary_flags_probe.cjs',
    'tests/held_marker_runtime.cjs', 'tests/held_literal_semantics.cjs',
    'tests/runtime_loader.cjs', 'tests/hyperbolic_angle_modes.cjs',
    'tests/hyperbolic_final_holes.cjs', 'tests/hyperbolic_pairs_runtime.cjs',
    'tests/hyperbolic_public_runtime.cjs', 'tests/index_guard_runtime.cjs',
    'tests/weighted_exponential_runtime.cjs', 'tests/new_identities_runtime.cjs', 'tests/partial_factor_runtime.cjs', 'candidates/partial187.cas', 'candidates/partial_walk187.cas', 'tools/benchmark.cjs',
    'tools/benchmark_cases.cjs', 'candidates/user-exp-result.cas',
    'candidates/perf181-baseline/scalar.cas',
    'candidates/perf181-baseline/matrix.cas',
    'candidates/perf181-baseline/presentation.cas',
    'candidates/perf181-baseline/posthoc.cas',
    'candidates/perf181-baseline/unified.cas',
    'candidates/imag182-baseline/scalar.cas',
    'candidates/imag182-baseline/matrix.cas',
    'candidates/imag182-baseline/presentation.cas',
    'candidates/imag182-baseline/posthoc.cas',
    'candidates/imag182-baseline/unified.cas',
)
BUILD_FILES = (
    INSTALLER + '.ppl', INSTALLER + '.hpprgm', INSTALLER + '.format.json',
    'installer_commands.json', 'INSTALLER_MANIFEST.json',
)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def allowed_path(text):
    path = PurePosixPath(text)
    if path.is_absolute() or not path.parts or any(part in ('..', '.') for part in path.parts):
        raise ValueError('archive path must be a normal relative POSIX path')
    if any(part.startswith('.') or part == '__pycache__' for part in path.parts):
        raise ValueError('hidden/cache archive paths are excluded')
    if path.suffix.lower() in ('.txt', '.pyc', '.zip'):
        raise ValueError('TXT, cache and nested ZIP files are excluded')
    return path


def evidence_reference(value):
    source, separator, relative = value.partition('=')
    if not separator:
        raise argparse.ArgumentTypeError('use SOURCE=ARCHIVE_PATH')
    try:
        archive = allowed_path(relative)
    except ValueError as error:
        raise argparse.ArgumentTypeError(str(error)) from error
    if archive.parts[0] != 'validation':
        raise argparse.ArgumentTypeError('evidence must be placed below validation/')
    source = Path(source).absolute()
    if source.is_symlink():
        raise argparse.ArgumentTypeError('evidence source cannot be a symlink')
    return source.resolve(), archive


def selected_evidence(value):
    source, archive = evidence_reference(value)
    if not source.is_file():
        raise argparse.ArgumentTypeError('evidence source must be an existing regular file')
    return source, archive


def selected_evidence_dir(value):
    source, archive = evidence_reference(value)
    if not source.is_dir():
        raise argparse.ArgumentTypeError('evidence source must be an existing directory')
    return source, archive


def expand_evidence(files, directories):
    selected = list(files)
    for source, destination in directories:
        for path in sorted(source.rglob('*')):
            relative = path.relative_to(source)
            if any(part.startswith('.') or part == '__pycache__' for part in relative.parts):
                continue
            if path.is_symlink():
                raise ValueError('symlink excluded from evidence directory: ' + str(path))
            if not path.is_file() or path.suffix.lower() in ('.txt', '.pyc', '.zip'):
                continue
            archive = allowed_path((destination / relative.as_posix()).as_posix())
            selected.append((path, archive))
    return selected


def read_files(evidence):
    files = {}

    def add(source, relative):
        relative = allowed_path(str(relative)).as_posix()
        if relative in files:
            raise ValueError('duplicate archive member: ' + relative)
        if not source.is_file() or source.is_symlink():
            raise ValueError('missing regular input: ' + str(source))
        files[relative] = source.read_bytes()

    for name in FILES:
        add(ROOT / name, name)
    for name in MODULES:
        add(ROOT / 'src' / (name + '.cas'), 'src/' + name + '.cas')
    for name in BUILD_FILES:
        add(ROOT / BUILD_DIR / name, BUILD_DIR / name)
    for source, relative in evidence:
        add(source, relative)
    return files


def validate_build(files):
    base = BUILD_DIR.as_posix() + '/'
    manifest = json.loads(files[base + 'INSTALLER_MANIFEST.json'])
    format_record = json.loads(files[base + INSTALLER + '.format.json'])
    ppl = files[base + INSTALLER + '.ppl']
    native = files[base + INSTALLER + '.hpprgm']
    if manifest['functions'] != len(manifest['function_names']) or len(set(manifest['function_names'])) != manifest['functions']:
        raise ValueError('installer function list is inconsistent')
    if manifest['sourcehash'] != sha(ppl):
        raise ValueError('PPL does not match installer manifest')
    if not ppl.startswith(('EXPORT ' + INSTALLER + '()\n').encode()):
        raise ValueError('unexpected installer entry point')
    for name in MODULES:
        filename = name + '.cas'
        if manifest['modulehash'][filename] != sha(files['src/' + filename]):
            raise ValueError('installer does not match source: ' + filename)
    if format_record['source_sha256'] != sha(ppl) or format_record['hpprgm_sha256'] != sha(native):
        raise ValueError('native container does not match format record')
    # Evidence that identifies this native source must match the packaged pair;
    # Prior-version validation is never promoted to current evidence.
    for name, data in files.items():
        if name.startswith('validation/') and name.endswith('.json'):
            record = json.loads(data)
            if isinstance(record, dict) and name.endswith('NATIVE_VALIDATION.json'):
                if record.get('source_sha256') != sha(ppl) or record.get('hpprgm_sha256') != sha(native):
                    raise ValueError('native validation belongs to another artifact')
    return manifest, sha(ppl), sha(native)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--date', default='20261027', help='YYYYMMDD package date')
    parser.add_argument('--output-parent', type=Path, default=ROOT.parent)
    parser.add_argument('--evidence', action='append', default=[], type=selected_evidence,
                        metavar='SOURCE=validation/PATH')
    parser.add_argument('--evidence-dir', action='append', default=[], type=selected_evidence_dir,
                        metavar='SOURCE_DIR=validation/SUBDIR',
                        help='explicitly select a curated current-version evidence directory')
    args = parser.parse_args(argv)
    date = datetime.datetime.strptime(args.date, '%Y%m%d')
    package_name = 'XSIMPKIT_' + VERSION + '_candidate_' + args.date
    output_parent = args.output_parent.resolve()
    target = output_parent / package_name
    archive_path = output_parent / (package_name + '.zip')
    if target.exists() or archive_path.exists():
        parser.error('output already exists; select a fresh output parent')
    evidence = expand_evidence(args.evidence, args.evidence_dir)
    files = read_files(evidence)
    installer_manifest, ppl_sha, native_sha = validate_build(files)
    members = [
        {'path': name, 'bytes': len(data), 'sha256': sha(data)}
        for name, data in sorted(files.items())
    ]
    package_manifest = {
        'version': VERSION,
        'status': 'candidate; validation scope is defined by the selected evidence',
        'g2_execution': 'not_tested',
        'functions': installer_manifest['functions'],
        'native_sha256': native_sha,
        'ppl_sha256': ppl_sha,
        'archive_members_excluding_this_manifest': members,
        'evidence_selection': [relative.as_posix() for _, relative in evidence],
        'standalone_native_copy': INSTALLER + '.hpprgm (excluded from ZIP duplicate)',
    }
    files['PACKAGE_MANIFEST.json'] = (json.dumps(package_manifest, ensure_ascii=False, indent=2) + '\n').encode()
    output_parent.mkdir(parents=True, exist_ok=True)
    # Stage the entire result before exposing either final path. Existing files
    # are never removed or overwritten by this script.
    with tempfile.TemporaryDirectory(prefix='.xsimpkit-package-', dir=output_parent) as temporary:
        staging = Path(temporary)
        tree = staging / package_name
        tree.mkdir()
        for name, data in sorted(files.items()):
            path = tree / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        standalone = tree / (INSTALLER + '.hpprgm')
        standalone.write_bytes(files[BUILD_DIR.as_posix() + '/' + INSTALLER + '.hpprgm'])
        staged_zip = staging / archive_path.name
        with zipfile.ZipFile(staged_zip, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, data in sorted(files.items()):
                info = zipfile.ZipInfo(package_name + '/' + name, (date.year, date.month, date.day, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                info.create_system = 3
                archive.writestr(info, data, compresslevel=9)
        with zipfile.ZipFile(staged_zip) as archive:
            if archive.testzip() is not None:
                raise ValueError('archive CRC validation failed')
            for name, data in files.items():
                if archive.read(package_name + '/' + name) != data:
                    raise ValueError('archive readback differs: ' + name)
        tree.rename(target)
        staged_zip.rename(archive_path)
    print(json.dumps({
        'directory': str(target), 'archive': str(archive_path),
        'archive_bytes': archive_path.stat().st_size,
        'archive_sha256': sha(archive_path.read_bytes()),
        'native_sha256': native_sha, 'ppl_sha256': ppl_sha,
        'archive_members': len(files),
    }, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

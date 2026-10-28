"""Package a local .hpprgm candidate using the pinned source-only container.

No compiler, emulator, calculator, or installation is invoked. Container validation
does not establish Prime source compatibility. See tools/templates/README.md.
"""
from pathlib import Path
import argparse
import hashlib
import json
import struct

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / 'tools' / 'templates' / 'code.hpprgm'
TEMPLATE_SHA = '3c8386b6d315b7d1155c68100b3346abd5946392ab64c97f0fa9bbf09cf87a7c'
BASELINE_SHA = '85bb0141f2d5a6e70f9540f81bbd6159a5763c57294b38fc2cbf1b9829b58aff'
MAGIC = bytes.fromhex('7c618ab2feffffff00000000')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def u32(data, pos):
    return struct.unpack_from('<I', data, pos)[0]

def inspect(data):
    """Read only the two measured layouts, rejecting truncated/malformed data."""
    if len(data) < 152 or data[:12] != MAGIC:
        raise ValueError('not a supported HP Prime container')
    if u32(data, 148) == 0x00C0009B:
        start, lengths = 152, (48, 56, 144)
        if (u32(data, 52), u32(data, 60), u32(data, 64), u32(data, 132),
                u32(data, 136)) != (0x014000BE, 68, 0x0040008B, 8, 0x00800085):
            raise ValueError('unexpected source-only container structure')
    elif len(data) >= 248 and u32(data, 244) == 0x00C0009B:
        start, lengths = 248, (144, 152, 240)
        if sha(data) != BASELINE_SHA:
            raise ValueError('only the pinned compiled v1.7 container may be inspected')
    else:
        raise ValueError('unknown source record; refusing to guess its location')
    end = start - 4 + u32(data, start - 8)
    if end > len(data) or end < start + 2 or (end - start) % 2:
        raise ValueError('source record is incomplete or has an invalid length')
    if any(pos + 4 + u32(data, pos) != end for pos in lengths):
        raise ValueError('enclosing lengths disagree with the source record')
    if data[end - 2:end] != b'\0\0':
        raise ValueError('missing UTF-16 source terminator')
    source = data[start:end - 2].decode('utf-16le')
    if '\0' in source:
        raise ValueError('embedded NUL in program source')
    return {'source': source, 'start': start, 'end': end, 'lengths': lengths,
            'compiled': start != 152, 'trailer': data[end:]}

def replace_source(template, source):
    info = inspect(template)
    if '\0' in source:
        raise ValueError('embedded NUL in new source')
    if info['compiled'] and source != info['source']:
        raise ValueError('compiled template cannot be used for changed source')
    payload = source.encode('utf-16le') + b'\0\0'
    delta = len(payload) - (info['end'] - info['start'])
    result = bytearray(template[:info['start']] + payload + info['trailer'])
    for pos in info['lengths']:
        struct.pack_into('<I', result, pos, u32(template, pos) + delta)
    result = bytes(result)
    check = inspect(result)
    if check['source'] != source or check['trailer'] != info['trailer']:
        raise ValueError('packaged source or trailer differs on readback')
    return result

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'dist/v1.8.7-installer/XSIMPKIT187.ppl')
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/v1.8.7-installer/XSIMPKIT187.hpprgm')
    args = parser.parse_args(argv)
    output = args.output.resolve()
    if output.suffix.lower() != '.hpprgm' or output == args.source.resolve():
        parser.error('output must be a separate .hpprgm file')
    for protected in (ROOT / 'native', ROOT / 'baseline', ROOT / 'tools/templates'):
        if output == protected or protected in output.parents:
            parser.error('output must not overwrite a release, baseline or template')
    template = TEMPLATE.read_bytes()
    if sha(template) != TEMPLATE_SHA:
        parser.error('source-only template checksum mismatch')
    source = args.source.read_bytes().decode('utf-8')
    if '\r' in source or source.startswith('\ufeff'):
        parser.error('source must be UTF-8 without BOM and use LF line endings')
    result = replace_source(template, source)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(result)
    saved = output.read_bytes()
    if saved != result or inspect(saved)['source'] != source:
        raise ValueError('saved native file differs from the verified container')
    manifest = {
        'status': 'experimental_local_candidate',
        'source_sha256': sha(source.encode('utf-8')),
        'hpprgm_sha256': sha(result),
        'template_sha256': TEMPLATE_SHA,
        'template_blob': 'b73bf5ca9a084c8043d62ad5eb79f3de6ced80a6',
        'template_source': 'https://github.com/JordiRigau/hp-prime-kit',
        'template_license': 'MIT; see tools/templates/LICENSE',
        'source_offset': 152,
        'source_bytes_utf16le': len(source.encode('utf-16le')),
        'compiled_cache': 'absent',
        'container_readback': 'passed',
        'prime_compile': 'not_executed',
        'prime_native_import': 'not_executed',
        'g2_execution': 'not_executed',
    }
    output.with_suffix('.format.json').write_text(
        json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('Packaged experimental native candidate: ' + str(output))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

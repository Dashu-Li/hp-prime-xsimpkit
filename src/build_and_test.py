"""Build HP source and a desktop Giac test copy (only indexing is adapted)."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
parts = [ROOT / (s + '.cas') for s in ['scalar', 'matrix', 'presentation', 'posthoc', 'unified']]
source = '\n\n'.join(p.read_text() for p in parts)
(ROOT / 'XSIMPKIT.txt').write_text(
    '// XSIMPKIT 1.7 - exact complex radicals and guarded simplification.\n'
    '// Paste the entire file into an ordinary PPL program named XSIMPKIT.\n'
    '// CAS radians / exact / Simplify=None. Entry: XSIMP(expression).\n'
    '#cas\n' + source + '\n#end\n\n'
    'EXPORT XSIMPKIT()\nBEGIN\n  RETURN "CAS: XSIMP(expression); quote(expr) preserves input";\nEND;\n'
)

def zero_index(match):
    terms = match.group(1).split(',')
    ans = []
    for term in terms:
        if '..' in term:
            lo, hi = term.split('..')
            ans.append('(' + lo + '-1)..(' + hi + '-1)')
        else:
            ans.append('(' + term + '-1)')
    return '[' + ','.join(ans) + ']'

# Only brackets attached to an identifier or closing parenthesis are indices;
# bracket literals in matrices and argument lists remain untouched.
desktop = re.sub(r'(?<=[A-Za-z0-9_)])\[([^\[\]\n]+)\]', zero_index, source)
(ROOT / 'XSIMPKIT_desktop.cas').write_text(desktop)
print('Built HP source and mechanically adapted desktop test copy.')

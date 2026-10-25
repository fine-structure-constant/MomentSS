"""Rebuild pinned, complete-character WOFF2 assets. Requires fonttools and brotli.

The editor loads these fonts only when selected. No hard-coded common-character subset.
"""
from pathlib import Path
import json
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'node_modules/.cache/font-tools'))
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

DEST = ROOT / 'public/fonts'
DEST.mkdir(parents=True, exist_ok=True)
CACHE = ROOT / 'node_modules/.cache/font-sources'
CACHE.mkdir(parents=True, exist_ok=True)
SOURCES = [
    ('MomentRounded-v1', 'https://raw.githubusercontent.com/Warren2060/ChillRoundGothic/53505f0818983d2fcdda00dc66e051ad13e81ffb/woff/ChillRoundGothic_Regular.woff', 'https://raw.githubusercontent.com/Warren2060/ChillRoundGothic/53505f0818983d2fcdda00dc66e051ad13e81ffb/License.txt', False),
    ('MomentSans-v1', 'https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf', 'https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/LICENSE', True),
]
manifest = []
for name, url, license_url, variable in SOURCES:
    source = CACHE / (name + ('.ttf' if variable else '.woff'))
    if not source.exists():
        urllib.request.urlretrieve(url, source)
    font = TTFont(source)
    if variable:
        font = instantiateVariableFont(font, {'wght': 400}, inplace=True)
    # These generated derivatives have their own family names; original copyright stays.
    for name_id, value in {1: name, 2: 'Regular', 3: name + '-1.0', 4: name, 6: name.replace('-', ''), 16: name, 17: 'Regular'}.items():
        font['name'].setName(value, name_id, 3, 1, 0x409)
    font.flavor = 'woff2'
    font.save(DEST / (name + '.woff2'))
    license_text = urllib.request.urlopen(license_url).read()
    (DEST / (name + '-LICENSE.txt')).write_bytes(license_text)
    manifest.append({'family': name, 'source': url, 'license': name + '-LICENSE.txt', 'characters': len(font.getBestCmap()), 'bytes': (DEST / (name + '.woff2')).stat().st_size, 'weight': 400})
    print(json.dumps(manifest[-1]), flush=True)
(DEST / 'sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

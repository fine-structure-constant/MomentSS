"""Download pinned official artwork for the built-in picker, with source/license records."""
import concurrent.futures, json, re, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'node_modules/.cache/emoji'; CACHE.mkdir(parents=True, exist_ok=True)
DEST = ROOT / 'public/emoji'; DEST.mkdir(exist_ok=True)
def read(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'MomentSS-artwork-build'})
    for attempt in range(3):
        try: return urllib.request.urlopen(request, timeout=40).read()
        except Exception:
            if attempt == 2: raise
def cached(name, url):
    path = CACHE / name
    if not path.exists(): path.write_bytes(read(url))
    return path.read_bytes()
tw = 'v17.0.3'
fluent = '1ffb34c752ecf5d402f04cfb4b392c77f57c54bc'
tree = json.loads(cached(f'fluent-tree-{fluent}.json', f'https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/{fluent}?recursive=1'))['tree']
paths = [entry['path'] for entry in tree if '/Color/' in entry['path'] and entry['path'].endswith('.svg')]
normalize = lambda s: re.sub(r'[^a-z0-9]', '', s.lower().replace('&', 'and'))
by_name = {normalize(path.split('/')[1]): path for path in paths if '/Default/' not in path and '/Light/' not in path}
names = {}
for line in cached('emoji-test.txt', 'https://unicode.org/Public/emoji/16.0/emoji-test.txt').decode().splitlines():
    match = re.match(r'^([0-9A-F ]+)\s*; fully-qualified\s*#\s*\S+\s+E[\d.]+\s+(.+)$',line)
    if match: names[''.join(chr(int(code,16)) for code in match[1].split())] = match[2]
values = re.findall(r"\['([^']+)',", (ROOT/'src/lib/emoji.ts').read_text(encoding='utf-8'))
values = list(dict.fromkeys(value for value in values if any(ord(c)>0x2000 for c in value)))
manifest = {}
def download(value):
    key = '-'.join(f'{ord(c):x}' for c in value)
    twkey = key if '\u200d' in value else key.replace('-fe0f','')
    entries = {}
    candidates = [('twemoji-v17', f'https://raw.githubusercontent.com/jdecked/twemoji/{tw}/assets/svg/{twkey}.svg')]
    path = by_name.get(normalize(names.get(value,'')))
    if path: candidates.append(('fluent-v1',f'https://raw.githubusercontent.com/microsoft/fluentui-emoji/{fluent}/'+urllib.parse.quote(path)))
    for style, url in candidates:
        folder=DEST/style; folder.mkdir(exist_ok=True); target=folder/(key+'.svg')
        try:
            if not target.exists(): target.write_bytes(read(url))
            entries[style]='/emoji/'+style+'/'+key+'.svg'
        except Exception as error: print('Missing', style,key,type(error).__name__)
    return value, entries
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    manifest = dict(pool.map(download,values))
(ROOT/'src/lib/emojiAssets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for filename,url in [('Twemoji-LICENSE.txt',f'https://raw.githubusercontent.com/jdecked/twemoji/{tw}/LICENSE-GRAPHICS'),('Fluent-LICENSE.txt',f'https://raw.githubusercontent.com/microsoft/fluentui-emoji/{fluent}/LICENSE')]:
    (DEST/filename).write_bytes(read(url))
(DEST/'sources.json').write_text(json.dumps({'twemoji':{'revision':tw,'source':'https://github.com/jdecked/twemoji','license':'CC BY 4.0','attribution':'Twemoji graphics by Twitter and jdecked contributors, unmodified'},'fluent':{'revision':fluent,'source':'https://github.com/microsoft/fluentui-emoji','license':'MIT','attribution':'Microsoft Corporation, unmodified'},'coverage':{style:sum(style in entries for entries in manifest.values()) for style in ['twemoji-v17','fluent-v1']}},indent=2)+'\n')
print('Artwork complete:',len(manifest))

"""Package Vite output and a manifest consumed by the server (Python 3.9+)."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile


def package(dist, output, repository, commit, tag):
    if not (dist / 'index.html').is_file():
        raise ValueError('dist/index.html is missing; build the frontend first')
    output.mkdir(parents=True, exist_ok=True)
    version = {'commit': commit, 'tag': tag}
    (dist / 'version.json').write_text(json.dumps(version) + '\n', encoding='utf-8')
    archive = output / 'momentss.tar.gz'
    with tarfile.open(archive, 'w:gz') as bundle:
        for path in sorted(dist.rglob('*')):
            if path.is_symlink() or not (path.is_dir() or path.is_file()):
                raise ValueError('Only static files and directories can be packaged')
            bundle.add(path, arcname=path.relative_to(dist).as_posix(), recursive=False)
    manifest = {
        'schema': 1, 'repository': repository, 'branch': 'main',
        **version, 'asset': archive.name, 'size': archive.stat().st_size,
        'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    }
    (output / 'deployment.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    (output / 'notes.md').write_text(
        'Static deployment built from main commit ' + commit + '.\n'
        'The server downloads this release and verifies its SHA-256 before activation.\n',
        encoding='utf-8',
    )
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository', required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--dist', type=Path, default=Path('dist'))
    parser.add_argument('--output', type=Path, default=Path('release'))
    args = parser.parse_args()
    package(args.dist, args.output, args.repository, args.commit, args.tag)

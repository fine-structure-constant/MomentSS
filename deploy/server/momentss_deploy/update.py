import hashlib
import io
import json
import logging
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tarfile
import tempfile
import time

from .download import archive_url, fetch, latest_manifest

LOG = logging.getLogger(__name__)


def extract_static(data, destination, size_limit):
    """Extract only regular files/directories, without tar ownership or permissions."""
    total = 0
    seen = set()
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as bundle:
        members = bundle.getmembers()
        if len(members) > 10000:
            raise ValueError('Too many archive entries')
        for member in members:
            path = PurePosixPath(member.name)
            if (path.is_absolute() or '..' in path.parts or '\\' in member.name
                    or not path.parts or not (member.isfile() or member.isdir())):
                raise ValueError('Unsafe archive entry: ' + member.name)
            if path in seen:
                raise ValueError('Duplicate archive entry: ' + member.name)
            seen.add(path)
            total += member.size
            if member.size < 0 or total > size_limit:
                raise ValueError('Extracted files exceed configured size limit')
        for member in members:
            target = destination.joinpath(*PurePosixPath(member.name).parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            if member.isdir():
                target.mkdir(exist_ok=True)
            else:
                with bundle.extractfile(member) as source, target.open('xb') as output:
                    shutil.copyfileobj(source, output)
                target.chmod(0o644)
    for path in destination.rglob('*'):
        if path.is_dir():
            path.chmod(0o755)
    destination.chmod(0o755)


def current_release(root):
    current = root / 'current'
    if current.is_symlink():
        target = current.resolve(strict=True)
        if target.parent != (root / 'releases').resolve() or not target.is_dir():
            raise ValueError('current points outside the releases directory')
        return target
    if current.exists():
        raise ValueError('current must be a symlink, not a directory')
    return None


def switch_current(root, release):
    temporary = root / '.current-next'
    if temporary.exists() or temporary.is_symlink():
        temporary.unlink()
    temporary.symlink_to(Path('releases') / release.name, target_is_directory=True)
    os.replace(temporary, root / 'current')


def check_health(config, tag):
    last_error = None
    for attempt in range(3):
        try:
            version = json.loads(fetch(config.health_url, config, 16384, local=True))
            if version.get('tag') != tag:
                raise ValueError('Nginx is not serving the expected release')
            return
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(1)
    raise RuntimeError('Local Nginx health check failed') from last_error


def activate(config, release):
    old = current_release(config.root)
    switch_current(config.root, release)
    try:
        check_health(config, release.name)
    except Exception:
        if old is not None:
            switch_current(config.root, old)
        else:
            (config.root / 'current').unlink()
        raise
    return old


def clean_releases(config, protected):
    releases = config.root / 'releases'
    candidates = sorted(
        (p for p in releases.iterdir() if not p.is_symlink() and p.is_dir()
         and re.fullmatch(r'deploy-[0-9]+-[0-9]+-[0-9a-f]{12}', p.name)),
        key=lambda p: p.stat().st_mtime, reverse=True,
    )
    keep = set(candidates[:config.keep_releases]) | set(protected)
    for path in candidates:
        if path not in keep:
            # Only verified immediate child directories of this application's releases.
            if path.resolve().parent != releases.resolve():
                raise ValueError('Unexpected release directory')
            shutil.rmtree(path)


def update(config):
    manifest = latest_manifest(config)
    current = current_release(config.root)
    if current and current.name == manifest['tag']:
        LOG.info('Already up to date: %s', current.name)
        return False
    releases = config.root / 'releases'
    releases.mkdir(parents=True, exist_ok=True)
    release = releases / manifest['tag']
    if release.is_symlink():
        raise ValueError('Release directory must not be a symlink: ' + str(release))
    archive = fetch(archive_url(config, manifest), config, config.max_archive_bytes)
    if (len(archive) != manifest['size']
            or hashlib.sha256(archive).hexdigest() != manifest['sha256']):
        raise ValueError('Archive size or SHA-256 mismatch; keeping current release')
    with tempfile.TemporaryDirectory(prefix='.staging-', dir=str(releases)) as staging:
        stage = Path(staging)
        extract_static(archive, stage, config.max_extracted_bytes)
        if not (stage / 'index.html').is_file():
            raise ValueError('Release has no index.html')
        version = json.loads((stage / 'version.json').read_text(encoding='utf-8'))
        if version != {'commit': manifest['commit'], 'tag': manifest['tag']}:
            raise ValueError('Packaged version differs from manifest')
        # Recover an interrupted run or re-deploy a version after a manual rollback.
        # Rebuild it from the verified archive instead of trusting partial disk state.
        if release.exists():
            if not release.is_dir() or release.resolve().parent != releases.resolve():
                raise ValueError('Unexpected existing release path')
            shutil.rmtree(release)
        stage.rename(release)
    try:
        old = activate(config, release)
    except Exception:
        # Activation has restored current, so this failed candidate can be retried.
        if current_release(config.root) != release:
            shutil.rmtree(release)
        raise
    LOG.info('Activated %s', release.name)
    try:
        clean_releases(config, [p for p in (old, release) if p])
    except Exception:
        LOG.exception('Deployment succeeded but old-release cleanup failed')
    return True


def rollback(config, tag):
    if not re.fullmatch(r'deploy-[0-9]+-[0-9]+-[0-9a-f]{12}', tag):
        raise ValueError('Invalid rollback release tag')
    release = config.root / 'releases' / tag
    if release.is_symlink() or not release.is_dir() or not (release / 'index.html').is_file():
        raise ValueError('Rollback release is not available locally')
    activate(config, release)
    LOG.info('Rolled back to %s; keep the update timer stopped until ready', tag)

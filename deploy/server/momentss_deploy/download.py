import json
import re
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener


class NoRelease(Exception):
    pass


def fetch(url, config, limit, local=False):
    # Do not inherit shell proxy settings; systemd and interactive use behave alike.
    proxies = {} if local or not config.proxy_url else {
        'https': config.proxy_url, 'http': config.proxy_url,
    }
    request = Request(url, headers={'User-Agent': 'MomentSS-deploy/1', 'Cache-Control': 'no-cache'})
    with build_opener(ProxyHandler(proxies)).open(request, timeout=config.timeout) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Download exceeds configured size limit')
    return data


def validate_manifest(manifest, config):
    if (manifest.get('schema') != 1 or manifest.get('repository') != config.repository
            or manifest.get('branch') != 'main' or manifest.get('asset') != 'momentss.tar.gz'):
        raise ValueError('Manifest is not a main deployment for this repository')
    if not re.fullmatch(r'[0-9a-f]{40}', str(manifest.get('commit', ''))):
        raise ValueError('Invalid commit in manifest')
    tag = manifest.get('tag', '')
    if not re.fullmatch(r'deploy-[0-9]+-[0-9]+-[0-9a-f]{12}', str(tag)):
        raise ValueError('Invalid deployment tag')
    if tag.rsplit('-', 1)[-1] != manifest['commit'][:12]:
        raise ValueError('Tag and commit do not match')
    if not re.fullmatch(r'[0-9a-f]{64}', str(manifest.get('sha256', ''))):
        raise ValueError('Invalid SHA-256 in manifest')
    size = manifest.get('size')
    if type(size) is not int or not 0 < size <= config.max_archive_bytes:
        raise ValueError('Invalid archive size')
    return manifest


def latest_manifest(config):
    url = 'https://github.com/' + config.repository + '/releases/latest/download/deployment.json'
    try:
        data = fetch(url, config, 16384)
    except HTTPError as error:
        if error.code == 404:
            raise NoRelease('No published deployment.json yet') from error
        raise
    return validate_manifest(json.loads(data), config)


def archive_url(config, manifest):
    # A version-specific URL prevents a later release from racing this download.
    return ('https://github.com/' + config.repository + '/releases/download/'
            + manifest['tag'] + '/momentss.tar.gz')

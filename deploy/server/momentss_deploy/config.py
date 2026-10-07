from dataclasses import dataclass
import json
from pathlib import Path
import re
from urllib.parse import urlparse


@dataclass(frozen=True)
class Config:
    repository: str
    root: Path
    health_url: str
    timeout: int = 30
    keep_releases: int = 5
    max_archive_bytes: int = 50 * 1024 * 1024
    max_extracted_bytes: int = 200 * 1024 * 1024
    proxy_url: str = ''

    def __post_init__(self):
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', self.repository):
            raise ValueError('repository must be OWNER/REPO')
        if not self.root.is_absolute() or self.root == Path(self.root.anchor):
            raise ValueError('root must be an absolute application directory')
        health = urlparse(self.health_url)
        if health.scheme != 'http' or health.hostname != '127.0.0.1' or not health.port:
            raise ValueError('health_url must use http://127.0.0.1:PORT/...')
        if min(self.timeout, self.keep_releases, self.max_archive_bytes, self.max_extracted_bytes) <= 0:
            raise ValueError('timeouts, retention and size limits must be positive')
        if self.proxy_url:
            proxy = urlparse(self.proxy_url)
            if proxy.scheme not in ('http', 'https') or not proxy.hostname:
                raise ValueError('proxy_url must be an HTTP(S) proxy URL')


def load_config(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    data['root'] = Path(data['root']).expanduser().resolve()
    return Config(**data)

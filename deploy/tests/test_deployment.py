"""Failure, integrity and recovery checks for the deployment boundary."""
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
sys.path.insert(0, str(DEPLOY / 'server'))
from package_release import package
from momentss_deploy.config import Config, load_config
from momentss_deploy.download import archive_url, validate_manifest
import momentss_deploy.update as update_module
from momentss_deploy.update import activate, extract_static, rollback, update

COMMIT = 'a' * 40
TAG = 'deploy-10-1-' + COMMIT[:12]
OLD_TAG = 'deploy-9-1-' + 'b' * 12


def malicious_archive(name, kind=tarfile.REGTYPE):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz') as bundle:
        entry = tarfile.TarInfo(name)
        entry.type = kind
        if kind == tarfile.SYMTYPE:
            entry.linkname = '/tmp/outside'
        if kind == tarfile.REGTYPE:
            entry.size = 1
            bundle.addfile(entry, io.BytesIO(b'x'))
        else:
            bundle.addfile(entry)
    return output.getvalue()


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'site'
        self.root.mkdir()
        self.config = Config('owner/repo', self.root, 'http://127.0.0.1:18080/version.json')
        dist = self.base / 'dist'
        dist.mkdir()
        (dist / 'index.html').write_text('<html>new</html>', encoding='utf-8')
        (dist / 'assets').mkdir()
        (dist / 'assets' / 'app.js').write_text('console.log(1)', encoding='utf-8')
        self.manifest = package(dist, self.base / 'output', 'owner/repo', COMMIT, TAG)
        self.archive = (self.base / 'output' / 'momentss.tar.gz').read_bytes()
        self.emulate_links = False
        probe = self.base / 'link-probe'
        try:
            probe.symlink_to(dist, target_is_directory=True)
            probe.unlink()
        except OSError:
            # On Windows without symlink privileges, test failure/retry behavior
            # through a small filesystem adapter. CI/server tests use real links.
            self.emulate_links = True
            def read_link(root):
                marker = root / 'current'
                return root / 'releases' / marker.read_text() if marker.exists() else None

            def write_link(root, release):
                (root / 'current').write_text(release.name)

            for operation, implementation in [('current_release', read_link), ('switch_current', write_link)]:
                patched = patch('momentss_deploy.update.' + operation, side_effect=implementation)
                patched.start()
                self.addCleanup(patched.stop)

    def old_release(self):
        release = self.root / 'releases' / OLD_TAG
        release.mkdir(parents=True)
        (release / 'index.html').write_text('<html>old</html>', encoding='utf-8')
        update_module.switch_current(self.root, release)
        return release

    def test_package_roundtrip_and_manifest(self):
        validate_manifest(self.manifest, self.config)
        target = self.base / 'extract'
        target.mkdir()
        extract_static(self.archive, target, self.config.max_extracted_bytes)
        self.assertEqual((target / 'assets' / 'app.js').read_text(), 'console.log(1)')
        self.assertEqual(json.loads((target / 'version.json').read_text())['tag'], TAG)
        self.assertEqual(hashlib.sha256(self.archive).hexdigest(), self.manifest['sha256'])

    def test_archive_url_pins_release_not_latest(self):
        self.assertEqual(archive_url(self.config, self.manifest),
                         'https://github.com/owner/repo/releases/download/' + TAG + '/momentss.tar.gz')

    def test_reject_manifest_for_different_repository_or_branch(self):
        for changes in ({'repository': 'other/repo'}, {'branch': 'feature'}, {'tag': '../escape'},
                        {'commit': 'b' * 40}, {'size': True}, {'sha256': 'invalid'}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate_manifest({**self.manifest, **changes}, self.config)

    def test_reject_traversal_absolute_and_symlink_archives(self):
        for name, kind in [('../outside', tarfile.REGTYPE), ('/outside', tarfile.REGTYPE),
                           ('assets\\outside', tarfile.REGTYPE), ('link', tarfile.SYMTYPE)]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                extract_static(malicious_archive(name, kind), self.root, 1024)
        self.assertFalse((self.base / 'outside').exists())

    def test_reject_extracted_size_over_limit(self):
        with self.assertRaises(ValueError):
            extract_static(self.archive, self.root, 1)

    def test_bad_checksum_preserves_current(self):
        old = self.old_release()
        with patch('momentss_deploy.update.latest_manifest', return_value=self.manifest), \
                patch('momentss_deploy.update.fetch', return_value=b'bad'), self.assertRaises(ValueError):
            update(self.config)
        self.assertEqual(update_module.current_release(self.root), old)
        self.assertFalse((self.root / 'releases' / TAG).exists())

    def test_failed_health_restores_old_version_and_allows_retry(self):
        old = self.old_release()
        with patch('momentss_deploy.update.latest_manifest', return_value=self.manifest), \
                patch('momentss_deploy.update.fetch', return_value=self.archive), \
                patch('momentss_deploy.update.check_health', side_effect=RuntimeError('unavailable')):
            with self.assertRaises(RuntimeError):
                update(self.config)
        self.assertEqual(update_module.current_release(self.root), old)
        self.assertFalse((self.root / 'releases' / TAG).exists())
        with patch('momentss_deploy.update.latest_manifest', return_value=self.manifest), \
                patch('momentss_deploy.update.fetch', return_value=self.archive), \
                patch('momentss_deploy.update.check_health'):
            self.assertTrue(update(self.config))
        self.assertEqual(update_module.current_release(self.root).name, TAG)

    def test_success_recovers_interrupted_release_and_is_idempotent(self):
        self.old_release()
        partial = self.root / 'releases' / TAG
        partial.mkdir()
        (partial / 'broken').write_text('partial')
        with patch('momentss_deploy.update.latest_manifest', return_value=self.manifest), \
                patch('momentss_deploy.update.fetch', return_value=self.archive) as download, \
                patch('momentss_deploy.update.check_health'):
            self.assertTrue(update(self.config))
            self.assertFalse(update(self.config))
            download.assert_called_once()
        self.assertFalse((partial / 'broken').exists())
        self.assertTrue((partial / 'index.html').is_file())

    def test_missing_index_does_not_activate(self):
        old = self.old_release()
        data = malicious_archive('not-index.html')
        manifest = {**self.manifest, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        with patch('momentss_deploy.update.latest_manifest', return_value=manifest), \
                patch('momentss_deploy.update.fetch', return_value=data), self.assertRaises(ValueError):
            update(self.config)
        self.assertEqual(update_module.current_release(self.root), old)

    def test_first_install_failed_health_removes_current(self):
        release = self.root / 'releases' / TAG
        release.mkdir(parents=True)
        with patch('momentss_deploy.update.check_health', side_effect=RuntimeError('unavailable')):
            with self.assertRaises(RuntimeError):
                activate(self.config, release)
        self.assertIsNone(update_module.current_release(self.root))

    def test_native_link_switch_stays_inside_releases(self):
        if self.emulate_links:
            self.skipTest('Native symlink integration runs on Linux CI/server')
        old = self.old_release()
        self.assertTrue((self.root / 'current').is_symlink())
        self.assertEqual(update_module.current_release(self.root), old)
        self.assertFalse((self.root / '.current-next').exists())

    def test_rollback_rejects_paths_outside_releases(self):
        with self.assertRaises(ValueError):
            rollback(self.config, '../outside')

    def test_configuration_load_and_invalid_health_target(self):
        file = self.base / 'config.json'
        file.write_text(json.dumps({'repository': 'owner/repo', 'root': str(self.root),
                                   'health_url': self.config.health_url}), encoding='utf-8')
        self.assertEqual(load_config(file).root, self.root.resolve())
        with self.assertRaises(ValueError):
            Config('owner/repo', self.root, 'https://example.com/version.json')


if __name__ == '__main__':
    unittest.main()

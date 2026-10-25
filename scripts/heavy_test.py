"""Small process-level regression tests: python3 scripts/heavy_test.py."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

RUNNER = str(Path(__file__).with_name('heavy.py'))


class HeavyLockTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='mini4wd-lock-test-')
        self.root = Path(self.directory.name)
        self.lock = self.root / 'compute.lock'
        self.children = []
        self.groups = []

    def tearDown(self):
        for child in self.children:
            if child.poll() is None:
                child.terminate()
            child.wait(timeout=5)
        for pgid in self.groups:
            try:
                os.killpg(pgid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        self.directory.cleanup()

    def start(self, code, *options):
        child = subprocess.Popen([sys.executable, RUNNER, '--lock', str(self.lock), *options, '--', sys.executable, '-c', code], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.children.append(child)
        return child

    def wait_for(self, path):
        deadline = time.monotonic() + 5
        while not path.exists():
            if time.monotonic() > deadline:
                self.fail(f'file was not created: {path}')
            time.sleep(0.01)

    def holder(self, duration=0.35):
        ready = self.root / 'ready'
        end = self.root / 'end'
        code = f'import pathlib,time; pathlib.Path({str(ready)!r}).touch(); time.sleep({duration}); pathlib.Path({str(end)!r}).write_text(str(time.monotonic()))'
        child = self.start(code)
        self.wait_for(ready)
        self.wait_for(self.lock.with_suffix('.lock.json'))
        self.groups.append(json.loads(self.lock.with_suffix('.lock.json').read_text())['pgid'])
        return child, end

    def test_jobs_do_not_overlap(self):
        first, end = self.holder()
        start = self.root / 'second'
        second = self.start(f'import pathlib,time; pathlib.Path({str(start)!r}).write_text(str(time.monotonic()))')
        self.assertEqual(first.wait(timeout=5), 0)
        self.assertEqual(second.wait(timeout=5), 0)
        self.assertGreaterEqual(float(start.read_text()), float(end.read_text()))

    def test_dead_owner_is_reclaimed_without_a_lease(self):
        self.lock.with_suffix('.lock.json').write_text(json.dumps({'pid': 1073741824, 'pgid': 1073741824, 'heartbeat': time.time()}))
        started = time.monotonic()
        child = self.start('import sys; sys.exit(7)')
        self.assertEqual(child.wait(timeout=5), 7)
        self.assertLess(time.monotonic() - started, 2)
        self.assertFalse(self.lock.with_suffix('.lock.json').exists())

    def test_killed_wrapper_keeps_live_child_exclusive(self):
        first, end = self.holder(0.5)
        first.kill()
        first.wait(timeout=5)
        start = self.root / 'after-crash'
        second = self.start(f'import pathlib,time; pathlib.Path({str(start)!r}).write_text(str(time.monotonic()))')
        self.assertEqual(second.wait(timeout=5), 0)
        self.assertGreaterEqual(float(start.read_text()), float(end.read_text()))

    def test_timeout_does_not_steal_a_live_lock(self):
        first, end = self.holder()
        second = self.start('raise RuntimeError("must not execute")', '--timeout', '0.05')
        self.assertEqual(second.wait(timeout=5), 75)
        self.assertEqual(first.wait(timeout=5), 0)
        self.assertTrue(end.exists())

    def test_signal_releases_lock_and_forwards_to_command(self):
        first, _ = self.holder(30)
        first.terminate()
        self.assertEqual(first.wait(timeout=5), 143)
        second = self.start('pass', '--timeout', '1')
        self.assertEqual(second.wait(timeout=5), 0)


if __name__ == '__main__':
    unittest.main()

#!/usr/bin/env python3
"""Shared macOS/Linux heavy-job lock. Kernel flock, no two-hour stale lease.

Usage: python3 scripts/heavy.py --label vitest -- node node_modules/vitest/vitest.mjs run
Other projects can use this same runner or MINI4WD_HEAVY_LOCK path.
"""
import argparse
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time


def group_alive(pgid):
    if not isinstance(pgid, int) or pgid <= 1:
        return False
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def run(command, label, lock_path, timeout=None):
    # Never unlink the lock file: doing so could give two processes different
    # inodes and thus two independent locks for the same pathname.
    lock_path = Path(lock_path)
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path = lock_path.with_suffix(lock_path.suffix + '.json')
    started = time.monotonic()
    child = None
    interrupted = None

    def on_signal(number, _frame):
        nonlocal interrupted
        interrupted = number
        if child and child.poll() is None:
            try:
                os.killpg(child.pid, number)
            except ProcessLookupError:
                pass

    previous = {s: signal.signal(s, on_signal) for s in (signal.SIGINT, signal.SIGTERM)}
    try:
        with lock_path.open('a+') as lock:
            announced = -30.0
            while True:
                if interrupted:
                    return 128 + interrupted
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    elapsed = time.monotonic() - started
                    if timeout is not None and elapsed >= timeout:
                        print(f'[heavy] timeout waiting for {lock_path}', file=sys.stderr)
                        return 75
                    if elapsed - announced >= 30:
                        print(f'[heavy] {label}: waiting for {lock_path}', file=sys.stderr, flush=True)
                        announced = elapsed
                    time.sleep(0.1)

            # A killed wrapper can leave its command group running. The child
            # inherits flock's fd, and this group check also covers commands
            # which explicitly close inherited descriptors.
            try:
                old = json.loads(meta_path.read_text())
            except (OSError, ValueError):
                old = {}
            while group_alive(old.get('pgid')):
                if interrupted:
                    return 128 + interrupted
                if timeout is not None and time.monotonic() - started >= timeout:
                    return 75
                time.sleep(0.1)

            def metadata():
                data = {'label': label, 'pid': os.getpid(), 'pgid': child.pid, 'heartbeat': time.time()}
                temporary = meta_path.with_name(f'{meta_path.name}.{os.getpid()}.tmp')
                temporary.write_text(json.dumps(data))
                os.replace(temporary, meta_path)

            print(f'[heavy] {label}: acquired', file=sys.stderr, flush=True)
            try:
                child = subprocess.Popen(command, start_new_session=True, pass_fds=(lock.fileno(),))
                metadata()
                last_heartbeat = time.monotonic()
                while child.poll() is None:
                    if time.monotonic() - last_heartbeat >= 1:
                        metadata()
                        last_heartbeat = time.monotonic()
                    time.sleep(0.05)
                # A command may start background processes. Keep the lock until
                # the entire command group has ended, not merely its leader.
                while group_alive(child.pid):
                    if interrupted:
                        try:
                            os.killpg(child.pid, interrupted)
                        except ProcessLookupError:
                            pass
                    time.sleep(0.1)
                return 128 - child.returncode if child.returncode < 0 else child.returncode
            finally:
                # Don't discard ownership while a surviving child is still busy.
                if child is None or not group_alive(child.pid):
                    meta_path.unlink(missing_ok=True)
                print(f'[heavy] {label}: released', file=sys.stderr, flush=True)
    finally:
        for number, handler in previous.items():
            signal.signal(number, handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label', default='mini4wd')
    parser.add_argument('--lock', default=os.environ.get('MINI4WD_HEAVY_LOCK', str(Path(tempfile.gettempdir()) / 'codex-heavy-compute.lock')))
    parser.add_argument('--timeout', type=float)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        parser.error('a command is required after --')
    try:
        return run(command, args.label, args.lock, args.timeout)
    except OSError as error:
        print(f'[heavy] {error}', file=sys.stderr)
        return 127


if __name__ == '__main__':
    sys.exit(main())

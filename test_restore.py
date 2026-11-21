#!/usr/bin/env python3
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("restore.py")


class RestoreTest(unittest.TestCase):
    def test_copy_backup_and_omp_commands(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            home, repo, bindir = root / "home", root / "repo", root / "bin"
            (repo / "agent").mkdir(parents=True)
            (repo / "skills" / "demo").mkdir(parents=True)
            bindir.mkdir()
            (repo / "agent" / "config.yml").write_text("new config\n")
            shutil.copy2(SCRIPT, repo / "restore.py")
            shutil.copy2(Path(__file__).with_name("skill-lock.json"), repo / "skill-lock.json")
            (repo / "skills" / "demo" / "SKILL.md").write_text("skill\n")
            outside = root / "outside"
            outside.mkdir()
            (outside / "SKILL.md").write_text("untouched\n")
            (home / ".agents" / "skills").mkdir(parents=True)
            (home / ".agents" / "skills" / "demo").symlink_to(outside, target_is_directory=True)
            target = home / ".omp" / "agent" / "config.yml"
            target.parent.mkdir(parents=True)
            target.write_text("old config\n")
            lock = home / ".agents" / ".skill-lock.json"
            lock.parent.mkdir(parents=True, exist_ok=True)
            lock.write_text("old lock\n")
            log = root / "commands.log"
            fake = bindir / "omp"
            fake.write_text("#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$OMP_TEST_LOG\"\n")
            fake.chmod(0o755)
            env = dict(os.environ, HOME=str(home), PATH=f"{bindir}:{os.environ['PATH']}", OMP_TEST_LOG=str(log))
            result = subprocess.run(["python3", str(repo / "restore.py")], env=env, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(target.read_text(), "new config\n")
            backups = list(home.glob("omp-restore-*/backup/.omp/agent/config.yml"))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_text(), "old config\n")
            self.assertEqual((home / ".agents/skills/demo/SKILL.md").read_text(), "skill\n")
            self.assertEqual((outside / "SKILL.md").read_text(), "untouched\n")
            self.assertTrue(next(home.glob("omp-restore-*/backup/.agents/skills/demo")).is_symlink())
            self.assertEqual(lock.read_text(), (repo / "skill-lock.json").read_text())
            lock_backups = list(home.glob("omp-restore-*/backup/.agents/.skill-lock.json"))
            self.assertEqual(len(lock_backups), 1)
            self.assertEqual(lock_backups[0].read_text(), "old lock\n")
            self.assertEqual(log.read_text().splitlines(), [
                "plugin install pi-google-workspace@1.0.1",
                "plugin install pi-mcp-adapter@5.3.2",
                "plugin marketplace add DietrichGebert/ponytail",
                "plugin install ponytail@ponytail",
            ])


if __name__ == "__main__":
    unittest.main()

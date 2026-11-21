#!/usr/bin/env python3
"""Restore portable OMP settings and skills without discarding local files."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent


def copy_preserving(source, destination, backup_root):
    if source.is_dir() and not source.is_symlink():
        if destination.is_symlink() or (destination.exists() and not destination.is_dir()):
            backup = backup_root / destination.relative_to(Path.home())
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(destination), str(backup))
        destination.mkdir(parents=True, exist_ok=True)
        for child in source.iterdir():
            copy_preserving(child, destination / child.name, backup_root)
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() or destination.is_symlink():
        backup = backup_root / destination.relative_to(Path.home())
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(destination), str(backup))
    if source.is_symlink():
        destination.symlink_to(os.readlink(source))
    else:
        shutil.copy2(source, destination)


def main():
    home = Path.home()
    if (home / ".omp").is_symlink() or (home / ".agents").is_symlink():
        print("Refusing to restore through symlinked .omp or .agents directories.", file=sys.stderr)
        return 1
    stamp = tempfile.mkdtemp(prefix="omp-restore-", dir=home)
    backups = Path(stamp) / "backup"
    failed = False
    for source, destination in ((ROOT / "agent", home / ".omp" / "agent"),
                                (ROOT / "skills", home / ".agents" / "skills")):
        try:
            copy_preserving(source, destination, backups)
        except OSError as error:
            print(f"Copy failed ({source}): {error}", file=sys.stderr)
            failed = True
    try:
        copy_preserving(ROOT / "skill-lock.json", home / ".agents" / ".skill-lock.json", backups)
    except OSError as error:
        print(f"Copy failed (skill-lock.json): {error}", file=sys.stderr)
        failed = True
    if not backups.exists():
        shutil.rmtree(stamp)
    else:
        print(f"Existing files backed up to {backups}")
    if failed:
        return 1
    print("Restored agent files and skills.")
    commands = (
        ("plugin", "install", "pi-google-workspace@1.0.1"),
        ("plugin", "install", "pi-mcp-adapter@5.3.2"),
        ("plugin", "marketplace", "add", "DietrichGebert/ponytail"),
        ("plugin", "install", "ponytail@ponytail"),
    )
    for command in commands:
        try:
            subprocess.run(("omp", *command), check=True)
        except (OSError, subprocess.CalledProcessError) as error:
            print(f"Command failed: omp {' '.join(command)}: {error}", file=sys.stderr)
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

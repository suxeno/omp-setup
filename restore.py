#!/usr/bin/env python3
"""Restore portable OMP settings and skills without discarding local files."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent


def installed_plugins():
    result = subprocess.run(("omp", "plugin", "list", "--json"), check=True, capture_output=True, text=True)
    plugins = json.loads(result.stdout)
    return ({plugin["name"]: plugin.get("version") for plugin in plugins.get("npm", [])},
            {plugin["id"]: plugin.get("entries", [{}])[0].get("version")
             for plugin in plugins.get("marketplace", [])})


def configured_marketplaces():
    result = subprocess.run(("omp", "plugin", "marketplace"), check=True, capture_output=True, text=True)
    for line in result.stdout.splitlines():
        fields = line.split()
        if len(fields) >= 2 and fields[0] == "ponytail":
            if fields[1] != "DietrichGebert/ponytail":
                raise RuntimeError(f"Marketplace 'ponytail' points to {fields[1]}, not DietrichGebert/ponytail")
            return True
    return False


def plugin_commands():
    npm, marketplace = installed_plugins()
    has_marketplace = configured_marketplaces()
    commands = []
    for name, version in (("pi-google-workspace", "1.0.1"), ("pi-mcp-adapter", "5.3.2")):
        if name not in npm:
            commands.append(("plugin", "install", f"{name}@{version}"))
        elif npm[name] != version:
            commands.append(("plugin", "install", "--force", f"{name}@{version}"))
    if not has_marketplace:
        commands.append(("plugin", "marketplace", "add", "DietrichGebert/ponytail"))
    if "ponytail@ponytail" not in marketplace:
        commands.append(("plugin", "install", "ponytail@ponytail"))
    else:
        commands.append(("plugin", "upgrade", "ponytail@ponytail"))
    return commands



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
    if (home / ".omp").is_symlink():
        print("Refusing to restore through a symlinked .omp directory.", file=sys.stderr)
        return 1
    stamp = tempfile.mkdtemp(prefix="omp-restore-", dir=home)
    backups = Path(stamp) / "backup"
    failed = False
    for source, destination in ((ROOT / "agent", home / ".omp" / "agent"),
                                (ROOT / "skills", home / ".omp" / "agent" / "skills")):
        try:
            copy_preserving(source, destination, backups)
        except OSError as error:
            print(f"Copy failed ({source}): {error}", file=sys.stderr)
            failed = True
    try:
        copy_preserving(ROOT / "skill-lock.json", home / ".omp" / "agent" / ".skill-lock.json", backups)
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
    try:
        commands = plugin_commands()
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError, KeyError, RuntimeError) as error:
        print(f"Could not inspect installed plugins: {error}", file=sys.stderr)
        return 1
    for command in commands:
        try:
            subprocess.run(("omp", *command), check=True)
        except (OSError, subprocess.CalledProcessError) as error:
            print(f"Command failed: omp {' '.join(command)}: {error}", file=sys.stderr)
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

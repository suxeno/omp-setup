#!/usr/bin/env python3
"""Copy the local OMP installation into this snapshot repository."""
import argparse
import filecmp
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
DEFAULT_SOURCE = Path.home() / ".omp"

# Repository path -> path under the local OMP home.
FILES = (
    ("agent/config.yml", "agent/config.yml"),
    ("agent/mcp.json", "agent/mcp.json"),
    ("agent/lsp.json", "agent/lsp.json"),
    ("skill-lock.json", "agent/.skill-lock.json"),
    ("plugins/package.json", "plugins/package.json"),
    ("plugins/bun.lock", "plugins/bun.lock"),
    ("plugins/omp-plugins.lock.json", "plugins/omp-plugins.lock.json"),
)
DIRECTORIES = (
    ("agent/extensions", "agent/extensions"),
    ("skills", "agent/skills"),
)
MANAGED = ("agent", "skills", "skill-lock.json", "plugins")
IGNORED_DIRECTORIES = {"node_modules", "cache", "sessions", "logs"}
IGNORED_NAMES = {".DS_Store", "secrets.yml", "secret-placeholder.key"}


def ignored(relative):
    if any(part in IGNORED_DIRECTORIES for part in relative.parts):
        return True
    name = relative.name
    return (
        name in IGNORED_NAMES
        or name == ".env"
        or name.startswith(".env.")
        or name.endswith(".db")
        or ".db-" in name
    )


def same_entry(source, destination):
    if source.is_symlink() or destination.is_symlink():
        return (
            source.is_symlink()
            and destination.is_symlink()
            and os.readlink(source) == os.readlink(destination)
        )
    return destination.is_file() and filecmp.cmp(source, destination, shallow=False)


def copy_entry(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_dir() and not destination.is_symlink():
        shutil.rmtree(destination)
    elif destination.is_symlink() or destination.exists():
        destination.unlink()
    if source.is_symlink():
        target = os.readlink(source)
        if os.path.isabs(target):
            print(
                f"Warning: {source} is an absolute symlink; it may not restore elsewhere.",
                file=sys.stderr,
            )
        destination.symlink_to(target)
    else:
        shutil.copy2(source, destination)


def sync_file(source, destination, dry_run, actions):
    if not (source.exists() or source.is_symlink()):
        print(f"Warning: missing {source}; leaving {destination.relative_to(ROOT)} as is.",
              file=sys.stderr)
        return
    if same_entry(source, destination):
        return
    kind = "update" if destination.exists() or destination.is_symlink() else "add"
    actions.append((kind, destination.relative_to(ROOT)))
    if not dry_run:
        copy_entry(source, destination)


def collect_files(base):
    entries = {}
    for directory, names, files in os.walk(base, followlinks=False):
        directory = Path(directory)
        relative_directory = directory.relative_to(base)
        kept = []
        for name in names:
            relative = relative_directory / name
            if ignored(relative):
                continue
            if (directory / name).is_symlink():
                entries[relative] = directory / name
            else:
                kept.append(name)
        names[:] = kept
        for name in files:
            relative = relative_directory / name
            if not ignored(relative):
                entries[relative] = directory / name
    return entries


def sync_directory(source, destination, prune, dry_run, actions):
    if not source.is_dir():
        print(f"Warning: missing {source}; leaving {destination.relative_to(ROOT)} as is.",
              file=sys.stderr)
        return
    local = collect_files(source)
    for relative, path in sorted(local.items()):
        sync_file(path, destination / relative, dry_run, actions)
    if not prune or not destination.exists():
        return
    for path in sorted(destination.rglob("*"), reverse=True):
        if path.is_dir() and not path.is_symlink():
            try:
                path.rmdir()
            except OSError:
                pass
            continue
        relative = path.relative_to(destination)
        if relative not in local:
            actions.append(("remove", path.relative_to(ROOT)))
            if not dry_run:
                path.unlink()


def git(*args, check=True):
    return subprocess.run(
        ("git", "-C", str(ROOT), *args),
        text=True,
        capture_output=True,
        check=check,
    )


def print_actions(actions, dry_run):
    labels = {"add": "Added", "update": "Updated", "remove": "Removed"}
    for kind in ("add", "update", "remove"):
        for action, path in actions:
            if action == kind:
                print(f"{labels[kind]:>8}  {path}")
    if not actions:
        print("Snapshot already up to date.")
    elif dry_run:
        print(f"\nDry run: {len(actions)} change(s) not written.")


def commit_and_push(message, push):
    added = git("add", "-A", "--", *MANAGED)
    staged = git("diff", "--cached", "--name-only", "--", *MANAGED).stdout.strip()
    if not staged:
        print("Nothing to commit.")
        return 0
    try:
        git("commit", "-m", message, "--", *MANAGED)
    except subprocess.CalledProcessError as error:
        print(error.stderr.strip() or "Commit failed.", file=sys.stderr)
        return 1
    print(f"Committed {len(staged.splitlines())} changed path(s).")
    if push:
        try:
            git("push")
        except subprocess.CalledProcessError as error:
            print(error.stderr.strip() or "Push failed.", file=sys.stderr)
            print("No commit was lost; push manually when ready.", file=sys.stderr)
            return 1
        print("Pushed to the configured remote.")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Copy local OMP settings, skills, and plugin metadata into this repository.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE,
                        help="local OMP home (default: ~/.omp)")
    parser.add_argument("--dry-run", action="store_true",
                        help="show what would change without writing files")
    parser.add_argument("--no-prune", action="store_true",
                        help="keep repository files that no longer exist locally")
    parser.add_argument("--commit", action="store_true", help="commit the snapshot")
    parser.add_argument("--push", action="store_true",
                        help="commit and push the snapshot (implies --commit)")
    parser.add_argument("--message", default="Update OMP setup snapshot",
                        help="commit message")
    args = parser.parse_args()

    if args.dry_run and (args.commit or args.push):
        parser.error("--dry-run cannot be combined with --commit or --push")

    source_root = args.source.expanduser().resolve()
    if not source_root.is_dir():
        print(f"OMP home not found: {source_root}", file=sys.stderr)
        return 1

    actions = []
    for repository_path, local_path in FILES:
        sync_file(source_root / local_path, ROOT / repository_path, args.dry_run, actions)
    for repository_path, local_path in DIRECTORIES:
        sync_directory(
            source_root / local_path,
            ROOT / repository_path,
            not args.no_prune,
            args.dry_run,
            actions,
        )

    print_actions(actions, args.dry_run)
    if args.dry_run:
        return 0

    if args.commit or args.push:
        return commit_and_push(args.message, args.push)

    status = git("status", "--short", "--", *MANAGED).stdout.strip()
    if status:
        print("\nReview before committing:")
        print(status)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

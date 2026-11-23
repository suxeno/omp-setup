# OMP setup backup

Private backup of OMP settings, MCP servers, skills, extensions, and plugin metadata.

## Set up a new device

1. Clone and restore:

   ```sh
   git clone https://github.com/suxeno/omp-setup.git ~/omp-setup
   cd ~/omp-setup
   python3 restore.py
   ```

   Close OMP first. Existing files are backed up under `~/omp-restore-*/backup/`. Plugin installation requires internet access. Restore installs missing plugins, updates outdated npm plugins, and runs the marketplace plugin upgrade command whenever it is installed; that command does not force a reinstall. It requires the configured marketplace name `ponytail` to point to `DietrichGebert/ponytail` and stops if that name is occupied by another source. Repository-owned files are replaced after backup, while unrelated local files and configuration remain untouched.
2. Start OMP, sign in with `/login`, and reconnect servers with `/mcp reauth <name>`.
3. Check `/mcp list`, `/mcp test <name>`, and `omp plugin list`. Some plugins need separate sign-in or dependencies.

## Restored locations

| Item | Location on device |
| --- | --- |
| Backup repository | `~/omp-setup/` |
| OMP settings | `~/.omp/agent/config.yml` |
| MCP servers | `~/.omp/agent/mcp.json` |
| LSP settings | `~/.omp/agent/lsp.json` |
| Skills | `~/.omp/agent/skills/` |
| Skill source metadata | `~/.omp/agent/.skill-lock.json` |
| Local extension | `~/.omp/agent/extensions/` |
| Installed plugins | `~/.omp/plugins/` |
| Marketplace registry | `~/.omp/marketplaces.json` |
| Replaced files | `~/omp-restore-*/backup/` |

Skills are OMP-scoped; `~/.agents/skills/` is untouched. The skill source metadata is for reference, not an OMP Skillshare lock.

**Security:** This restores `tools.approvalMode: yolo` (permissive tool approval). Review `agent/config.yml` before restoring.

## Update the backup

From this repository, run:

```sh
python3 update.py --dry-run   # preview changes
python3 update.py             # copy local OMP state into this repository
python3 update.py --commit    # copy and commit the snapshot
python3 update.py --push      # copy, commit, and push to origin
```

The script mirrors these local paths:

| Repository | Local source |
| --- | --- |
| `agent/config.yml`, `agent/mcp.json`, `agent/lsp.json` | matching files in `~/.omp/agent/` |
| `agent/extensions/` | `~/.omp/agent/extensions/` |
| `skills/` | `~/.omp/agent/skills/` |
| `skill-lock.json` | `~/.omp/agent/.skill-lock.json` |
| `plugins/` | `~/.omp/plugins/` (metadata and lockfiles only) |

Skills and extensions removed locally are pruned from the repository by default; pass `--no-prune` to keep them. The script skips credentials, sessions, caches, databases, `node_modules`, and `.env` files. It does not update this README, `restore.py`, or `update.py`; review `git diff` for secrets before committing.

## What is not included

Credentials, sessions, project configuration, caches, and local models are excluded. Sign in again and back up projects separately. Plugin dependencies and marketplace versions may change. Restore targets the default profile and default OMP paths.

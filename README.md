# OMP setup backup

Private backup of OMP settings, MCP servers, skills, extensions, and plugin metadata.

## Set up a new device

1. Clone and restore:

   ```sh
   git clone https://github.com/suxeno/omp-setup.git ~/omp-setup
   cd ~/omp-setup
   python3 restore.py
   ```

   Close OMP first. Existing files are backed up under `~/omp-restore-*/backup/`. Plugin installation requires internet access.
   Skills restore to `~/.omp/agent/skills/`, not the shared `~/.agents/skills/` directory. Skill source metadata is kept at `~/.omp/agent/.skill-lock.json` for reference; OMP does not use it as its Skillshare lock.
2. Start OMP, sign in with `/login`, and reconnect servers with `/mcp reauth <name>`.
3. Check `/mcp list`, `/mcp test <name>`, and `omp plugin list`. Some plugins need separate sign-in or dependencies.

**Security:** This restores `tools.approvalMode: yolo` (permissive tool approval). Review `agent/config.yml` before restoring.

## Update the backup

This is a snapshot, not automatic sync. Copy OMP settings from `~/.omp/agent/` into `agent/`. Copy skills into `skills/` and their source metadata into `skill-lock.json`; on the original device these are under `~/.agents/`. Update plugin metadata and restore commands when needed. Review for secrets, then commit and push.

## What is not included

Credentials, sessions, project configuration, caches, and local models are excluded. Sign in again and back up projects separately. Plugin dependencies and marketplace versions may change. Restore targets the default profile and default OMP paths.

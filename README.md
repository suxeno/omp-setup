# OMP setup backup

Private backup of the default-profile OMP settings, MCP definitions, LSP configuration, user skills, local extension and plugin dependency/runtime metadata. This does not contain credentials or conversation history. The configuration includes internal service URLs: keep this repository private.

## Restore on a new device

1. Install Git, OMP, and Node.js/npm (`npx` is used by Playwright). Clone this repository and change into it. These instructions assume default OMP paths, not an XDG relocation or named profile.
2. Close OMP. Back up any existing `~/.omp/agent/config.yml`, `mcp.json`, `lsp.json`, `extensions/`, and `~/.agents/skills/` before copying; the following commands may overwrite files with the same names:

   ```sh
   mkdir -p ~/.omp/agent/extensions ~/.agents/skills
   cp agent/config.yml agent/mcp.json agent/lsp.json ~/.omp/agent/
   cp -R agent/extensions/. ~/.omp/agent/extensions/
   cp -R skills/. ~/.agents/skills/
   ```

3. Reinstall the plugins using OMP, which creates its own local plugin state. Versions are those observed on the source device; the marketplace install selects its current version:

   ```sh
   omp plugin install pi-google-workspace@1.0.1
   omp plugin install pi-mcp-adapter@5.3.2
   omp plugin marketplace add DietrichGebert/ponytail
   omp plugin install ponytail@ponytail
   ```

   `plugins/` contains the original package manifest, Bun lock, and runtime state for reference. Do not blindly copy the runtime lock or marketplace cache to another device. Transitive dependency and marketplace versions may differ when reinstalling.
4. Launch OMP, sign in to model providers with `/login`, and use `/mcp reauth <name>` for OAuth servers. Restore any needed API keys through your secure credential manager or environment, not Git. Reauthorize Google Workspace separately as required by its plugin.
5. Run `/mcp list` and `/mcp test <name>` for the servers you use, and `omp plugin list` to check the plugins. Confirm the skills are discovered. The Playwright server may require its browser dependencies. Model availability, local speech models, service access and OS-specific permissions vary by device.

## Update this backup

Copy changed settings and skills from the same source paths into this checkout, review every change for secrets and machine-specific paths, then commit and push. Review `plugins/` when plugins change. Do not add databases, sessions, logs, cache, OAuth credentials, `.env` files, `secrets.yml`, or `secret-placeholder.key`. Never use `git add -A` without reviewing untracked files.

The settings currently include `tools.approvalMode: yolo`: restoring them grants the same permissive tool policy on the new device. Review before use.

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import restore


class PluginCommandTests(unittest.TestCase):
    def test_always_upgrades_installed_marketplace_plugin(self):
        listing = json.dumps({
            "npm": [{"name": "pi-google-workspace", "version": "1.0.1"},
                    {"name": "pi-mcp-adapter", "version": "5.3.2"}],
            "marketplace": [{"id": "ponytail@ponytail", "entries": [{"version": "5.3.3"}]}],
        })
        with patch.object(restore.subprocess, "run", side_effect=[
            SimpleNamespace(stdout=listing),
            SimpleNamespace(stdout="Configured Marketplaces:\nponytail DietrichGebert/ponytail"),
        ]):
            self.assertEqual(restore.plugin_commands(), [("plugin", "upgrade", "ponytail@ponytail")])

    def test_updates_outdated_npm_plugin_and_marketplace(self):
        listing = json.dumps({
            "npm": [{"name": "pi-google-workspace", "version": "0.9.0"},
                    {"name": "pi-mcp-adapter", "version": "5.3.2"}],
            "marketplace": [{"id": "ponytail@ponytail", "entries": [{"version": "5.3.2"}]}],
        })
        with patch.object(restore.subprocess, "run", side_effect=[
            SimpleNamespace(stdout=listing),
            SimpleNamespace(stdout="Configured Marketplaces:\nponytail DietrichGebert/ponytail"),
        ]):
            self.assertEqual(restore.plugin_commands(), [
                ("plugin", "install", "--force", "pi-google-workspace@1.0.1"),
                ("plugin", "upgrade", "ponytail@ponytail"),
            ])

    def test_refuses_marketplace_name_collision(self):
        with patch.object(restore.subprocess, "run", side_effect=[
            SimpleNamespace(stdout=json.dumps({"npm": [], "marketplace": []})),
            SimpleNamespace(stdout="Configured Marketplaces:\nponytail someone/else"),
        ]):
            with self.assertRaisesRegex(RuntimeError, "not DietrichGebert/ponytail"):
                restore.plugin_commands()

    def test_installs_missing_plugins_and_registers_missing_marketplace(self):
        listing = json.dumps({"npm": [], "marketplace": []})
        with patch.object(restore.subprocess, "run", side_effect=[
            SimpleNamespace(stdout=listing),
            SimpleNamespace(stdout="Configured Marketplaces:"),
        ]):
            self.assertEqual(restore.plugin_commands(), [
                ("plugin", "install", "pi-google-workspace@1.0.1"),
                ("plugin", "install", "pi-mcp-adapter@5.3.2"),
                ("plugin", "marketplace", "add", "DietrichGebert/ponytail"),
                ("plugin", "install", "ponytail@ponytail"),
            ])


if __name__ == "__main__":
    unittest.main()

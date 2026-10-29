# claude-mods

The team's Claude Code mods, published as the `claude-mods` plugin marketplace. A mod is a plugin with a hooks module: it adds panes, bands, commands and prompt helpers to Claude Code in the terminal and in the desktop app.

## Mods

| Mod | What it does |
| --- | --- |
| [mod-manager](mod-manager/README.md) | A `/mods` pane listing the global and project mods, with a switch to turn each on or off. |
| [chat-handoff](chat-handoff/README.md) | Once the context grows past a threshold, offers to carry the work over to a fresh chat with a generated handoff prompt. |
| [prompt-reformer](prompt-reformer/README.md) | Offers to restructure long prompts into a clearer form, asking clarifying questions first. |

## Installation

Add the marketplace once:

```bash
claude plugin marketplace add Kotalev/claude-mods
```

Then install the mods you want. `--scope user` makes a mod active in every project:

```bash
claude plugin install mod-manager@claude-mods --scope user
claude plugin install chat-handoff@claude-mods --scope user
claude plugin install prompt-reformer@claude-mods --scope user
```

Inside a session, the same works with `/plugin marketplace add Kotalev/claude-mods` and `/plugin install <mod>@claude-mods`.

### Installing for a whole project

To have Claude Code offer the mods to everyone who opens a project, add this to the project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "claude-mods": {
      "source": { "source": "github", "repo": "Kotalev/claude-mods" }
    }
  },
  "enabledPlugins": {
    "mod-manager@claude-mods": true
  }
}
```

## Updating

Pull the latest versions of all mods:

```bash
claude plugin marketplace update claude-mods
```

Then run `/reload-plugins` or start a new session.

## Contributing

Each mod is a folder with `.claude-plugin/plugin.json` and a hooks module under `hooks/`. To work on one:

1. Clone the repository and edit the mod.
2. Try it without installing: `claude --plugin-dir ./<mod>`.
3. Check it with `claude plugin validate ./<mod>` and, where it has tests, `claude plugin test ./<mod>`.
4. Raise `version` in the mod's `plugin.json`, so installed copies pick up the change on update.
5. Commit and push to `main`.

To add a new mod, add its folder and an entry to `plugins` in `.claude-plugin/marketplace.json`.

# mod-manager

A Claude Code mod that lists the mods active for the current conversation, both the global ones and the ones scoped to this project, and lets you switch each one on or off without leaving the chat. It works in Claude Code Desktop and in the terminal.

## What it does

- Adds a `/mods` slash command that opens a **Mods** pane beside the chat.
- Lists every installed **mod**, meaning a plugin whose `hooks/hooks.json` names a hooks module under `modules`. Ordinary plugins (skills, commands, MCP servers only) are not shown.
- Groups them in two sections:
  - **Global**: mods installed at the `user` scope, active in every project.
  - **This project**: mods installed at the `project` or `local` scope for the folder the session runs in. Mods scoped to other projects are left out.
- Shows a count of enabled mods per section, e.g. `GLOBAL · 7/8 on`.
- Gives each mod a switch:
  - **Desktop**: a rounded switch, green with the knob on the right when on, grey with the knob on the left when off, faded while the change runs.
  - **Terminal**: a coloured text pill with the knob on the same sides.
- A **↻ Refresh** button re-reads the list.

## How to use it

1. Type `/mods` in the prompt. The Mods pane opens. Where no pane can be shown, `/mods` prints the list as text instead.
2. Click a switch to turn that mod on or off.
3. The change applies straight away: the mod runs `/reload-plugins` for you after each switch, so the mod loads or unloads in the current session too.

Errors from the `claude` CLI, such as a failed enable, are shown in red at the bottom of the pane.

> Note: `mod-manager` lists itself under **Global**. Turning it off removes the `/mods` command and the pane until you turn it back on with `claude plugin enable mod-manager@claude-mods`.

## How it works

The list comes from `claude plugin list --json`. A switch runs:

```bash
claude plugin enable <plugin>@<marketplace> --scope <scope>
```

or `claude plugin disable ...` with the mod's own scope, then refreshes the list and runs `/reload-plugins`.

The mod calls the same `claude` executable the session runs on (read from `CLAUDE_CODE_EXECPATH`) and falls back to `claude` on your `PATH`.

## Installation

The mod is part of the [`claude-mods`](https://github.com/Kotalev/claude-mods) marketplace.

Add the marketplace and install the mod for all projects:

```bash
claude plugin marketplace add Kotalev/claude-mods
```

```bash
claude plugin install mod-manager@claude-mods --scope user
```

Use `--scope project` instead to install it for one project only.

To get a newer version, run `claude plugin marketplace update claude-mods`, then `/reload-plugins` or start a new session.

## Configuration

The mod has no settings of its own: there are no `userConfig` options and nothing to set in `/config`.

What you can configure is through Claude Code itself:

| What | How |
| --- | --- |
| Where the mod is active | Install at `--scope user` (all projects), `project` (shared via `.claude/settings.json`) or `local` (only you, this project). |
| Turn the mod off | `claude plugin disable mod-manager@claude-mods`, or its own switch in the pane. |
| Uninstall | `claude plugin uninstall mod-manager@claude-mods` |

## Limitations

- Mods loaded with `--plugin-dir`, `CLAUDE_CODE_PLUGIN_DIRS` or from a session's draft mods folder are not installed plugins, so `claude plugin` cannot list or toggle them and they do not appear.
- The on/off state shown is the `enabled` field from `claude plugin list --json`.
- `/reload-plugins` is not available over a remote connection. There, a switch changes the setting, but the change reaches the session only after you run `/reload-plugins` locally or start a new session.

## Development

```text
mod-manager/
├── .claude-plugin/
│   └── plugin.json        manifest
├── hooks/
│   ├── hooks.json         names the hooks module
│   └── register.tsx       the mod: /mods command, pane, toggling
├── types/index.d.ts       the mod's state contract
└── tests/mods.test.tsx    pane and toggle test
```

Check and test the mod from the repository root:

```bash
claude plugin validate mod-manager
```

```bash
claude plugin test mod-manager
```

To try local changes without installing, start Claude Code with `claude --plugin-dir ./mod-manager`.

# chat-handoff

A Claude Code mod that offers to carry your work over to a fresh chat once the context grows large. It works in Claude Code Desktop and in the terminal.

## What it does

When a turn finishes normally (not interrupted and not ended by an error), the mod checks how large the conversation's context is. If it is at or above the configured threshold (300,000 tokens by default), a band appears above the prompt box:

> Контекстът е 312k токена (праг 300k). Да пренеса работата в нов чат?

When you choose to transfer, the mod:

1. Asks the model to read the conversation so far and write a handoff prompt for a new chat. The prompt covers the goal, the current state, key decisions and constraints, relevant files, findings, next steps and open questions. It is written in the language you have been using.
2. Runs `/clear`, which starts a clean conversation in the same window. The old conversation is kept, and the prompt ends with a `claude --resume <id>` line so you can go back to it.
3. Puts the generated prompt in the prompt box of the new chat, ready to send.

If the prompt box cannot take the text, the prompt is copied to the clipboard instead and a toast tells you so.

## Usage

The band offers these buttons:

| Button | Where | What it does |
| --- | --- | --- |
| **Пренеси в нов чат** | Terminal and Desktop | Generates the prompt, clears the chat and puts the prompt in the box. You review it and press Enter. |
| **Пренеси и изпрати** | Desktop only | Same, but sends the prompt right away, so the new chat starts working at once. |
| **Не сега** | Terminal and Desktop | Hides the offer until the next `/clear`. |

While the prompt is being generated the band shows "Генерирам промпт за новия чат…". If generation fails, the band shows the reason and offers **Опитай пак** (retry) and **Затвори** (close).

The offer is not shown while a turn is running, and it only counts turns of the main conversation, not those of subagents.

Note: a mod cannot open a separate new session in the sidebar. "New chat" here means `/clear` in the current window.

## Configuration

The mod has one option:

| Option | Default | Description |
| --- | --- | --- |
| `threshold` | `300000` | Context size in tokens at which a finished turn offers the handoff. |

The context size is the number of input tokens of the last model response, the same figure the status line shows.

**Terminal:** open `/config` and change the row **Handoff threshold (tokens)**, or from a shell:

```bash
echo '{"threshold":"250000"}' | claude plugin configure chat-handoff@ivan-mods --values-stdin
```

**Desktop:** `/config` is not available there. Set the value in `~/.claude/settings.json`:

```json
{
  "pluginConfigs": {
    "chat-handoff@ivan-mods": {
      "options": { "threshold": 250000 }
    }
  }
}
```

Settings are shared, so a value set from the terminal also applies in Desktop.

## Installation

The mod lives in the local marketplace `ivan-mods` (`~/Projects/mods`) and is installed at the user scope, so it loads in every project:

```bash
claude plugin marketplace add ~/Projects/mods
```

```bash
claude plugin install chat-handoff@ivan-mods --scope user
```

The plugin is read straight from this folder. After editing it, run `/reload-plugins` in the terminal or start a new session.

## Development

- `hooks/register.tsx`: the hooks module (the threshold check, the band and the transfer).
- `types/index.d.ts`: the state contract for the band.
- `hooks/register.test.tsx`: tests. Run them with `claude plugin test .` in this folder.
- Validate with `claude plugin validate .`.

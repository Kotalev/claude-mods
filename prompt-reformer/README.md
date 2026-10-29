# prompt-reformer

A Claude Code mod that turns long, stream-of-consciousness prompts into clear, structured ones before they are sent. It works in Claude Code in the terminal and in the Claude desktop app (Code tab).

## What it does

When you submit a prompt longer than a configurable number of words (50 by default), the mod pauses the submission and asks:

> Your prompt is 69 words. Restructure it into a clearer form?

| Option | What happens |
| --- | --- |
| **Reformat** | The mod reads your prompt, asks clarifying questions about anything ambiguous or missing, then rewrites it and puts the result in the prompt box for you to review. |
| **Send as is** | Your prompt is sent unchanged. |
| **Keep editing** | Nothing is sent; your prompt goes back into the prompt box. |

### The reformat flow

1. **Clarifying questions.** The mod asks Claude (Sonnet) what is unclear in the draft: goals, scope, constraints, acceptance criteria, technology choices. You get up to 4 questions, each with ready-made answers; pick one or choose "Type something" to write your own. If the draft is already clear, there are no questions.
2. **Rewrite.** The draft and your answers are rewritten into a structured prompt with short markdown sections where they fit (Goal, Context, Requirements, Constraints, Done when). Every fact from your draft and answers is kept and nothing new is invented. The prompt stays in the language you wrote it in, and code, paths and identifiers are kept exactly as written.
3. **Ready to send.** The original prompt is not sent. The rewritten prompt is placed in the prompt box, where you can edit it and press Enter. That next submission goes straight through without another offer.

Press Esc during the questions to cancel; your original prompt is put back in the prompt box.

If the surface has no prompt box the mod can fill, it shows the rewritten prompt in the transcript and asks whether to send it or your original.

### Prompts with attached images

The prompt box only takes text, so a prompt with images or other attachments is never moved back into it after a rewrite. Instead, the mod shows the rewritten prompt in the transcript and asks **Send it** or **Send my original**. Either one is sent in the same submission, with your images still attached. You cannot edit the rewritten text before it is sent.

The images are kept, but the model that asks the questions and rewrites the prompt reads only the text, not the images.

If you choose **Keep editing**, cancel, or the model does not answer, only the text goes back into the prompt box. The mod tells you to attach the images again.

### What is not affected

- Prompts at or below the threshold.
- Slash commands.
- Messages the engine or other plugins send (task notifications, scheduled tasks, other sessions, plugin prompts).
- Headless runs (`claude -p`), where nobody can answer the offer: the prompt is sent unchanged.

## Usage

There is nothing to invoke. Write your prompt as usual. Once it goes over the threshold, the offer appears when you press Enter.

## Configuration

The only setting is the word threshold, `wordThreshold` (default `50`). Prompts with **more** words than this get the offer.

### With the slash command (terminal and desktop)

```
/reformer-threshold          # show the current threshold
/reformer-threshold 80       # set it to 80 words
```

The value must be a positive whole number. The mod reloads with the new value right away.

### In the settings menu

In the terminal, open `/config` and change the **Word threshold** row.

### In settings.json

The value is stored in `~/.claude/settings.json`:

```json
{
  "pluginConfigs": {
    "prompt-reformer@claude-mods": {
      "options": { "wordThreshold": 80 }
    }
  }
}
```

## Installation

The mod is part of the [`claude-mods`](https://github.com/Kotalev/claude-mods) marketplace. Install it at user scope, so it is active in every project:

```bash
claude plugin marketplace add Kotalev/claude-mods
claude plugin install prompt-reformer@claude-mods --scope user
```

To turn it off without uninstalling:

```bash
claude plugin disable prompt-reformer@claude-mods --scope user
```

To get a newer version, run `claude plugin marketplace update claude-mods`, then `/reload-plugins` or start a new session.

## Development

| File | Purpose |
| --- | --- |
| `.claude-plugin/plugin.json` | Manifest and the `wordThreshold` option |
| `hooks/hooks.json` | Points to the hooks module |
| `hooks/register.ts` | The mod: the `prompt.submit` hook, the `/reformer-threshold` command and the prompts sent to the model |

To try local changes without installing, start Claude Code from the repository root with `claude --plugin-dir ./prompt-reformer`. To check the mod:

```bash
claude plugin validate prompt-reformer
```

The model used for questions and rewriting is set by `MODEL` in `hooks/register.ts` (`sonnet`). The instructions it follows are `QUESTIONS_SYSTEM` and `REWRITE_SYSTEM` in the same file.

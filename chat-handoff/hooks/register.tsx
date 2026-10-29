import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { HandoffBand } from '../types'

const band = atom({ plugin: 'chat-handoff', key: 'band' } as const, { phase: 'idle' } as HandoffBand)

const HANDOFF_REQUEST = `The conversation so far is about to be continued in a brand-new chat that will see none of this history. Write the opening message for that new chat, so the next assistant can pick up the work exactly where it stands.

Write it in the language the user has been writing in. Address the next assistant directly. Include, as short sections:
- Goal: what the user is ultimately trying to achieve.
- Current state: what is done and working, what is in progress.
- Key decisions and constraints: choices made and why, the user's stated preferences and rules.
- Relevant files and locations: absolute paths, commands, URLs, identifiers the work depends on.
- Findings: non-obvious facts learned (causes of bugs, API quirks, dead ends to avoid).
- Next steps: an ordered list of what to do next.
- Open questions: anything still waiting on the user.

Be concrete and complete but drop chatter and anything already irrelevant. Reply with the message text only: no preamble, no closing remark, no code fence around the whole message.`

const formatTokens = (n: number) => `${Math.round(n / 1000)}k`

async function transfer($: EngineInterface, tokens: number, send: boolean) {
  await update($, band, (): HandoffBand => ({ phase: 'generating', tokens }))
  const sessionId = await $.session.id()
  const reply = await $.model.fork({ prompt: HANDOFF_REQUEST })

  if (!reply.isAnswered) {
    await update($, band, (): HandoffBand => ({ phase: 'error', tokens, reason: reply.reason }))
    return
  }

  const text = `${reply.text.trim()}\n\n(Previous chat: claude --resume ${sessionId})`
  await $.command.run({ command: 'clear' })
  await update($, band, (): HandoffBand => ({ phase: 'idle' }))

  if (send) {
    await $.prompt.submit({ text })
    return
  }

  const filled = await $.prompt.fill({ text })
  if (!filled.isFilled) {
    await $.ui.copy({ text })
    $.ui.toast('Handoff prompt copied to the clipboard: paste it into the new chat')
  }
}

export const register: Register = (on, options) => {
  const threshold = typeof options.threshold === 'number' && options.threshold > 0 ? options.threshold : 300000

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') {
      return result
    }

    const { context } = await $.session.usage()
    const current = await read($, band)
    if (context.tokens !== undefined && context.tokens >= threshold && current.phase === 'idle') {
      await update($, band, (): HandoffBand => ({ phase: 'offer', tokens: context.tokens ?? 0 }))
    }

    return result
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, band, (): HandoffBand => ({ phase: 'idle' }))
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const state = await read($, band)
    if (e.props.hasSurvey || state.phase === 'idle' || state.phase === 'dismissed') {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const dismiss = () => update($, band, (): HandoffBand => ({ phase: 'dismissed' }))

    if (state.phase === 'generating') {
      return (
        <Box>
          <Text dimColor>Генерирам промпт за новия чат…</Text>
        </Box>
      )
    }

    if (state.phase === 'error') {
      return (
        <Box flexDirection="column">
          <Text color="error">Промптът не се генерира ({state.reason}).</Text>
          <Box gap={1}>
            <Button key="retry" variant="primary" label="Опитай пак" onPress={() => transfer($, state.tokens, false)} />
            <Button key="dismiss" label="Затвори" onPress={dismiss} />
          </Box>
        </Box>
      )
    }

    if (e.props.isWorking) {
      return next(e)
    }

    return (
      <Box flexDirection="column">
        <Text>
          Контекстът е {formatTokens(state.tokens)} токена (праг {formatTokens(threshold)}). Да пренеса работата в нов чат?
        </Text>
        <Box gap={1}>
          <Button key="transfer" variant="primary" label="Пренеси в нов чат" onPress={() => transfer($, state.tokens, false)} />
          {e.surface === 'desktop' ? (
            <Button key="transfer-send" label="Пренеси и изпрати" onPress={() => transfer($, state.tokens, true)} />
          ) : null}
          <Button key="dismiss" label="Не сега" onPress={dismiss} />
        </Box>
      </Box>
    )
  })
}

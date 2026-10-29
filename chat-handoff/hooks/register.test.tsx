import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'chat-handoff',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const finishTurn = {
  answer: 'done',
  durationMs: 1000,
  isAborted: false,
  turnId: 't1',
  reason: 'answer',
} as const

const engineBand = (on: Parameters<Parameters<typeof test>[1]>[1]) =>
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

test('no offer below the threshold', { options: { threshold: 300000 } }, async ($, on) => {
  on('turn.complete', () => ({ text: 'done' }))
  engineBand(on)
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 120000, window: 1000000 }, rateLimits: [] } }))

  await $.turn.complete(finishTurn)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', key: 'transfer' })).toBeUndefined()
  await ui.unmount()
})

test('offers past the threshold; desktop also sends directly', { options: { threshold: 300000 } }, async ($, on) => {
  on('turn.complete', () => ({ text: 'done' }))
  engineBand(on)
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 310000, window: 1000000 }, rateLimits: [] } }))

  await $.turn.complete(finishTurn)

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await terminal.find({ type: 'Button', key: 'transfer' })).toBeDefined()
  expect(await terminal.find({ type: 'Button', key: 'transfer-send' })).toBeUndefined()
  expect((await terminal.find({ type: 'Text', text: /310k/ }))?.text).toContain('праг 300k')
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desktop.find({ type: 'Button', key: 'transfer-send' })).toBeDefined()
  await desktop.unmount()
})

test('transfer generates the prompt, clears and fills the box', { options: { threshold: 1000 } }, async ($, on) => {
  const order: string[] = []
  let filled = ''
  on('turn.complete', () => ({ text: 'done' }))
  engineBand(on)
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 5000, window: 1000000 }, rateLimits: [] } }))
  on('session.id', () => ({ value: 'abc-123' }))
  on('model.fork', () => {
    order.push('fork')
    return { value: { isAnswered: true, text: 'Goal: ship it', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }
  })
  on('command.run', (_, e) => {
    order.push(e.command)
    return { text: '' }
  })
  on('prompt.fill', (_, e) => {
    order.push('fill')
    filled = e.text
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })

  await $.turn.complete(finishTurn)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'transfer' })

  expect(order).toEqual(['fork', 'clear', 'fill'])
  expect(filled).toContain('Goal: ship it')
  expect(filled).toContain('claude --resume abc-123')
  expect(await ui.find({ type: 'Button', key: 'transfer' })).toBeUndefined()
  await ui.unmount()
})

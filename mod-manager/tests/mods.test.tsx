import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'mod-manager',
  component: 'Pane',
  requestId: 'mod-manager',
  props: {
    title: 'Mods',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const INSTALLED = [
  { id: 'cache-tax@shop', scope: 'user', enabled: true, installPath: '/p/cache-tax' },
  { id: 'skins@shop', scope: 'user', enabled: false, installPath: '/p/skins' },
  { id: 'lint@shop', scope: 'user', enabled: true, installPath: '/p/lint' },
  { id: 'here@shop', scope: 'project', enabled: true, installPath: '/p/here', projectPath: '/proj' },
  { id: 'there@shop', scope: 'local', enabled: true, installPath: '/p/there', projectPath: '/other' },
]

test('lists the global and this project mods, and toggles one', async ($, on) => {
  const runs: string[][] = []
  on('command.register', () => ({ value: { command: 'mods' } }))
  on('command.run', () => ({ text: '' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('env.get', () => ({ value: '/bin/claude' }))
  // lint ships no hooks module: a plugin, not a mod.
  on('fs.read', (_, e) => {
    if (e.path.startsWith('/p/lint')) throw new Error('ENOENT')
    return { value: '{ "modules": ["./register.tsx"] }' }
  })
  on('process.run', (_, e) => {
    runs.push([...e.argv])
    const stdout = e.argv.includes('list') ? JSON.stringify(INSTALLED) : ''
    return {
      value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }
  })

  await $.session.start({ cwd: '/proj', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /cache-tax/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /here/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /there/ })).toBeFalsy()
    expect(await ui.find({ type: 'Text', text: /lint/ })).toBeFalsy()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'toggle:skins@shop' })
  await ui.unmount()

  expect(runs).toContainEqual([
    '/bin/claude', 'plugin', 'enable', 'skins@shop', '--scope', 'user',
  ])
})

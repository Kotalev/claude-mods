import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Listing, Mod } from '../types'

const PANE = 'mod-manager'
const TITLE = 'Mods'
// Change the tag when Listing's fields change: it declines what an earlier
// version stored, which outlives a reload.
const listing = atom({ plugin: 'mod-manager', key: 'listing' } as const, { mods: [] }, {
  shape: 'listing-1',
})

type Installed = {
  id: string
  scope: Mod['scope']
  enabled: boolean
  installPath: string
  projectPath?: string
}

// The session's working directory: a project-scoped mod shows only here.
let cwd = ''

// A rounded switch: green track with the knob right when on, grey with the
// knob left when off, faded while the toggle runs.
function switchSvg(isOn: boolean, isBusy: boolean) {
  const track = isOn ? '#34C759' : '#3A3A3C'
  const knobX = isOn ? 32 : 12
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="24" viewBox="0 0 44 24" opacity="${isBusy ? 0.5 : 1}"><rect width="44" height="24" rx="12" fill="${track}"/><circle cx="${knobX}" cy="12" r="10" fill="#FFFFFF"/></svg>`
}

async function claude($: EngineInterface) {
  return (await $.env.get('CLAUDE_CODE_EXECPATH')) ?? 'claude'
}

// A mod is a plugin whose hooks.json names a hooks module.
async function isMod($: EngineInterface, installPath: string) {
  try {
    const hooks = JSON.parse(await $.fs.read(`${installPath}/hooks/hooks.json`))

    return Array.isArray(hooks.modules) && hooks.modules.length > 0
  } catch {
    return false
  }
}

async function refresh($: EngineInterface) {
  const { exitCode, stdout, stderr } = await $.process.run([
    await claude($),
    'plugin',
    'list',
    '--json',
  ])
  if (exitCode !== 0) {
    await update($, listing, () => ({ mods: [], error: stderr.trim() }))
    return
  }

  const installed: Installed[] = JSON.parse(stdout)
  const visible = installed.filter(
    one => one.scope === 'user' || one.projectPath === undefined || one.projectPath === cwd,
  )
  const mods: Mod[] = []
  for (const one of visible) {
    if (await isMod($, one.installPath)) {
      mods.push({ id: one.id, scope: one.scope, isEnabled: one.enabled })
    }
  }
  await update($, listing, () => ({ mods }))
}

async function toggle($: EngineInterface, mod: Mod) {
  await update($, listing, now => ({ ...now, busyId: mod.id, error: undefined }))
  const verb = mod.isEnabled ? 'disable' : 'enable'
  const { exitCode, stderr } = await $.process.run([
    await claude($),
    'plugin',
    verb,
    mod.id,
    '--scope',
    mod.scope,
  ])
  await refresh($)
  if (exitCode !== 0) {
    await update($, listing, now => ({ ...now, error: stderr.trim() }))
    return
  }
  // Loads or unloads the mod in this session too, not only in the next one.
  await $.command.run({ command: 'reload-plugins' }).catch(() => undefined)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    await $.command.register({
      name: 'mods',
      description: 'Show the global and project mods, and turn them on or off',
    })
    void refresh($)

    return next(e)
  })

  on('command.run', { command: 'mods' }, async $ => {
    await refresh($)
    const { isPlaced } = await $.ui.open({ id: PANE, title: TITLE })
    const { mods } = await read($, listing)
    const lines = mods.map(mod => `${mod.isEnabled ? 'on ' : 'off'}  ${mod.id} (${mod.scope})`)

    return { text: isPlaced ? 'Mods pane opened.' : lines.join('\n') || 'No mods installed.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const { mods, error, busyId } = await read($, listing)
    const global = mods.filter(mod => mod.scope === 'user')
    const project = mods.filter(mod => mod.scope !== 'user')

    // A switch drawn as a pill: the knob sits right when on, left when off.
    const knob = (mod: Mod) =>
      busyId === mod.id ? ' ··· ' : mod.isEnabled ? '   ● ' : ' ●   '

    const row = (mod: Mod) => {
      const [name, marketplace] = mod.id.split('@')

      return (
        <Box
          key={mod.id}
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box flexDirection="column" flexShrink={1}>
            <Text weight="semibold" dimColor={!mod.isEnabled} wrap="truncate-end">
              {name}
            </Text>
            <Text size="caption" dimColor wrap="truncate-end">
              {marketplace}
            </Text>
          </Box>
          {sw(mod, `${mod.isEnabled ? 'Turn off' : 'Turn on'} ${name}`)}
        </Box>
      )
    }

    // The terminal has no Svg: there the switch is the text pill alone.
    const sw = (mod: Mod, label: string) => {
      const press = () => void toggle($, mod)
      if (e.surface === 'terminal') {
        return (
          <Button key={`toggle:${mod.id}`} label={label} plain onPress={press}>
            <Text
              color="inverseText"
              backgroundColor={mod.isEnabled ? 'success' : 'inactive'}
              bold
            >
              {knob(mod)}
            </Text>
          </Button>
        )
      }

      // An Svg takes no press, so a blank Button lies over it and takes it.
      const { Svg } = $.ui.resolve(e)
      return (
        <Box key={`switch:${mod.id}`} position="relative">
          <Svg source={switchSvg(mod.isEnabled, busyId === mod.id)} alt={label} width={44} height={24} />
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Button key={`toggle:${mod.id}`} label={' '} plain onPress={press}>
              <Text color={mod.isEnabled ? '#34C759' : '#3A3A3C'}>{' '}</Text>
            </Button>
          </Box>
        </Box>
      )
    }

    const section = (title: string, list: Mod[]) => (
      <Box flexDirection="column" marginBottom={1} gap={1}>
        <Text size="footnote" weight="semibold" dimColor>
          {title.toUpperCase()} · {list.filter(mod => mod.isEnabled).length}/{list.length} on
        </Text>
        {list.length === 0 && <Text dimColor>No mods here</Text>}
        {list.map(row)}
      </Box>
    )

    return (
      <Box flexDirection="column">
        {section('Global', global)}
        {section('This project', project)}
        {error !== undefined && <Text color="error">{error}</Text>}
        <Button key="refresh" label="↻ Refresh" plain dimColor onPress={() => void refresh($)} />
      </Box>
    )
  })
}

export type Mod = {
  id: string
  scope: 'user' | 'project' | 'local'
  isEnabled: boolean
}

export type Listing = { mods: Mod[]; error?: string; busyId?: string }

declare module 'claude-code' {
  interface PluginState {
    'mod-manager': { listing: Shaped<Listing> }
  }
}

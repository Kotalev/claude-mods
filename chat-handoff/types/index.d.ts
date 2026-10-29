export type HandoffBand =
  | { phase: 'idle' }
  | { phase: 'offer'; tokens: number }
  | { phase: 'generating'; tokens: number }
  | { phase: 'error'; tokens: number; reason: string }
  | { phase: 'dismissed' }

declare module 'claude-code' {
  interface PluginState {
    'chat-handoff': { band: HandoffBand }
  }
}

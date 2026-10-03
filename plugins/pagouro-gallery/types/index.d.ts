export type Slide = { name: string; file: string; width: number; height: number; caption: string; category?: string; seed?: number }

declare module 'claude-code' {
  interface PluginState {
    'pagouro-gallery': {
      folder: string
      seconds: number
      index: number
      slides: Slide[]
      paused: boolean
    }
  }
}

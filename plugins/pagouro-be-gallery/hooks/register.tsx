import type { Register } from 'claude-code'

// Pagouro BE Gallery: a pane in Claude Code that shows one Belle Époque poster every few seconds, drawn by Pagouro BE,
// a free image model that runs offline on a USB stick (https://pagouro.com). Thirty pictures ship inside the plugin
// as small RGB thumbnails in base64 text and are drawn as half-block colour cells, so any truecolor terminal shows them.
// The plugin reads only its own files (or a folder the person names); it makes no network calls.
//
//   /pagouro_be                       open the gallery (12 s per picture)
//   /pagouro_be 20                    every 20 s
//   /pagouro_be next | prev | pause | play | stop
//   /pagouro_be folder <path>         show your own pictures (thumbnails made by tools/make_thumbs.py)
//   /pagouro_be folder                back to the bundled pictures

type Slide = { name: string; file: string; width: number; height: number; caption: string }

const PANE_ID = 'pagouro-be-gallery'
const CREDIT = 'Drawn by Pagouro BE, a free offline image model · pagouro.com'

// Module state, shared by the hooks below.
const state = { folder: '', seconds: 12, index: 0, slides: [] as Slide[], paused: false, isOpen: false, timer: 0 }

function join(dir: string, name: string): string {
  return dir.endsWith('/') || dir.endsWith('\\') ? dir + name : `${dir}/${name}`
}

function picturesDir($: any): string {
  return state.folder || join($.plugin.root, 'pictures')
}

async function loadSlides($: any): Promise<Slide[]> {
  try {
    const text = await $.fs.read(join(picturesDir($), 'index.json'))
    const list = JSON.parse(text) as Slide[]
    return Array.isArray(list) ? list.filter(s => s && s.name && s.width > 0 && s.height > 0) : []
  } catch {
    return []
  }
}

function step(by: number): void {
  const n = state.slides.length
  if (n) state.index = (state.index + by + n) % n
}

// One timer chain per opening: each tick schedules the next one, and a chain whose number is no longer current stops.
function schedule($: any, chain: number): void {
  $.clock.after(Math.max(2, state.seconds) * 1000, () => tick($, chain))
}

function tick($: any, chain: number): void {
  if (chain !== state.timer || !state.isOpen) return
  if (!state.paused) {
    step(1)
    $.ui.invalidate('ui.render')
  }
  schedule($, chain)
}

async function openGallery($: any): Promise<number> {
  state.slides = await loadSlides($)
  state.index = state.slides.length ? state.index % state.slides.length : 0
  state.isOpen = true
  state.timer += 1
  await $.ui.open({ id: PANE_ID, title: 'Pagouro BE Gallery' })
  schedule($, state.timer)
  $.ui.invalidate('ui.render')
  return state.slides.length
}

async function closeGallery($: any): Promise<void> {
  state.isOpen = false
  state.timer += 1
  await $.ui.close({ id: PANE_ID })
}

// Runs the /pagouro_be command and returns the line to show.
async function runCommand($: any, argText: string): Promise<string> {
  const args = argText.trim().split(/\s+/).filter(Boolean)
  const word = args[0]?.toLowerCase()
  if (word === 'next' || word === 'prev') {
    step(word === 'next' ? 1 : -1)
    $.ui.invalidate('ui.render')
    return word === 'next' ? 'Next picture.' : 'Previous picture.'
  }
  if (word === 'stop' || word === 'close') {
    await closeGallery($)
    return 'Gallery closed.'
  }
  if (word === 'pause' || word === 'play') {
    state.paused = word === 'pause'
    $.ui.invalidate('ui.render')
    return state.paused ? 'Gallery paused.' : 'Gallery playing.'
  }
  if (word === 'folder') {
    state.folder = args.slice(1).join(' ')
    state.index = 0
    const n = await openGallery($)
    if (!state.folder) return `Back to the ${n} bundled Pagouro BE pictures.`
    return n ? `Showing ${n} pictures from ${state.folder}.` : `No index.json in ${state.folder}. Make thumbnails with tools/make_thumbs.py.`
  }
  if (word && /^\d+$/.test(word)) state.seconds = Number(word)
  const n = await openGallery($)
  return `Pagouro BE Gallery: ${n} pictures, one every ${state.seconds} s. /pagouro_be stop to close.`
}

// Each cell is an upper half block: its foreground is one pixel and its background the pixel below it.
export function rasterCells(rgb: Uint8Array, width: number, height: number, columns: number, rows: number): string {
  const words = new Uint32Array(columns * rows * 3)
  const px = (x: number, y: number) => {
    const sx = Math.min(width - 1, Math.floor((x * width) / columns))
    const sy = Math.min(height - 1, Math.floor((y * height) / (rows * 2)))
    const o = (sy * width + sx) * 3
    return (rgb[o] << 16) | (rgb[o + 1] << 8) | rgb[o + 2]
  }
  let k = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      words[k++] = 0x2580
      words[k++] = px(c, 2 * r)
      words[k++] = px(c, 2 * r + 1)
    }
  }
  return new Uint8Array(words.buffer).toBase64()
}

async function readPicture($: any, name: string): Promise<Uint8Array> {
  // bundled pictures are base64 text (<name>.b64); thumbnails made by tools/make_thumbs.py are raw bytes (<name>.rgb)
  const dir = picturesDir($)
  try {
    const text = await $.fs.read(join(dir, `${name}.b64`))
    return Uint8Array.fromBase64(text.trim())
  } catch {
    const { base64 } = await $.fs.read(join(dir, `${name}.rgb`), { as: 'bytes' })
    return Uint8Array.fromBase64(base64)
  }
}

async function galleryView($: any, e: any) {
  const { Box, Text, Raster } = $.ui.resolve(e)
  const cols = Math.max(20, Math.min(120, (e.viewport?.columns ?? 80) - 2))
  const rowsAvail = Math.max(6, (e.viewport?.rows ?? 30) - 5)
  if (state.slides.length === 0) {
    return <Text dimColor>No pictures found in {picturesDir($)}.</Text>
  }
  const i = state.index % state.slides.length
  const s = state.slides[i]
  let picture = <Text dimColor>(picture missing: {s.name})</Text>
  try {
    const rgb = await readPicture($, s.name)
    if (rgb.length >= s.width * s.height * 3) {
      // terminal cells are about twice as tall as wide and hold two pixel rows, so a square picture is
      // twice as many columns as rows
      let rows = rowsAvail
      let columns = Math.round((rows * 2 * s.width) / s.height)
      if (columns > cols) {
        columns = cols
        rows = Math.max(1, Math.round((columns * s.height) / (2 * s.width)))
      }
      picture = <Raster key={`pic-${i}`} columns={columns} rows={rows} cells={rasterCells(rgb, s.width, s.height, columns, rows)} />
    }
  } catch {
    /* the missing-picture line stays */
  }
  return (
    <Box flexDirection="column">
      {picture}
      <Text>
        {i + 1}/{state.slides.length}
        {state.paused ? ' (paused)' : ''} {s.caption ? s.caption.slice(0, Math.max(10, cols - 12)) : s.name}
      </Text>
      <Text dimColor>{CREDIT}</Text>
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({
      name: 'pagouro_be',
      description: 'Pagouro BE Gallery: Belle Époque posters in a pane. /pagouro_be [seconds] | next | prev | pause | play | stop | folder [path]',
    })
    return r
  })

  on('command.run', { command: 'pagouro_be' }, async ($, e) => {
    const line = await runCommand($, String(e.args ?? ''))
    return { text: line }
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e)
    return galleryView($, e)
  })

  on('ui.close', async ($, e, next) => {
    if ((e as any).id === PANE_ID) {
      state.isOpen = false
      state.timer += 1
    }
    return next(e)
  })
}

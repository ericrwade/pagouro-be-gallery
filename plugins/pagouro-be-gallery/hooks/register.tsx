import type { EngineInterface, Register } from 'claude-code'

import type { Slide } from '../types'

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

const PANE = 'pagouro-be-gallery'
const CREDIT = 'Drawn by Pagouro BE, a free offline image model · pagouro.com'

let ticker: { cancel: () => void } | undefined

function join(dir: string, name: string): string {
  return dir.endsWith('/') || dir.endsWith('\\') ? dir + name : `${dir}/${name}`
}

async function getFolder($: EngineInterface): Promise<string> {
  const { value } = await $.state.get({ plugin: 'pagouro-be-gallery', key: 'folder' })
  return value ?? ''
}

async function getSeconds($: EngineInterface): Promise<number> {
  const { value } = await $.state.get({ plugin: 'pagouro-be-gallery', key: 'seconds' })
  return value ?? 12
}

async function getIndex($: EngineInterface): Promise<number> {
  const { value } = await $.state.get({ plugin: 'pagouro-be-gallery', key: 'index' })
  return value ?? 0
}

async function getSlides($: EngineInterface): Promise<Slide[]> {
  const { value } = await $.state.get({ plugin: 'pagouro-be-gallery', key: 'slides' })
  return value ?? []
}

async function getPaused($: EngineInterface): Promise<boolean> {
  const { value } = await $.state.get({ plugin: 'pagouro-be-gallery', key: 'paused' })
  return value ?? false
}

async function picturesDir($: EngineInterface): Promise<string> {
  const own = await getFolder($)
  return own || join($.plugin.root, 'pictures')
}

async function loadSlides($: EngineInterface, dir: string): Promise<Slide[]> {
  try {
    const text = await $.fs.read(join(dir, 'index.json'))
    const list = JSON.parse(text) as Slide[]
    return Array.isArray(list) ? list.filter(s => s && s.name && s.width > 0 && s.height > 0) : []
  } catch {
    return []
  }
}

async function step($: EngineInterface, by: number): Promise<void> {
  const list = await getSlides($)
  if (list.length === 0) return
  const i = await getIndex($)
  await $.state.set({ plugin: 'pagouro-be-gallery', key: 'index' }, (i + by + list.length) % list.length)
}

async function tick($: EngineInterface): Promise<void> {
  if (await getPaused($)) return
  await step($, 1)
}

async function restart($: EngineInterface): Promise<void> {
  if (ticker) ticker.cancel()
  const s = await getSeconds($)
  ticker = $.clock.every(Math.max(2, s) * 1000, () => tick($))
}

async function openGallery($: EngineInterface, secs?: number): Promise<number> {
  const list = await loadSlides($, await picturesDir($))
  if (secs) await $.state.set({ plugin: 'pagouro-be-gallery', key: 'seconds' }, secs)
  await $.state.set({ plugin: 'pagouro-be-gallery', key: 'slides' }, list)
  const i = await getIndex($)
  await $.state.set({ plugin: 'pagouro-be-gallery', key: 'index' }, list.length ? i % list.length : 0)
  await $.ui.open({ id: PANE, title: 'Pagouro BE Gallery' })
  await restart($)
  return list.length
}

async function closeGallery($: EngineInterface): Promise<void> {
  if (ticker) ticker.cancel()
  ticker = undefined
  await $.ui.close({ id: PANE })
}

// Runs the /pagouro_be command and returns the line to show the person.
async function runCommand($: EngineInterface, argText: string): Promise<string> {
  const args = argText.trim().split(/\s+/).filter(Boolean)
  const word = args[0]?.toLowerCase()
  if (word === 'next' || word === 'prev') {
    await step($, word === 'next' ? 1 : -1)
    return word === 'next' ? 'Next picture.' : 'Previous picture.'
  }
  if (word === 'stop' || word === 'close') {
    await closeGallery($)
    return 'Gallery closed.'
  }
  if (word === 'pause' || word === 'play') {
    await $.state.set({ plugin: 'pagouro-be-gallery', key: 'paused' }, word === 'pause')
    return word === 'pause' ? 'Gallery paused.' : 'Gallery playing.'
  }
  if (word === 'folder') {
    const dir = args.slice(1).join(' ')
    await $.state.set({ plugin: 'pagouro-be-gallery', key: 'folder' }, dir)
    await $.state.set({ plugin: 'pagouro-be-gallery', key: 'index' }, 0)
    const n = await openGallery($)
    if (!dir) return `Back to the ${n} bundled Pagouro BE pictures.`
    return n ? `Showing ${n} pictures from ${dir}.` : `No index.json in ${dir}. Make thumbnails with tools/make_thumbs.py.`
  }
  const secs = word && /^\d+$/.test(word) ? Number(word) : undefined
  const n = await openGallery($, secs)
  return `Pagouro BE Gallery: ${n} pictures, one every ${await getSeconds($)} s. /pagouro_be stop to close.`
}

// Each cell is an upper half block: its foreground is one pixel and its background the pixel below it.
export function rasterCells(rgb: Uint8Array, w: number, h: number, columns: number, rows: number): string {
  const words = new Uint32Array(columns * rows * 3)
  const px = (x: number, y: number) => {
    const sx = Math.min(w - 1, Math.floor((x * w) / columns))
    const sy = Math.min(h - 1, Math.floor((y * h) / (rows * 2)))
    const o = (sy * w + sx) * 3
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

async function readPicture($: EngineInterface, dir: string, name: string): Promise<Uint8Array> {
  // bundled pictures are base64 text (<name>.b64); thumbnails made by tools/make_thumbs.py are raw bytes (<name>.rgb)
  try {
    const text = await $.fs.read(join(dir, `${name}.b64`))
    return Uint8Array.fromBase64(text.trim())
  } catch {
    const { base64 } = await $.fs.read(join(dir, `${name}.rgb`), { as: 'bytes' })
    return Uint8Array.fromBase64(base64)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pagouro_be',
      description: 'Pagouro BE Gallery: Belle Époque posters in a pane. /pagouro_be [seconds] | next | prev | pause | play | stop | folder [path]',
    })
    return next(e)
  })

  on('command.run', { command: 'pagouro_be' }, async ($, e, next) => {
    const line = await runCommand($, String(e.args ?? ''))
    $.ui.toast(line)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Raster } = $.ui.resolve(e)
    const list = await getSlides($)
    const i = await getIndex($)
    const dir = await picturesDir($)
    const isPaused = await getPaused($)
    const cols = Math.max(20, Math.min(120, (e.viewport?.columns ?? 80) - 2))
    const rowsAvail = Math.max(6, (e.viewport?.rows ?? 30) - 5)
    if (list.length === 0) {
      return <Text dimColor>No pictures found in {dir}.</Text>
    }
    const s = list[i % list.length]
    let picture = <Text dimColor>(picture missing: {s.name})</Text>
    try {
      const rgb = await readPicture($, dir, s.name)
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
          {i + 1}/{list.length}
          {isPaused ? ' (paused)' : ''} {s.caption ? s.caption.slice(0, Math.max(10, cols - 12)) : s.name}
        </Text>
        <Text dimColor>{CREDIT}</Text>
      </Box>
    )
  })
}

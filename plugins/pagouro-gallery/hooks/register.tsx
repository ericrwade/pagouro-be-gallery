import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Slide } from '../types'

// Pagouro Gallery: a pane in Claude Code that shows one Belle Époque poster every few seconds, drawn by Pagouro BE,
// a free image model that runs offline on a USB stick (https://pagouro.com). Thirty pictures ship inside the plugin
// as small raw-RGB thumbnails and are drawn as half-block colour cells, so any truecolor terminal shows them.
//
//   /pagouro                       open the gallery (12 s per picture)
//   /pagouro 20                    every 20 s
//   /pagouro next | prev | pause | play | stop
//   /pagouro folder <path>         show your own pictures (thumbnails made by tools/make_thumbs.py)
//   /pagouro folder                back to the bundled pictures

const PANE = 'pagouro-gallery'
const CREDIT = 'Drawn by Pagouro BE, a free offline image model · pagouro.com'
const folder = atom({ plugin: 'pagouro-gallery', key: 'folder' } as const, '')
const seconds = atom({ plugin: 'pagouro-gallery', key: 'seconds' } as const, 12)
const index = atom({ plugin: 'pagouro-gallery', key: 'index' } as const, 0)
const slides = atom({ plugin: 'pagouro-gallery', key: 'slides' } as const, [] as Slide[])
const paused = atom({ plugin: 'pagouro-gallery', key: 'paused' } as const, false)

let ticker: { cancel: () => void } | undefined

const join = (dir: string, name: string) => (dir.endsWith('/') || dir.endsWith('\\') ? dir + name : `${dir}/${name}`)

async function picturesDir($: any): Promise<string> {
  const own = await read($, folder)
  return own || join($.plugin.root, 'pictures')
}

async function loadSlides($: any, dir: string): Promise<Slide[]> {
  try {
    const list = JSON.parse(await $.fs.read(join(dir, 'index.json'))) as Slide[]
    return Array.isArray(list) ? list.filter(s => s && s.name && s.width > 0 && s.height > 0) : []
  } catch {
    return []
  }
}

async function restart($: any) {
  if (ticker) ticker.cancel()
  const s = await read($, seconds)
  ticker = $.clock.every(Math.max(2, s) * 1000, async () => {
    if (await read($, paused)) return
    const list = await read($, slides)
    if (list.length) await update($, index, i => (i + 1) % list.length)
  })
}

async function open($: any, secs?: number) {
  const list = await loadSlides($, await picturesDir($))
  if (secs) await update($, seconds, () => secs)
  await update($, slides, () => list)
  await update($, index, i => (list.length ? i % list.length : 0))
  await $.ui.open({ id: PANE, title: 'Pagouro Gallery' })
  await restart($)
  return list.length
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pagouro',
      description: 'Pagouro Gallery: Belle Époque posters in a pane. /pagouro [seconds] | next | prev | pause | play | stop | folder [path]',
    })
    return next(e)
  })

  on('command.run', { command: 'pagouro' }, async ($, e) => {
    const args = String((e as any).args ?? '').trim().split(/\s+/).filter(Boolean)
    const word = args[0]?.toLowerCase()
    if (word === 'next' || word === 'prev') {
      const list = await read($, slides)
      if (list.length) await update($, index, i => (i + (word === 'next' ? 1 : list.length - 1)) % list.length)
      return { text: word === 'next' ? 'Next picture.' : 'Previous picture.' }
    }
    if (word === 'stop' || word === 'close') {
      if (ticker) ticker.cancel()
      ticker = undefined
      await $.ui.close({ id: PANE })
      return { text: 'Gallery closed.' }
    }
    if (word === 'pause' || word === 'play') {
      await update($, paused, () => word === 'pause')
      return { text: word === 'pause' ? 'Gallery paused.' : 'Gallery playing.' }
    }
    if (word === 'folder') {
      const dir = args.slice(1).join(' ')
      await update($, folder, () => dir)
      await update($, index, () => 0)
      const n = await open($)
      if (!dir) return { text: `Back to the ${n} bundled Pagouro BE pictures.` }
      return { text: n ? `Showing ${n} pictures from ${dir}.` : `No index.json in ${dir}. Make thumbnails with tools/make_thumbs.py from the plugin's repository.` }
    }
    const secs = word && /^\d+$/.test(word) ? Number(word) : undefined
    const n = await open($, secs)
    return { text: `Pagouro Gallery: ${n} pictures, one every ${await read($, seconds)} s. /pagouro stop to close.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Raster } = $.ui.resolve(e) as any
    const list = await read($, slides)
    const i = await read($, index)
    const dir = await picturesDir($)
    const isPaused = await read($, paused)
    const cols = Math.max(20, Math.min(120, (e.viewport?.columns ?? 80) - 2))
    const rowsAvail = Math.max(6, (e.viewport?.rows ?? 30) - 5)
    if (list.length === 0) {
      return <Text dimColor>No pictures found in {dir}.</Text>
    }
    const s = list[i % list.length]
    let picture: any = <Text dimColor>(picture missing: {s.name})</Text>
    try {
      const { base64 } = await $.fs.read(join(dir, `${s.name}.rgb`), { as: 'bytes' })
      const rgb = Uint8Array.fromBase64(base64)
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
      /* the alt line stays */
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

import { test, expect } from 'claude-code/testing'

import { rasterCells } from './register'

test('a 2x2 picture becomes one cell column per pixel, top pixel in front, bottom behind', () => {
  // red, green / blue, white
  const rgb = Uint8Array.of(255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255)
  const b64 = rasterCells(rgb, 2, 2, 2, 1)
  const words = new Uint32Array(Uint8Array.fromBase64(b64).buffer)
  expect(Array.from(words)).toEqual([0x2580, 0xff0000, 0x0000ff, 0x2580, 0x00ff00, 0xffffff])
})

test('pause, play and next answer the command themselves', async $ => {
  expect((await $.command.run({ command: 'pagouro_be', args: 'pause' })).text).toBe('Gallery paused.')
  expect((await $.command.run({ command: 'pagouro_be', args: 'play' })).text).toBe('Gallery playing.')
  expect((await $.command.run({ command: 'pagouro_be', args: 'next' })).text).toBe('Next picture.')
})

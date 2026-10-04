# Pagouro BE Gallery

A pane inside Claude Code that shows a Belle Époque poster every twelve seconds. Every picture was drawn by
[Pagouro BE](https://github.com/ericrwade/pagouro-be), a free image model that runs offline on a USB stick, trained only on
public-domain posters with a ledger for every one. Thirty pictures ship inside the plugin, and they are CC0: use them for
anything.

## Use

Type `/pagouro_be` in a Claude Code session to open the gallery. Add a number to change the pace, for example
`/pagouro_be 20` for one picture every twenty seconds. `/pagouro_be next`, `prev`, `pause`, `play` and `stop` do what they
say. `/pagouro_be folder <path>` shows your own pictures instead, once you have made thumbnails for them with the
`tools/make_thumbs.py` script in the repository; `/pagouro_be folder` with no path goes back to the bundled pictures.

## What it looks like, honestly

The pane draws each picture with colored text characters, not real pixels: each cell is an upper half block whose text
color is one pixel and whose background color is the pixel below it. A poster comes out at roughly 60 by 60 pixels, a bold
mosaic rather than a sharp image. On Windows Terminal and the Windows desktop app the cells are large, so the mosaic is
coarse; make the pane bigger and the font smaller for a finer picture. Any terminal needs 24-bit color for the colors to
be right.

## What the hooks do

The plugin is one readable TypeScript file, `hooks/register.tsx`, a Claude Code mod with four hooks:

- **`session.start`**: lets the session start as usual, then registers the `/pagouro_be` slash command.
- **`command.run` for `/pagouro_be` only**: opens, steps, pauses, resumes or closes the gallery pane and answers with a
  one-line confirmation. It answers no other command.
- **`ui.render` for its own pane only**: reads the current picture from the plugin's `pictures` folder and draws it as
  colored character cells, with its caption and the credit line underneath. Every other part of Claude Code's interface
  is passed on unchanged.
- **`ui.close`**: when you close the gallery pane, it notes that the pane is closed and stops its timer; every close is
  passed on unchanged.

While the pane is open, a timer moves to the next picture every few seconds and asks Claude Code to redraw the pane. The
plugin's only memory is a few values in the module itself (the folder, the pace, the current picture, the picture list,
whether it is paused), kept for the session and never written to disk.

## What it runs, reads and sends

It reads only its own `pictures` folder, or a folder you name with `/pagouro_be folder`. It makes no network calls, sends
nothing anywhere, starts no processes, and changes no settings. The credit line under each picture names pagouro.com as
text; nothing is fetched from it.

## License

Code: Apache 2.0 (`LICENSE`). Pictures: CC0 1.0. Pagouro BE itself is CC BY-SA 4.0, a fine-tune of CommonCanvas-S-C.
Made by Eric Wade, with Claude (Anthropic).

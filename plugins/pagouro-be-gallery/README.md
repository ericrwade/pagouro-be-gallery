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

## What it runs, reads and sends

The plugin is one readable TypeScript file, `hooks/register.tsx`. It registers the `/pagouro_be` command and draws one pane.
It reads only its own `pictures` folder, or a folder you name with `/pagouro_be folder`. It makes no network calls, sends
nothing anywhere, starts no processes, and changes no settings. The credit line under each picture names pagouro.com as
text; nothing is fetched from it.

## License

Code: Apache 2.0 (`LICENSE`). Pictures: CC0 1.0. Pagouro BE itself is CC BY-SA 4.0, a fine-tune of CommonCanvas-S-C.
Made by Eric Wade, with Claude (Anthropic).

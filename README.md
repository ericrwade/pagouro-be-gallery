# Pagouro Gallery for Claude Code

A pane inside Claude Code that shows a Belle Époque poster every few seconds. Every picture was drawn by
[Pagouro BE](https://github.com/ericrwade/pagouro-be), a free image model that runs offline on a USB stick, trained only on
public-domain posters with a ledger for every one. The pictures are CC0: use them for anything.

![thirty pictures in the gallery](gallery_sheet.jpg)

## Install

```
claude plugin marketplace add ericrwade/pagouro-gallery
claude plugin install pagouro-gallery@pagouro
```

Then, in a Claude Code session:

```
/pagouro              open the gallery, one picture every 12 seconds
/pagouro 20           one every 20 seconds
/pagouro next         /pagouro prev      /pagouro pause      /pagouro play      /pagouro stop
```

Nothing to set up: thirty pictures ship inside the plugin. No network, no Python, no account.

## How it draws

Each terminal cell is an upper half block (▀): its text colour is one pixel and its background colour is the pixel below
it, so one character shows two pixels. That works in any terminal with 24-bit colour (Windows Terminal, iTerm2, kitty,
Ghostty, the Claude Code desktop app), and it is why the pictures look like bold mosaics rather than photographs: a poster
is drawn at roughly 60 by 60 pixels. The full-size pictures are in the Pagouro BE repository.

## Your own pictures

`tools/make_thumbs.py` turns a folder of PNG or JPG files into the thumbnails the plugin reads (needs Python and
Pillow):

```
python tools/make_thumbs.py "C:\path\to\pictures"
```

It writes a `thumbs` folder inside that folder. Then in Claude Code:

```
/pagouro folder C:\path\to\pictures\thumbs
/pagouro folder                       back to the bundled pictures
```

## What is in it

`plugins/pagouro-gallery/hooks/register.tsx` is the whole plugin (one file, about 170 lines), with a test beside it.
`plugins/pagouro-gallery/pictures/` holds the thirty thumbnails and `index.json` with each picture's caption, its
category and the seed it was drawn with. The prompts, seeds and judge notes for all 180 showcase pictures they were
chosen from are in `showcase/x180/prompts.jsonl` of the Pagouro BE repository.

## License

Code: Apache 2.0. Pictures: CC0 1.0 (Pagouro BE's outputs carry no rights). Pagouro BE itself is CC BY-SA 4.0, a
fine-tune of CommonCanvas-S-C.

Eric Wade, with Claude (Anthropic). https://pagouro.com

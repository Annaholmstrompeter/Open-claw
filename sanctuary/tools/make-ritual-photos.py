#!/usr/bin/env python3
"""Make the five ritual photographs for the carousel on the Rituals page.

One photograph (content/source/ritual-photo.jpg: the Presence bottle in its box, Anna's picture) becomes five: the
name and the one line on the bottle's label are replaced for each ritual. The paper under the old words is
filled from clean paper of the same label (so its grain and shading stay), and the new words are set
in the site's own letters (Cormorant Garamond), at the measured size, spacing and colour of the old ones.
Everything else in the picture is untouched. Presence is the picture itself.

The taglines are the ones on Anna's front-page picture. The bottle is the picture's: 30 ml "Ritual Oil", which is
not the real product (hand wash, hand cream ...): it stands in until there are real photographs.

Writes public/assets/img/ritual-<id>.webp (900 x 1125).
Needs: pillow, numpy, fonttools + brotli (to read the site's woff2 fonts).
Usage:  python3 sanctuary/tools/make-ritual-photos.py [--preview]     (--preview also writes a zoomed check picture)
"""
import io
import pathlib
import sys
import tempfile

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "source" / "ritual-photo.jpg"
FONTS = ROOT / "public" / "assets" / "fonts"
OUT = ROOT / "public" / "assets" / "img"

TAGLINES = {
    "balance": "A calmer tomorrow.",
    "luminance": "A brighter you.",
    "kindness": "Happier skin, gentler days.",
    "serenity": "A softer pace.",
    "presence": "I return to myself.",
}

# Measured on the picture (pixels): the label's words and where clean paper is.
CENTER = 450.5
NAME = dict(box=(358, 835, 543, 867), clean_y=(801, 833), width=161, cap=21, y_top=840)
TAG = dict(box=(366, 948, 536, 984), clean_y=(930, 950), width=145, y_top=955, max_width=186)
INK = (72, 64, 58)


def ttf(name):
    """The site's woff2 font as a TTF in a temp folder (Pillow cannot read woff2)."""
    tmp = pathlib.Path(tempfile.gettempdir()) / "bme-fonts"
    tmp.mkdir(exist_ok=True)
    out = tmp / (name + ".ttf")
    if not out.exists():
        f = TTFont(str(FONTS / (name + ".woff2")))
        f.flavor = None
        f.save(str(out))
    return str(out)


def fill_paper(img, box, clean_y):
    """Cover the old words with clean paper from the same label: the rows above them, mirrored to the height needed."""
    x0, y0, x1, y1 = box
    c0, c1 = clean_y
    strip = np.asarray(img.crop((x0, c0, x1, c1)))
    need = y1 - y0
    rows, flip = [], False
    while sum(len(r) for r in rows) < need:
        rows.append(strip[::-1] if flip else strip)
        flip = not flip
    block = np.concatenate(rows, axis=0)[:need]
    img.paste(Image.fromarray(block), (x0, y0))


def paint_text(img, text, font_path, size, tracking, cx, ink_top, ref_char="H"):
    """Set text so that its letters' top lands on ink_top (the picture's own measured line)."""
    S = 4
    font = ImageFont.truetype(font_path, int(size * S))
    asc_top = font.getbbox(ref_char)[1] / S           # where the top of a capital sits under the text origin
    layer = Image.new("L", (img.width * S, img.height * S), 0)
    d = ImageDraw.Draw(layer)
    total = sum(font.getlength(ch) for ch in text) + tracking * S * (len(text) - 1)
    x = cx * S - total / 2
    y = (ink_top - asc_top) * S
    for ch in text:
        d.text((x, y), ch, font=font, fill=255)
        x += font.getlength(ch) + tracking * S
    layer = layer.resize(img.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.45))   # as soft as the picture
    ink = Image.new("RGB", img.size, INK)
    img.paste(ink, (0, 0), layer.point(lambda v: int(v * 0.94)))


def dark_bbox(img, region, thr=150):
    """The box around the dark ink in a region, measured the same way on the original and on ours."""
    x0, y0, x1, y1 = region
    lum = np.asarray(img.crop(region)).astype(float).mean(axis=2)
    ys, xs = np.where(lum < thr)
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max(), y0 + ys.max()


def calibrate():
    """Size and spacing that make our letters as tall and as wide as the picture's own (measured, not guessed)."""
    name_font = ttf("cormorant-garamond-latin-500-normal")
    tag_font = ttf("cormorant-garamond-latin-400-italic")
    base = Image.open(SRC).convert("RGB")
    want_w = NAME["width"]
    want_h = NAME["cap"]
    best = None
    for size in np.arange(22.0, 36.0, 0.5):
        f = ImageFont.truetype(name_font, int(size * 10))
        natural = sum(f.getlength(c) for c in "PRESENCE") / 10
        tracking = (want_w - natural) / 7
        probe = base.copy()
        fill_paper(probe, NAME["box"], NAME["clean_y"])
        paint_text(probe, "PRESENCE", name_font, size, tracking, CENTER, NAME["y_top"])
        x0, y0, x1, y1 = dark_bbox(probe, (340, 832, 560, 870))
        err = abs((y1 - y0) - want_h) * 4 + abs((x1 - x0) - want_w)
        if best is None or err < best[0]:
            best = (err, size, tracking)
    _, size, tracking = best
    # tagline: "I return to myself." is TAG['width'] wide at no extra spacing
    f2 = ImageFont.truetype(tag_font, 400)
    base = f2.getlength(TAGLINES["presence"]) / 400
    tag_size = TAG["width"] / base
    return name_font, size, tracking, tag_font, tag_size


def tagline_size(tag_font, size, text):
    f = ImageFont.truetype(tag_font, 400)
    w = f.getlength(text) / 400 * size
    return size if w <= TAG["max_width"] else size * TAG["max_width"] / w


def make(rid, base, cal):
    name_font, size, tracking, tag_font, tag_size = cal
    img = base.copy()
    if rid != "presence":
        fill_paper(img, NAME["box"], NAME["clean_y"])
        paint_text(img, rid.upper(), name_font, size, tracking, CENTER, NAME["y_top"])
        fill_paper(img, TAG["box"], TAG["clean_y"])
        text = TAGLINES[rid]
        ts = tagline_size(tag_font, tag_size, text)
        # the tagline's own top (the capital or ascender) sits where the old one did, a little lower for a smaller size
        paint_text(img, text, tag_font, ts, 0.0, CENTER + 1, TAG["y_top"] + (tag_size - ts) * 0.5, ref_char="l")
    return img


def main():
    base = Image.open(SRC).convert("RGB")
    cal = calibrate()
    print("name size %.1f px, spacing %.2f px; tagline size %.1f px" % (cal[1], cal[2], cal[4]))
    OUT.mkdir(parents=True, exist_ok=True)
    tiles = []
    for rid in TAGLINES:
        img = make(rid, base, cal)
        img.resize((900, 1125), Image.LANCZOS).save(OUT / ("ritual-%s.webp" % rid), quality=82, method=6)
        tiles.append(img.crop((318, 640, 582, 1050)))
        print("wrote ritual-%s.webp  %d KB" % (rid, (OUT / ("ritual-%s.webp" % rid)).stat().st_size // 1024))
    if "--preview" in sys.argv:
        w, h = tiles[0].size
        sheet = Image.new("RGB", (w * len(tiles) * 2, h * 2), (240, 235, 225))
        for i, t in enumerate(tiles):
            sheet.paste(t.resize((w * 2, h * 2), Image.LANCZOS), (i * w * 2, 0))
        sheet.save(pathlib.Path(tempfile.gettempdir()) / "ritual-label-preview.png")
        print("preview:", pathlib.Path(tempfile.gettempdir()) / "ritual-label-preview.png")


if __name__ == "__main__":
    main()

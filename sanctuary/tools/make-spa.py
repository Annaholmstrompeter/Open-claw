#!/usr/bin/env python3
"""Make one spa's own page: its photograph, its name, a thank-you and a link to book.

    python3 sanctuary/tools/make-spa.py --slug horizon-hill --name "Horizon Hill Spa" --photo path/to/photo.jpg \\
        --book-url https://example.com/book --thanks "Thank you for taking this moment with us." [--logo logo.png] [--demo]

Writes public/spas/<slug>/hero.webp (+ logo.webp) and spa.js. The page is then   <site>/?s=<slug>#/
Everything else on the page is the sanctuary itself; only the picture, the name and the way to book are the spa's.

IMPORTANT: a real spa's pictures and name are theirs. Real spas are built in a PRIVATE copy of the project (public/spas/ is
kept out of the public repository by .gitignore, except the fictional demo). The photograph is graded to the house look
(a little less colour, warm highlights, soft umber shadows) so that every spa looks equally at home next to the products.
Needs: pillow, numpy.
"""
import argparse
import json
import pathlib
import re
import sys

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
RATIO = 1.1            # width / height of the front page's picture


def grade(img):
    """The house look: calm the loudest blues, warm the lights, soft umber in the shadows."""
    hsv = np.asarray(img.convert("HSV")).astype(np.float32)
    hue = hsv[..., 0] / 255 * 360
    sat = hsv[..., 1] / 255
    blue = ((hue > 170) & (hue < 260)).astype(np.float32)
    hsv[..., 1] = np.clip(sat * (1 - 0.55 * blue) * 0.88, 0, 1) * 255
    g = np.asarray(Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")).astype(np.float32) / 255
    lum = g.mean(axis=2, keepdims=True)
    g = g * np.array([1.04, 0.98, 0.86], dtype=np.float32)
    g = g * (1 - 0.12 * (1 - lum)) + np.array([0.20, 0.14, 0.09], dtype=np.float32) * 0.12 * (1 - lum)
    g = np.clip((g - 0.5) * 0.96 + 0.5 + 0.015, 0, 1)
    return Image.fromarray((g * 255).astype(np.uint8))


def crop(img, focus):
    w, h = img.size
    if w / h > RATIO:                       # too wide: cut the sides, around the focus
        cw = int(h * RATIO)
        x0 = int(min(max(focus[0] * w - cw / 2, 0), w - cw))
        return img.crop((x0, 0, x0 + cw, h))
    ch = int(w / RATIO)                     # too tall: cut top and bottom
    y0 = int(min(max(focus[1] * h - ch / 2, 0), h - ch))
    return img.crop((0, y0, w, y0 + ch))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True, help="lower case letters, digits and hyphens: it is the address (?s=<slug>)")
    ap.add_argument("--name", required=True, help="the spa's name as it should be written")
    ap.add_argument("--photo", required=True, help="the spa's photograph")
    ap.add_argument("--focus", default="0.5,0.5", help="where the picture's centre of interest is, as x,y between 0 and 1")
    ap.add_argument("--logo", help="the spa's logotype (an image with a transparent or light background); otherwise the name is set in type")
    ap.add_argument("--book-url", default="", help="the spa's own booking page (or tel:/mailto:)")
    ap.add_argument("--thanks", default="Thank you for taking this moment with us.", help="the line after the ritual")
    ap.add_argument("--no-grade", action="store_true", help="use the photograph as it is")
    ap.add_argument("--demo", action="store_true", help="a fictional example spa: says so on the page")
    a = ap.parse_args()

    if not re.fullmatch(r"[a-z0-9-]{2,40}", a.slug):
        sys.exit("the slug must be 2-40 lower case letters, digits or hyphens")
    fx, fy = (float(v) for v in a.focus.split(","))
    out = ROOT / "public" / "spas" / a.slug
    out.mkdir(parents=True, exist_ok=True)

    img = Image.open(a.photo).convert("RGB")
    img = crop(img, (fx, fy))
    if img.width > 1500:
        img = img.resize((1500, int(1500 / RATIO)), Image.LANCZOS)
    if not a.no_grade:
        img = grade(img)
    img.save(out / "hero.webp", quality=84, method=6)

    logo = None
    if a.logo:
        lg = Image.open(a.logo).convert("RGBA")
        lg.thumbnail((640, 240), Image.LANCZOS)
        lg.save(out / "logo.webp", quality=90, lossless=False)
        logo = "spas/%s/logo.webp" % a.slug

    conf = {"slug": a.slug, "name": a.name, "hero": "spas/%s/hero.webp" % a.slug, "logo": logo,
            "bookUrl": a.book_url, "thanks": a.thanks, "demo": bool(a.demo)}
    (out / "spa.js").write_text("/* %s: made by tools/make-spa.py */\nwindow.BME_SPA = %s;\n" % (a.name, json.dumps(conf, ensure_ascii=False, indent=1)))
    print("wrote", out.relative_to(ROOT.parent), " -> open  <site>/?s=%s#/" % a.slug)


if __name__ == "__main__":
    main()

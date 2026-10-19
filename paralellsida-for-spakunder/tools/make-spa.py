#!/usr/bin/env python3
"""Make one spa's own page: its photograph, its name, a thank-you and a link to book.

    python3 paralellsida-for-spakunder/tools/make-spa.py --slug horizon-hill --name "Horizon Hill Spa" --photo path/to/photo.jpg \\
        --book-url https://example.com/book --shop-url https://example.com/shop --thanks "Thank you for taking this moment with us." \\
        [--logo logo.png] [--short-name "Horizon Hill"] [--demo]

Writes public/spas/<slug>/hero.webp (+ logo.webp), spa.js, and what lets a guest keep the page as an app on the phone:
manifest.webmanifest and icon-180/192/512.png (the spa's logo on sand; without a logo its initials in the house style; --icon photo for a square of the photograph).
The page is then   <site>/spas/<slug>/   (python3 tools/build-content.py makes spas/<slug>/index.html; <site>/?s=<slug> also works)
Without --shop-url the "Refill" button goes to the house shop (BME_HOUSE_SHOP in assets/spa-loader.js), or is left out while that is empty.
Everything else on the page is the sanctuary itself; only the picture, the name and the way to book are the spa's.

IMPORTANT: a real spa's pictures and name are theirs. Real spas are built in a PRIVATE copy of the project (public/spas/ is
kept out of the public repository by .gitignore, except the fictional demo). The photograph is graded to the house look
(a little less colour, warm highlights, soft umber shadows) so that every spa looks equally at home next to the products.
Needs: pillow, numpy (and fonttools + brotli for the initials icon).
"""
import argparse
import io
import json
import pathlib
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
RATIO = 1.1            # width / height of the front page's picture
SAND = (239, 230, 214)  # #efe6d6: the app's background colour, behind a logo in the icon
GOLD = (184, 153, 63)
INK = (51, 41, 29)


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


def serif_font(size):
    """The house serif (Cormorant Garamond) for the monogram. The site's copy is a woff2 file, which Pillow cannot read, so it is
    unpacked in memory (needs: pip install fonttools brotli); without those, a plain serif is used."""
    try:
        from fontTools.ttLib import TTFont
        f = TTFont(str(ROOT / "public" / "assets" / "fonts" / "cormorant-garamond-latin-500-normal.woff2"))
        f.flavor = None
        buf = io.BytesIO()
        f.save(buf)
        buf.seek(0)
        return ImageFont.truetype(buf, size)
    except Exception:
        for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", "/Library/Fonts/Georgia.ttf", "C:/Windows/Fonts/georgia.ttf"):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
        return ImageFont.load_default()


def monogram_initials(name):
    words = [w for w in re.split(r"[^A-Za-zÅÄÖåäöÉéÜü]+", name) if w and w.lower() not in ("spa", "hotel", "hotell", "the", "resort", "wellness", "retreat")]
    return "".join(w[0] for w in words[:2]).upper() or name[:1].upper()


def monogram_tile(text):
    """A calm icon that reads in a small circle: sand ground, one fine gold ring, the spa's initials in the house serif.
    Everything lies well inside the middle of the square, so a round or rounded mask never cuts it."""
    tile = Image.new("RGB", (512, 512), SAND)
    d = ImageDraw.Draw(tile)
    d.ellipse((74, 74, 438, 438), outline=GOLD, width=6)
    size = 230 if len(text) == 1 else 176
    font = serif_font(size)
    track = 0 if len(text) == 1 else 16
    advances = [font.getlength(ch) for ch in text]
    total = sum(advances) + track * (len(text) - 1)
    cap = font.getbbox("H")
    cap_h = cap[3] - cap[1]
    x = 256 - total / 2
    baseline = 256 + cap_h / 2
    for ch, adv in zip(text, advances):
        d.text((x, baseline), ch, font=font, fill=INK, anchor="ls")
        x += adv + track
    return tile


def make_icons(out, hero, logo_path, mode="auto", text=""):
    """The icon on the guest's home screen (and in the phone's own "add to home screen" box): the spa's logo on sand if there is one, else
    the spa's initials in the house style (mode "monogram"); mode "photo" gives a square of the spa's photograph instead."""
    if mode == "auto":
        mode = "logo" if logo_path else "monogram"
    if mode == "monogram":
        tile = monogram_tile(text)
    elif mode == "logo" and logo_path:
        lg = Image.open(logo_path).convert("RGBA")
        lg.thumbnail((340, 340), Image.LANCZOS)
        tile = Image.new("RGB", (512, 512), SAND)
        tile.paste(lg, ((512 - lg.width) // 2, (512 - lg.height) // 2), lg)
    else:   # photo
        side = min(hero.size)
        x0 = (hero.width - side) // 2
        tile = hero.crop((x0, 0, x0 + side, side)).resize((512, 512), Image.LANCZOS)
    for size in (512, 192, 180):
        tile.resize((size, size), Image.LANCZOS).save(out / ("icon-%d.png" % size), optimize=True)


def make_manifest(out, slug, name, short):
    """One installable app per spa: its own identity (id), name and icon, opening that spa's page, spas/<slug>/ (start_url "./").
    Its scope is that folder only ("./"), so an installed spa app never takes over another spa's links (a scope of the whole site
    would). Paths are relative to this file, so they hold on any address the site is put on (github.io/<repo>/ or a domain)."""
    manifest = {
        "id": "./",
        "name": name,
        "short_name": short,
        "description": "A sensory ritual from %s, with Body Mind Earth." % name,
        "lang": "en",
        "start_url": "./",
        "scope": "./",
        "display": "standalone",
        "orientation": "portrait",
        "background_color": "#efe6d6",
        "theme_color": "#efe6d6",
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    (out / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True, help="lower case letters, digits and hyphens: it is the address (?s=<slug>)")
    ap.add_argument("--name", required=True, help="the spa's name as it should be written")
    ap.add_argument("--photo", required=True, help="the spa's photograph")
    ap.add_argument("--focus", default="0.5,0.5", help="where the picture's centre of interest is, as x,y between 0 and 1")
    ap.add_argument("--logo", help="the spa's logotype (an image with a transparent or light background); otherwise the name is set in type")
    ap.add_argument("--book-url", default="", help="the spa's own booking page (or tel:/mailto:)")
    ap.add_argument("--shop-url", default="", help="the spa's own shop (or tel:/mailto:); without it the house shop is used, if there is one")
    ap.add_argument("--short-name", default="", help="the name under the icon on the phone; phones cut it at about 9 letters (\"Horizon\", not \"Horizon Hill\"); default: the spa's name")
    ap.add_argument("--icon", choices=["auto", "logo", "monogram", "photo"], default="auto", help="the icon on the phone: auto = the logo if there is one, else the initials")
    ap.add_argument("--monogram", default="", help="the letters in the initials icon (default: the first letters of the name's first two words)")
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

    short = a.short_name or a.name
    if len(short) > 9:
        print("note: the name under the icon, \"%s\", is %d letters; phones cut it at about 9. Give a shorter one with --short-name." % (short, len(short)))
    make_icons(out, img, a.logo, a.icon, (a.monogram or monogram_initials(a.name)).upper())
    make_manifest(out, a.slug, a.name, short)

    conf = {"slug": a.slug, "name": a.name, "shortName": short, "hero": "spas/%s/hero.webp" % a.slug, "logo": logo,
            "bookUrl": a.book_url, "shopUrl": a.shop_url, "thanks": a.thanks, "demo": bool(a.demo)}
    (out / "spa.js").write_text("/* %s: made by tools/make-spa.py */\nwindow.BME_SPA = %s;\n" % (a.name, json.dumps(conf, ensure_ascii=False, indent=1)))
    print("wrote", out.relative_to(ROOT.parent), " -> run tools/build-content.py, then open  <site>/spas/%s/" % a.slug)


if __name__ == "__main__":
    main()

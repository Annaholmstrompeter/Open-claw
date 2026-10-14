#!/usr/bin/env python3
"""Take the artwork out of the label PDFs, so the sanctuary looks like the labels.

The label PDFs are pure vector files, so everything can be rendered sharply. For each ritual this
makes, in public/assets/img/:

  logo.webp               the gold sea-urchin mark (transparent), once
  <id>-botanical.webp     the engraved botanical from the product panel (transparent)
  <id>-waves.webp         the flowing line ornament from the ritual panel (transparent)
  <id>-species.webp       the endangered-species engraving from the middle panel (on label cream)
  waves-gold.webp         the line ornament in gold only, for the cream pages

Text on the labels is never copied as pictures: it lives in content/products.json as real text.

Needs:  poppler's pdftoppm, and  pip install numpy scipy pillow
Usage:  python3 sanctuary/tools/extract-label-art.py  <folder-with-the-five-label-PDFs>  [out-dir]
(the PDF file names must contain Balance, Luminance, Kindness, Serenity and Presence)
"""
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RITUALS = ["balance", "luminance", "kindness", "serenity", "presence"]
DPI = 400
K = DPI / 150.0  # the coordinates below were measured on a 150 dpi render of the 176 x 96 mm label

GOLD = np.array([212, 175, 55], float)          # #d4af37
LINE_CREAM = np.array([244, 232, 215], float)   # #f4e8d7, the wave lines
WHITE = np.array([255, 255, 255], float)        # label text
PANEL_CREAM = np.array([255, 247, 233], float)  # #fff7e9, the middle panel


def render(pdf, dpi, crop=None):
    with tempfile.TemporaryDirectory() as tmp:
        base = pathlib.Path(tmp) / "page"
        cmd = ["pdftoppm", "-r", str(dpi), "-png", "-singlefile"]
        if crop:
            x, y, w, h = crop
            cmd += ["-x", str(x), "-y", str(y), "-W", str(w), "-H", str(h)]
        subprocess.run(cmd + [str(pdf), str(base)], check=True)
        return np.array(Image.open(str(base) + ".png").convert("RGB"), dtype=float)


def find_pdf(folder, rid):
    hits = [p for p in sorted(folder.glob("*.pdf")) if rid in p.name.lower()]
    if len(hits) != 1:
        sys.exit("Expected exactly one PDF with '%s' in its name in %s, found %d" % (rid, folder, len(hits)))
    return hits[0]


def panels(img):
    """x where the cream middle panel starts and ends, found on one row."""
    row = img[int(300 * K)]
    xs = np.where(np.all(row == PANEL_CREAM, axis=1))[0]
    return int(xs.min()), int(xs.max())


def big_components(mask, min_side=None, min_extent=None, grow=4):
    """Keep only the large connected pieces of a mask (artwork), dropping small ones (text)."""
    grown = ndi.binary_dilation(mask, structure=np.ones((3, 3)), iterations=grow)
    lab, n = ndi.label(grown, structure=np.ones((3, 3)))
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        ok = True
        if min_side is not None:
            ok = ok and min(h, w) >= min_side
        if min_extent is not None:
            ok = ok and max(h, w) >= min_extent
        keep[i] = ok
    return keep[lab]


def save_rgba(rgb, alpha, path, pad=3, scale=1.0, lossless=False, quality=90):
    ys, xs = np.where(alpha > 0.02)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, alpha.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, alpha.shape[1])
    out = np.dstack([rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1] * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(path, "WEBP", lossless=lossless, quality=quality, alpha_quality=100, method=6)
    return im.size


def logo(pdf, bg, out):
    """The gold urchin, rendered large from the vector file and made transparent."""
    page = render(pdf, DPI)
    _, x_cream_end = panels(page)
    region = page[: int(115 * K), x_cream_end + 3:]
    gold = np.sqrt(((region - GOLD) ** 2).sum(2)) < 45
    ys, xs = np.where(gold)
    pt = 72.0 / DPI
    x0, x1 = (xs.min() + x_cream_end + 3) * pt, (xs.max() + x_cream_end + 3) * pt
    y0, y1 = ys.min() * pt, ys.max() * pt
    hi = 1400  # dpi for the crop
    f = hi / 72.0
    m = 4  # points of margin
    crop = (int((x0 - m) * f), int((y0 - m) * f), int((x1 - x0 + 2 * m) * f), int((y1 - y0 + 2 * m) * f))
    img = render(pdf, hi, crop)
    d = GOLD - bg
    t = (((img - bg) @ d) / (d @ d)).clip(0, 1)
    rgb = np.broadcast_to(GOLD, img.shape)
    return save_rgba(rgb, t, out, lossless=True, scale=0.5)


def botanical(img, bg, out):
    h, w, _ = img.shape
    _, x_end = panels(img)
    x0, x1 = x_end + 3, min(w, x_end + int(235 * K))
    y0 = int(300 * K)
    reg = img[y0:h, x0:x1]
    dist = np.sqrt(((reg - bg) ** 2).sum(2))
    # the label's text is pure white and the engravings never are: remove it, plus its soft edge
    text = ndi.binary_dilation(reg.min(2) >= 250, structure=np.ones((3, 3)), iterations=3)
    keep = big_components((dist > 10) & ~text, min_side=int(40 * K), grow=5)
    keep = ndi.binary_dilation(ndi.binary_fill_holes(keep), iterations=2) & ~text
    alpha = ((dist - 4) / 14).clip(0, 1) * keep
    # remove the background tint that bleeds into soft edges
    a = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.where(alpha[..., None] < 0.95, bg + (reg - bg) / a, reg)
    return save_rgba(rgb, alpha, out, scale=0.9, quality=88)


def waves(img, bg, out):
    h, w, _ = img.shape
    x_start, _ = panels(img)
    reg = img[:, :x_start]
    # tint line colour: the commonest mid-tone between the ground and the cream lines in the right strip
    strip = reg[:, int(300 * K):].reshape(-1, 3)
    sd = np.sqrt(((strip - bg) ** 2).sum(1))
    mid = strip[(sd > 40) & (np.abs(strip - LINE_CREAM).sum(1) > 60) & (np.abs(strip - GOLD).sum(1) > 60)]
    vals, counts = np.unique(mid.astype(int), axis=0, return_counts=True)
    tint = vals[counts.argmax()].astype(float)
    palette = [LINE_CREAM, GOLD, tint, WHITE]
    # the gold subtitles ("The Scent" ...) and the logo are gold too, but are not ornament
    skip = np.zeros(reg.shape[:2], bool)
    for bx0, by0, bx1, by1 in [(120, 128, 265, 162), (120, 218, 265, 252), (120, 308, 265, 342), (150, 400, 235, 485)]:
        skip[int(by0 * K):int(by1 * K), int(bx0 * K):int(bx1 * K)] = True
    ts, errs = [], []
    flat = reg.reshape(-1, 3)
    for f in palette:
        d = f - bg
        t = (((flat - bg) @ d) / (d @ d)).clip(0, 1)
        ts.append(t)
        errs.append(((flat - (bg + t[:, None] * d)) ** 2).sum(1) + (4.0 if f is tint else 0.0))
    best = np.argmin(np.stack(errs), axis=0)
    t = np.choose(best, ts)
    t[best == 3] = 0  # white is label text, not ornament
    t[np.sqrt(((flat - bg) ** 2).sum(1)) < 8] = 0
    colours = np.array(palette)[best]
    alpha = t.reshape(reg.shape[:2])
    alpha[skip] = 0
    keep = big_components(alpha > 0.3, min_extent=int(34 * K), grow=3)
    keep = ndi.binary_dilation(keep, iterations=2)
    alpha = alpha * keep
    size = save_rgba(colours.reshape(reg.shape), alpha, out, lossless=True, scale=0.62)
    return size, tint, alpha


def species(img, out):
    h, w, _ = img.shape
    x_start, x_end = panels(img)
    x0, x1 = int(580 * K), x_end - 4
    y0, y1 = int(328 * K), int(424 * K)
    reg = img[y0:y1, x0:x1]
    dist = np.sqrt(((reg - PANEL_CREAM) ** 2).sum(2))
    keep = big_components(dist > 14, min_side=int(18 * K), grow=4)
    keep = ndi.binary_dilation(keep, iterations=3)
    ys, xs = np.where(keep)
    pad = 6
    sl = (slice(max(ys.min() - pad, 0), ys.max() + pad), slice(max(xs.min() - pad, 0), xs.max() + pad))
    clean = np.where(keep[..., None], reg, PANEL_CREAM)[sl]
    im = Image.fromarray(clean.clip(0, 255).astype(np.uint8))
    im.save(out, "WEBP", quality=90, method=6)
    return im.size


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    folder = pathlib.Path(sys.argv[1])
    outdir = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(__file__).resolve().parent.parent / "public/assets/img"
    outdir.mkdir(parents=True, exist_ok=True)

    for rid in RITUALS:
        pdf = find_pdf(folder, rid)
        img = render(pdf, DPI)
        bg = img[int(300 * K), 20]
        print("%-10s ground #%02x%02x%02x" % (rid, *bg.astype(int)), end="  ")
        if rid == "balance":
            print("logo", logo(pdf, bg, outdir / "logo.webp"), end="  ")
        print("botanical", botanical(img, bg, outdir / ("%s-botanical.webp" % rid)), end="  ")
        size, tint, alpha = waves(img, bg, outdir / ("%s-waves.webp" % rid))
        print("waves", size, end="  ")
        if rid == "balance":
            gold = np.broadcast_to(np.array([176, 140, 40], float), alpha.shape + (3,))
            save_rgba(gold, alpha * 0.9, outdir / "waves-gold.webp", lossless=True, scale=0.62)
        print("species", species(img, outdir / ("%s-species.webp" % rid)))
    total = sum(p.stat().st_size for p in outdir.glob("*.webp"))
    print("wrote %d files, %d KB, to %s" % (len(list(outdir.glob("*.webp"))), total // 1024, outdir))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Make the soft-focus background photo used on the welcome and closing screens.

It is a crop of the olive branch on the sunlit wall in the kit photo, enlarged and blurred so it
reads as a photographic soft focus. Replace public/assets/img/hero.webp with a proper photo whenever
there is one: the page only needs a warm, light, portrait-friendly image.

Usage:  python3 sanctuary/tools/make-hero.py  <kit-photo.png>  [out.webp]
"""
import pathlib
import sys

from PIL import Image, ImageFilter


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Image.open(sys.argv[1]).convert("RGB")
    out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else pathlib.Path(__file__).resolve().parent.parent / "public/assets/img/hero.webp")
    w, h = src.size
    # the wall and the olive branch in the upper right of the 1448 x 1086 kit photo, above the box lid
    box = (int(w * 0.697), 0, w, int(h * 0.171))
    crop = src.crop(box)
    big = crop.resize((crop.width * 3, crop.height * 3), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.2))
    big.save(out, "WEBP", quality=80, method=6)
    print("wrote", out, big.size, out.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()

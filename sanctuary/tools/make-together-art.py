#!/usr/bin/env python3
"""Make the light-on-water pictures used by TOGETHER.

No photographs and no one else's pictures: the reflections are calculated (a sum of slow waves, the
bright lines being where the waves cancel), so they are ours and free to use. They are soft
champagne light on a transparent ground; the site lays them over a warm colour and moves them
very slowly.

Writes (into public/assets/together/img/):
  light-a.webp   fine, bright reflections
  light-b.webp   broader, softer ones
Both tile, so the picture can drift without a seam.

Needs: numpy, pillow.   Usage: python3 sanctuary/tools/make-together-art.py
"""
import pathlib

import numpy as np
from PIL import Image, ImageFilter

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "assets" / "together" / "img"
W = H = 768


def waves(rng, n, kmin, kmax):
    """Sum of n plane waves with whole numbers of cycles across the picture, so it tiles."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float64)
    f = np.zeros((H, W))
    for _ in range(n):
        while True:
            kx, ky = rng.integers(-kmax, kmax + 1, size=2)
            if kmin <= np.hypot(kx, ky) <= kmax:
                break
        phase = rng.uniform(0, 2 * np.pi)
        f += np.cos(2 * np.pi * (kx * x / W + ky * y / H) + phase) / np.sqrt(n)
    return f


def caustic(seed, n, kmin, kmax, sharp, blur):
    rng = np.random.default_rng(seed)
    f = waves(rng, n, kmin, kmax)
    g = waves(rng, n, kmin, kmax)
    # bright thin lines where two wave fields cancel together: a network like light through ripples
    v = np.exp(-((f / 0.30) ** 2 * sharp)) + np.exp(-((g / 0.34) ** 2 * sharp)) * 0.65
    v = v / v.max()
    img = Image.fromarray((v * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(img).astype(np.float64) / 255.0
    a = np.clip((a - 0.12) / 0.88, 0, 1) ** 1.35
    # tint: champagne light (warm cream), alpha carries the shape
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[..., 0] = 255
    rgba[..., 1] = 239
    rgba[..., 2] = 200
    rgba[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    caustic(7, 11, 5, 12, 1.0, 1.1).save(OUT / "light-a.webp", quality=72, method=6)
    caustic(21, 9, 2, 6, 0.8, 5.5).save(OUT / "light-b.webp", quality=72, method=6)
    for f in sorted(OUT.glob("light-*.webp")):
        print(f.name, f.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()

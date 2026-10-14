#!/usr/bin/env python3
"""Make the QR code that points to the live sanctuary.

The code is static: it simply contains the address, so it keeps working for as long as
the address does. Make it only once the final address is decided, before anything is printed.

Needs:  pip install segno
Usage:  python3 sanctuary/tools/make-qr.py https://ritual.example.se  [output-name]

Writes <output-name>.svg (vector, for print) and <output-name>.png (1200 px).
Dark brown on a light ground, with a quiet zone and high error correction, so it
scans reliably even on textured card.
"""
import pathlib
import sys

try:
    import segno
except ImportError:
    sys.exit("Install the QR library first:  pip install segno")


def main():
    if len(sys.argv) < 2 or not sys.argv[1].startswith("https://"):
        sys.exit("Give the full https:// address, e.g.  python3 make-qr.py https://ritual.example.se")
    url = sys.argv[1]
    name = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "sanctuary-qr")

    qr = segno.make(url, error="q", micro=False)
    qr.save(str(name.with_suffix(".svg")), scale=12, border=4, dark="#2b2418", light=None)
    qr.save(str(name.with_suffix(".png")), scale=24, border=4, dark="#2b2418", light="#ffffff")
    print("QR for", url)
    print("  ", name.with_suffix(".svg"), "(transparent background, for print)")
    print("  ", name.with_suffix(".png"))
    print("Scan it with a phone before sending anything to the printer.")


if __name__ == "__main__":
    main()

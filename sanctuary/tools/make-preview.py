#!/usr/bin/env python3
"""Pack the whole sanctuary into ONE self-contained HTML file for previewing.

Fonts, logo and texture are embedded, the service worker is left out. The file
has no <html>/<head>/<body> wrapper, which is what the Artifact page contract expects.

Usage:  python3 sanctuary/tools/make-preview.py out.html
"""
import base64
import pathlib
import re
import sys

PUBLIC = pathlib.Path(__file__).resolve().parent.parent / "public"
ASSETS = PUBLIC / "assets"


def data_uri(path, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode(path.read_bytes()).decode("ascii"))


def main():
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "preview.html")

    css = (ASSETS / "style.css").read_text(encoding="utf-8")
    css = re.sub(
        r'url\("fonts/([^"]+\.woff2)"\)',
        lambda m: 'url("%s")' % data_uri(ASSETS / "fonts" / m.group(1), "font/woff2"),
        css,
    )
    css = css.replace('url("grain.svg")', 'url("%s")' % data_uri(ASSETS / "grain.svg", "image/svg+xml"))

    logo = data_uri(ASSETS / "logo.svg", "image/svg+xml")
    app = (ASSETS / "app.js").read_text(encoding="utf-8").replace("assets/logo.svg", logo)
    app = re.sub(r"/\* ——— offline support.*?\n  \}\n", "", app, flags=re.S)  # no service worker in a preview

    page = (
        "<title>Body Mind Earth Sanctuary</title>\n"
        "<style>\n" + css + "\n</style>\n"
        '<header class="top"><a id="nav-back" class="nav-back" href="#/rituals" hidden></a></header>\n'
        '<main id="stage" tabindex="-1"></main>\n'
        "<script>\n" + (ASSETS / "content.js").read_text(encoding="utf-8") + "\n</script>\n"
        "<script>\n" + (ASSETS / "art.js").read_text(encoding="utf-8") + "\n</script>\n"
        "<script>\n" + app + "\n</script>\n"
    )
    out.write_text(page, encoding="utf-8")
    print("wrote %s (%d KB)" % (out, len(page) // 1024))


if __name__ == "__main__":
    main()

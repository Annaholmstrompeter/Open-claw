#!/usr/bin/env python3
"""Pack the whole sanctuary into ONE self-contained HTML file for previewing.

Fonts, pictures and texture are embedded, the service worker is left out. The file has no
<html>/<head>/<body> wrapper, which is what the Artifact page contract expects.

Usage:  python3 sanctuary/tools/make-preview.py out.html
"""
import base64
import pathlib
import re
import sys

PUBLIC = pathlib.Path(__file__).resolve().parent.parent / "public"
ASSETS = PUBLIC / "assets"
MIME = {".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png"}


def data_uri(path):
    return "data:%s;base64,%s" % (MIME[path.suffix], base64.b64encode(path.read_bytes()).decode("ascii"))


def main():
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "preview.html")

    css = (ASSETS / "style.css").read_text(encoding="utf-8")
    css = re.sub(r'url\("((?:fonts|img)/[^"]+|grain\.svg)"\)', lambda m: 'url("%s")' % data_uri(ASSETS / m.group(1)), css)

    content = (ASSETS / "content.js").read_text(encoding="utf-8")
    content = re.sub(r'assets/img/[\w.-]+\.webp', lambda m: data_uri(PUBLIC / m.group(0)), content)

    app = (ASSETS / "app.js").read_text(encoding="utf-8")
    app = re.sub(r"/\* ——— offline support.*?\n  \}\n", "", app, flags=re.S)  # no service worker in a preview

    # the page body of index.html (without <script> tags and the file wrapper)
    html = (PUBLIC / "index.html").read_text(encoding="utf-8")
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
    body = re.sub(r"\s*<script[^>]*></script>", "", body)
    body = body.replace("assets/img/logo.webp", data_uri(ASSETS / "img/logo.webp"))

    page = (
        "<title>Body Mind Earth Sanctuary</title>\n"
        "<style>\n" + css + "\n</style>\n"
        + body.strip() + "\n"
        "<script>\n" + content + "\n</script>\n"
        "<script>\n" + app + "\n</script>\n"
    )
    out.write_text(page, encoding="utf-8")
    print("wrote %s (%d KB)" % (out, len(page) // 1024))


if __name__ == "__main__":
    main()

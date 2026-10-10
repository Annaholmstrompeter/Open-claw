#!/usr/bin/env python3
"""Build the sanctuary's content from Anna's own words.

Reads
  content/meditations-mall.txt   text snapshot of the Google Doc "Meditations mall"
  content/products.json          product facts, copied from the five labels
  content/quotes.json            one line from each meditation, shown while it plays
  content/audio.json             the names of the recordings in public/assets/audio/
  content/together.json          TOGETHER (A Ritual for Two): the paired rituals
and writes
  public/assets/content.js       what the site displays
  public/sw.js                   the offline file list and cache version

The meditations themselves are heard, not read: the manuscript is only used for the short
introduction text on the Sensory Enrichment page and to check that every quote is word for
word from it. The manuscript is never sent to the guest's phone.

Usage:  python3 sanctuary/tools/build-content.py
"""
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "meditations-mall.txt"
PRODUCTS = ROOT / "content" / "products.json"
QUOTES = ROOT / "content" / "quotes.json"
AUDIO = ROOT / "content" / "audio.json"
TOGETHER = ROOT / "content" / "together.json"
OUT = ROOT / "public" / "assets" / "content.js"

# "4. BALANCE — SHORT", "2. PRESENCE — KORT RITUAL", "KINDNESS — EXTENDED" ...
HEADING = re.compile(r"^\s*(?:\d+\.\s*)?([A-ZÅÄÖ][A-ZÅÄÖ ]*?)\s+—\s+(.+?)\s*$")


def parse_manuscript(text):
    """-> {script_key: {mode: [lines]}}, production notes in [brackets] left out."""
    scripts = {}
    key = mode = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = HEADING.match(line)
        if m:
            name, label = m.group(1).strip(), m.group(2).strip()
            key = "intro" if name.startswith("GEMENSAMT") else name.lower()
            mode = "extended" if "EXTENDED" in label.upper() else "short"
            scripts.setdefault(key, {"short": [], "extended": []})
            continue
        if key is None or (line.startswith("[") and line.endswith("]")):
            continue
        scripts[key][mode].append(line)
    return scripts


def norm(s):
    return re.sub(r"\s+", " ", s.replace("’", "'").replace("—", "-").replace("–", "-")).strip()


def join_ellipsis(lines):
    """'And now…' + 'let the practice begin.' read as one sentence."""
    out = []
    for ln in lines:
        if out and out[-1].endswith("…") and ln[:1].islower():
            out[-1] = out[-1] + " " + ln
        else:
            out.append(ln)
    return out


def duration_minutes(path):
    try:
        import mutagen  # optional
        return round(mutagen.File(str(path)).info.length / 60.0, 1)
    except Exception:
        return None


def refresh_service_worker():
    """Keep the offline file list and the cache version in public/sw.js in step with the site.
    The recordings are not cached by the service worker (they are large and are streamed).
    TOGETHER's Supabase client and its pictures are left out too: they are fetched, and then kept,
    the first time someone opens a shared session, so a guest who only uses the rituals never downloads them."""
    public = ROOT / "public"
    skip = {"sw.js", "_headers", "robots.txt"}
    files = sorted(
        f.relative_to(public).as_posix()
        for f in public.rglob("*")
        if f.is_file() and f.name not in skip and not f.name.startswith("OFL-") and "assets/audio/" not in f.as_posix()
        and "assets/together/vendor/" not in f.as_posix() and "assets/together/img/" not in f.as_posix()
        and f.name != "config.js"
    )
    digest = hashlib.sha1()
    for name in files:
        digest.update(name.encode())
        digest.update((public / name).read_bytes())
    version = "bme-sanctuary-" + digest.hexdigest()[:10]
    sw = (public / "sw.js").read_text(encoding="utf-8")
    sw = re.sub(r"var VERSION = '[^']*';", "var VERSION = '%s';" % version, sw)
    listing = "var FILES = [\n  './',\n" + ",\n".join("  '%s'" % f for f in files) + "\n];"
    sw = re.sub(r"var FILES = \[.*?\];", lambda m: listing, sw, flags=re.S)
    (public / "sw.js").write_text(sw, encoding="utf-8")
    print("offline cache %s: %d files" % (version, len(files)))


def main():
    scripts = parse_manuscript(SRC.read_text(encoding="utf-8"))
    products = json.loads(PRODUCTS.read_text(encoding="utf-8"))
    quotes = json.loads(QUOTES.read_text(encoding="utf-8"))
    audio = json.loads(AUDIO.read_text(encoding="utf-8"))
    problems, warnings = [], []

    together = json.loads(TOGETHER.read_text(encoding="utf-8"))
    together.pop("_note", None)
    for t in together["rituals"]:
        for key in ("id", "title", "subtitle", "minutes", "lead", "consent", "disclaimer", "audio"):
            if key not in t:
                problems.append("together %s: missing %s" % (t.get("id", "?"), key))
        if not (ROOT / "public" / t["audio"]["src"]).exists():
            warnings.append("TOGETHER recording not added yet: " + t["audio"]["src"])

    # The shared introduction, for the Sensory Enrichment page. The sanctuary is closed,
    # so a line sending guests to a website is left out.
    intro = []
    for l in scripts["intro"]["short"]:
        if "our website" in l.lower():
            print("note: left out for the closed sanctuary:", l)
            continue
        intro.append(l)
    intro = join_ellipsis(intro)

    audio_dir = ROOT / "public" / audio["dir"]
    intro_file = audio["intro"]
    if not (audio_dir / intro_file).exists():
        warnings.append("recording not added yet: " + intro_file)

    rituals = []
    for p in products["rituals"]:
        rid = p["id"]
        r = {k: p[k] for k in (
            "id", "kind", "scent", "tone", "with", "size", "rows", "affirmation",
            "formula", "actives", "vegan", "ingredients", "natural", "labCreated", "footnote", "species")}
        r["img"] = {}
        for part in ("species", "photo"):
            # (the photograph for the carousel on the Rituals page: tools/make-ritual-photos.py)
            rel = ("assets/img/ritual-%s.webp" % rid) if part == "photo" else ("assets/img/%s-%s.webp" % (rid, part))
            if not (ROOT / "public" / rel).exists():
                problems.append("missing picture " + rel)
            r["img"][part] = rel
        r["audio"] = {}
        for mode in ("short", "extended"):
            quote = quotes.get(rid, {}).get(mode)
            body = norm(" ".join(scripts.get(p["script"], {}).get(mode, [])))
            if not quote:
                problems.append("%s %s: no quote" % (rid, mode))
            elif norm(quote) not in body:
                problems.append("%s %s: the quote is not word for word in the manuscript: %s" % (rid, mode, quote))
            name = audio["rituals"][rid][mode]
            f = audio_dir / name
            if not f.exists():
                warnings.append("recording not added yet: " + name)
            r["audio"][mode] = {"src": audio["dir"] + name, "quote": quote, "min": duration_minutes(f) if f.exists() else None}
        rituals.append(r)

    if not (ROOT / "public/assets/img/logo.webp").exists():
        problems.append("missing picture assets/img/logo.webp")
    if problems:
        print("\n".join("PROBLEM: " + x for x in problems), file=sys.stderr)
        sys.exit(1)

    data = {
        "intro": intro,
        "introAudio": audio["dir"] + intro_file,
        "logo": "assets/img/logo.webp",
        "rituals": rituals,
        "together": together,
    }
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    body = body.replace('{"id":', '\n{"id":')  # one ritual per line, easier to diff
    OUT.write_text(
        "/* GENERATED by sanctuary/tools/build-content.py from content/*. Do not edit by hand:\n"
        "   change the sources and run the tool again. */\n"
        "window.SANCTUARY = " + body + ";\n",
        encoding="utf-8",
    )
    refresh_service_worker()
    for r in rituals:
        print("%-10s %s" % (r["id"], "  ".join("%s: %s" % (m, ("%.1f min" % r["audio"][m]["min"]) if r["audio"][m]["min"] else "no recording yet") for m in ("short", "extended"))))
    for w in warnings:
        print("WARNING:", w)
    print("wrote", OUT.relative_to(ROOT.parent))


if __name__ == "__main__":
    main()

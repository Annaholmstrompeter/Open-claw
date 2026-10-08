#!/usr/bin/env python3
"""Build the sanctuary's content from Anna's own words.

Reads
  content/meditations-mall.txt   text snapshot of the Google Doc "Meditations mall"
  content/products.json          snapshot of the five products in Shopify
and writes
  public/assets/content.js       what the site displays

Nothing is rewritten: meditation lines are shown exactly as written. The only
decisions made here are where one quiet screen ends and the next begins, which
follows the bracketed notes in the manuscript ([Pause.], [Music. Pause.] ...).
Those notes themselves are never shown.

Usage:  python3 sanctuary/tools/build-content.py
"""
import json
import math
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "meditations-mall.txt"
PRODUCTS = ROOT / "content" / "products.json"
OUT = ROOT / "public" / "assets" / "content.js"

# "4. BALANCE — SHORT", "2. PRESENCE — KORT RITUAL", "KINDNESS — EXTENDED" ...
HEADING = re.compile(r"^\s*(?:\d+\.\s*)?([A-ZÅÄÖ][A-ZÅÄÖ ]*?)\s+—\s+(.+?)\s*$")
BREATH = re.compile(r"deep breaths|Connect with your breathing", re.I)
MAX_LINES = 4
MAX_CHARS = 260


def norm(s):
    return re.sub(r"[^a-z ]", "", s.lower().replace(",", "")).strip()


def parse_manuscript(text):
    """-> {script_key: {mode: [section, ...]}} where a section is a list of lines."""
    scripts = {}
    key = mode = None
    section = None

    def close():
        nonlocal section
        if section:
            scripts[key][mode].append(section)
        section = None

    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = HEADING.match(line)
        if m:
            close()
            name, label = m.group(1).strip(), m.group(2).strip()
            key = "intro" if name.startswith("GEMENSAMT") else name.lower()
            mode = "extended" if "EXTENDED" in label.upper() else "short"
            scripts.setdefault(key, {"short": [], "extended": []})
            continue
        if key is None:
            continue
        if line.startswith("[") and line.endswith("]"):
            close()  # a production note: a pause, a music cue ... starts a new screen
            continue
        if section is None:
            section = []
        section.append(line)
    close()
    return scripts


def join_ellipsis(lines):
    """'And now…' + 'let the practice begin.' read as one sentence."""
    out = []
    for ln in lines:
        if out and out[-1].endswith("…") and ln[:1].islower():
            out[-1] = out[-1] + " " + ln
        else:
            out.append(ln)
    return out


def affirmation_forms(affirmation):
    """The full affirmation and each 'I am <word>.' piece of it, normalised."""
    forms = {norm(affirmation)}
    words = re.split(r",\s*(?:and\s+)?|\s+and\s+", re.sub(r"^I am\s+", "", affirmation).rstrip("."))
    for w in words:
        if w.strip():
            forms.add(norm("I am " + w))
    return forms


def balanced_chunks(lines):
    total = sum(len(l) for l in lines)
    k = max(math.ceil(len(lines) / MAX_LINES), math.ceil(total / MAX_CHARS), 1)
    target = total / k
    chunks, cur, n = [], [], 0
    for ln in lines:
        if cur and len(chunks) < k - 1 and n + len(ln) / 2 > target:
            chunks.append(cur)
            cur, n = [], 0
        cur.append(ln)
        n += len(ln)
    if cur:
        chunks.append(cur)
    return chunks


def to_screens(sections, affirmation):
    forms = affirmation_forms(affirmation)
    screens = []
    breath_done = False
    for sec in sections:
        pieces = []  # lists of lines, each becoming one or more screens
        if not breath_done and any(BREATH.search(l) for l in sec):
            i = next(i for i, l in enumerate(sec) if BREATH.search(l))
            if sec[:i]:
                pieces.append(("t", sec[:i]))
            pieces.append(("b", [sec[i]]))  # the breathing line gets a screen of its own
            if sec[i + 1:]:
                pieces.append(("t", sec[i + 1:]))
            breath_done = True
        else:
            pieces.append(("t", sec))
        for kind, lines in pieces:
            for chunk in balanced_chunks(lines) if kind == "t" else [lines]:
                marked = [("§ " + l) if norm(l) in forms else l for l in chunk]
                screen = {"l": marked}
                if kind == "b":
                    screen["b"] = 1
                screens.append(screen)
    return screens


def main():
    scripts = parse_manuscript(SRC.read_text(encoding="utf-8"))
    products = json.loads(PRODUCTS.read_text(encoding="utf-8"))

    # Shared intro: shown on the "About Sensory Enrichment" page. The sanctuary is closed,
    # so a line sending guests to a website is left out.
    intro = []
    for sec in scripts["intro"]["short"]:
        for l in sec:
            if "our website" in l.lower():
                print("note: left out for the closed sanctuary:", l)
                continue
            intro.append(l)
    intro = join_ellipsis(intro)

    rituals = []
    problems = []
    for p in products["rituals"]:
        key = p["script"]
        if key not in scripts:
            problems.append("no meditation text found for " + key)
            continue
        p = dict(p, title=p["title"].replace(" – ", " — "))  # one kind of dash, nothing else touched
        r = {k: p[k] for k in (
            "id", "num", "color", "title", "kind", "scent", "with", "tone", "lede", "rows",
            "affirmation", "formula", "essentials", "badges", "inci")}
        for mode in ("short", "extended"):
            secs = scripts[key][mode]
            if not secs:
                problems.append("%s: no %s meditation" % (key, mode))
            r[mode] = to_screens(secs, p["affirmation"])
        if not any(l.startswith("§ ") for s in r["short"] for l in s["l"]):
            problems.append("%s: affirmation not found in the short meditation" % key)
        rituals.append(r)

    if problems:
        print("\n".join("PROBLEM: " + x for x in problems), file=sys.stderr)
        sys.exit(1)

    data = {"intro": intro, "rituals": rituals}
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    body = body.replace('{"id":', '\n{"id":')  # one ritual per line, easier to diff
    OUT.write_text(
        "/* GENERATED by sanctuary/tools/build-content.py from content/meditations-mall.txt and\n"
        "   content/products.json. Do not edit by hand: change the sources and run the tool again. */\n"
        "window.SANCTUARY = " + body + ";\n",
        encoding="utf-8",
    )
    for r in rituals:
        print("%-10s short: %2d screens   extended: %2d screens" % (r["id"], len(r["short"]), len(r["extended"])))
    print("wrote", OUT.relative_to(ROOT.parent))


if __name__ == "__main__":
    main()

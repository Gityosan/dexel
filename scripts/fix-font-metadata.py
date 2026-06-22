#!/usr/bin/env python3
"""Normalize the bundled Noto Sans JP subset's metadata.

The subset's outlines are Regular weight (usWeightClass 400; capital-I stem ~92,
kanji horizontal stroke ~82 per 1000 em), but its name table and STAT axis were
mislabeled as "Thin" — so OS font pickers and PDF metadata showed the wrong
style. This rewrites the name records to a clean "Noto Sans JP / Regular" and
drops the single-weight STAT table. Outlines and glyph coverage are untouched.

    pip install fonttools
    python scripts/fix-font-metadata.py

Noto is OFL-licensed without reserved font names, so renaming is permitted.
"""
from fontTools.ttLib import TTFont

PATH = "assets/fonts/noto-sans-jp-subset.ttf"

NAMES = {
    1: "Noto Sans JP",            # Family
    2: "Regular",                 # Subfamily
    3: "2.004;ADBO;NotoSansJP-Regular;ADOBE",  # Unique ID
    4: "Noto Sans JP Regular",    # Full name
    6: "NotoSansJP-Regular",      # PostScript name
    16: "Noto Sans JP",           # Typographic Family
    17: "Regular",                # Typographic Subfamily
}

f = TTFont(PATH)
name = f["name"]
for nid, val in NAMES.items():
    name.setName(val, nid, 3, 1, 0x409)  # Windows / Unicode BMP / en-US
    name.setName(val, nid, 1, 0, 0)      # Mac / Roman / en

if "STAT" in f:
    del f["STAT"]

# Keep weight/style metadata internally consistent with the Regular outlines.
f["OS/2"].usWeightClass = 400
f["head"].macStyle = 0
f["post"].italicAngle = 0.0

f.save(PATH)
print("normalized", PATH)
for nid in (1, 2, 4, 6):
    print(" ", nid, name.getDebugName(nid))
print("  usWeightClass:", f["OS/2"].usWeightClass, "| STAT:", "STAT" in f)

#!/usr/bin/env python3
"""PaperMap icon and favicon generator.

Sources (branding/):
  papermap-icon.png  full-bleed app icon (ink background)
  papermap-mark.png  same mark on a transparent background
Both are rendered from the matching .svg files. After changing an SVG, render
it to a 1024 px PNG and run this script. CI builds the native Android/iOS icon
sets from web/assets/* with @capacitor/assets.

Requires: pip install Pillow
Usage:    python3 scripts/generate-icons.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, "branding")
ASSETS = os.path.join(ROOT, "web", "assets")    # @capacitor/assets sources
PUBLIC = os.path.join(ROOT, "web", "public")     # web favicons
NATIVE = os.path.join(ROOT, "apps", "assets")    # native app sources

PAPER = (245, 243, 238, 255)  # #F5F3EE
INK = (23, 25, 24, 255)       # #171918


def load(name):
    return Image.open(os.path.join(BRAND, name)).convert("RGBA")


def fit(mark, canvas_px, scale, bg):
    """Centre the 1024 px mark on a square canvas, scaled to `scale` of it."""
    size = max(1, round(canvas_px * scale))
    r = mark.resize((size, size), Image.LANCZOS)
    c = Image.new("RGBA", (canvas_px, canvas_px), bg)
    off = (canvas_px - size) // 2
    c.alpha_composite(r, (off, off))
    return c


def save(img, path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, **kw)
    print("yazildi:", os.path.relpath(path, ROOT))


def main():
    icon = load("papermap-icon.png")
    mark = load("papermap-mark.png")
    clear = (0, 0, 0, 0)

    # Adaptive icon: the mark must stay inside the 66% safe circle, hence 0.82.
    for out in (ASSETS, NATIVE):
        save(icon.resize((1024, 1024), Image.LANCZOS), os.path.join(out, "icon-only.png"))
        save(fit(mark, 1024, 0.82, clear), os.path.join(out, "icon-foreground.png"))
        save(Image.new("RGBA", (1024, 1024), INK), os.path.join(out, "icon-background.png"))
        save(fit(mark, 2732, 0.40, PAPER), os.path.join(out, "splash.png"))
        save(fit(mark, 2732, 0.40, INK), os.path.join(out, "splash-dark.png"))

    save(icon.resize((180, 180), Image.LANCZOS), os.path.join(PUBLIC, "apple-touch-icon.png"))
    save(icon.resize((192, 192), Image.LANCZOS), os.path.join(PUBLIC, "icon-192.png"))
    save(icon.resize((512, 512), Image.LANCZOS), os.path.join(PUBLIC, "icon-512.png"))
    save(icon.resize((32, 32), Image.LANCZOS), os.path.join(PUBLIC, "favicon-32.png"))
    save(icon.resize((16, 16), Image.LANCZOS), os.path.join(PUBLIC, "favicon-16.png"))
    icon.resize((48, 48), Image.LANCZOS).save(
        os.path.join(PUBLIC, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print("yazildi: web/public/favicon.ico")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""PaperMap ikon/favicon ureticisi.

Tek kaynak (branding/logo.png) -> tum uygulama ikonlari ve web favicon'lari.
Logo degistiginde SADECE branding/logo.png'yi degistirip bu betigi calistirin;
Android/iOS native ikonlar CI'da (GitHub Actions) `@capacitor/assets` ile
buradaki `web/assets/*` kaynaklarindan otomatik uretilir.

Gereksinim:  pip install Pillow
Kullanim:    python3 scripts/generate-icons.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "branding", "logo.png")
ASSETS = os.path.join(ROOT, "web", "assets")    # @capacitor/assets kaynaklari
PUBLIC = os.path.join(ROOT, "web", "public")     # web favicon'lari

WHITE = (255, 255, 255, 255)
DARK = (16, 19, 28, 255)  # uygulama koyu tema zemini (#10131c)


def load_logo():
    im = Image.open(SRC).convert("RGBA")
    return im.crop(im.split()[3].getbbox())  # seffaf kenarlari kirp


def white_version(mark):
    """Siyah logoyu beyaza cevir (alfa maskesini koru) — koyu zeminler icin."""
    w = Image.new("RGBA", mark.size, (255, 255, 255, 0))
    w.putalpha(mark.split()[3])
    return w


def compose(canvas_px, frac_w, bg, mark):
    """mark'i genisligi = frac_w*canvas olacak sekilde kareye ortala."""
    tw = max(1, round(canvas_px * frac_w))
    th = max(1, round(mark.height * (tw / mark.width)))
    r = mark.resize((tw, th), Image.LANCZOS)
    c = Image.new("RGBA", (canvas_px, canvas_px), bg)
    c.alpha_composite(r, ((canvas_px - tw) // 2, (canvas_px - th) // 2))
    return c


def save(img, path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, **kw)
    print("yazildi:", os.path.relpath(path, ROOT))


def main():
    logo = load_logo()
    white_logo = white_version(logo)

    # ---- @capacitor/assets kaynaklari (web/assets/) ----
    save(compose(1024, 0.74, WHITE, logo), os.path.join(ASSETS, "icon-only.png"))
    save(compose(1024, 0.60, (255, 255, 255, 0), logo), os.path.join(ASSETS, "icon-foreground.png"))
    save(Image.new("RGBA", (1024, 1024), WHITE), os.path.join(ASSETS, "icon-background.png"))
    save(compose(2732, 0.34, WHITE, logo), os.path.join(ASSETS, "splash.png"))
    save(compose(2732, 0.34, DARK, white_logo), os.path.join(ASSETS, "splash-dark.png"))

    # ---- Web favicon'lari (web/public/) ----
    save(compose(180, 0.72, WHITE, logo), os.path.join(PUBLIC, "apple-touch-icon.png"))
    save(compose(192, 0.74, WHITE, logo), os.path.join(PUBLIC, "icon-192.png"))
    save(compose(512, 0.74, WHITE, logo), os.path.join(PUBLIC, "icon-512.png"))
    save(compose(32, 0.86, WHITE, logo), os.path.join(PUBLIC, "favicon-32.png"))
    save(compose(16, 0.88, WHITE, logo), os.path.join(PUBLIC, "favicon-16.png"))
    compose(48, 0.86, WHITE, logo).save(
        os.path.join(PUBLIC, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print("yazildi: web/public/favicon.ico")


if __name__ == "__main__":
    main()

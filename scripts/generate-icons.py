#!/usr/bin/env python3
"""Generate PWA icons for recipe app using Pillow."""

from PIL import Image, ImageDraw, ImageFont
import os, math

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "icons")

COLOR_BG = (245, 240, 235)    # #F5F0EB warm beige
COLOR_ACCENT = (168, 149, 106)  # #A8956A warm sand
COLOR_TEXT = (60, 50, 40)     # stone-800-ish

ICONS = [
    ("icon-192x192.png", 192, False),
    ("icon-512x512.png", 512, False),
    ("icon-512x512-maskable.png", 512, True),
    ("apple-touch-icon.png", 180, False),
]

def draw_icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), COLOR_BG)
    draw = ImageDraw.Draw(img)

    # Safe zone for maskable: content within 80% center
    if maskable:
        safe = int(size * 0.8)
        offset = (size - safe) // 2
        cx, cy = size // 2, size // 2
        r = safe // 2 - int(size * 0.04)
    else:
        r = size // 2 - int(size * 0.06)
        cx, cy = size // 2, size // 2

    # Draw a circle background for the "R"
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        fill=COLOR_ACCENT,
    )

    # Draw a stylized "R" letter
    font_size = int(size * 0.55)
    try:
        # Try common font paths
        for fp in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
                    "/System/Library/Fonts/Helvetica.ttc"]:
            if os.path.exists(fp):
                font = ImageFont.truetype(fp, font_size)
                break
        else:
            font = ImageFont.load_default()
    except (IOError, OSError):
        font = ImageFont.load_default()

    text = "R"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = cx - tw // 2 - bbox[0]
    ty = cy - th // 2 - bbox[1] - 2  # slight optical adjustment

    draw.text((tx, ty), text, fill=COLOR_BG, font=font)

    return img

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for filename, size, maskable in ICONS:
        path = os.path.join(OUT_DIR, filename)
        img = draw_icon(size, maskable)
        img.save(path, "PNG")
        print(f"  ✅ {filename} ({size}x{size}, maskable={maskable}) — {os.path.getsize(path)} bytes")

if __name__ == "__main__":
    main()

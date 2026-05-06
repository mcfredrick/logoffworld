#!/usr/bin/env python3
"""Generate OG image and favicon for Log Off."""

import os
from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')

BG = (10, 10, 10)
CLOUD_BLUE = (126, 184, 212)
DRUM_GOLD = (212, 162, 78)
WHITE = (255, 255, 255)
MUTED = (102, 102, 102)


def load_font(size):
    for path in [
        '/System/Library/Fonts/Helvetica.ttc',
        '/System/Library/Fonts/SFNSDisplay.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]:
        try:
            return ImageFont.truetype(path, size=size)
        except (IOError, OSError):
            pass
    return ImageFont.load_default()


def draw_centered(draw, text, y, font, fill, width):
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (width - (bbox[2] - bbox[0])) // 2 - bbox[0]
    draw.text((x, y), text, fill=fill, font=font)
    return bbox[3] - bbox[1]


def make_og_image():
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img)

    # Subtle gradient band across center
    for i in range(H):
        t = i / H
        r = int(10 + 8 * (1 - abs(t - 0.5) * 2))
        draw.line([(0, i), (W, i)], fill=(r, r, r))

    font_large = load_font(72)
    font_mid = load_font(36)
    font_small = load_font(28)
    font_tag = load_font(22)

    # Emojis as text
    draw_centered(draw, '☁️  🥁', 140, load_font(56), WHITE, W)

    # Title
    draw_centered(draw, 'Log Off', 240, font_large, WHITE, W)

    # Divider line
    draw.line([(W // 2 - 120, 340), (W // 2 + 120, 340)], fill=MUTED, width=1)

    # Tagline
    draw_centered(draw, 'One daily prompt.  Two human choices.  No algorithms.', 368, font_mid, (180, 180, 180), W)

    # Reset note
    draw_centered(draw, 'All data resets at midnight.', 428, font_small, MUTED, W)

    # URL
    draw_centered(draw, 'logoff.world', 530, font_tag, CLOUD_BLUE, W)

    return img


def make_favicon():
    size = 32
    img = Image.new('RGB', (size, size), BG)
    draw = ImageDraw.Draw(img)
    font = load_font(14)
    text = 'LO'
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (size - (bbox[2] - bbox[0])) // 2 - bbox[0]
    y = (size - (bbox[3] - bbox[1])) // 2 - bbox[1]
    draw.text((x, y), text, fill=WHITE, font=font)
    return img


def main():
    os.makedirs(ASSETS_DIR, exist_ok=True)

    og_path = os.path.join(ASSETS_DIR, 'og-image.png')
    make_og_image().save(og_path, 'PNG')
    print(f'Created {og_path} ({os.path.getsize(og_path):,} bytes)')

    favicon_path = os.path.join(PUBLIC_DIR, 'favicon.ico')
    favicon = make_favicon()
    favicon.save(favicon_path, 'ICO', sizes=[(16, 16), (32, 32)])
    print(f'Created {favicon_path} ({os.path.getsize(favicon_path):,} bytes)')


if __name__ == '__main__':
    main()

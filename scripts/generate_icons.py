#!/usr/bin/env python3
"""Generate PWA icons for Log Off."""

import os
from PIL import Image, ImageDraw, ImageFont

ICONS_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'icons')
BG_COLOR = (10, 10, 10, 255)
TEXT_COLOR = (255, 255, 255, 255)


def make_icon(size):
    img = Image.new('RGBA', (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', size=size // 4)
    except (IOError, OSError):
        font = ImageFont.load_default()

    text = 'LO'
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2 - bbox[0]
    y = (size - text_h) // 2 - bbox[1]
    draw.text((x, y), text, fill=TEXT_COLOR, font=font)

    return img.convert('RGB')


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    for size in (192, 512):
        path = os.path.join(ICONS_DIR, f'icon-{size}.png')
        make_icon(size).save(path, 'PNG')
        print(f'Created {path} ({os.path.getsize(path)} bytes)')


if __name__ == '__main__':
    main()

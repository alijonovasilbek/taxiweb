"""Chortoq Ijrochi ikonkalari: bordo fonda oq "C" (Manrope ExtraBold).

    python scripts/make-icons.py     (driver-mobile papkasidan; Pillow kerak)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
FONT = ROOT / "node_modules/@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf"
TOP, BOTTOM = (168, 40, 78), (86, 12, 34)  # Mini App --grad
WHITE = (255, 255, 255, 255)


def gradient(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)) + (255,)
    return img


def letter(img: Image.Image, scale: float, color=WHITE) -> Image.Image:
    d = ImageDraw.Draw(img)
    size = img.size[0]
    font = ImageFont.truetype(str(FONT), int(size * scale))
    box = d.textbbox((0, 0), "C", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1]), "C", font=font, fill=color)
    return img


def main():
    letter(gradient(1024), 0.62).convert("RGB").save(ASSETS / "icon.png")
    # Adaptiv ikonka: fon + oldingi qatlam (xavfsiz zona — markaziy 66%)
    gradient(1024).convert("RGB").save(ASSETS / "android-icon-background.png")
    letter(Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)), 0.40).save(ASSETS / "android-icon-foreground.png")
    letter(Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)), 0.40).save(ASSETS / "android-icon-monochrome.png")
    letter(Image.new("RGBA", (512, 512), (0, 0, 0, 0)), 0.70).save(ASSETS / "splash-icon.png")
    # Bildirishnoma / foreground service ikonkasi: oq, shaffof fon, 96x96
    letter(Image.new("RGBA", (96, 96), (0, 0, 0, 0)), 0.80).save(ASSETS / "notification-icon.png")
    letter(gradient(48), 0.62).convert("RGB").save(ASSETS / "favicon.png")
    print("ikonkalar yangilandi:", ASSETS)


if __name__ == "__main__":
    main()

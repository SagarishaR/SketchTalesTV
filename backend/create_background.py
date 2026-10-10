from PIL import Image, ImageDraw, ImageFilter
import math
import random
from pathlib import Path

random.seed(18)

ROOT = Path(__file__).parent
CUTOUT = ROOT / "test-assets" / "elephant-cutout.png"
OUT = ROOT / "public" / "scenes" / "forest-background.png"

W, H = 1280, 720

# Create a soft, storybook forest background.
bg = Image.new("RGB", (W, H))
pixels = bg.load()

top = (37, 54, 82)
bottom = (244, 188, 105)

for y in range(H):
    t = y / H
    for x in range(W):
        glow = max(0, 1 - math.sqrt(
            ((x - 790) / 600) ** 2 + ((y - 290) / 430) ** 2
        ))
        pixels[x, y] = tuple(
            int(top[c] * (1 - t) + bottom[c] * t + glow * 24)
            for c in range(3)
        )

draw = ImageDraw.Draw(bg, "RGBA")

# Distant forest silhouettes.
for i in range(-100, W + 120, 100):
    height = random.randint(130, 260)
    color = random.choice([
        (36, 77, 76, 180),
        (43, 91, 79, 190),
        (55, 105, 83, 180),
    ])
    draw.polygon([
        (i, 460), (i + 48, 460 - height),
        (i + 100, 460)
    ], fill=color)

# Sunlit clearing.
draw.ellipse((530, 180, 1100, 690), fill=(255, 224, 153, 48))

# Large foreground trees on the edges.
for x, width, color in [
    (20, 95, (45, 76, 61, 255)),
    (145, 48, (61, 94, 65, 230)),
    (1120, 65, (48, 76, 59, 255)),
    (1210, 105, (37, 64, 55, 255)),
]:
    draw.rounded_rectangle(
        (x, 80, x + width, 720),
        radius=22,
        fill=color
    )

# Tree crowns.
for cx, cy, radius in [
    (60, 120, 170), (190, 95, 135),
    (1120, 105, 170), (1250, 170, 190),
    (380, 100, 85), (950, 80, 100),
]:
    for _ in range(22):
        dx = random.randint(-radius, radius)
        dy = random.randint(-radius, radius)
        if dx * dx + dy * dy <= radius * radius:
            r = random.randint(24, 55)
            color = random.choice([
                (37, 91, 69, 235),
                (54, 119, 77, 235),
                (83, 143, 83, 220),
                (119, 157, 91, 210),
            ])
            draw.ellipse(
                (cx + dx - r, cy + dy - r,
                 cx + dx + r, cy + dy + r),
                fill=color
            )

# Winding path through the clearing.
draw.polygon([
    (510, 720), (810, 720), (770, 575),
    (850, 485), (755, 430), (680, 450),
    (720, 545), (640, 615)
], fill=(213, 174, 113, 210))

# Grass and small storybook flowers.
for _ in range(250):
    x = random.randint(0, W - 1)
    y = random.randint(430, H - 1)
    r = random.randint(2, 7)
    color = random.choice([
        (109, 157, 91, 210),
        (164, 183, 100, 210),
        (245, 205, 117, 220),
        (245, 145, 163, 220),
        (238, 228, 186, 220),
    ])
    draw.ellipse((x-r, y-r, x+r, y+r), fill=color)

# Soft finishing blur on the background only.
bg = bg.filter(ImageFilter.GaussianBlur(1.2)).convert("RGBA")

OUT.parent.mkdir(parents=True, exist_ok=True)
bg.convert("RGB").save(OUT, quality=95)

print(f"Background created: {OUT}")
print(f"Canvas: {W}x{H}")
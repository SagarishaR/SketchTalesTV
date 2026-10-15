from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import json
import math
import random
import re
import sys

OUT = Path("backend/public/scenes/generated")
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1280, 720

PALETTES = {
    "magical": ((20, 35, 73), (55, 111, 104), (255, 213, 111)),
    "space": ((13, 16, 56), (51, 48, 115), (112, 226, 255)),
    "funny": ((111, 195, 224), (93, 164, 111), (255, 155, 105)),
    "animals": ((94, 169, 197), (50, 112, 76), (255, 213, 133)),
}

def contains(text, *words):
    return any(word in text for word in words)

def draw_tree(draw, x, ground, scale, rng, accent):
    trunk_w = int(24 * scale)
    trunk_h = int(120 * scale)
    draw.rectangle(
        (x - trunk_w // 2, ground - trunk_h, x + trunk_w // 2, ground),
        fill=(82, 63, 52, 255),
    )
    for dx, dy, radius in [
        (-28, -trunk_h + 15, 52),
        (22, -trunk_h - 5, 60),
        (0, -trunk_h - 45, 48),
    ]:
        r = int(radius * scale)
        cx, cy = x + int(dx * scale), ground + int(dy * scale)
        color = (
            max(0, accent[0] + rng.randint(-15, 15)),
            max(0, accent[1] + rng.randint(-15, 15)),
            max(0, accent[2] + rng.randint(-15, 15)),
            255,
        )
        draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=color)

def generate(scene, genre, index):
    prompt = str(scene.get("visualPrompt", scene.get("narration", "")))
    title = str(scene.get("title", f"Scene {index}"))
    text = f"{title} {prompt}".lower()
    seed = sum(ord(c) for c in f"{genre}:{index}:{prompt}")
    rng = random.Random(seed)

    sky, ground, accent = PALETTES.get(genre, PALETTES["magical"])
    image = Image.new("RGB", (W, H), sky)
    draw = ImageDraw.Draw(image, "RGBA")

    # Atmospheric light and a soft sun/moon.
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gx, gy = 950, 145
    for radius in range(190, 10, -10):
        alpha = max(2, int(32 * (1 - radius / 210)))
        gd.ellipse(
            (gx-radius, gy-radius, gx+radius, gy+radius),
            fill=(*accent, alpha),
        )
    image = Image.alpha_composite(image.convert("RGBA"), glow)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.ellipse((900, 95, 1000, 195), fill=(*accent, 230))

    # Star field for night, magic, and space scenes.
    if contains(text, "star", "moon", "night", "space", "cosmic", "galaxy"):
        for _ in range(110):
            x, y = rng.randint(0, W), rng.randint(15, 480)
            r = rng.choice([1, 2, 3, 4])
            draw.ellipse((x-r, y-r, x+r, y+r), fill=(255, 255, 235, rng.randint(120, 240)))

    # Layered rolling terrain.
    for layer in range(4):
        base_y = 400 + layer * 65
        points = [(0, H)]
        for x in range(0, W + 31, 30):
            y = base_y + math.sin((x + seed % 300 + layer * 60) / 150) * (24 + layer * 9)
            points.append((x, int(y)))
        points.append((W, H))
        shade = max(0, 1 - layer * 0.12)
        color = tuple(int(c * shade) for c in ground) + (255,)
        draw.polygon(points, fill=color)

    # Scene elements are selected from the actual scene description.
    if contains(text, "river", "stream", "brook", "water", "lake", "ocean", "sea"):
        draw.polygon([(0, 535), (W, 475), (W, H), (0, H)], fill=(39, 132, 187, 235))
        for _ in range(35):
            x, y = rng.randint(0, W-100), rng.randint(525, 700)
            draw.line((x, y, x+rng.randint(20, 95), y-rng.randint(0, 6)),
                      fill=(175, 231, 255, 180), width=rng.choice([2, 3, 4]))
        for x, y in [(280, 540), (500, 565), (790, 530), (1010, 580)]:
            draw.ellipse((x, y, x+100, y+30), fill=(192, 181, 151, 255))

    if contains(text, "cave", "crystal", "cavern", "underground"):
        draw.polygon([(0, 0), (250, 0), (340, 250), (230, 470), (0, 540)],
                     fill=(30, 30, 60, 255))
        draw.polygon([(W, 0), (W-240, 0), (W-330, 270), (W-230, 490), (W, 540)],
                     fill=(30, 30, 60, 255))
        for x, y in [(430, 420), (580, 500), (800, 410), (950, 480), (680, 350)]:
            draw.polygon([(x, y), (x-25, y+65), (x+25, y+65)],
                         fill=(*accent, 220))

    if contains(text, "castle", "palace", "kingdom", "tower"):
        draw.rectangle((420, 260, 850, 500), fill=(89, 82, 132, 255))
        for x in [430, 535, 735, 840]:
            draw.rectangle((x, 205, x+65, 330), fill=(112, 101, 158, 255))
            draw.polygon([(x-8, 205), (x+32, 145), (x+73, 205)],
                         fill=(238, 157, 112, 255))
        draw.rectangle((590, 360, 680, 500), fill=(39, 40, 72, 255))

    if contains(text, "tree", "forest", "woodland", "garden", "flower", "leaf", "woods"):
        for x, scale in [(100, 0.85), (300, 0.7), (1030, 0.9), (1170, 0.7)]:
            draw_tree(draw, x, 575, scale, rng, ground)

    if contains(text, "celebration", "party", "festival", "confetti", "birthday"):
        for _ in range(120):
            x, y = rng.randint(0, W), rng.randint(30, 580)
            r = rng.choice([2, 3, 5, 7])
            color = rng.choice([
                (255, 224, 117, 230),
                (255, 170, 190, 230),
                (177, 221, 255, 230),
            ])
            draw.ellipse((x-r, y-r, x+r, y+r), fill=color)

    # Small foreground plants for depth.
    for _ in range(150):
        x = rng.randint(0, W)
        y = rng.randint(610, 715)
        draw.line((x, y, x+rng.randint(-5, 5), y-rng.randint(8, 25)),
                  fill=(95, 170, 105, 220), width=2)
        if rng.random() < 0.35:
            draw.ellipse((x-4, y-22, x+4, y-14), fill=(*accent, 220))

    # Save a deterministic, scene-specific file.
    safe_genre = re.sub(r"[^a-z0-9_-]", "", genre.lower()) or "story"
    target = OUT / f"{safe_genre}-scene-{index}.png"
    image.convert("RGB").save(target, optimize=True)
    print(target)

def main():
    if len(sys.argv) < 2:
        raise SystemExit(
            "Usage: python3 backend/generate_scene_art.py story.json [genre]"
        )
    source = Path(sys.argv[1])
    story = json.loads(source.read_text())
    genre = sys.argv[2] if len(sys.argv) > 2 else story.get("genre", "magical")
    scenes = story.get("scenes", [])
    if not scenes:
        raise SystemExit("Story JSON must contain a non-empty scenes array.")
    for index, scene in enumerate(scenes, start=1):
        generate(scene, genre, index)

if __name__ == "__main__":
    main()

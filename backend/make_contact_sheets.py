from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys
import math

BASE_DIR = Path(__file__).parent / "public" / "scenes" / "library"
OUTPUT_DIR = Path(__file__).parent / "contact_sheets"

def make_contact_sheet(folder_name):
    folder = BASE_DIR / folder_name

    if not folder.is_dir():
        print(f"Folder not found: {folder}")
        return

    files = sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )

    if not files:
        print(f"No images found in {folder}")
        return

    columns = 3
    cell_width = 320
    image_height = 180
    label_height = 42
    cell_height = image_height + label_height
    rows = math.ceil(len(files) / columns)

    sheet = Image.new(
        "RGB",
        (columns * cell_width, rows * cell_height),
        "white"
    )
    draw = ImageDraw.Draw(sheet)

    for index, file in enumerate(files):
        x = (index % columns) * cell_width
        y = (index // columns) * cell_height

        try:
            with Image.open(file) as source:
                image = source.convert("RGB")
                image.thumbnail((cell_width - 12, image_height - 12))

            image_x = x + (cell_width - image.width) // 2
            image_y = y + (image_height - image.height) // 2
            sheet.paste(image, (image_x, image_y))

            label = file.name
            draw.text(
                (x + 8, y + image_height + 5),
                label[:44],
                fill="black"
            )
        except Exception as error:
            draw.text((x + 8, y + 8), f"Error: {file.name}", fill="red")
            print(f"Could not read {file.name}: {error}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / f"{folder_name}-contact-sheet.jpg"
    sheet.save(output_file, quality=90)

    print(f"Images: {len(files)}")
    print(f"Saved: {output_file}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python make_contact_sheets.py <folder-name>")
        print("Example: python make_contact_sheets.py ocean")
        sys.exit(1)

    make_contact_sheet(sys.argv[1])

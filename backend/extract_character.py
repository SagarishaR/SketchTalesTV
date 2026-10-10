import sys
import cv2
import numpy as np

MAX_DIMENSION = 1024


def extract_character(input_path, output_path):
    image = cv2.imread(input_path, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Could not read the input image")

    height, width = image.shape[:2]

    # Resize large phone photographs before processing.
    scale = min(1.0, MAX_DIMENSION / max(height, width))
    if scale < 1.0:
        image = cv2.resize(
            image,
            (round(width * scale), round(height * scale)),
            interpolation=cv2.INTER_AREA,
        )

    height, width = image.shape[:2]

    # Detect near-white paper.
    white = cv2.inRange(image, (225, 225, 225), (255, 255, 255))

    # Flood-fill only near-white pixels connected to the image border.
    # Do not dilate this mask: that can erase white parts of the drawing.
    flood = white.copy()
    flood_mask = np.zeros((height + 2, width + 2), np.uint8)

    for x, y in [
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
        (width // 2, 0),
        (width // 2, height - 1),
        (0, height // 2),
        (width - 1, height // 2),
    ]:
        if flood[y, x] == 255:
            cv2.floodFill(flood, flood_mask, (x, y), 128)

    background = flood == 128

    # Preserve a narrow antialiased transition at the character boundary.
    alpha = np.where(background, 0, 255).astype(np.uint8)

    rgba = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha

    if not cv2.imwrite(
        output_path,
        rgba,
        [cv2.IMWRITE_PNG_COMPRESSION, 9],
    ):
        raise ValueError("Could not save the extracted image")

    print(f"Output dimensions: {width}x{height}")
    print(f"Transparent pixels: {100 * np.mean(alpha == 0):.1f}%")
    print(f"Saved: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python extract_character.py input_image output_png")
        sys.exit(2)

    try:
        extract_character(sys.argv[1], sys.argv[2])
    except Exception as error:
        print(f"Extraction failed: {error}", file=sys.stderr)
        sys.exit(1)

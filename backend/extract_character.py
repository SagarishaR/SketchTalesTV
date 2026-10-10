import sys
import cv2
import numpy as np

MAX_DIMENSION = 1024

def extract_character(input_path, output_path):
    image = cv2.imread(input_path)

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

    # Detect near-white paper connected to the image border.
    white = cv2.inRange(image, (235, 235, 235), (255, 255, 255))
    flood = white.copy()
    flood_mask = np.zeros((height + 2, width + 2), np.uint8)
    cv2.floodFill(flood, flood_mask, (0, 0), 128)

    background = flood == 128
    background_mask = background.astype(np.uint8) * 255
    background_mask = cv2.dilate(
        background_mask, np.ones((3, 3), np.uint8), iterations=1
    )

    alpha = np.where(background_mask > 0, 0, 255).astype(np.uint8)

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

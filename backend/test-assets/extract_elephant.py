import cv2
import numpy as np

folder = "test-assets"
image = cv2.imread(f"{folder}/character.png")

if image is None:
    raise SystemExit("Could not read character.png")

height, width = image.shape[:2]

# Detect near-white paper.
white = cv2.inRange(image, (235, 235, 235), (255, 255, 255))

# Flood-fill white pixels connected to the outer border.
flood = white.copy()
mask = np.zeros((height + 2, width + 2), np.uint8)
cv2.floodFill(flood, mask, (0, 0), 128)

# Exterior background only; enclosed white character areas stay opaque.
background = flood == 128

# Slightly expand the background mask to reduce white fringes.
background_u8 = background.astype(np.uint8) * 255
background_u8 = cv2.dilate(
    background_u8,
    np.ones((3, 3), np.uint8),
    iterations=1,
)

alpha = np.where(background_u8 > 0, 0, 255).astype(np.uint8)

rgba = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
rgba[:, :, 3] = alpha

output = f"{folder}/elephant-cutout.png"
cv2.imwrite(output, rgba)

# Preview: composite the cutout over purple.
purple = np.zeros_like(image)
purple[:] = (100, 45, 65)  # BGR
a = alpha.astype(np.float32)[:, :, None] / 255.0
preview = (image * a + purple * (1 - a)).astype(np.uint8)
cv2.imwrite(f"{folder}/elephant-preview.jpg", preview)

print("Saved cutout:", output)
print("Saved preview:", f"{folder}/elephant-preview.jpg")
print("Transparent pixels:", round(100 * np.mean(alpha == 0), 1), "%")
print("Opaque pixels:", round(100 * np.mean(alpha == 255), 1), "%")

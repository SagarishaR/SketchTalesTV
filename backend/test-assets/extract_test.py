import cv2
import numpy as np
from pathlib import Path

folder = Path("test-assets")
image = cv2.imread(str(folder / "character.png"))

if image is None:
    raise SystemExit("Could not read character.png")

height, width = image.shape[:2]

# First-pass foreground extraction.
# GrabCut needs a rectangle that contains the character.
mask = np.zeros((height, width), np.uint8)
rect = (
    int(width * 0.05),
    int(height * 0.05),
    int(width * 0.90),
    int(height * 0.90),
)

background_model = np.zeros((1, 65), np.float64)
foreground_model = np.zeros((1, 65), np.float64)

cv2.grabCut(
    image,
    mask,
    rect,
    background_model,
    foreground_model,
    5,
    cv2.GC_INIT_WITH_RECT,
)

alpha = np.where(
    (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD),
    255,
    0,
).astype(np.uint8)

rgba = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
rgba[:, :, 3] = alpha

output = folder / "character-cutout.png"
cv2.imwrite(str(output), rgba)

print("Original:", width, "x", height)
print("Saved first-pass cutout:", output)
print("Foreground pixel percentage:", round(100 * np.count_nonzero(alpha) / alpha.size, 1), "%")
print("IMPORTANT: This is an initial test, not yet a validated cutout.")

"""
Gives a flat cut-out a soft 3D "paper toy / felt toy" look: the shape is inflated like a cushion
(centre high, edges low) and lit from the top-left, so it gets gentle light, shade and a small shine.
It only changes brightness, never the child's colours or lines.

    python3 puff_character.py in.png out.png [--strength 0.5] [--shine 0.18]

Input and output: transparent PNG from extract_character.py / colorize_character.py.
"""
import argparse
import sys

import cv2
import numpy as np

LIGHT = np.array([-0.45, -0.65, 0.62], np.float32)       # from the top-left, towards the viewer
LIGHT /= np.linalg.norm(LIGHT)


def puff(rgba, strength=0.5, shine=0.18):
    bgr = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    inside = (alpha > 128).astype(np.uint8)
    h, w = inside.shape
    size = max(h, w)

    dist = cv2.distanceTransform(inside, cv2.DIST_L2, 5)
    dist = dist / (float(dist.max()) + 1e-6)
    height = np.sqrt(dist)                                  # round "cushion" profile
    height = cv2.GaussianBlur(height, (0, 0), size * 0.012)

    gx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3)
    k = size * 0.045                                        # how steep the cushion looks
    normal = np.dstack([-gx * k, -gy * k, np.ones_like(gx)])
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)

    lambert = np.clip((normal * LIGHT).sum(axis=2), 0, 1)
    flat = float(LIGHT[2])                                  # brightness of a flat, front-facing surface
    factor = 1.0 + strength * (lambert - flat)              # flat areas stay as drawn (factor 1)

    half = (LIGHT + np.array([0, 0, 1], np.float32))
    half /= np.linalg.norm(half)
    spec = np.clip((normal * half).sum(axis=2), 0, 1) ** 28 * shine * 255.0

    lit = np.clip(bgr * factor[:, :, None] + spec[:, :, None] * (inside[:, :, None]), 0, 255)
    return np.dstack([lit.astype(np.uint8), alpha])


def main(argv):
    ap = argparse.ArgumentParser(description="Add a soft 3D toy look to a cut-out.")
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--strength", type=float, default=0.5)
    ap.add_argument("--shine", type=float, default=0.18)
    a = ap.parse_args(argv)
    rgba = cv2.imread(a.input, cv2.IMREAD_UNCHANGED)
    if rgba is None or rgba.ndim != 3 or rgba.shape[2] != 4:
        print("Input must be a transparent PNG", file=sys.stderr)
        return 1
    cv2.imwrite(a.output, puff(rgba, a.strength, a.shine))
    print("Added soft 3D look")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
    
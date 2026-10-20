"""
SketchTales character extractor v2.

Works on white paper AND on painted/coloured pages: it learns the page colour(s)
from the image border, removes everything that looks like the page, fills holes,
and keeps the largest remaining shape (plus anything attached to it).

Usage: python extract_character.py input_image output_png
"""
import sys
import cv2
import numpy as np

MAX_DIMENSION = 1024
BORDER_FRAC = 0.03      # width of the border strip used to learn the page colour
BG_DISTANCE = 20.0      # Lab distance below which a pixel counts as page
MIN_FG, MAX_FG = 0.03, 0.90   # sanity limits for the character's share of the image
# Pale tinted pages (a light-blue sky, a pastel sheet) usually carry soft cast shadows and gaps
# between legs. For those pages only: darker patches of the page's own colour count as page, and
# big enclosed patches of page colour (the gap between legs) stay see-through.
PALE_CHROMA_MIN, PALE_CHROMA_MAX = 10.0, 40.0
SHADOW_AB, SHADOW_L = 14.0, 45.0
MAX_SMALL_HOLE = 0.004        # holes smaller than this share of the image are always filled (eye shine)


def _legacy_white_flood(image):
    """Old behaviour: remove near-white paper connected to the border."""
    h, w = image.shape[:2]
    white = cv2.inRange(image, (225, 225, 225), (255, 255, 255))
    mask = np.zeros((h + 2, w + 2), np.uint8)
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if white[y, x] == 255:
            cv2.floodFill(white, mask, (x, y), 128)
    return np.where(white == 128, 0, 255).astype(np.uint8)


LINE_DARKNESS = 28.0   # how much darker than the paper a pencil stroke must be


def _fill_holes(mask):
    h, w = mask.shape
    inv = 255 - mask
    ff = np.zeros((h + 2, w + 2), np.uint8)
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if inv[y, x] == 255:
            cv2.floodFill(inv, ff, (x, y), 0)
    return cv2.bitwise_or(mask, inv)


def _line_art_mask(image):
    """Pencil/pen line drawings on pale paper: find the dark strokes, join gaps,
    fill the enclosed shape, keep the largest piece."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (0, 0), 1.5)
    # Estimate the paper brightness (handles shadows and uneven light), then
    # mark pixels clearly darker than the paper as strokes.
    paper = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
    paper = cv2.GaussianBlur(paper, (0, 0), 15)
    diff = paper.astype(np.float32) - gray.astype(np.float32)
    strokes = (diff > LINE_DARKNESS).astype(np.uint8) * 255
    k = max(15, int(min(image.shape[:2]) * 0.05)) | 1
    joined = cv2.morphologyEx(strokes, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    joined = _fill_holes(joined)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(joined)
    if n <= 1:
        return np.zeros_like(joined)
    biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    shape = (labels == biggest).astype(np.uint8) * 255
    # Keep thin parts (tails, whiskers) from vanishing: add the strokes inside/near the shape.
    near = cv2.dilate(shape, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    keep = cv2.bitwise_and(strokes, near)
    keep = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    return cv2.bitwise_or(shape, keep)


def extract_character(input_path, output_path):
    image = cv2.imread(input_path, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not read the input image")

    h, w = image.shape[:2]
    scale = min(1.0, MAX_DIMENSION / max(h, w))
    if scale < 1.0:
        image = cv2.resize(image, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    h, w = image.shape[:2]

    lab = cv2.cvtColor(cv2.GaussianBlur(image, (0, 0), 2), cv2.COLOR_BGR2LAB).astype(np.float32)

    # Learn the page colour(s) from a strip around the border.
    b = max(4, int(min(h, w) * BORDER_FRAC))
    strip = np.concatenate([lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3),
                            lab[:, :b].reshape(-1, 3), lab[:, -b:].reshape(-1, 3)])
    k = 3
    _, _, centres = cv2.kmeans(strip, k, None,
                               (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5),
                               3, cv2.KMEANS_PP_CENTERS)
    dist = np.min([np.linalg.norm(lab - c, axis=2) for c in centres], axis=0)

    bg_like = dist <= BG_DISTANCE
    chroma = float(np.linalg.norm(centres[:, 1:] - 128.0, axis=1).max())     # how tinted is the page?
    pale_tinted = PALE_CHROMA_MIN < chroma < PALE_CHROMA_MAX
    if pale_tinted:
        shadow = np.zeros(bg_like.shape, bool)
        for c in centres:
            d_ab = np.linalg.norm(lab[:, :, 1:] - c[1:], axis=2)
            d_l = lab[:, :, 0] - c[0]
            shadow |= (d_ab < SHADOW_AB) & (d_l < -4) & (d_l > -SHADOW_L)
        bg_like = bg_like | shadow
    fg = (~bg_like).astype(np.uint8) * 255
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    filled = _fill_holes(fg)
    if pale_tinted:
        holes = cv2.subtract(filled, fg)
        n_h, lab_h, st_h, _ = cv2.connectedComponentsWithStats(holes)
        limit = MAX_SMALL_HOLE * h * w
        keep = np.zeros_like(fg)
        for i in range(1, n_h):
            region = lab_h == i
            if st_h[i, cv2.CC_STAT_AREA] < limit or float(dist[region].mean()) > BG_DISTANCE * 1.5:
                keep[region] = 255
        fg = cv2.bitwise_or(fg, keep)
    else:
        fg = filled

    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n > 1:
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = (labels == biggest).astype(np.uint8) * 255

    share = float(np.mean(fg > 0))
    method = "page-colour (pale page)" if pale_tinted else "page-colour"
    if not (MIN_FG <= share <= MAX_FG):
        line = _line_art_mask(image)
        line_share = float(np.mean(line > 0))
        if 0.005 <= line_share <= 0.60:
            fg, share, method = line, line_share, "line-art"
        else:
            fg = _legacy_white_flood(image)
            share = float(np.mean(fg > 0))
            method = "white-flood fallback"

    # Soft, slightly shrunk edge so no page colour rim shows.
    fg = cv2.erode(fg, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    alpha = cv2.GaussianBlur(fg, (0, 0), 1.2)

    rgba = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha
    ys, xs = np.where(alpha > 10)
    if len(xs):
        rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

    if not cv2.imwrite(output_path, rgba, [cv2.IMWRITE_PNG_COMPRESSION, 9]):
        raise ValueError("Could not save the extracted image")

    print(f"Method: {method}")
    print(f"Character share of photo: {100 * share:.1f}%")
    print(f"Output dimensions: {rgba.shape[1]}x{rgba.shape[0]}")
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
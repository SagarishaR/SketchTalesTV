"""Gives a flat cut-out hero a light 3D "thick paper / cardboard" look.

Usage:  python depth_character.py input_cutout.png output.png [--depth 0.022] [--no-outline]

What it adds (all computed from the cut-out's own outline, so thin ears, tails and
legs can never produce odd artefacts):
  * a thin soft-white sticker outline,
  * a thick dark "paper edge" below and to the right (the extrusion),
  * a gentle top light and bottom shade on the drawing itself.
The drawing's own pixels are never moved or redrawn. The canvas grows only on the
right and the bottom, so the character keeps the same left/top position.
"""
import argparse
import sys

import cv2
import numpy as np


def shift(arr, dx, dy):
    """Move an image by whole pixels (dx right, dy down), filling with zeros."""
    out = np.zeros_like(arr)
    h, w = arr.shape[:2]
    xs, xd = (0, dx) if dx >= 0 else (-dx, 0)
    ys, yd = (0, dy) if dy >= 0 else (-dy, 0)
    cw, ch = w - abs(dx), h - abs(dy)
    if cw <= 0 or ch <= 0:
        return out
    out[yd:yd + ch, xd:xd + cw] = arr[ys:ys + ch, xs:xs + cw]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--depth', type=float, default=0.022,
                    help='thickness as a fraction of the picture height')
    ap.add_argument('--no-outline', action='store_true')
    args = ap.parse_args()

    img = cv2.imread(args.src, cv2.IMREAD_UNCHANGED)
    if img is None:
        sys.exit(f'Cannot read {args.src}')
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    h, w = img.shape[:2]
    depth = max(3, int(round(h * args.depth)))
    outline = 0 if args.no_outline else max(2, depth // 3)
    pad_l = pad_t = outline + 1            # room for the outline on the left / top
    pad_r = pad_b = outline + depth + 2    # room for outline + thickness on the right / bottom

    canvas = np.zeros((h + pad_t + pad_b, w + pad_l + pad_r, 4), np.uint8)
    canvas[pad_t:pad_t + h, pad_l:pad_l + w] = img
    bgr = canvas[:, :, :3].astype(np.float32) / 255.0
    a = canvas[:, :, 3].astype(np.float32) / 255.0
    H, W = a.shape

    # --- body colour of the paper edge: a dark version of the drawing's average colour ---
    solid = a > 0.5
    if solid.any():
        mean = bgr[solid].mean(axis=0)
    else:
        mean = np.array([0.3, 0.3, 0.3], np.float32)
    edge_col = np.clip(mean * 0.38 + np.array([0.04, 0.02, 0.05], np.float32), 0, 1)

    # --- sticker outline: the outline of the cut-out, grown by `outline` pixels ---
    base_mask = (a > 0.08).astype(np.uint8)
    if outline > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * outline + 1, 2 * outline + 1))
        grown = cv2.dilate(base_mask, k)
    else:
        grown = base_mask
    grown_a = cv2.GaussianBlur(grown.astype(np.float32), (0, 0), 0.8)

    # --- extrusion: the grown shape copied step by step down and to the right ---
    ext = grown_a.copy()
    for step in range(1, depth + 1):
        ext = np.maximum(ext, shift(grown_a, step, step))
    ext = np.clip(ext, 0, 1)

    # --- soft contact shadow under everything ---
    shadow = cv2.GaussianBlur(shift(ext, depth // 2 + 2, depth + 3), (0, 0), max(2.0, depth * 0.6)) * 0.35

    out_rgb = np.zeros((H, W, 3), np.float32)
    out_a = np.zeros((H, W), np.float32)

    def over(layer_rgb, layer_a):
        nonlocal out_rgb, out_a
        la = layer_a[..., None]
        oa = out_a[..., None]
        new_a = la + oa * (1 - la)
        safe = np.maximum(new_a, 1e-6)
        out_rgb = (layer_rgb * la + out_rgb * oa * (1 - la)) / safe
        out_a = new_a[..., 0]

    over(np.zeros((H, W, 3), np.float32), shadow)                       # 1 shadow
    over(np.ones((H, W, 3), np.float32) * edge_col, ext)               # 2 paper edge
    if outline > 0:
        over(np.ones((H, W, 3), np.float32) * np.array([0.97, 0.96, 0.94], np.float32), grown_a)  # 3 outline

    # --- the drawing itself, with a gentle top light / bottom shade ---
    ys = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    ys = np.broadcast_to(ys, (H, W, 1))
    top_rows = np.where(a > 0.05)[0]
    if top_rows.size:
        y0, y1 = top_rows.min(), top_rows.max()
        t = np.clip((np.arange(H, dtype=np.float32) - y0) / max(1, y1 - y0), 0, 1)[:, None, None]
        light = 1.07 - 0.16 * t          # 1.07 at the top, 0.91 at the bottom
    else:
        light = np.ones((H, 1, 1), np.float32)
    lit = np.clip(bgr * light, 0, 1)
    over(lit, a)                                                       # 4 drawing

    result = np.dstack([np.clip(out_rgb, 0, 1), np.clip(out_a, 0, 1)])
    result = (result * 255.0 + 0.5).astype(np.uint8)
    cv2.imwrite(args.dst, result)
    print(f'Depth: {depth}px  Outline: {outline}px  Output dimensions: {result.shape[1]}x{result.shape[0]}')
    print(f'Saved: {args.dst}')


if __name__ == '__main__':
    main()
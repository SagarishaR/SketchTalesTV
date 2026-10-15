#!/usr/bin/env python3
"""
SketchTales scene renderer (prototype).

Turns ONE scene into an MP4 clip:
  background image  + camera pan/zoom
  child's hero cutout, "polished" (cleaned colours, sticker outline, soft shadow)
  living motion (walk / hop / pop / celebrate with squash-and-stretch)
  optional prop that pops in and floats
  twinkling sparkles, fade in/out, soft vignette
  narration audio + quiet looping background music

Style: --style stopmotion (default) gives a hand-made paper cut-out look:
  12 stepped frames per second, tiny hand jitter, rough paper-cut edges,
  paper grain and a lifted drop shadow. --style smooth gives the old smooth look.

Usage example:
  python render_clip.py --bg bg.png --hero hero.png --narration scene1.mp3 \
      --music music.mp3 --motion walk --out scene1.mp4

Requirements: python3, opencv-python, numpy, and ffmpeg on the PATH.
"""
import argparse
import math
import os
import subprocess
import sys

import cv2
import numpy as np

W, H, FPS = 1280, 720, 24


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def ease_out_back(x):
    c1, c3 = 1.70158, 2.70158
    x = min(max(x, 0.0), 1.0)
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def audio_seconds(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path])
    return float(out.decode().strip())


def load_rgba(path, max_side):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        sys.exit(f"Could not read image: {path}")
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    h, w = img.shape[:2]
    s = max_side / max(h, w)
    if s < 1:
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    # crop to the visible pixels so the feet sit on the bottom edge
    ys, xs = np.where(img[:, :, 3] > 10)
    if len(xs):
        img = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return img



def load_foreground(path):
    """Load a foreground strip. Plain magenta backgrounds are keyed out."""
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        sys.exit(f"Could not read foreground: {path}")
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    if img[:, :, 3].min() == 255:  # no transparency present: key out magenta
        b, g, r = [img[:, :, i].astype(np.float32) for i in range(3)]
        dist = np.sqrt((r - 255) ** 2 + g ** 2 + (b - 255) ** 2)
        a = np.clip((dist - 70) / 60.0, 0, 1)
        img[:, :, 3] = (a * 255).astype(np.uint8)
        img[:, :, :3][a < 0.05] = 0
    ys, xs = np.where(img[:, :, 3] > 10)
    if len(xs):
        img = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return img


def polish(sprite, outline_px=7, rough=False):
    """Make a rough cutout look like a clean paper sticker."""
    bgr = sprite[:, :, :3]
    alpha = sprite[:, :, 3]

    # smooth colour noise but keep edges, then lift saturation a little
    bgr = cv2.bilateralFilter(bgr, 9, 55, 55)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.25, 0, 255)
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.04 + 4, 0, 255)
    bgr = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    # soften the cut edge
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.2)

    pad = outline_px + 14
    bgr = cv2.copyMakeBorder(bgr, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(0, 0, 0))
    alpha = cv2.copyMakeBorder(alpha, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)

    # white sticker outline = dilated alpha painted white behind the sprite
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (outline_px * 2 + 1, outline_px * 2 + 1))
    outline = cv2.dilate(alpha, k)
    outline = cv2.GaussianBlur(outline, (0, 0), 1.0)

    if rough:
        # irregular scissor-cut edge: wobble the outline with smooth noise
        rs = np.random.RandomState(11)
        noise = cv2.GaussianBlur(rs.rand(*outline.shape).astype(np.float32), (0, 0), 3.0)
        noise = (noise - noise.mean()) / (noise.std() + 1e-6)
        noise = np.clip(noise, -1.6, 1.6)  # keeps the wobble on the edge, no stray specks
        edge = outline.astype(np.float32) / 255.0 + noise * 0.30
        base = outline.astype(np.float32) / 255.0
        wob = np.clip((edge - 0.5) * 6 + 0.5, 0, 1) * (base > 0.03)  # no specks away from the edge
        outline = (wob * 255).astype(np.uint8)
        outline = np.maximum(outline, (alpha > 128).astype(np.uint8) * 255)

    out_bgr = np.full_like(bgr, 255)
    a_f = alpha.astype(np.float32)[:, :, None] / 255.0
    out_bgr = (bgr.astype(np.float32) * a_f + out_bgr.astype(np.float32) * (1 - a_f)).astype(np.uint8)
    return np.dstack([out_bgr, outline])


def make_sparkle(size=64):
    """A soft four-point star (BGR, float 0..1 intensity)."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    cx = cy = (size - 1) / 2
    dx, dy = np.abs(xx - cx) / cx, np.abs(yy - cy) / cy
    star = np.clip(1 - (dx ** 0.5 + dy ** 0.5), 0, 1) ** 2
    glow = np.clip(1 - np.sqrt(dx ** 2 + dy ** 2), 0, 1) ** 3 * 0.5
    return np.clip(star + glow, 0, 1)


def warp_rgba(sprite, M, canvas_w, canvas_h):
    return cv2.warpAffine(sprite, M, (canvas_w, canvas_h), flags=cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))


def composite(frame, layer):
    """Alpha-blend an RGBA layer (uint8) onto a BGR float32 frame, in place."""
    a = layer[:, :, 3:4].astype(np.float32) / 255.0
    frame *= (1 - a)
    frame += layer[:, :, :3].astype(np.float32) * a


def matrix(sx, sy, shear, angle_deg, tx, ty, pivot):
    """Scale/shear/rotate around `pivot`, then translate by (tx, ty). Returns 2x3."""
    px, py = pivot
    T1 = np.array([[1, 0, -px], [0, 1, -py], [0, 0, 1]], np.float32)
    S = np.array([[sx, shear * sx, 0], [0, sy, 0], [0, 0, 1]], np.float32)
    a = math.radians(angle_deg)
    R = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]], np.float32)
    T2 = np.array([[1, 0, px + tx], [0, 1, py + ty], [0, 0, 1]], np.float32)
    return (T2 @ R @ S @ T1)[:2]


# --------------------------------------------------------------------------
# Hero motion presets. Return (dx, dy, sx, sy, shear, angle) in pixels/ratios.
# --------------------------------------------------------------------------
def hero_motion(kind, t, w, h):
    if kind == "walk":
        phase = t * 2 * math.pi * 1.6
        dx = (-0.10 + 0.20 * (0.5 - 0.5 * math.cos(t * 2 * math.pi / 6.0))) * W
        dy = -abs(math.sin(phase)) * h * 0.04
        squash = 1 + 0.03 * math.sin(phase * 2)
        return dx, dy, 1 / squash, squash, 0.02 * math.sin(phase), 2.5 * math.sin(phase)
    if kind == "hop":
        phase = (t * 1.1) % 1.0
        up = math.sin(phase * math.pi)
        air = up > 0.02
        dy = -up * h * 0.30
        sy = 1.0 + (0.12 * up if air else 0.0) - (0.15 * (1 - phase) if phase < 0.12 else 0.0)
        return 0, dy, 1 / max(sy, 0.6), sy, 0, 2 * math.sin(phase * 2 * math.pi)
    if kind == "pop":
        s = 1 + 0.10 * math.sin(t * 2 * math.pi * 1.2)
        return 0, -h * 0.02 * math.sin(t * 2 * math.pi * 2.4), s, s, 0, 1.5 * math.sin(t * 3)
    # celebrate
    phase = t * 2 * math.pi * 1.4
    return 0, -abs(math.sin(phase)) * h * 0.18, 1.04, 1.04, 0.03 * math.sin(phase), 8 * math.sin(phase)


# --------------------------------------------------------------------------
# Main render
# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bg", required=True)
    ap.add_argument("--hero", required=True, help="RGBA cutout PNG of the child's drawing")
    ap.add_argument("--narration", help="narration audio (mp3/wav/m4a); sets the clip length")
    ap.add_argument("--music", help="background music (looped, mixed quietly)")
    ap.add_argument("--prop", help="optional RGBA prop PNG that pops in and floats")
    ap.add_argument("--prop-at", type=float, default=1.5, help="seconds when the prop appears")
    ap.add_argument("--motion", default="walk", choices=["walk", "hop", "pop", "celebrate"])
    ap.add_argument("--seconds", type=float, default=0, help="clip length if no narration")
    ap.add_argument("--hero-x", type=float, default=0.30, help="hero centre as fraction of width")
    ap.add_argument("--hero-y", type=float, default=0.80, help="hero feet as fraction of height")
    ap.add_argument("--hero-h", type=float, default=0.46, help="hero height as fraction of height")
    ap.add_argument("--parallax", action="store_true",
                    help="2.5D: estimate depth for the background and move the camera in 3D-like parallax")
    ap.add_argument("--depth-model", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "midas_small.onnx"))
    ap.add_argument("--cam-range", type=float, default=1.0, help="parallax camera sweep strength (0 = still)")
    ap.add_argument("--fg", help="optional foreground strip (grass/flowers) drawn IN FRONT of the hero; "
                                "PNG with transparency, or on a plain magenta (#FF00FF) background")
    ap.add_argument("--style", default="stopmotion", choices=["stopmotion", "smooth"])
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    duration = audio_seconds(args.narration) + 0.8 if args.narration else args.seconds
    if duration <= 0:
        sys.exit("Give --narration or --seconds")
    total = int(duration * FPS)

    # --- assets
    bg = cv2.imread(args.bg)
    if bg is None:
        sys.exit(f"Could not read background: {args.bg}")
    par = args.parallax
    depth = None
    if par:
        from depth_map import estimate_depth  # needs onnxruntime + the MiDaS small .onnx model
        bg = cv2.resize(bg, (W, H), interpolation=cv2.INTER_AREA)
        depth = cv2.GaussianBlur(estimate_depth(bg, args.depth_model), (0, 0), 2.0)
        gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    else:
        bg = cv2.resize(bg, (int(W * 1.35), int(H * 1.35)), interpolation=cv2.INTER_AREA)

    stop = args.style == "stopmotion"
    hero = polish(load_rgba(args.hero, 900), outline_px=8 if stop else 7, rough=stop)
    hh = int(H * args.hero_h)
    hw = int(hero.shape[1] * hh / hero.shape[0])
    hero = cv2.resize(hero, (hw, hh), interpolation=cv2.INTER_AREA)

    prop = None
    if args.prop:
        prop = polish(load_rgba(args.prop, 400), outline_px=5, rough=stop)
        ph = int(H * 0.16)
        pw = int(prop.shape[1] * ph / prop.shape[0])
        prop = cv2.resize(prop, (pw, ph), interpolation=cv2.INTER_AREA)

    fg = None
    if args.fg:
        fg = load_foreground(args.fg)
        fw = int(W * 1.18)
        fh = int(fg.shape[0] * fw / fg.shape[1])
        fh = min(fh, int(H * 0.38))
        fg = cv2.resize(fg, (fw, fh), interpolation=cv2.INTER_AREA)

    spark = make_sparkle(64)
    rng = np.random.RandomState(7)
    sparks = [(rng.uniform(0.04, 0.96) * W, rng.uniform(0.05, 0.6) * H,
               rng.uniform(0.35, 0.9), rng.uniform(0, 6.28), rng.uniform(0.6, 1.4))
              for _ in range(16)]

    # paper grain + soft mottling (static)
    gr = np.random.RandomState(5)
    fine = cv2.GaussianBlur(gr.randn(H, W).astype(np.float32), (0, 0), 0.8)
    coarse = cv2.GaussianBlur(gr.randn(H, W).astype(np.float32), (0, 0), 40.0)
    coarse = coarse / (np.abs(coarse).max() + 1e-6)
    grain = (1.0 + 0.05 * fine + 0.05 * coarse)[:, :, None].astype(np.float32)

    # vignette
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    vignette = np.clip(1.0 - 0.28 * np.clip(d - 0.55, 0, 1), 0, 1)[:, :, None]

    # --- ffmpeg (video from stdin, audio mixed from files)
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    n_in = 1
    filters, amap = [], []
    if args.narration:
        cmd += ["-i", args.narration]
        filters.append(f"[{n_in}:a]adelay=400|400,volume=1.0[nar]")
        amap.append("[nar]")
        n_in += 1
    if args.music:
        cmd += ["-stream_loop", "-1", "-i", args.music]
        filters.append(f"[{n_in}:a]volume=0.16,afade=t=in:d=1.5,"
                       f"afade=t=out:st={max(duration - 1.5, 0):.2f}:d=1.5[mus]")
        amap.append("[mus]")
        n_in += 1
    if amap:
        filters.append("".join(amap) + f"amix=inputs={len(amap)}:duration=longest:normalize=0[a]")
        cmd += ["-filter_complex", ";".join(filters), "-map", "0:v", "-map", "[a]",
                "-c:a", "aac", "-b:a", "128k"]
    cmd += ["-t", f"{duration:.2f}", "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", args.out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    base_x = args.hero_x * W
    base_y = args.hero_y * H
    pivot = (hw / 2, hh)  # feet
    d_hero = 0.8
    if par:
        y0, y1 = int(max(base_y - 20, 0)), int(min(base_y + 10, H - 1))
        x0, x1 = int(max(base_x - 60, 0)), int(min(base_x + 60, W - 1))
        d_hero = float(np.median(depth[y0:y1, x0:x1]))

    STEP_FPS = 12
    cache_key, cache_frame = None, None

    for i in range(total):
        t_real = i / FPS
        # stop-motion: hold each pose for 2 frames (12 poses per second)
        step = int(t_real * STEP_FPS) if stop else i
        t = (step / STEP_FPS) if stop else t_real
        p = t / max(duration, 1e-6)

        if stop and step == cache_key:
            # same pose as the previous frame: reuse it, only the fade changes
            frame = cache_frame.copy()
            fade = min(1.0, t_real / 0.6, (duration - t_real) / 0.6)
            frame *= max(fade, 0.0)
            proc.stdin.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())
            continue

        jr = np.random.RandomState(step)
        jit_x, jit_y, jit_a = (jr.uniform(-2.0, 2.0), jr.uniform(-1.6, 1.6), jr.uniform(-0.7, 0.7)) if stop else (0, 0, 0)

        # camera: slow zoom + pan across the oversized background
        zoom = 1.0 + 0.10 * p
        cam_w, cam_h = W * zoom, H * zoom
        ox = (bg.shape[1] - cam_w) * (0.25 + 0.5 * p) + jit_x * 0.8
        oy = (bg.shape[0] - cam_h) * 0.55 + jit_y * 0.8
        s = 1.0 / zoom  # map background pixels -> output pixels
        M_cam = np.array([[s, 0, -ox * s], [0, s, -oy * s]], np.float32)
        frame = cv2.warpAffine(bg, M_cam, (W, H), flags=cv2.INTER_LINEAR).astype(np.float32)
        par_x, dep_w = 0.0, None
        if par:
            cam = (-0.9 + 1.8 * p) * args.cam_range
            pz = 1.04 + 0.06 * p
            shift = cam * 38.0 * (depth - 0.45)
            mx = (gx - W / 2) / pz + W / 2 - shift
            my = (gy - H / 2) / pz + H / 2
            frame = cv2.remap(bg, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
            dep_w = cv2.remap(depth, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            par_x = -cam * 38.0 * (d_hero - 0.45)

        # sparkles (additive)
        for (sx0, sy0, amp, ph0, spd) in sparks:
            pulse = 0.5 + 0.5 * math.sin(t * spd * 2 + ph0)
            size = int(22 + 26 * amp * pulse)
            sp = cv2.resize(spark, (size, size))
            x0, y0 = int(sx0 - size / 2), int(sy0 - size / 2 - 8 * pulse)
            if 0 <= x0 < W - size and 0 <= y0 < H - size:
                frame[y0:y0 + size, x0:x0 + size] += (sp * pulse * 210)[:, :, None]

        base_copy = frame.copy() if par else None

        # hero
        dx, dy, sx, sy, shear, ang = hero_motion(args.motion, t, hw, hh)
        # pop-in during the first 0.7 s
        pop = ease_out_back(t / 0.7)
        sx, sy = sx * pop, sy * pop
        tx = base_x - hw / 2 + dx + jit_x + par_x
        ty = base_y - hh + dy + jit_y
        ang = ang + jit_a

        # soft ground shadow
        sh = np.zeros((H, W), np.float32)
        shadow_w = int(hw * 0.42 * (1.0 - 0.25 * min(1, abs(dy) / (hh * 0.4 + 1))))
        cv2.ellipse(sh, (int(base_x + dx + par_x), int(base_y)), (shadow_w, 14), 0, 0, 360, 0.38, -1)
        sh = cv2.GaussianBlur(sh, (0, 0), 7)
        frame *= (1 - sh)[:, :, None]

        M = matrix(sx, sy, shear, ang, tx, ty, pivot)
        layer = warp_rgba(hero, M, W, H)
        if stop:
            # paper lifted off the background: offset, slightly blurred shadow
            a = layer[:, :, 3].astype(np.float32) / 255.0
            a = np.roll(a, (9, 7), (0, 1))
            a = cv2.GaussianBlur(a, (0, 0), 3.0)
            frame *= (1 - 0.38 * a)[:, :, None]
        composite(frame, layer)

        # prop: pops in, then floats near the hero
        if prop is not None and t > args.prop_at:
            tp = t - args.prop_at
            ps = ease_out_back(tp / 0.6)
            pw_, ph_ = prop.shape[1], prop.shape[0]
            px = base_x + hw * 0.85 + 12 * math.sin(tp * 1.7) + par_x
            py = base_y - hh * 0.95 + 14 * math.sin(tp * 2.3)
            Mp = matrix(ps, ps, 0, 6 * math.sin(tp * 2), px - pw_ / 2, py - ph_ / 2, (pw_ / 2, ph_ / 2))
            pl = warp_rgba(prop, Mp, W, H)
            if stop:
                pa = np.roll(pl[:, :, 3].astype(np.float32) / 255.0, (7, 5), (0, 1))
                frame *= (1 - 0.32 * cv2.GaussianBlur(pa, (0, 0), 2.5))[:, :, None]
            composite(frame, pl)

        if par:
            occ = np.clip((dep_w - (d_hero + 0.05)) * 14, 0, 1)
            occ = cv2.GaussianBlur(occ, (0, 0), 1.5)[:, :, None]
            frame = frame * (1 - occ) + base_copy * occ

        # foreground strip in front of everything, drifting a little faster than the background
        if fg is not None:
            fx = -(fg.shape[1] - W) * (0.15 + 0.7 * p) + jit_x
            fy = H - fg.shape[0] + 6 + jit_y * 0.5
            Mf = np.array([[1, 0, fx], [0, 1, fy]], np.float32)
            composite(frame, warp_rgba(fg, Mf, W, H))

        # paper grain + vignette (cached with the pose), then fade in/out
        frame *= grain
        frame *= vignette
        cache_key, cache_frame = step, frame.copy()
        fade = min(1.0, t_real / 0.6, (duration - t_real) / 0.6)
        frame *= max(fade, 0.0)

        proc.stdin.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())

    proc.stdin.close()
    proc.wait()
    print(f"Wrote {args.out}  ({duration:.1f}s, {total} frames)")


if __name__ == "__main__":
    main()
import sys, cv2, numpy as np, onnxruntime as ort

def estimate_depth(bgr, model="midas_small.onnx"):
    """Return a float32 depth map in 0..1 where 1 = nearest to the camera."""
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0]
    h, w = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    rgb = cv2.resize(rgb, (256, 256), interpolation=cv2.INTER_AREA)
    rgb = (rgb - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = rgb.transpose(2, 0, 1)[None].astype(np.float32)
    d = sess.run(None, {inp.name: x})[0].squeeze()
    d = cv2.resize(d, (w, h), interpolation=cv2.INTER_CUBIC)
    lo, hi = np.percentile(d, 2), np.percentile(d, 98)
    d = np.clip((d - lo) / (hi - lo + 1e-6), 0, 1).astype(np.float32)
    d = cv2.bilateralFilter(d, 9, 0.08, 9)   # clean up while keeping edges
    return d

if __name__ == "__main__":
    img = cv2.imread(sys.argv[1])
    import time; t = time.time()
    d = estimate_depth(img)
    print("depth ok", d.shape, d.min(), d.max(), f"{time.time()-t:.2f}s")
    cv2.imwrite(sys.argv[2], (d * 255).astype(np.uint8))
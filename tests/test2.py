"""
Test YOLO model trained on RAM-only dataset.

Usage:
    python test2.py
    python test2.py --weights runs/segment/ram_only_train/weights/best.pt
"""

import argparse
import time
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO


def load_class_names(classes_path: str | None) -> list[str] | None:
    if not classes_path:
        return None
    p = Path(classes_path)
    if not p.exists():
        print(f"[warn] classes file not found: {p}")
        return None
    names = []
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if line:
            names.append(line)
    return names if names else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", type=str, default="epoch65.pt",
                    help="Path to YOLO segmentation weights.")
    ap.add_argument("--classes", type=str, default="classes.txt",
                    help="classes.txt file.")
    ap.add_argument("--cam", type=int, default=1, help="Camera index.")
    ap.add_argument("--imgsz", type=int, default=640, help="Inference image size.")
    ap.add_argument("--conf", type=float, default=0.6, help="Confidence threshold.")
    ap.add_argument("--device", type=str, default="0", help="Device.")
    ap.add_argument("--max_det", type=int, default=10, help="Max detections.")
    args = ap.parse_args()

    weights_path = Path(args.weights)
    if not weights_path.exists():
        raise FileNotFoundError(f"Weights not found: {weights_path.resolve()}")

    class_names = load_class_names(args.classes)
    
    print(f"[info] Loading model: {weights_path}")
    if class_names:
        print(f"[info] Classes: {class_names}")
    model = YOLO(str(weights_path))

    # Windows camera
    cap = cv2.VideoCapture(args.cam, cv2.CAP_DSHOW)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open camera {args.cam}")

    cv2.namedWindow("YOLO RAM Test", cv2.WINDOW_NORMAL)

    last_t = time.time()
    fps = 0.0
    frame_count = 0

    try:
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                print("[warn] camera read failed")
                break
            
            frame_count += 1
            
            # Save first frame for debugging
            if frame_count == 1:
                cv2.imwrite("debug_frame2.jpg", frame)
                print(f"[DEBUG] Saved debug_frame2.jpg - shape: {frame.shape}")

            # Inference
            results = model.predict(
                source=frame,
                imgsz=args.imgsz,
                conf=args.conf,
                device=args.device,
                max_det=args.max_det,
                verbose=False
            )
            r = results[0]
            
            # Debug output
            num_det = len(r.boxes) if r.boxes is not None else 0
            if num_det > 0:
                print(f"[DETECTED] {num_det} objects:")
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    name = class_names[cls_id] if class_names and cls_id < len(class_names) else str(cls_id)
                    print(f"  - {name}: {conf:.2f}")

            # Use YOLO's built-in visualization
            vis = r.plot()

            # FPS
            now = time.time()
            dt = now - last_t
            last_t = now
            if dt > 0:
                fps = 0.9 * fps + 0.1 * (1.0 / dt) if fps > 0 else (1.0 / dt)

            cv2.putText(vis, f"FPS: {fps:.1f} | conf={args.conf}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

            cv2.imshow("YOLO RAM Test", vis)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("]"):
                args.conf = min(0.99, args.conf + 0.05)
                print(f"[info] conf = {args.conf:.2f}")
            if key == ord("["):
                args.conf = max(0.01, args.conf - 0.05)
                print(f"[info] conf = {args.conf:.2f}")

    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

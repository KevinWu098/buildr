"""
Train YOLO on RAM-only dataset (dataset2).

Usage:
    python train2.py
    python train2.py --epochs 50 --batch 32
"""

import argparse
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser(description="Train YOLO on RAM-only dataset.")
    ap.add_argument("--data", type=str, default="dataset2/dataset.yaml", 
                    help="Path to dataset YAML.")
    ap.add_argument("--model", type=str, default="yolo11s-seg.pt", 
                    help="Base model checkpoint")
    ap.add_argument("--imgsz", type=int, default=640, 
                    help="Image size.")
    ap.add_argument("--epochs", type=int, default=50, 
                    help="Epochs.")
    ap.add_argument("--batch", type=int, default=32, 
                    help="Batch size.")
    ap.add_argument("--device", type=str, default="0", 
                    help="CUDA device index, or 'cpu'.")
    ap.add_argument("--project", type=str, default="runs/segment", 
                    help="Output project folder.")
    ap.add_argument("--name", type=str, default="ram_only_train", 
                    help="Run name.")
    args = ap.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset YAML not found: {data_path}")

    from ultralytics import YOLO

    model = YOLO(args.model)
    model.train(
        data=str(data_path),
        imgsz=args.imgsz,
        epochs=args.epochs,
        batch=args.batch,
        device=args.device,
        project=args.project,
        name=args.name,
        task="segment",
    )

    print("✅ Training complete.")
    print(f"Check weights in: {Path(args.project) / args.name / 'weights'}")


if __name__ == "__main__":
    main()

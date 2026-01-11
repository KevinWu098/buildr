"""
Transform script for RAM-only dataset (debugging/testing).

Creates dataset2 with:
- Only ram_labels folder
- Almost all images in train, just 1 in val

Usage:
    python transform_2.py
"""

import argparse
import re
import shutil
from pathlib import Path


IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def read_classes(classes_path: Path) -> list[str]:
    if not classes_path.exists():
        raise FileNotFoundError(f"classes.txt not found at: {classes_path}")

    names = []
    for line in classes_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if line:
            names.append(line)
    if not names:
        raise ValueError("classes.txt is empty (no class names found).")
    return names


def find_label_for_image(img_path: Path) -> Path | None:
    """Find matching label file for an image."""
    same_stem = img_path.with_suffix(".txt")
    if same_stem.exists():
        return same_stem

    stem = img_path.stem

    if stem.startswith("frame_"):
        cand = img_path.with_name("label_" + stem[len("frame_"):]).with_suffix(".txt")
        if cand.exists():
            return cand

    m = re.search(r"(\d+)$", stem)
    if m:
        num = m.group(1)
        cand = img_path.with_name(f"label_{num}").with_suffix(".txt")
        if cand.exists():
            return cand
        for width in (5, 6, 7, 8):
            cand = img_path.with_name(f"label_{int(num):0{width}d}").with_suffix(".txt")
            if cand.exists():
                return cand

    return None


def write_yaml(out_root: Path, names: list[str], yaml_name: str = "dataset.yaml") -> Path:
    yaml_path = out_root / yaml_name
    lines = []
    lines.append(f"path: {out_root.name}")
    lines.append("train: images/train")
    lines.append("val: images/val")
    lines.append("")
    lines.append("names:")
    for i, name in enumerate(names):
        lines.append(f"  {i}: {name}")

    yaml_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return yaml_path


def collect_images_from_folder(folder: Path) -> list[Path]:
    """Collect all images from a folder."""
    if not folder.exists():
        return []
    images = [p for p in sorted(folder.iterdir()) if p.is_file() and p.suffix.lower() in IMG_EXTS]
    return images


def main() -> None:
    ap = argparse.ArgumentParser(description="Prepare RAM-only YOLO dataset for testing.")
    ap.add_argument("--src_root", type=str, default=".", 
                    help="Folder containing classes.txt and ram_labels.")
    ap.add_argument("--src_folder", type=str, default="cpu_labels",
                    help="Folder containing RAM images + labels.")
    ap.add_argument("--out_root", type=str, default="dataset2", 
                    help="Output dataset folder to create.")
    ap.add_argument("--val_count", type=int, default=1, 
                    help="Number of images in validation (rest go to train).")
    ap.add_argument("--yaml_name", type=str, default="dataset.yaml", 
                    help="Name of dataset yaml.")
    args = ap.parse_args()

    src_root = Path(args.src_root).resolve()
    src_folder = (src_root / args.src_folder).resolve()
    out_root = (src_root / args.out_root).resolve()

    classes_path = src_root / "classes.txt"
    names = read_classes(classes_path)
    print(f"📋 Classes ({len(names)}): {names}")

    if not src_folder.exists():
        raise FileNotFoundError(f"Source folder not found: {src_folder}")

    # Create output dirs
    img_train = out_root / "images" / "train"
    img_val = out_root / "images" / "val"
    lbl_train = out_root / "labels" / "train"
    lbl_val = out_root / "labels" / "val"
    
    # Clean and recreate
    if out_root.exists():
        shutil.rmtree(out_root)
    for p in (img_train, img_val, lbl_train, lbl_val):
        p.mkdir(parents=True, exist_ok=True)

    images = collect_images_from_folder(src_folder)
    if not images:
        raise RuntimeError(f"No images found in {src_folder}")

    print(f"📁 Found {len(images)} images in {args.src_folder}")

    copied_train = 0
    copied_val = 0
    missing_labels = []

    for i, img_path in enumerate(images):
        lbl_path = find_label_for_image(img_path)
        if lbl_path is None or not lbl_path.exists():
            missing_labels.append(img_path.name)
            continue

        # First val_count images go to val, rest to train
        is_val = (i < args.val_count)

        # Copy image
        dst_img_dir = img_val if is_val else img_train
        shutil.copy2(img_path, dst_img_dir / img_path.name)

        # Copy label (same basename as image)
        dst_lbl_dir = lbl_val if is_val else lbl_train
        dst_lbl_path = dst_lbl_dir / (img_path.stem + ".txt")
        shutil.copy2(lbl_path, dst_lbl_path)

        if is_val:
            copied_val += 1
        else:
            copied_train += 1

    yaml_path = write_yaml(out_root, names, yaml_name=args.yaml_name)

    print()
    print("=" * 50)
    print("✅ Done.")
    print(f"Output dataset: {out_root}")
    print(f"YAML: {yaml_path}")
    print(f"Train images: {copied_train}")
    print(f"Val images:   {copied_val}")
    
    if missing_labels:
        print(f"⚠️ Missing labels: {len(missing_labels)}")


if __name__ == "__main__":
    main()

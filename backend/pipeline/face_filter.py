"""
face_filter.py
Filters cropped face images — matched to teacher's notebook (cell 9).

Teacher's filters (check_whether_frame_is_suitable):
  1. is_small(path, 20)      → min face dimension 20px
  2. is_blurred(path, 50)    → Laplacian variance < 50 → discard
  3. is_obstructed(path,0.7) → MediaPipe confidence (omitted — needs mediapipe install)

Previous version used min_size=80, blur=200, plus brightness/variance/aspect checks.
These were far too aggressive and reduced a 140-student lecture to only 13 detections.
Philosophy: be LENIENT here, let DBSCAN's noise-discard handle the true junk.
"""
import cv2
import os
import shutil
from pathlib import Path
from typing import Callable, Optional


def filter_faces(
    faces_dir: str,
    output_dir: str,
    min_face_size: int    = 20,
    blur_threshold: float = 50.0,
    progress_callback: Optional[Callable[[int, str], None]] = None,
    # Legacy keyword args accepted but ignored (brightness, variance, aspect)
    **kwargs
) -> list[str]:
    """
    Copy only quality face crops to output_dir.
    Applies size and blur checks only — matching teacher's notebook exactly.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    all_files = sorted([
        f for f in os.listdir(faces_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ])

    total = len(all_files)
    kept = []
    r_small = 0
    r_blur  = 0
    r_none  = 0

    for i, fname in enumerate(all_files):
        fpath = os.path.join(faces_dir, fname)
        img   = cv2.imread(fpath)

        if img is None:
            r_none += 1
            continue

        h, w = img.shape[:2]

        # ── 1. Size (teacher: is_small threshold = 20) ────────────────────────
        if h < min_face_size or w < min_face_size:
            r_small += 1
            continue

        # ── 2. Blur (teacher: is_blurred threshold = 50) ─────────────────────
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        if cv2.Laplacian(gray, cv2.CV_64F).var() < blur_threshold:
            r_blur += 1
            continue

        dst = os.path.join(output_dir, fname)
        shutil.copy(fpath, dst)
        kept.append(dst)

        if progress_callback and total > 0:
            pct = int(((i + 1) / total) * 100)
            progress_callback(pct, f"Filtering faces... {i+1}/{total}")

    if progress_callback:
        progress_callback(
            100,
            f"Filtering done. Kept: {len(kept)}/{total} | "
            f"Too small: {r_small} | Blurry: {r_blur} | Unreadable: {r_none}"
        )

    return kept

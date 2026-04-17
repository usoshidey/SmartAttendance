"""
embedder.py
Generates VGG-Face embeddings using DeepFace.

Notes:
  - detector_backend="skip": faces are already YOLO-cropped, no re-detection needed.
  - align=False (intentional): align=True secretly re-runs a face detector for
    landmark detection internally, even when detector_backend="skip". On large
    batches (1000+ faces) this causes crashes/hangs on problematic crops.
    YOLO crops are already well-framed, so alignment adds no accuracy benefit here.
"""
import os
import json
from pathlib import Path
from typing import Callable, Optional


def generate_embeddings(
    faces_dir: str,
    output_path: str,
    model_name: str = "VGG-Face",
    progress_callback: Optional[Callable[[int, str], None]] = None
) -> dict:
    """
    Generate face embeddings for all images in faces_dir.
    Returns dict mapping filename → embedding vector (list of floats).
    """
    from deepface import DeepFace

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    files = sorted([
        f for f in os.listdir(faces_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ])

    # No hard cap — NoiseRemoval is disabled (NR_THRESHOLD=0) so
    # the old OOM risk from N×N×4096 matrix is gone.
    # More faces = better DBSCAN clustering, especially for large classes.

    MAX_FACES = 600
    if len(files) > MAX_FACES:
        step = len(files) / MAX_FACES
        files = [files[int(i * step)] for i in range(MAX_FACES)]

    total      = len(files)
    embeddings = {}
    errors     = 0

    for i, fname in enumerate(files):
        fpath = os.path.join(faces_dir, fname)
        try:
            # Try with align=True first — better embedding consistency
            rep = DeepFace.represent(
                img_path          = fpath,
                model_name        = model_name,
                detector_backend  = "skip",
                align             = False,
                enforce_detection = False
            )
            if rep and rep[0].get("embedding"):
                embeddings[fname] = rep[0]["embedding"]
            else:
                errors += 1
        except Exception:
            # Fallback: align=False for problematic crops
            try:
                rep = DeepFace.represent(
                    img_path          = fpath,
                    model_name        = model_name,
                    detector_backend  = "skip",
                    align             = False,
                    enforce_detection = False
                )
                if rep and rep[0].get("embedding"):
                    embeddings[fname] = rep[0]["embedding"]
                else:
                    errors += 1
            except Exception:
                errors += 1

        if progress_callback and total > 0:
            pct = int(((i + 1) / total) * 100)
            progress_callback(pct, f"Generating embeddings... {i+1}/{total}")

    with open(output_path, "w") as f:
        json.dump(embeddings, f)

    if progress_callback:
        progress_callback(
            100,
            f"Embeddings done. {len(embeddings)} succeeded, {errors} failed."
        )

    return embeddings


def load_embeddings(path: str) -> dict:
    with open(path, "r") as f:
        return json.load(f)


def compute_centroid(embedding_list: list) -> list:
    import numpy as np
    arr      = np.array(embedding_list, dtype=np.float32)
    centroid = arr.mean(axis=0)
    norm     = np.linalg.norm(centroid)
    if norm > 0:
        centroid /= norm
    return centroid.tolist()
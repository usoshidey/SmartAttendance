"""
face_detector.py
Runs YOLO face detection directly on a video file (or pre-extracted frames)
and crops face ROIs.

Supports two modes:
  - video_path mode (preferred): reads frames directly from the video using
    OpenCV at `sample_rate` (every Nth frame), resized to `resize_width` for
    speed. This avoids writing frames to disk.
  - frames_dir mode (legacy): reads pre-saved frame images from a directory.
"""
import cv2
import os
from pathlib import Path
from typing import Callable, Optional

# Lazy-load YOLO so it's only imported once at module level
_yolo_model = None


def get_yolo_model(model_path: str):
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        _yolo_model = YOLO(model_path)
    return _yolo_model


def _run_yolo_on_frame(model, frame, conf: float, frame_idx: int, output_dir: str, saved_paths: list):
    """Helper: run YOLO on one frame and save all detected face crops."""
    results = model(frame, conf=conf, verbose=False)
    face_id = 0
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            face = frame[y1:y2, x1:x2]
            if face.size == 0:
                continue
            face_id += 1
            out_name = f"frame_{frame_idx:06d}_face_{face_id:03d}.jpg"
            out_path = os.path.join(output_dir, out_name)
            cv2.imwrite(out_path, face)
            saved_paths.append(out_path)


def detect_and_crop_faces(
    frames_dir: Optional[str],
    output_dir: str,
    model_path: str,
    conf: float = 0.5,
    progress_callback: Optional[Callable[[int, str], None]] = None,
    # ── Video-direct mode parameters ──────────────────────────────────────────
    video_path: Optional[str] = None,
    sample_rate: int = 5,
    resize_width: Optional[int] = 960,
) -> list[str]:
    """
    Run YOLO on video frames, crop detected face bounding boxes, save as images.

    If `video_path` is provided the function reads the video directly via OpenCV
    (no frames saved to disk). Only every `sample_rate`-th frame is processed.
    Frames are optionally resized to `resize_width` before detection for speed.

    If `video_path` is None, `frames_dir` must be set and pre-saved frame images
    are used instead (legacy mode).

    Args:
        frames_dir:    (legacy) directory of pre-extracted frame images.
        output_dir:    Directory to save cropped face images.
        model_path:    Path to the YOLO .pt weights file.
        conf:          Detection confidence threshold.
        progress_callback: fn(percent: int, message: str)
        video_path:    Path to the input video file (preferred mode).
        sample_rate:   Process every Nth frame (default 5).
        resize_width:  Resize frame to this width before YOLO (keeps aspect ratio).
                       Set to None to skip resizing.

    Returns:
        List of saved face crop file paths.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    model = get_yolo_model(model_path)
    saved_paths = []

    # ── VIDEO-DIRECT MODE ──────────────────────────────────────────────────────
    if video_path is not None:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        sampled_total = max(1, total_frames // sample_rate)
        frame_idx = 0
        sampled_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_rate == 0:
                sampled_idx += 1

                # Optional resize for speed
                if resize_width and frame.shape[1] > resize_width:
                    scale = resize_width / frame.shape[1]
                    new_h = int(frame.shape[0] * scale)
                    frame = cv2.resize(frame, (resize_width, new_h), interpolation=cv2.INTER_AREA)

                _run_yolo_on_frame(model, frame, conf, frame_idx, output_dir, saved_paths)

                if progress_callback and sampled_total > 0:
                    pct = int((sampled_idx / sampled_total) * 100)
                    progress_callback(pct, f"Detecting faces... frame {sampled_idx}/{sampled_total}")

            frame_idx += 1

        cap.release()

    # ── FRAMES-DIR MODE (legacy) ───────────────────────────────────────────────
    else:
        if frames_dir is None:
            raise ValueError("Either video_path or frames_dir must be provided.")

        frame_files = sorted([
            f for f in os.listdir(frames_dir)
            if f.lower().endswith((".jpg", ".jpeg", ".png"))
        ])
        total = len(frame_files)

        for i, fname in enumerate(frame_files):
            frame_path = os.path.join(frames_dir, fname)
            frame = cv2.imread(frame_path)
            if frame is None:
                continue

            _run_yolo_on_frame(model, frame, conf, i, output_dir, saved_paths)

            if progress_callback and total > 0:
                pct = int(((i + 1) / total) * 100)
                progress_callback(pct, f"Detecting faces... frame {i+1}/{total}")

    if progress_callback:
        progress_callback(100, f"Face detection complete. {len(saved_paths)} faces found.")

    return saved_paths

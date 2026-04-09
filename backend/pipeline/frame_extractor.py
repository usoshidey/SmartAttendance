"""
frame_extractor.py
Extracts frames from a video file at a given sample rate.
Returns list of saved frame paths.
"""
import cv2
import os
from pathlib import Path
from typing import Callable, Optional


def extract_frames(
    video_path: str,
    output_dir: str,
    sample_rate: int = 1,
    progress_callback: Optional[Callable[[int, str], None]] = None
) -> list[str]:
    """
    Extract frames from video.

    Args:
        video_path: Path to the input video file.
        output_dir: Directory to save extracted frames.
        sample_rate: Save every Nth frame (1 = every frame).
        progress_callback: fn(percent: int, message: str)

    Returns:
        List of saved frame file paths.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    saved_paths = []
    frame_idx = 0
    saved_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1

        if frame_idx % sample_rate == 0:
            fname = f"frame_{frame_idx:05d}.jpg"
            fpath = os.path.join(output_dir, fname)
            cv2.imwrite(fpath, frame)
            saved_paths.append(fpath)
            saved_count += 1

        if progress_callback and total_frames > 0:
            pct = int((frame_idx / total_frames) * 100)
            progress_callback(pct, f"Extracting frames... {frame_idx}/{total_frames}")

    cap.release()

    if progress_callback:
        progress_callback(100, f"Frame extraction complete. {saved_count} frames saved.")

    return saved_paths

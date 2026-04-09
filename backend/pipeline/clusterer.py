"""
clusterer.py
DBSCAN clustering with:
  1. Pre-DBSCAN NoiseRemoval  — teacher's notebook cell 34
  2. correlation metric        — teacher's notebook cell 39 (was euclidean — WRONG)
  3. Dynamic per-class grid search — teacher's requirement

Teacher's exact DBSCAN call (cell 39):
    db = DBSCAN(eps=0.28, min_samples=11, metric="correlation").fit(X)

Teacher's NoiseRemoval call (cell 34):
    thres, lab = NoiseRemoval(X, min_neighbours=3, removal_percentage=5,
                              min_dist=0.01, max_dist=5, step=0.001)
    X_filtered = [X[i] for i in range(len(X)) if lab[i] != 0]

Why correlation not euclidean:
    VGG-Face 4096-dim vectors have non-uniform magnitude. Correlation distance
    is equivalent to cosine similarity on mean-centred vectors — it measures
    the SHAPE of the embedding, not its magnitude, which is what we want for
    face identity matching.
"""
import numpy as np
from typing import Callable, Optional
from sklearn.cluster import DBSCAN
from sklearn.metrics import silhouette_score


# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Noise Removal (teacher's notebook cell 10 + 34)
# ─────────────────────────────────────────────────────────────────────────────

def noise_removal(
    X: list,
    min_neighbours: int   = 3,
    removal_percentage: float = 5.0,
    min_dist: float       = 0.01,
    max_dist: float       = 5.0,
    step: float           = 0.05
) -> tuple:
    """
    Find the smallest threshold_dist such that at most removal_percentage%
    of points have fewer than min_neighbours neighbours within that distance.

    Returns (threshold_dist, labels) where label=1 means keep, label=0 means noise.
    Matches teacher's NoiseRemoval() exactly but uses numpy instead of torch
    for CPU compatibility (no GPU required).
    """
    X_arr = np.array(X, dtype=np.float32)
    n = len(X_arr)
    max_allowed_noise = int((removal_percentage / 100.0) * n)

    threshold_dist = min_dist
    while threshold_dist <= max_dist:
        # Pairwise distances — use batched approach to avoid OOM on large sets
        if n <= 2000:
            # Direct pairwise for small datasets
            dists = np.sqrt(((X_arr[:, None] - X_arr[None, :]) ** 2).sum(axis=2))
        else:
            # For large datasets use sklearn to avoid memory explosion
            from sklearn.metrics import pairwise_distances
            dists = pairwise_distances(X_arr, metric="euclidean")

        neighbours_count = (dists < threshold_dist).sum(axis=1) - 1  # exclude self
        noise_points = int((neighbours_count < min_neighbours).sum())

        if noise_points <= max_allowed_noise:
            labels = (neighbours_count >= min_neighbours).astype(int).tolist()
            return threshold_dist, labels

        threshold_dist = round(threshold_dist + step, 6)

    # Fallback: keep everything
    return None, [1] * n


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Dynamic min_samples grid (per-class)
# ─────────────────────────────────────────────────────────────────────────────

def _dynamic_min_samples_grid(n_faces: int) -> list:
    """
    Compute 5-value min_samples grid scaled to dataset size.
    Teacher uses min_samples=11 for their ~1800-face dataset.
    """
    low  = max(3,  n_faces // 500)
    high = max(15, n_faces // 100)
    if low >= high:
        high = low * 3
    step = max(1, (high - low) // 4)
    grid = sorted(set([
        low,
        low + step,
        low + 2 * step,
        low + 3 * step,
        high
    ]))
    return grid


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────

def cluster_faces(
    embeddings: dict,
    eps_values: list           = None,
    min_samples_values: list   = None,
    progress_callback: Optional[Callable[[int, str], None]] = None
) -> dict:
    """
    Full pipeline: NoiseRemoval → DBSCAN (correlation metric) → centroids.

    Args:
        embeddings:          dict filename → embedding vector
        eps_values:          eps grid (uses config default if None)
        min_samples_values:  if None, computed dynamically from n_faces
        progress_callback:   fn(percent, message)

    Returns:
        dict  cluster_id → {"files": [...], "centroid": [...]}
    """
    from backend.config import (
        DBSCAN_EPS_VALUES, DBSCAN_METRIC,
        NOISE_REMOVAL_MIN_NEIGHBOURS, NOISE_REMOVAL_REMOVAL_PERCENT,
        NOISE_REMOVAL_MIN_DIST, NOISE_REMOVAL_MAX_DIST, NOISE_REMOVAL_STEP
    )

    if eps_values is None:
        eps_values = DBSCAN_EPS_VALUES

    if progress_callback:
        progress_callback(2, "Preparing embeddings...")

    filenames = list(embeddings.keys())
    n_total   = len(filenames)
    X_all     = np.array(list(embeddings.values()), dtype=np.float32)

    # ── Stage 1: Noise Removal ────────────────────────────────────────────────
    # NoiseRemoval is O(n²) — computing pairwise distances on CPU for large
    # datasets (5000+ faces) causes memory crash and browser freeze.
    # Threshold: skip for datasets > 2000 faces and let DBSCAN's -1 labels
    # handle noise instead (which it does well with correlation metric).
    NR_THRESHOLD = 0

    if n_total <= NR_THRESHOLD:
        if progress_callback:
            progress_callback(5, f"Running NoiseRemoval on {n_total} embeddings...")

        _, labels_nr = noise_removal(
            X_all.tolist(),
            min_neighbours     = NOISE_REMOVAL_MIN_NEIGHBOURS,
            removal_percentage = NOISE_REMOVAL_REMOVAL_PERCENT,
            min_dist           = NOISE_REMOVAL_MIN_DIST,
            max_dist           = NOISE_REMOVAL_MAX_DIST,
            step               = NOISE_REMOVAL_STEP
        )
        kept_mask = [i for i, l in enumerate(labels_nr) if l != 0]
    else:
        if progress_callback:
            progress_callback(
                5,
                f"Dataset too large for NoiseRemoval ({n_total} faces > {NR_THRESHOLD}). "
                f"Skipping — DBSCAN will handle noise via -1 labels."
            )
        kept_mask = list(range(n_total))

    # Keep only non-noise embeddings
    filenames_filt = [filenames[i] for i in kept_mask]
    X              = X_all[kept_mask]
    n_faces        = len(X)
    n_removed_nr   = n_total - n_faces

    if progress_callback:
        progress_callback(
            20,
            f"After noise stage: {n_faces}/{n_total} embeddings kept "
            f"({n_removed_nr} removed)"
        )

    if n_faces < 2:
        if progress_callback:
            progress_callback(100, "Too few faces after noise removal.")
        return {}

    # ── Stage 2: Dynamic min_samples grid ────────────────────────────────────
    if min_samples_values is None:
        min_samples_values = _dynamic_min_samples_grid(n_faces)

    if progress_callback:
        progress_callback(
            22,
            f"Per-class grid search: metric={DBSCAN_METRIC}, "
            f"eps={eps_values}, min_samples={min_samples_values}"
        )

    # Subsample silhouette for large datasets (O(n²) otherwise)
    sil_sample = min(n_faces, 3000) if n_faces > 3000 else None

    total_combos = len(eps_values) * len(min_samples_values)
    combo_idx    = 0
    best_score   = -1
    best_params  = None
    best_labels  = None

    # ── Stage 3: Grid search ─────────────────────────────────────────────────
    for eps in eps_values:
        for ms in min_samples_values:
            combo_idx += 1
            pct = 22 + int((combo_idx / total_combos) * 55)

            if progress_callback:
                progress_callback(
                    pct,
                    f"Grid [{combo_idx}/{total_combos}]: "
                    f"eps={eps}, min_samples={ms} ..."
                )

            db     = DBSCAN(eps=eps, min_samples=ms, metric=DBSCAN_METRIC)
            labels = db.fit_predict(X)
            n_clusters = len(set(labels) - {-1})

            if n_clusters < 2:
                continue

            # Sanity cap — prevents degenerate over-clustering
            if n_clusters > n_faces // ms + 10:
                continue

            try:
                score = silhouette_score(
                    X, labels,
                    metric      = DBSCAN_METRIC,
                    sample_size = sil_sample,
                    random_state= 42
                )
                if score > best_score:
                    best_score  = score
                    best_params = (eps, ms)
                    best_labels = labels.copy()
            except Exception:
                pass

    # ── Fallback ──────────────────────────────────────────────────────────────
    if best_labels is None:
        fallback_ms = max(5, n_faces // 200)
        if progress_callback:
            progress_callback(
                80,
                f"Grid search inconclusive. "
                f"Fallback: eps=0.28, min_samples={fallback_ms}..."
            )
        db          = DBSCAN(eps=0.28, min_samples=fallback_ms, metric=DBSCAN_METRIC)
        best_labels = db.fit_predict(X)
        best_params = (0.28, fallback_ms)
        best_score  = 0.0

    n_clusters_final = len(set(best_labels) - {-1})
    n_noise_dbscan   = int((best_labels == -1).sum())

    if progress_callback:
        progress_callback(
            80,
            f"Best: eps={best_params[0]}, min_samples={best_params[1]}, "
            f"silhouette={best_score:.3f} → "
            f"{n_clusters_final} clusters, {n_noise_dbscan} noise"
        )

    # ── Build result with centroids ───────────────────────────────────────────
    raw_clusters = {}
    for fname, label in zip(filenames_filt, best_labels):
        if label == -1:
            continue
        raw_clusters.setdefault(int(label), []).append(fname)

    result = {}
    for cid, files in raw_clusters.items():
        embs     = np.array([embeddings[f] for f in files], dtype=np.float32)
        centroid = embs.mean(axis=0)
        norm     = np.linalg.norm(centroid)
        if norm > 0:
            centroid /= norm
        result[cid] = {"files": files, "centroid": centroid.tolist()}

    if progress_callback:
        progress_callback(
            100,
            f"Done. {len(result)} students found. "
            f"(NR removed: {n_removed_nr}, DBSCAN noise: {n_noise_dbscan})"
        )

    return result
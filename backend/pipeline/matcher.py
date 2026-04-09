"""
matcher.py
Matches clustered face centroids against registered student embeddings.
Returns attendance result per registered student.
"""
import numpy as np
from typing import Callable, Optional


def cosine_similarity(a: list, b: list) -> float:
    """Compute cosine similarity between two vectors."""
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def match_clusters_to_students(
    clusters: dict,
    registered_students: list[dict],
    similarity_threshold: float = 0.35,
    progress_callback: Optional[Callable[[int, str], None]] = None
) -> list[dict]:
    """
    For each registered student, find the best-matching cluster.

    Args:
        clusters: Dict from clusterer — {cluster_id: {"files": [...], "centroid": [...]}}
        registered_students: List of dicts with keys:
            - student_id: int
            - name: str
            - roll_no: str
            - embedding: list of floats (centroid from registration)
        similarity_threshold: Minimum cosine similarity to call a match.
        progress_callback: fn(percent: int, message: str)

    Returns:
        List of dicts:
            - student_id, name, roll_no
            - status: "present" | "absent"
            - similarity: float | None
            - matched_cluster_id: int | None
    """
    if not clusters:
        # No clusters found → everyone absent
        return [
            {
                "student_id": s["student_id"],
                "name": s["name"],
                "roll_no": s["roll_no"],
                "status": "absent",
                "similarity": None,
                "matched_cluster_id": None
            }
            for s in registered_students
        ]

    cluster_centroids = {
        cid: np.array(data["centroid"], dtype=np.float32)
        for cid, data in clusters.items()
    }

    results = []
    total = len(registered_students)

    for i, student in enumerate(registered_students):
        student_emb = np.array(student["embedding"], dtype=np.float32)
        # Normalize student embedding
        norm = np.linalg.norm(student_emb)
        if norm > 0:
            student_emb = student_emb / norm

        best_sim = -1.0
        best_cid = None

        for cid, centroid in cluster_centroids.items():
            sim = cosine_similarity(student_emb.tolist(), centroid.tolist())
            if sim > best_sim:
                best_sim = sim
                best_cid = cid

        if best_sim >= similarity_threshold:
            status = "present"
        else:
            status = "absent"
            best_cid = None
            best_sim = None

        results.append({
            "student_id": student["student_id"],
            "name": student["name"],
            "roll_no": student["roll_no"],
            "status": status,
            "similarity": round(float(best_sim), 4) if best_sim is not None else None,
            "matched_cluster_id": best_cid
        })

        if progress_callback and total > 0:
            pct = int(((i + 1) / total) * 100)
            progress_callback(pct, f"Matching student {i+1}/{total}: {student['name']}")

    if progress_callback:
        present_count = sum(1 for r in results if r["status"] == "present")
        progress_callback(
            100,
            f"Matching done. Present: {present_count}/{total}"
        )

    return results

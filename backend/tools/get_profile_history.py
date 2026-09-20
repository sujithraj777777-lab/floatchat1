from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ocean_data import read_catalog_profiles


def get_profile_history(
    float_id: int,
    cycle_start: int | None = None,
    cycle_end: int | None = None,
) -> dict:
    """Get historical profiles for a float."""
    history = read_catalog_profiles(float_id=float_id)

    profiles = history["profiles"]

    if cycle_start is not None:
        profiles = [p for p in profiles if p["cycle"] >= cycle_start]
    if cycle_end is not None:
        profiles = [p for p in profiles if p["cycle"] <= cycle_end]

    profiles.sort(key=lambda p: p["time_utc"])

    return {
        "float_id": float_id,
        "total_profiles": len(profiles),
        "excluded_count": len(history["excluded_profiles"]),
        "discovered_files": history["discovered_files"],
        "profiles": profiles,
        "excluded_profiles": history["excluded_profiles"],
    }

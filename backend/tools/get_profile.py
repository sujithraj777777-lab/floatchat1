from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ocean_data import read_catalog_profiles


def get_profile(float_id: int, cycle: int) -> dict:
    """Get a single profile with all observations."""
    history = read_catalog_profiles(float_id=float_id)

    for profile in history["profiles"]:
        if profile["cycle"] == cycle:
            return {
                "float_id": profile["float_id"],
                "cycle": profile["cycle"],
                "time_utc": profile["time_utc"],
                "latitude": profile["latitude"],
                "longitude": profile["longitude"],
                "data_mode": profile["data_mode"],
                "total_levels": profile["total_levels"],
                "accepted_levels": profile["accepted_levels"],
                "excluded_levels": profile["excluded_levels"],
                "evidence": profile["evidence"],
                "observations": profile["observations"],
            }

    for excluded in history["excluded_profiles"]:
        if excluded["cycle"] == cycle:
            return {
                "float_id": float_id,
                "cycle": cycle,
                "status": "excluded",
                "reason": excluded["reason"],
                "observations": [],
            }

    return {
        "float_id": float_id,
        "cycle": cycle,
        "status": "not_found",
        "reason": f"No profile found for float {float_id}, cycle {cycle}",
        "observations": [],
    }

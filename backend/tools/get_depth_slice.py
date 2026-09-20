from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ocean_data import read_catalog_profiles


def get_depth_slice(
    float_id: int,
    target_depth_m: float,
    tolerance_m: float = 25.0,
    cycle_start: int | None = None,
    cycle_end: int | None = None,
) -> dict:
    """Get observations near a specific depth across cycles."""
    history = read_catalog_profiles(float_id=float_id)

    profiles = history["profiles"]

    if cycle_start is not None:
        profiles = [p for p in profiles if p["cycle"] >= cycle_start]
    if cycle_end is not None:
        profiles = [p for p in profiles if p["cycle"] <= cycle_end]

    observations = []

    for profile in sorted(profiles, key=lambda p: p["time_utc"]):
        nearest = None
        nearest_dist = float("inf")

        for obs in profile["observations"]:
            dist = abs(obs["depth_m"] - target_depth_m)
            if dist < nearest_dist:
                nearest_dist = dist
                nearest = obs

        if nearest is not None and nearest_dist <= tolerance_m:
            observations.append({
                "float_id": profile["float_id"],
                "cycle": profile["cycle"],
                "time_utc": profile["time_utc"],
                "latitude": profile["latitude"],
                "longitude": profile["longitude"],
                "source_row": nearest["source_row"],
                "pressure_dbar": nearest["pressure_dbar"],
                "depth_m": nearest["depth_m"],
                "depth_difference_m": nearest_dist,
                "temperature_c": nearest["temperature_c"],
                "salinity_psu": nearest["salinity_psu"],
            })

    temps = [o["temperature_c"] for o in observations]
    sals = [o["salinity_psu"] for o in observations]

    return {
        "float_id": float_id,
        "target_depth_m": target_depth_m,
        "tolerance_m": tolerance_m,
        "observations_found": len(observations),
        "observations": observations,
        "statistics": {
            "temperature": {
                "mean": float(np.mean(temps)) if temps else None,
                "std": float(np.std(temps)) if temps else None,
                "min": float(np.min(temps)) if temps else None,
                "max": float(np.max(temps)) if temps else None,
            } if temps else None,
            "salinity": {
                "mean": float(np.mean(sals)) if sals else None,
                "std": float(np.std(sals)) if sals else None,
                "min": float(np.min(sals)) if sals else None,
                "max": float(np.max(sals)) if sals else None,
            } if sals else None,
        },
        "evidence": {
            "method": f"Nearest observation within {tolerance_m} m of {target_depth_m} m target depth per profile. No interpolation.",
            "scope": f"Only locally downloaded, QC-accepted profiles searched.",
        },
    }

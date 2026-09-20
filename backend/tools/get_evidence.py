from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ocean_data import read_catalog_profiles


def get_evidence(
    float_id: int,
    cycle: int,
    source_row: int | None = None,
) -> dict:
    """Get full evidence package for a specific observation."""
    history = read_catalog_profiles(float_id=float_id)

    profile = None
    for p in history["profiles"]:
        if p["cycle"] == cycle:
            profile = p
            break

    if profile is None:
        for excluded in history["excluded_profiles"]:
            if excluded["cycle"] == cycle:
                return {
                    "float_id": float_id,
                    "cycle": cycle,
                    "status": "excluded",
                    "reason": excluded["reason"],
                    "local_dataset": excluded.get("local_dataset", "unknown"),
                    "evidence_note": (
                        "This profile was excluded from the analysis. "
                        "The original file may still exist but did not pass QC policy."
                    ),
                }
        return {
            "float_id": float_id,
            "cycle": cycle,
            "status": "not_found",
            "reason": f"No profile found for float {float_id}, cycle {cycle}",
        }

    observations = profile["observations"]

    if source_row is not None:
        obs = next((o for o in observations if o["source_row"] == source_row), None)
        if obs is None:
            return {
                "float_id": float_id,
                "cycle": cycle,
                "status": "row_not_found",
                "reason": f"Source row {source_row} not found in accepted observations",
                "total_accepted_rows": len(observations),
                "available_rows": [o["source_row"] for o in observations],
            }

        evidence = {
            "float_id": float_id,
            "cycle": cycle,
            "timestamp": profile["time_utc"],
            "latitude": profile["latitude"],
            "longitude": profile["longitude"],
            "pressure_dbar": obs["pressure_dbar"],
            "depth_m": obs["depth_m"],
            "temperature_c": obs["temperature_c"],
            "salinity_psu": obs["salinity_psu"],
            "source_row": obs["source_row"],
            "data_mode": profile["data_mode"],
            "source_file": profile["evidence"]["local_dataset"],
            "measurement_fields": profile["evidence"]["measurement_fields"],
            "qc_policy": profile["evidence"]["qc_policy"],
            "vertical_coordinate": profile["evidence"]["vertical_coordinate"],
        }
        return evidence

    return {
        "float_id": float_id,
        "cycle": cycle,
        "timestamp": profile["time_utc"],
        "latitude": profile["latitude"],
        "longitude": profile["longitude"],
        "data_mode": profile["data_mode"],
        "total_levels": profile["total_levels"],
        "accepted_levels": profile["accepted_levels"],
        "excluded_levels": profile["excluded_levels"],
        "source_file": profile["evidence"]["local_dataset"],
        "measurement_fields": profile["evidence"]["measurement_fields"],
        "qc_policy": profile["evidence"]["qc_policy"],
        "vertical_coordinate": profile["evidence"]["vertical_coordinate"],
        "observations_summary": [
            {
                "source_row": o["source_row"],
                "pressure_dbar": o["pressure_dbar"],
                "depth_m": o["depth_m"],
                "temperature_c": o["temperature_c"],
                "salinity_psu": o["salinity_psu"],
            }
            for o in observations
        ],
    }

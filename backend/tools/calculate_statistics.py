from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ocean_data import read_catalog_profiles


def calculate_statistics(
    float_id: int,
    cycle: int,
    variable: str,
    min_pressure: float | None = None,
    max_pressure: float | None = None,
) -> dict:
    """Calculate statistical summary for a variable."""
    history = read_catalog_profiles(float_id=float_id)

    profile = None
    for p in history["profiles"]:
        if p["cycle"] == cycle:
            profile = p
            break

    if profile is None:
        return {
            "error": f"Cycle {cycle} not found for float {float_id}",
            "status": "not_found",
        }

    field_map = {
        "temperature": "temperature_c",
        "salinity": "salinity_psu",
    }
    unit_map = {
        "temperature": "°C",
        "salinity": "PSU",
    }
    field = field_map.get(variable)
    if field is None:
        return {"error": f"Unknown variable: {variable}", "status": "error"}

    obs = profile["observations"]
    if min_pressure is not None:
        obs = [o for o in obs if o["pressure_dbar"] >= min_pressure]
    if max_pressure is not None:
        obs = [o for o in obs if o["pressure_dbar"] <= max_pressure]

    if not obs:
        return {
            "error": "No observations in the specified pressure range",
            "status": "no_data",
        }

    values = np.array([o[field] for o in obs])
    pressures = np.array([o["pressure_dbar"] for o in obs])

    return {
        "float_id": float_id,
        "cycle": cycle,
        "variable": variable,
        "unit": unit_map.get(variable, ""),
        "observation_count": len(values),
        "pressure_range": {
            "min": float(np.min(pressures)),
            "max": float(np.max(pressures)),
        },
        "statistics": {
            "count": len(values),
            "mean": float(np.mean(values)),
            "std": float(np.std(values)),
            "min": float(np.min(values)),
            "max": float(np.max(values)),
            "median": float(np.median(values)),
            "q25": float(np.percentile(values, 25)),
            "q75": float(np.percentile(values, 75)),
            "range": float(np.max(values) - np.min(values)),
        },
        "evidence": {
            "file": profile["evidence"]["local_dataset"],
            "qc_policy": profile["evidence"]["qc_policy"],
            "source_rows": [o["source_row"] for o in obs],
        },
    }

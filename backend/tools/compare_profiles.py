from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ocean_data import read_catalog_profiles


def compare_profiles(
    float_id: int,
    cycle_a: int,
    cycle_b: int,
    variable: str = "temperature",
    min_pressure: float | None = None,
    max_pressure: float | None = None,
) -> dict:
    """Compare two profiles and calculate deltas."""
    history = read_catalog_profiles(float_id=float_id)

    profile_a = None
    profile_b = None

    for profile in history["profiles"]:
        if profile["cycle"] == cycle_a:
            profile_a = profile
        if profile["cycle"] == cycle_b:
            profile_b = profile

    if profile_a is None:
        return {
            "error": f"Cycle {cycle_a} not found or excluded for float {float_id}",
            "status": "not_found",
        }
    if profile_b is None:
        return {
            "error": f"Cycle {cycle_b} not found or excluded for float {float_id}",
            "status": "not_found",
        }

    field_map = {
        "temperature": "temperature_c",
        "salinity": "salinity_psu",
    }
    field = field_map.get(variable)
    if field is None:
        return {"error": f"Unknown variable: {variable}", "status": "error"}

    def filter_observations(profile, min_p, max_p):
        obs = profile["observations"]
        if min_p is not None:
            obs = [o for o in obs if o["pressure_dbar"] >= min_p]
        if max_p is not None:
            obs = [o for o in obs if o["pressure_dbar"] <= max_p]
        return obs

    obs_a = filter_observations(profile_a, min_pressure, max_pressure)
    obs_b = filter_observations(profile_b, min_pressure, max_pressure)

    if not obs_a or not obs_b:
        return {
            "error": "No observations found in the specified pressure range",
            "status": "no_data",
        }

    values_a = np.array([o[field] for o in obs_a])
    values_b = np.array([o[field] for o in obs_b])
    pressures_a = np.array([o["pressure_dbar"] for o in obs_a])
    pressures_b = np.array([o["pressure_dbar"] for o in obs_b])

    matched_deltas = []
    for obs_b_item in obs_b:
        closest_idx = np.argmin(np.abs(pressures_a - obs_b_item["pressure_dbar"]))
        if abs(pressures_a[closest_idx] - obs_b_item["pressure_dbar"]) < 50:
            delta = obs_b_item[field] - obs_a[closest_idx][field]
            matched_deltas.append({
                "pressure_dbar": obs_b_item["pressure_dbar"],
                "depth_m": obs_b_item["depth_m"],
                "value_a": obs_a[closest_idx][field],
                "value_b": obs_b_item[field],
                "delta": float(delta),
            })

    delta_values = [d["delta"] for d in matched_deltas]

    return {
        "float_id": float_id,
        "variable": variable,
        "unit": "°C" if variable == "temperature" else "PSU",
        "cycle_a": {
            "cycle": cycle_a,
            "time_utc": profile_a["time_utc"],
            "latitude": profile_a["latitude"],
            "longitude": profile_a["longitude"],
            "observation_count": len(obs_a),
        },
        "cycle_b": {
            "cycle": cycle_b,
            "time_utc": profile_b["time_utc"],
            "latitude": profile_b["latitude"],
            "longitude": profile_b["longitude"],
            "observation_count": len(obs_b),
        },
        "statistics": {
            "mean_a": float(np.mean(values_a)),
            "mean_b": float(np.mean(values_b)),
            "std_a": float(np.std(values_a)),
            "std_b": float(np.std(values_b)),
            "min_a": float(np.min(values_a)),
            "max_a": float(np.max(values_a)),
            "min_b": float(np.min(values_b)),
            "max_b": float(np.max(values_b)),
        },
        "matched_deltas": matched_deltas,
        "delta_summary": {
            "count": len(delta_values),
            "mean_delta": float(np.mean(delta_values)) if delta_values else None,
            "std_delta": float(np.std(delta_values)) if delta_values else None,
            "min_delta": float(np.min(delta_values)) if delta_values else None,
            "max_delta": float(np.max(delta_values)) if delta_values else None,
        },
        "evidence": {
            "file_a": profile_a["evidence"]["local_dataset"],
            "file_b": profile_b["evidence"]["local_dataset"],
            "qc_policy": profile_a["evidence"]["qc_policy"],
            "method": "Nearest-observation matching within 50 dbar pressure tolerance. No interpolation.",
        },
    }

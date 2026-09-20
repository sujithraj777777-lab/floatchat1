from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ocean_data import read_catalog_profiles


def calculate_temperature_change(
    float_id: int,
    cycle_a: int,
    cycle_b: int,
    min_pressure: float | None = None,
    max_pressure: float | None = None,
) -> dict:
    """Calculate temperature change between two cycles."""
    history = read_catalog_profiles(float_id=float_id)

    profile_a = None
    profile_b = None

    for profile in history["profiles"]:
        if profile["cycle"] == cycle_a:
            profile_a = profile
        if profile["cycle"] == cycle_b:
            profile_b = profile

    if profile_a is None:
        return {"error": f"Cycle {cycle_a} not found", "status": "not_found"}
    if profile_b is None:
        return {"error": f"Cycle {cycle_b} not found", "status": "not_found"}

    def filter_obs(profile, min_p, max_p):
        obs = profile["observations"]
        if min_p is not None:
            obs = [o for o in obs if o["pressure_dbar"] >= min_p]
        if max_p is not None:
            obs = [o for o in obs if o["pressure_dbar"] <= max_p]
        return obs

    obs_a = filter_obs(profile_a, min_pressure, max_pressure)
    obs_b = filter_obs(profile_b, min_pressure, max_pressure)

    if not obs_a or not obs_b:
        return {"error": "No observations in pressure range", "status": "no_data"}

    temps_a = np.array([o["temperature_c"] for o in obs_a])
    temps_b = np.array([o["temperature_c"] for o in obs_b])
    pressures_a = np.array([o["pressure_dbar"] for o in obs_a])
    pressures_b = np.array([o["pressure_dbar"] for o in obs_b])

    matched = []
    for i, ob in enumerate(obs_b):
        closest = np.argmin(np.abs(pressures_a - ob["pressure_dbar"]))
        if abs(pressures_a[closest] - ob["pressure_dbar"]) < 50:
            delta = ob["temperature_c"] - obs_a[closest]["temperature_c"]
            matched.append({
                "pressure_dbar": ob["pressure_dbar"],
                "depth_m": ob["depth_m"],
                "temp_a": obs_a[closest]["temperature_c"],
                "temp_b": ob["temperature_c"],
                "delta_temp": float(delta),
            })

    deltas = [m["delta_temp"] for m in matched]

    return {
        "float_id": float_id,
        "variable": "temperature",
        "unit": "°C",
        "cycle_a": cycle_a,
        "cycle_b": cycle_b,
        "time_a": profile_a["time_utc"],
        "time_b": profile_b["time_utc"],
        "matched_observations": len(matched),
        "details": matched,
        "summary": {
            "mean_delta": float(np.mean(deltas)) if deltas else None,
            "max_warming": float(np.max(deltas)) if deltas else None,
            "max_cooling": float(np.min(deltas)) if deltas else None,
            "std_delta": float(np.std(deltas)) if deltas else None,
        },
        "evidence": {
            "file_a": profile_a["evidence"]["local_dataset"],
            "file_b": profile_b["evidence"]["local_dataset"],
            "method": "Matched by nearest pressure within 50 dbar. No interpolation.",
        },
    }

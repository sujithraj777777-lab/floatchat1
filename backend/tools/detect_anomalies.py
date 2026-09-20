from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ocean_data import read_catalog_profiles


def detect_anomalies(
    float_id: int,
    cycle: int,
    variable: str,
    method: str = "zscore",
    threshold: float | None = None,
) -> dict:
    """Detect unusual changes in temperature or salinity profiles.

    Uses statistical methods (Z-score or IQR) to identify outlier observations.
    The AI does NOT interpret anomalies — pure statistics only.
    """
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
    if len(obs) < 3:
        return {
            "error": "Need at least 3 observations for anomaly detection",
            "status": "insufficient_data",
        }

    values = np.array([o[field] for o in obs])
    pressures = np.array([o["pressure_dbar"] for o in obs])

    if method == "zscore":
        if threshold is None:
            threshold = 2.0
        mean = np.mean(values)
        std = np.std(values)
        if std == 0:
            z_scores = np.zeros_like(values)
        else:
            z_scores = np.abs((values - mean) / std)
        is_anomaly = z_scores > threshold
        method_desc = f"Z-score (threshold: {threshold}σ)"

    elif method == "iqr":
        if threshold is None:
            threshold = 1.5
        q25 = np.percentile(values, 25)
        q75 = np.percentile(values, 75)
        iqr = q75 - q25
        lower = q25 - threshold * iqr
        upper = q75 + threshold * iqr
        z_scores = np.where(
            iqr == 0,
            0,
            np.abs(values - np.median(values)) / (iqr / 1.349),
        )
        is_anomaly = (values < lower) | (values > upper)
        method_desc = f"IQR (threshold: {threshold}×IQR)"

    else:
        return {"error": f"Unknown method: {method}. Use 'zscore' or 'iqr'.", "status": "error"}

    anomalies = []
    for i, obs_item in enumerate(obs):
        if is_anomaly[i]:
            anomaly_type = "high" if values[i] > np.mean(values) else "low"

            if i > 0 and i < len(obs) - 1:
                prev_diff = abs(values[i] - values[i - 1])
                next_diff = abs(values[i] - values[i + 1])
                local_change = max(prev_diff, next_diff)
            elif i == 0:
                local_change = abs(values[i] - values[1]) if len(values) > 1 else 0
            else:
                local_change = abs(values[i] - values[-2]) if len(values) > 1 else 0

            anomalies.append({
                "source_row": obs_item["source_row"],
                "depth_m": obs_item["depth_m"],
                "pressure_dbar": obs_item["pressure_dbar"],
                "value": float(values[i]),
                "z_score": float(z_scores[i]),
                "is_anomaly": True,
                "anomaly_type": anomaly_type,
                "local_gradient": float(local_change),
            })

    summary = (
        f"Detected {len(anomalies)} anomalous {variable} observations "
        f"in cycle {cycle} using {method_desc}. "
    )

    if anomalies:
        depths = [a["depth_m"] for a in anomalies]
        summary += f"Anomalies found at depths: {', '.join(f'{d:.0f}m' for d in sorted(depths))}."
    else:
        summary += "No anomalies detected."

    return {
        "float_id": float_id,
        "cycle": cycle,
        "variable": variable,
        "unit": unit_map.get(variable, ""),
        "method": method_desc,
        "total_levels": len(obs),
        "anomalies_detected": len(anomalies),
        "anomalies": anomalies,
        "summary": summary,
        "statistics": {
            "mean": float(np.mean(values)),
            "std": float(np.std(values)),
            "min": float(np.min(values)),
            "max": float(np.max(values)),
        },
        "evidence": {
            "file": profile["evidence"]["local_dataset"],
            "qc_policy": profile["evidence"]["qc_policy"],
            "method_note": (
                "Anomaly detection uses statistical methods only. "
                "Results indicate observations that deviate from the profile mean. "
                "This does not imply measurement error or oceanographic significance."
            ),
        },
    }

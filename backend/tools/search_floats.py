from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ocean_data import read_catalog


def search_floats(float_id: int | None = None) -> dict:
    """Search available ARGO floats in the local catalogue."""
    catalog = read_catalog()

    floats = catalog["floats"]

    if float_id is not None:
        floats = [f for f in floats if f["float_id"] == float_id]

    return {
        "total_floats": len(floats),
        "total_profiles": sum(f["profile_count"] for f in floats),
        "floats": floats,
        "excluded_profiles": catalog["excluded_profiles"],
        "scope": catalog["scope"],
    }

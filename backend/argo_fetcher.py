"""Live Argo float data fetcher service using argopy and ERDDAP."""

import re
from pathlib import Path
from tempfile import TemporaryDirectory
import numpy as np
import xarray as xr
from argopy import DataFetcher
from ocean_data import read_profile, read_catalog, PROFILE_DIRECTORY

REQUIRED_FIELDS = [
    "PLATFORM_NUMBER",
    "CYCLE_NUMBER",
    "TIME",
    "LATITUDE",
    "LONGITUDE",
    "DATA_MODE",
    "PRES_ADJUSTED",
    "TEMP_ADJUSTED",
    "PSAL_ADJUSTED",
    "PRES_ADJUSTED_QC",
    "TEMP_ADJUSTED_QC",
    "PSAL_ADJUSTED_QC",
    "POSITION_QC",
    "TIME_QC",
]


def text_clean(val):
    if isinstance(val, bytes):
        return val.decode().strip()
    return str(val).strip()


def validate_dataset(dataset, expected_float_id=None, expected_cycle=None):
    """Validate that an xarray Dataset from Argo contains required variables and valid observations."""
    count = dataset.sizes.get("N_POINTS", 0)
    if count == 0:
        raise ValueError("No observation points returned for this query.")

    missing = [f for f in REQUIRED_FIELDS if f not in dataset]
    if missing:
        raise ValueError(f"Missing required oceanographic fields: {', '.join(missing)}")

    def get_vals(name):
        arr = dataset[name].values.reshape(-1)
        if arr.size != count:
            raise ValueError(f"{name} layout does not match N_POINTS count.")
        return arr

    if expected_float_id is not None:
        floats = get_vals("PLATFORM_NUMBER").astype(float)
        if not np.all(floats == expected_float_id):
            raise ValueError(f"Dataset float ID does not match expected {expected_float_id}.")

    if expected_cycle is not None:
        cycles = get_vals("CYCLE_NUMBER").astype(float)
        if not np.all(cycles == expected_cycle):
            raise ValueError(f"Dataset cycle does not match expected {expected_cycle}.")

    timestamps = get_vals("TIME")
    if np.isnat(timestamps[0]):
        raise ValueError("Profile contains invalid timestamp (NaT).")

    return True


def fetch_argo_profile(float_id: int, cycle: int) -> dict:
    """Download a single Argo float profile by float_id and cycle from ERDDAP and save to local dataset catalog."""
    PROFILE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    filename = f"argo_{float_id}_cycle_{cycle}.nc"
    destination_path = PROFILE_DIRECTORY / filename

    if destination_path.exists():
        profile = read_profile(destination_path)
        return {
            "status": "already_exists",
            "message": f"Profile for float {float_id} cycle {cycle} is already cached.",
            "profile": profile,
            "file": filename,
        }

    try:
        dataset = (
            DataFetcher(src="erddap", mode="expert")
            .profile(float_id, cycle)
            .to_xarray()
        )
    except Exception as err:
        raise RuntimeError(f"ERDDAP fetch error for float {float_id} cycle {cycle}: {err}") from err

    try:
        validate_dataset(dataset, expected_float_id=float_id, expected_cycle=cycle)

        with TemporaryDirectory(prefix="argo-fetch-", dir=PROFILE_DIRECTORY) as tmpdir:
            tmp_file = Path(tmpdir) / filename
            dataset.to_netcdf(tmp_file, engine="netcdf4")
            profile = read_profile(tmp_file)

            if destination_path.exists():
                return {
                    "status": "already_exists",
                    "message": f"Profile was written concurrently.",
                    "profile": read_profile(destination_path),
                    "file": filename,
                }

            tmp_file.rename(destination_path)

        return {
            "status": "downloaded",
            "message": f"Successfully downloaded and validated profile for float {float_id} cycle {cycle}.",
            "profile": profile,
            "file": filename,
        }
    finally:
        dataset.close()


def fetch_argo_series(float_id: int, cycles: list[int]) -> dict:
    """Fetch a series of cycles for a float ID."""
    results = []
    errors = []

    for cycle in cycles:
        try:
            res = fetch_argo_profile(float_id, cycle)
            results.append(res)
        except Exception as err:
            errors.append({"cycle": cycle, "error": str(err)})

    catalog = read_catalog()
    return {
        "float_id": float_id,
        "requested_cycles": cycles,
        "successful_downloads": len(results),
        "errors": errors,
        "results": results,
        "updated_catalog": catalog,
    }

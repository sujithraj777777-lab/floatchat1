import truststore

truststore.inject_into_ssl()

from pathlib import Path

import numpy as np
import xarray as xr
from argopy import DataFetcher


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data" / "profiles"
PROFILE_FILE = DATA_DIR / "argo_6902746_cycle_34.nc"


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if PROFILE_FILE.exists():
        print("Opening the previously downloaded profile...")
        dataset = xr.load_dataset(PROFILE_FILE)
    else:
        print("Downloading real Argo observations...")
        print("Float: 6902746 | Cycle: 34")
        print("The first request may take a little time.")

        # Expert mode retains fields needed for later quality-control checks.
        fetcher = DataFetcher(src="erddap", mode="expert")
        dataset = fetcher.profile(6902746, 34).to_xarray()

        if dataset.sizes.get("N_POINTS", 0) == 0:
            raise RuntimeError("The source returned no observations.")

        # This is a local export of the fetched dataset.
        dataset.to_netcdf(PROFILE_FILE)
        print(f"Saved dataset to: {PROFILE_FILE}")

    print("\n--- DATASET DIMENSIONS ---")
    print(dict(dataset.sizes))

    print("\n--- OBSERVATION METADATA ---")
    for name in [
        "PLATFORM_NUMBER",
        "CYCLE_NUMBER",
        "TIME",
        "LATITUDE",
        "LONGITUDE",
        "DATA_MODE",
    ]:
        if name in dataset:
            values = dataset[name].values.reshape(-1)
            print(f"{name}: {values[:3]}")

    print("\n--- MEASUREMENT AVAILABILITY ---")
    for name in ["PRES", "TEMP", "PSAL"]:
        if name not in dataset:
            print(f"{name}: unavailable")
            continue

        values = dataset[name].values
        count = int(np.isfinite(values).sum())
        units = dataset[name].attrs.get("units", "units unspecified")
        print(f"{name}: {count} finite values | units: {units}")

    print("\n--- QUALITY-CONTROL FIELDS ---")
    qc_fields = sorted(
        name for name in dataset.data_vars if name.endswith("_QC")
    )
    print(", ".join(qc_fields) or "No QC fields returned.")

    print("\nSUCCESS: The profile is available locally.")
    print("These measurements have not yet passed our analysis QC policy.")


if __name__ == "__main__":
    main()
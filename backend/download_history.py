import truststore

truststore.inject_into_ssl()

from pathlib import Path

import numpy as np
import xarray as xr
from argopy import DataFetcher


FLOAT_ID = 6902746
CYCLES = range(30, 40)

DATA_DIR = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "profiles"
)


def validate(dataset, cycle):
    if dataset.sizes.get("N_POINTS", 0) == 0:
        raise ValueError("No observations returned.")

    required = [
        "PLATFORM_NUMBER", "CYCLE_NUMBER",
        "TIME", "LATITUDE", "LONGITUDE", "DATA_MODE",
        "PRES_ADJUSTED", "TEMP_ADJUSTED", "PSAL_ADJUSTED",
        "PRES_ADJUSTED_QC", "TEMP_ADJUSTED_QC",
        "PSAL_ADJUSTED_QC", "POSITION_QC", "TIME_QC",
    ]

    missing = [name for name in required if name not in dataset]
    if missing:
        raise ValueError(f"Missing fields: {', '.join(missing)}")

    if not np.all(dataset["PLATFORM_NUMBER"].values == FLOAT_ID):
        raise ValueError("Unexpected float ID.")

    if not np.all(dataset["CYCLE_NUMBER"].values == cycle):
        raise ValueError("Unexpected cycle number.")


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    available = []
    failed = []

    for cycle in CYCLES:
        path = DATA_DIR / f"argo_{FLOAT_ID}_cycle_{cycle}.nc"
        temporary = path.with_suffix(".partial.nc")

        print(f"\nCycle {cycle}:", flush=True)

        try:
            if path.exists():
                print("  Reading existing local file.", flush=True)
                dataset = xr.load_dataset(path)
                validate(dataset, cycle)
            else:
                print("  Downloading...", flush=True)

                dataset = (
                    DataFetcher(src="erddap", mode="expert")
                    .profile(FLOAT_ID, cycle)
                    .to_xarray()
                )

                validate(dataset, cycle)

                # Publish the local file only after writing completes.
                dataset.to_netcdf(temporary, engine="netcdf4")
                temporary.replace(path)

            timestamp = str(dataset["TIME"].values.reshape(-1)[0])
            latitude = float(dataset["LATITUDE"].values.reshape(-1)[0])
            longitude = float(dataset["LONGITUDE"].values.reshape(-1)[0])
            levels = dataset.sizes["N_POINTS"]

            print(f"  Date: {timestamp}")
            print(f"  Position: {latitude:.3f}, {longitude:.3f}")
            print(f"  Levels before QC filtering: {levels}")

            available.append(cycle)
            dataset.close()

        except Exception as error:
            temporary.unlink(missing_ok=True)
            failed.append(cycle)
            print(f"  FAILED: {type(error).__name__}: {error}", flush=True)

    print("\n--- DOWNLOAD SUMMARY ---")
    print(f"Available cycles: {available}")
    print(f"Failed cycles: {failed}")
    print(f"Local files available: {len(available)} / {len(CYCLES)}")
    print("Downloaded profiles still need our analysis QC filter.")

    if failed:
        print("Rerun this script to retry failed downloads.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
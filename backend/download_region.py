import truststore

truststore.inject_into_ssl()

import argparse
import re
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
import xarray as xr
from argopy import ArgoIndex, DataFetcher

from ocean_data import read_profile


DATA_DIR = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "profiles"
)

# Ascending, delayed-mode core profile filenames.
# Descending profiles have a different suffix and are skipped.
INDEX_FILENAME = re.compile(r"^D(\d+)_(\d+)\.nc$")

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


def text(value):
    if isinstance(value, bytes):
        return value.decode().strip()
    return str(value).strip()


def validate(dataset, float_id, cycle, args):
    count = dataset.sizes.get("N_POINTS", 0)

    if count == 0:
        raise ValueError("No point observations returned.")

    missing = [
        name for name in REQUIRED_FIELDS
        if name not in dataset
    ]

    if missing:
        raise ValueError(f"Missing fields: {', '.join(missing)}")

    def values(name):
        array = dataset[name].values.reshape(-1)

        if array.size != count:
            raise ValueError(
                f"{name} does not match the flattened N_POINTS layout."
            )

        return array

    for name in REQUIRED_FIELDS:
        values(name)

    if not np.all(
        values("PLATFORM_NUMBER").astype(float) == float_id
    ):
        raise ValueError("Unexpected float ID.")

    if not np.all(
        values("CYCLE_NUMBER").astype(float) == cycle
    ):
        raise ValueError("Unexpected cycle number.")

    if {text(value) for value in values("DATA_MODE")} != {"D"}:
        raise ValueError("This loader requires delayed-mode data.")

    if "DIRECTION" in dataset:
        directions = {
            text(value)
            for value in dataset["DIRECTION"].values.reshape(-1)
        }

        if directions != {"A"}:
            raise ValueError(
                "Expected one ascending profile; mixed or descending "
                "observations are not supported by this export."
            )

    # Do not combine multiple recorded profiles under one identity.
    for name in ["TIME", "LATITUDE", "LONGITUDE"]:
        array = values(name)

        if not np.all(array == array[0]):
            raise ValueError(
                f"Multiple or invalid {name} values in one profile."
            )

    timestamp = values("TIME")[0]

    if np.isnat(timestamp):
        raise ValueError("Missing profile time.")

    observed_date = date.fromisoformat(
        np.datetime_as_string(timestamp, unit="D")
    )

    latitude = float(values("LATITUDE")[0])
    longitude = float(values("LONGITUDE")[0])

    if not (
        args.south <= latitude <= args.north
        and args.west <= longitude <= args.east
        and args.start <= observed_date <= args.end
    ):
        raise ValueError(
            "Downloaded profile is outside the requested region or dates."
        )


def discover(args):
    print(
        "Searching the Argo core index. "
        "The first index download may take a while...",
        flush=True,
    )

    index = ArgoIndex(
        host="https://data-argo.ifremer.fr",
        index_file="core",
        cache=True,
    )

    # Search through the following midnight, then enforce inclusive
    # calendar dates locally.
    end_exclusive = args.end + timedelta(days=1)

    frame = index.query.box([
        args.west,
        args.east,
        args.south,
        args.north,
        args.start.isoformat(),
        end_exclusive.isoformat(),
    ]).to_dataframe()

    if "file" not in frame or "date" not in frame:
        raise ValueError(
            "The index response is missing file/date columns."
        )

    grouped = defaultdict(dict)

    for record in frame.to_dict("records"):
        filename = str(record["file"]).rsplit("/", 1)[-1]
        match = INDEX_FILENAME.fullmatch(filename)

        if match is None:
            continue

        float_id, cycle = map(int, match.groups())

        if float_id == args.exclude_float:
            continue

        observed_date = date.fromisoformat(
            str(record["date"])[:10]
        )

        if not args.start <= observed_date <= args.end:
            continue

        grouped[float_id][cycle] = str(record["date"])

    if args.float_id is not None:
        grouped = {
            float_id: rows
            for float_id, rows in grouped.items()
            if float_id == args.float_id
        }

    if not grouped:
        raise ValueError(
            "No matching delayed-mode ascending candidates were found. "
            "Try a wider region/date range. No profiles were downloaded."
        )

    # Prefer the float with the most candidate cycles in this search.
    ranked = sorted(
        grouped,
        key=lambda float_id: (-len(grouped[float_id]), float_id),
    )

    print("\nCandidate floats:", flush=True)

    for float_id in ranked[:10]:
        print(
            f"  Float {float_id}: "
            f"{len(grouped[float_id])} candidate cycles"
        )

    chosen = ranked[0]

    cycles = sorted(
        grouped[chosen],
        key=lambda cycle: (grouped[chosen][cycle], cycle),
    )[:args.limit]

    print(f"\nSelected float: {chosen}")
    print(f"Selected cycles: {cycles}")
    print("Index eligibility does not guarantee analysis QC acceptance.")

    return chosen, cycles


def download_one(float_id, cycle, args):
    path = DATA_DIR / f"argo_{float_id}_cycle_{cycle}.nc"

    if path.exists():
        print("  Checking existing file; it will not be overwritten.")

        with xr.open_dataset(path) as source:
            validate(source, float_id, cycle, args)

        return read_profile(path), False

    print("  Downloading full profile...", flush=True)

    dataset = (
        DataFetcher(src="erddap", mode="expert")
        .profile(float_id, cycle)
        .to_xarray()
    )

    try:
        validate(dataset, float_id, cycle, args)

        # A private temporary directory prevents incomplete files
        # from appearing in the application's catalogue.
        with TemporaryDirectory(
            prefix="download-",
            dir=DATA_DIR,
        ) as temporary_directory:
            temporary = Path(temporary_directory) / path.name

            dataset.to_netcdf(temporary, engine="netcdf4")

            # Apply the same QC policy used by the application.
            profile = read_profile(temporary)

            if path.exists():
                raise FileExistsError(
                    "Destination appeared during download. "
                    "Existing file was preserved."
                )

            temporary.rename(path)

        return profile, True

    finally:
        dataset.close()


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Discover one additional Argo float and download "
            "a small batch of QC-accepted profiles."
        )
    )

    parser.add_argument("--west", type=float, default=-65)
    parser.add_argument("--east", type=float, default=-50)
    parser.add_argument("--south", type=float, default=10)
    parser.add_argument("--north", type=float, default=25)

    parser.add_argument(
        "--start",
        type=date.fromisoformat,
        default=date(2017, 12, 1),
    )
    parser.add_argument(
        "--end",
        type=date.fromisoformat,
        default=date(2018, 1, 31),
    )

    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--exclude-float", type=int, default=6902746)
    parser.add_argument("--float-id", type=int, default=None)
    parser.add_argument("--discover-only", action="store_true")

    args = parser.parse_args()

    if not -180 <= args.west < args.east <= 180:
        parser.error(
            "Use -180 <= west < east <= 180. "
            "This downloader does not support date-line-crossing boxes."
        )

    if not -90 <= args.south < args.north <= 90:
        parser.error("Use -90 <= south < north <= 90.")

    if args.start > args.end:
        parser.error("Start date must not exceed end date.")

    if args.end == date.max:
        parser.error("End date must be earlier than 9999-12-31.")

    if not 1 <= args.limit <= 20:
        parser.error("Limit must be between 1 and 20.")

    if args.float_id is not None and args.float_id <= 0:
        parser.error("Float ID must be positive.")

    return args


def main():
    args = parse_args()
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    try:
        float_id, cycles = discover(args)
    except Exception as error:
        print(
            f"\nDISCOVERY FAILED: {type(error).__name__}: {error}",
            flush=True,
        )
        raise SystemExit(1)

    if args.discover_only:
        print("\nDiscovery complete. No profile files were downloaded.")
        return

    accepted = []
    issues = []
    downloaded = 0

    for cycle in cycles:
        print(f"\nFloat {float_id}, cycle {cycle}:", flush=True)

        try:
            profile, is_new = download_one(float_id, cycle, args)

            accepted.append(cycle)
            downloaded += int(is_new)

            print(f"  Time: {profile['time_utc']}")
            print(
                f"  Position: {profile['latitude']:.3f}, "
                f"{profile['longitude']:.3f}"
            )
            print(
                f"  Accepted levels: {profile['accepted_levels']} / "
                f"{profile['total_levels']}"
            )

        except Exception as error:
            reason = f"{type(error).__name__}: {error}"
            issues.append((cycle, reason))
            print(f"  FAILED OR EXCLUDED: {reason}", flush=True)

    print("\n--- REGIONAL DOWNLOAD SUMMARY ---")
    print(f"Selected float: {float_id}")
    print(f"Attempted cycles: {cycles}")
    print(f"QC-accepted local cycles: {accepted}")
    print(f"New files added: {downloaded}")

    for cycle, reason in issues:
        print(f"  Cycle {cycle}: {reason}")

    print("Existing profile files were not overwritten.")

    if issues:
        print(
            "Network failures may succeed on retry. "
            "QC exclusions require inspecting the reported reason."
        )

    if not accepted or issues:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
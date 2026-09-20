from pathlib import Path
import gsw
import numpy as np
import xarray as xr
import re
from collections import OrderedDict
from copy import deepcopy
from threading import RLock


PROFILE_FILE = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "profiles"
    / "argo_6902746_cycle_34.nc"
)


def _read_profile_uncached(profile_path=PROFILE_FILE):
    if not profile_path.exists():
        raise FileNotFoundError("Download the Argo profile first.")

    with xr.open_dataset(profile_path) as source:
        dataset = source.load()

    def values(name):
        if name not in dataset:
            raise ValueError(f"Required field is missing: {name}")
        return dataset[name].values.reshape(-1)

    def text(value):
        if isinstance(value, bytes):
            return value.decode().strip()
        return str(value).strip()

    def good_qc(name):
        # Handles flags stored as numbers, strings, or bytes.
        return np.array([
            text(value) in {"1", "1.0"} for value in values(name)
        ])

    modes = {text(value) for value in values("DATA_MODE")}
    if modes != {"D"}:
        raise ValueError("This initial loader expects a delayed-mode profile.")

    pressure = values("PRES_ADJUSTED")
    temperature = values("TEMP_ADJUSTED")
    salinity = values("PSAL_ADJUSTED")
    depth = -gsw.z_from_p(pressure, values("LATITUDE"))

    # This first endpoint returns levels where all three variables pass.
    accepted = (
        np.isfinite(pressure)
        & np.isfinite(depth)
&       (depth >= 0)
        & np.isfinite(temperature)
        & np.isfinite(salinity)
        & good_qc("PRES_ADJUSTED_QC")
        & good_qc("TEMP_ADJUSTED_QC")
        & good_qc("PSAL_ADJUSTED_QC")
        & good_qc("POSITION_QC")
        & good_qc("TIME_QC")
    )

    indices = np.flatnonzero(accepted)
    indices = indices[np.argsort(pressure[indices])]

    if len(indices) == 0:
        raise ValueError("No observation levels passed the current QC policy.")

    first = int(indices[0])

    observations = [
        {
            "source_row": int(index),
            "pressure_dbar": float(pressure[index]),
            "depth_m": float(depth[index]),
            "temperature_c": float(temperature[index]),
            "salinity_psu": float(salinity[index]),
        }
        for index in indices
    ]

    return {
        "float_id": int(values("PLATFORM_NUMBER")[first]),
        "cycle": int(values("CYCLE_NUMBER")[first]),
        "time_utc": np.datetime_as_string(
            values("TIME")[first], unit="s"
        ) + "Z",
        "latitude": float(values("LATITUDE")[first]),
        "longitude": float(values("LONGITUDE")[first]),
        "data_mode": "D",
        "total_levels": int(len(pressure)),
        "accepted_levels": len(observations),
        "excluded_levels": int(len(pressure) - len(observations)),
        "evidence": {
            "local_dataset": profile_path.name,
            "measurement_fields": [
                "PRES_ADJUSTED",
                "TEMP_ADJUSTED",
                "PSAL_ADJUSTED",
            ],
            "qc_policy": (
                "Finite adjusted pressure, temperature and salinity; "
                "all corresponding QC flags, position QC and time QC = 1."
            ),
            "vertical_coordinate": (
    "Pressure in dbar; depth_m calculated as "
    "-gsw.z_from_p(PRES_ADJUSTED, LATITUDE), "
    "using default zero dynamic-height and sea-surface-geopotential corrections."
),
        },
        "observations": observations,
    }

PROFILE_DIRECTORY = PROFILE_FILE.parent

PROFILE_FILENAME = re.compile(
    r"argo_(\d+)_cycle_(\d+)\.nc"
)

_PROFILE_CACHE = OrderedDict()
_PROFILE_LOCK = RLock()
MAX_CACHED_PROFILES = 128


def read_profile(profile_path=PROFILE_FILE):
    """Read a profile, reusing processed data while the file is unchanged."""
    path = Path(profile_path).resolve()

    # Serialize file reads within this backend process.
    with _PROFILE_LOCK:
        stat = path.stat()
        signature = (stat.st_mtime_ns, stat.st_size)

        cached = _PROFILE_CACHE.get(path)

        if cached is not None and cached["signature"] == signature:
            _PROFILE_CACHE.move_to_end(path)
            return deepcopy(cached["profile"])

        profile = _read_profile_uncached(path)

        # Check that the filename matches the observations it contains.
        match = PROFILE_FILENAME.fullmatch(path.name)

        if match is not None:
            expected_float, expected_cycle = map(int, match.groups())

            if (
                profile["float_id"] != expected_float
                or profile["cycle"] != expected_cycle
            ):
                raise ValueError(
                    "Profile metadata does not match its filename."
                )

        latitude = profile["latitude"]
        longitude = profile["longitude"]

        if not np.isfinite(latitude) or not -90 <= latitude <= 90:
            raise ValueError("Profile latitude is invalid.")

        if not np.isfinite(longitude) or not -180 <= longitude <= 180:
            raise ValueError("Profile longitude is invalid.")

        if profile["time_utc"].startswith("NaT"):
            raise ValueError("Profile observation time is missing.")

        # Avoid caching a file that changed during the read.
        after = path.stat()

        if signature != (after.st_mtime_ns, after.st_size):
            raise OSError(
                "Profile changed while being read. Retry after the download finishes."
            )

        _PROFILE_CACHE[path] = {
            "signature": signature,
            "profile": profile,
        }
        _PROFILE_CACHE.move_to_end(path)

        while len(_PROFILE_CACHE) > MAX_CACHED_PROFILES:
            _PROFILE_CACHE.popitem(last=False)

        return deepcopy(profile)


def read_catalog_profiles(float_id=None):
    """Discover available local exports and apply the existing QC policy."""
    profiles = []
    excluded = []
    discovered = 0

    for path in sorted(PROFILE_DIRECTORY.glob("argo_*_cycle_*.nc")):
        match = PROFILE_FILENAME.fullmatch(path.name)

        if match is None:
            continue

        file_float, file_cycle = map(int, match.groups())

        if float_id is not None and file_float != float_id:
            continue

        discovered += 1

        try:
            profiles.append(read_profile(path))
        except (FileNotFoundError, ValueError, OSError, KeyError) as error:
            excluded.append({
                "float_id": file_float,
                "cycle": file_cycle,
                "local_dataset": path.name,
                "reason": str(error),
            })

    profiles.sort(
        key=lambda profile: (
            profile["time_utc"],
            profile["float_id"],
            profile["cycle"],
        )
    )

    return {
        "profiles": profiles,
        "excluded_profiles": excluded,
        "discovered_files": discovered,
    }


def read_catalog():
    """Return a small inventory without sending every observation."""
    history = read_catalog_profiles()
    grouped = {}

    for profile in history["profiles"]:
        grouped.setdefault(profile["float_id"], []).append(profile)

    floats = []

    for float_id, profiles in sorted(grouped.items()):
        cycles = sorted({profile["cycle"] for profile in profiles})
        times = sorted(profile["time_utc"] for profile in profiles)

        floats.append({
            "float_id": float_id,
            "profile_count": len(profiles),
            "cycles": cycles,
            "cycle_range": [min(cycles), max(cycles)],
            "time_start_utc": times[0],
            "time_end_utc": times[-1],
            "accepted_observations": sum(
                profile["accepted_levels"] for profile in profiles
            ),
        })

    return {
        "scope": "Locally downloaded profiles passing the analysis QC policy.",
        "discovered_files": history["discovered_files"],
        "available_profiles": len(history["profiles"]),
        "available_floats": len(floats),
        "floats": floats,
        "excluded_profiles": history["excluded_profiles"],
    }
def profile_is_ready():
    try:
        read_profile()
        return True
    except (FileNotFoundError, ValueError, OSError):
        return False
def read_history():
    profiles = []
    excluded = []

    for cycle in range(30, 40):
        path = PROFILE_FILE.with_name(
            f"argo_6902746_cycle_{cycle}.nc"
        )

        try:
            profile = read_profile(path)
            profiles.append(profile)
        except (FileNotFoundError, ValueError, OSError, KeyError) as error:
            excluded.append({
                "cycle": cycle,
                "reason": str(error),
            })

    profiles.sort(key=lambda profile: profile["time_utc"])

    return {
        "profiles": profiles,
        "excluded_profiles": excluded,
        "available_profiles": len(profiles),
        "requested_profiles": 10,
    }
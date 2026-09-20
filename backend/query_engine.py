from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ocean_data import read_catalog_profiles


class OceanQuery(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    float_id: int = Field(default=6902746, gt=0)

    cycle_start: int = Field(default=30, ge=0)
    cycle_end: int = Field(default=39, ge=0)

    # Inclusive UTC calendar dates, for example "2017-12-15".
    date_start: date | None = None
    date_end: date | None = None

    # Supply all four coordinates, or omit all four.
    latitude_min: float | None = Field(default=None, ge=-90, le=90)
    latitude_max: float | None = Field(default=None, ge=-90, le=90)
    longitude_min: float | None = Field(default=None, ge=-180, le=180)
    longitude_max: float | None = Field(default=None, ge=-180, le=180)

    target_depth_m: float = Field(default=500, ge=0, le=2000)
    tolerance_m: float = Field(default=25, gt=0, le=100)

    variables: list[Literal["temperature", "salinity"]] = Field(
        default_factory=lambda: ["temperature", "salinity"],
        min_length=1,
        max_length=2,
    )

    @model_validator(mode="after")
    def validate_query(self):
        if self.cycle_start > self.cycle_end:
            raise ValueError("cycle_start must not exceed cycle_end.")

        if len(set(self.variables)) != len(self.variables):
            raise ValueError("variables must not contain duplicates.")

        if (
            self.date_start is not None
            and self.date_end is not None
            and self.date_start > self.date_end
        ):
            raise ValueError("date_start must not exceed date_end.")

        coordinates = (
            self.latitude_min,
            self.latitude_max,
            self.longitude_min,
            self.longitude_max,
        )

        if any(value is not None for value in coordinates):
            if not all(value is not None for value in coordinates):
                raise ValueError(
                    "Supply all four latitude/longitude bounds."
                )

            if self.latitude_min > self.latitude_max:
                raise ValueError(
                    "latitude_min must not exceed latitude_max."
                )

        return self


def matches_date_and_location(profile, query):
    observed_date = date.fromisoformat(profile["time_utc"][:10])

    if query.date_start is not None and observed_date < query.date_start:
        return False

    if query.date_end is not None and observed_date > query.date_end:
        return False

    if query.latitude_min is not None:
        latitude = profile["latitude"]
        longitude = profile["longitude"]

        if not query.latitude_min <= latitude <= query.latitude_max:
            return False

        west = query.longitude_min
        east = query.longitude_max

        if west <= east:
            inside_longitude = west <= longitude <= east
        else:
            # A range such as 170 to -170 crosses the date line.
            inside_longitude = longitude >= west or longitude <= east

        if not inside_longitude:
            return False

    return True


def execute_query(query: OceanQuery):
    history = read_catalog_profiles(float_id=query.float_id)

    results = []
    unavailable = []

    has_metadata_filters = (
        query.date_start is not None
        or query.date_end is not None
        or query.latitude_min is not None
    )

    for excluded in history["excluded_profiles"]:
        if query.cycle_start <= excluded["cycle"] <= query.cycle_end:
            item = dict(excluded)

            if has_metadata_filters:
                item["filter_status"] = (
                    "Date and location filters could not be assessed "
                    "because this profile could not be loaded."
                )

            unavailable.append(item)

    for profile in history["profiles"]:
        if not query.cycle_start <= profile["cycle"] <= query.cycle_end:
            continue

        if not matches_date_and_location(profile, query):
            continue

        nearest = min(
            profile["observations"],
            key=lambda row: abs(
                row["depth_m"] - query.target_depth_m
            ),
            default=None,
        )

        if nearest is None:
            unavailable.append({
                "float_id": profile["float_id"],
                "cycle": profile["cycle"],
                "reason": "No accepted observations.",
            })
            continue

        difference = abs(
            nearest["depth_m"] - query.target_depth_m
        )

        if difference > query.tolerance_m:
            unavailable.append({
                "float_id": profile["float_id"],
                "cycle": profile["cycle"],
                "reason": (
                    "No accepted observation within depth tolerance."
                ),
                "nearest_depth_m": nearest["depth_m"],
                "depth_difference_m": difference,
            })
            continue

        measurements = {}

        if "temperature" in query.variables:
            measurements["temperature_c"] = nearest["temperature_c"]

        if "salinity" in query.variables:
            measurements["salinity_psu"] = nearest["salinity_psu"]

        results.append({
            "float_id": profile["float_id"],
            "cycle": profile["cycle"],
            "time_utc": profile["time_utc"],
            "latitude": profile["latitude"],
            "longitude": profile["longitude"],
            "actual_depth_m": nearest["depth_m"],
            "depth_difference_m": difference,
            "pressure_dbar": nearest["pressure_dbar"],
            "measurements": measurements,
            "evidence": {
                "local_dataset": profile["evidence"]["local_dataset"],
                "source_row": nearest["source_row"],
                "qc_policy": profile["evidence"]["qc_policy"],
                "vertical_coordinate": (
                    profile["evidence"]["vertical_coordinate"]
                ),
            },
        })

    available_cycles = sorted({
        profile["cycle"] for profile in history["profiles"]
    })

    available_range = (
        [available_cycles[0], available_cycles[-1]]
        if available_cycles
        else []
    )

    return {
        "query": query.model_dump(mode="json"),
        "dataset_scope": {
            "float_id": query.float_id,
            "available_cycle_range": available_range,
            "available_cycles": available_cycles,
            "available_profiles": len(history["profiles"]),
            "coverage_note": (
                "Only discovered local files are searched. "
                "An absent cycle is not evidence that no observation exists."
            ),
        },
        "matched_profiles": len(results),
        "results": results,
        "unavailable_profiles": unavailable,
        "method": (
            "One nearest QC-accepted observation per profile, "
            "within the requested depth tolerance. No interpolation. "
            "Date bounds include the entire UTC calendar day. "
            "Location filters use the recorded profile position."
        ),
    }
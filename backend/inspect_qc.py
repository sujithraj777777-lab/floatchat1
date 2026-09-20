import truststore

truststore.inject_into_ssl()

import gsw
import numpy as np
from argopy import DataFetcher


FLOAT_ID = 5904664
CYCLE = 140


def text(value):
    if isinstance(value, bytes):
        return value.decode().strip()
    return str(value).strip()


def main():
    print(
        f"Inspecting float {FLOAT_ID}, cycle {CYCLE}...",
        flush=True,
    )

    dataset = (
        DataFetcher(src="erddap", mode="expert")
        .profile(FLOAT_ID, CYCLE)
        .to_xarray()
    )

    try:
        count = dataset.sizes.get("N_POINTS", 0)

        if count == 0:
            raise ValueError("No observations returned.")

        def values(name):
            if name not in dataset:
                raise ValueError(f"Missing field: {name}")

            array = dataset[name].values.reshape(-1)

            if array.size != count:
                raise ValueError(
                    f"{name}: {array.size} values, expected {count}."
                )

            return array

        print(f"\nTotal levels: {count}")

        print("\n--- DATA MODE ---")
        modes, counts = np.unique(
            [text(value) for value in values("DATA_MODE")],
            return_counts=True,
        )
        print(dict(zip(modes.tolist(), counts.tolist())))

        print("\n--- MEASUREMENT AVAILABILITY ---")
        for name in [
            "PRES", "TEMP", "PSAL",
            "PRES_ADJUSTED", "TEMP_ADJUSTED", "PSAL_ADJUSTED",
        ]:
            if name not in dataset:
                print(f"{name}: missing")
                continue

            array = values(name)
            print(
                f"{name}: {np.count_nonzero(np.isfinite(array))}"
                f" / {count} finite"
            )

        qc_fields = [
            "PRES_ADJUSTED_QC",
            "TEMP_ADJUSTED_QC",
            "PSAL_ADJUSTED_QC",
            "POSITION_QC",
            "TIME_QC",
        ]

        print("\n--- QC FLAG COUNTS ---")
        for name in qc_fields:
            flags, counts = np.unique(
                [text(value) for value in values(name)],
                return_counts=True,
            )
            print(
                f"{name}: "
                f"{dict(zip(flags.tolist(), counts.tolist()))}"
            )

        pressure = values("PRES_ADJUSTED")
        depth = -gsw.z_from_p(pressure, values("LATITUDE"))

        checks = [
            ("Finite adjusted pressure", np.isfinite(pressure)),
            ("Finite calculated depth", np.isfinite(depth)),
            ("Non-negative depth", depth >= 0),
            (
                "Finite adjusted temperature",
                np.isfinite(values("TEMP_ADJUSTED")),
            ),
            (
                "Finite adjusted salinity",
                np.isfinite(values("PSAL_ADJUSTED")),
            ),
        ]

        for name in qc_fields:
            checks.append((
                f"{name} equals 1",
                np.array([
                    text(value) in {"1", "1.0"}
                    for value in values(name)
                ]),
            ))

        print("\n--- ACCEPTANCE BREAKDOWN ---")
        remaining = np.ones(count, dtype=bool)

        for label, passed in checks:
            remaining &= passed
            print(
                f"{label}: "
                f"{np.count_nonzero(passed)} pass individually; "
                f"{np.count_nonzero(remaining)} remain after all checks so far"
            )

        print(
            "\nFinal accepted levels:",
            np.count_nonzero(remaining),
        )
        print("Diagnostic only. No profile files were changed.")

    finally:
        dataset.close()


if __name__ == "__main__":
    main()
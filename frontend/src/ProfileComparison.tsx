import { useState } from "react";

type Observation = {
  source_row: number;
  depth_m: number;
  temperature_c: number;
  salinity_psu: number;
};

type Profile = {
  float_id: number;
  cycle: number;
  time_utc: string;
  latitude: number;
  longitude: number;
  evidence: {
    local_dataset: string;
  };
  observations: Observation[];
};

type Props = {
  profiles: Profile[];
  current: Profile;
  targetDepth: number;
};

function nearestObservation(profile: Profile, target: number) {
  const tolerance = target === 0 ? 10 : 25;

  const nearest = profile.observations.reduce<Observation | null>(
    (best, row) => {
      if (!Number.isFinite(row.depth_m) || row.depth_m < 0) {
        return best;
      }

      return best === null ||
        Math.abs(row.depth_m - target) < Math.abs(best.depth_m - target)
        ? row
        : best;
    },
    null,
  );

  return nearest && Math.abs(nearest.depth_m - target) <= tolerance
    ? nearest
    : null;
}

function signed(value: number, decimals = 3) {
  const rounded = Number(value.toFixed(decimals));
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(decimals)}`;
}

export default function ProfileComparison({
  profiles,
  current,
  targetDepth,
}: Props) {
  const [baselineCycle, setBaselineCycle] = useState<number | null>(null);

  const baseline =
    profiles.find((profile) => profile.cycle === baselineCycle) ??
    profiles[0];

  if (!baseline) return null;

  const before = nearestObservation(baseline, targetDepth);
  const after = nearestObservation(current, targetDepth);
  const sameProfile =
    baseline.float_id === current.float_id &&
    baseline.cycle === current.cycle;

  return (
    <section className="comparison-panel">
      <p className="eyebrow">WHAT CHANGED?</p>
      <h3>Compare two recorded profiles</h3>

      <label htmlFor="baseline-cycle">Compare against</label>
      <select
        id="baseline-cycle"
        value={baseline.cycle}
        onChange={(event) => setBaselineCycle(Number(event.target.value))}
      >
        {profiles.map((profile) => (
          <option key={profile.cycle} value={profile.cycle}>
            Cycle {profile.cycle} — {profile.time_utc.slice(0, 10)}
          </option>
        ))}
      </select>

      <p className="profile-note">
        Target: {targetDepth === 0 ? "near surface" : `${targetDepth} m`}.
        Change is calculated as selected profile minus comparison profile.
      </p>

      {sameProfile ? (
        <p role="status">
          Both selections are cycle {current.cycle}. Choose another comparison
          profile or move the history slider.
        </p>
      ) : !before || !after ? (
        <p role="status">
          Cannot compare at this target:{" "}
          {!before && `cycle ${baseline.cycle} has no nearby accepted observation`}
          {!before && !after && "; "}
          {!after && `cycle ${current.cycle} has no nearby accepted observation`}.
        </p>
      ) : (
        <>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th scope="col">Measurement</th>
                  <th scope="col">Cycle {baseline.cycle}</th>
                  <th scope="col">Cycle {current.cycle}</th>
                  <th scope="col">Difference</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Calculated depth (m)</th>
                  <td>{before.depth_m.toFixed(1)}</td>
                  <td>{after.depth_m.toFixed(1)}</td>
                  <td>{signed(after.depth_m - before.depth_m, 1)}</td>
                </tr>
                <tr>
                  <th scope="row">Temperature (°C)</th>
                  <td>{before.temperature_c.toFixed(3)}</td>
                  <td>{after.temperature_c.toFixed(3)}</td>
                  <td>{signed(after.temperature_c - before.temperature_c)}</td>
                </tr>
                <tr>
                  <th scope="row">Practical salinity (PSU)</th>
                  <td>{before.salinity_psu.toFixed(3)}</td>
                  <td>{after.salinity_psu.toFixed(3)}</td>
                  <td>{signed(after.salinity_psu - before.salinity_psu)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <details className="profile-evidence">
            <summary>Inspect both source observations</summary>
            <p>
              Comparison: {baseline.time_utc} ·{" "}
              {baseline.latitude.toFixed(3)}°, {baseline.longitude.toFixed(3)}°
              <br />
              {baseline.evidence.local_dataset} · Source row {before.source_row}
            </p>
            <p>
              Selected: {current.time_utc} ·{" "}
              {current.latitude.toFixed(3)}°, {current.longitude.toFixed(3)}°
              <br />
              {current.evidence.local_dataset} · Source row {after.source_row}
            </p>
          </details>
        </>
      )}

      <p className="profile-note">
        These observations were recorded at different times and potentially
        different locations and depths. Differences may reflect float movement
        and sampling as well as ocean changes. This comparison does not establish
        a regional trend or anomaly.
      </p>
    </section>
  );
}
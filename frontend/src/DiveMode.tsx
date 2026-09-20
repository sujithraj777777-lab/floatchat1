type DiveObservation = {
  source_row: number;
  depth_m: number;
  pressure_dbar: number;
  temperature_c: number;
  salinity_psu: number;
};

type Props = {
  targetDepth: number;
  onDepthChange: (depth: number) => void;
  observation: DiveObservation | null;
  tolerance: number;
};

export default function DiveMode({
  targetDepth,
  onDepthChange,
  observation,
  tolerance,
}: Props) {
  return (
    <section className="dive-panel" aria-labelledby="dive-title">
      <p className="eyebrow">DIVE MODE</p>
      <h3 id="dive-title">Explore a depth</h3>

      <div className="dive-buttons">
        {[0, 100, 500, 1000, 2000].map((depth) => (
          <button
            key={depth}
            type="button"
            aria-pressed={targetDepth === depth}
            onClick={() => onDepthChange(depth)}
          >
            {depth === 0 ? "Near surface" : `${depth.toLocaleString()} m`}
          </button>
        ))}
      </div>

      <p className="profile-note">
        Nearest accepted observation within {tolerance} m of the target.
        These are prototype selection tolerances, not measurement uncertainty.
        No interpolation is used.
      </p>

      {observation ? (
        <div aria-live="polite">
          <div className="dive-readings">
            <div>
              <span>Actual calculated depth</span>
              <strong>{observation.depth_m.toFixed(1)} m</strong>
            </div>
            <div>
              <span>Temperature</span>
              <strong>{observation.temperature_c.toFixed(3)} °C</strong>
            </div>
            <div>
              <span>Practical salinity</span>
              <strong>{observation.salinity_psu.toFixed(3)} PSU</strong>
            </div>
          </div>

          <p className="profile-note">
            Target: {targetDepth} m · Difference:{" "}
            {Math.abs(observation.depth_m - targetDepth).toFixed(1)} m
            <br />
            Pressure: {observation.pressure_dbar.toFixed(1)} dbar ·
            Source row: {observation.source_row}
            <br />
            The selected observation is highlighted in white on both charts.
          </p>
        </div>
      ) : (
        <p role="status">
          No nearby observation within {tolerance} m of {targetDepth} m
          in this profile.
        </p>
      )}
    </section>
  );
}
import { useState } from "react";
import Plot from "react-plotly.js";
import { calculateGradients } from "./oceanGradients";
import type { GradientInterval, GradientObservation } from "./oceanGradients";

type Props = {
  profile: {
    float_id: number;
    cycle: number;
    time_utc: string;
    evidence: { local_dataset: string; qc_policy: string };
    observations: GradientObservation[];
  };
};
const controlStyle = { padding: "10px", borderRadius: "8px", border: "1px solid #365269", background: "#132a3b", color: "#e5eff8" };
const chartFields = [
  { field: "temperature_per_m" as const, label: "Temperature gradient", unit: "°C/m", color: "#54e0cc" },
  { field: "salinity_per_m" as const, label: "Salinity gradient", unit: "PSU/m", color: "#ffbd75" },
];
function signed(value: number) { return `${value > 0 ? "+" : ""}${value.toFixed(5)}`; }

export default function ProfileGradients({ profile }: Props) {
  const [maxDepth, setMaxDepth] = useState(1000);
  const [maxSeparation, setMaxSeparation] = useState(50);
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const analysis = calculateGradients(profile.observations, {
    minDepth: 0, maxDepth, minSeparation: 2, maxSeparation,
  });
  const pairId = (row: GradientInterval) => `${row.shallow.source_row}:${row.deep.source_row}`;
  const selected = analysis.intervals.find((row) => pairId(row) === selectedPair)
    ?? analysis.strongestCooling ?? analysis.intervals[0];
  const summaries = [
    { title: "Strongest cooling interval", interval: analysis.strongestCooling, field: "temperature_per_m" as const,
      unit: "°C/m", empty: "No cooling interval under these settings." },
    { title: "Largest absolute salinity gradient", interval: analysis.strongestSalinity, field: "salinity_per_m" as const,
      unit: "PSU/m", empty: "No non-zero salinity gradient under these settings." },
  ];

  return (
    <section className="ocean-query-panel" aria-label="Profile depth gradients">
      <p className="eyebrow">VERTICAL STRUCTURE</p>
      <h2>How quickly does the water change with depth?</h2>
      <p>Float {profile.float_id} · Cycle {profile.cycle} · {profile.time_utc.replace("T", " ").replace("Z", " UTC")}</p>
      <p className="profile-note">
        Interval gradient = (deeper value − shallower value) / depth separation.
        Depth increases downward: negative temperature gradients mean cooling with depth;
        positive salinity gradients mean increasing salinity with depth.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", margin: "20px 0" }}>
        <label>Analysis window{" "}<select style={controlStyle} value={maxDepth} onChange={(event) => {
          setMaxDepth(Number(event.target.value)); setSelectedPair(null);
        }}>
          <option value={250}>0–250 m</option><option value={1000}>0–1,000 m</option><option value={2200}>0–2,200 m</option>
        </select></label>
        <label>Maximum level separation{" "}<select style={controlStyle} value={maxSeparation} onChange={(event) => {
          setMaxSeparation(Number(event.target.value)); setSelectedPair(null);
        }}>
          <option value={25}>25 m</option><option value={50}>50 m</option><option value={100}>100 m</option>
        </select></label>
      </div>
      <p role="status">{analysis.intervals.length} usable intervals under these settings.</p>
      <div className="profile-charts">
        {summaries.map((summary) => (
          <article className="profile-chart" key={summary.field} style={{ padding: "20px" }}>
            <h3>{summary.title}</h3>
            {summary.interval ? <>
              <p style={{ fontSize: "24px", fontWeight: 700 }}>{signed(summary.interval[summary.field])} {summary.unit}</p>
              <p>{summary.interval.shallow.depth_m.toFixed(1)}–{summary.interval.deep.depth_m.toFixed(1)} m</p>
              <button type="button" onClick={() => setSelectedPair(pairId(summary.interval!))}>Inspect source pair</button>
            </> : <p>{summary.empty}</p>}
          </article>
        ))}
      </div>
      <p className="profile-note">
        The strongest cooling interval is an exploratory clue to vertical structure,
        not a validated thermocline boundary. Results depend on sampling spacing,
        measurement noise and the chosen window. Equal extrema select the shallower interval.
      </p>
      {analysis.intervals.length > 0 && <>
        <div className="profile-charts">
          {chartFields.map((chart) => (
            <article className="profile-chart" key={chart.field}>
              <h3>{chart.label}</h3>
              <Plot data={[{
                type: "scatter", mode: "markers",
                x: analysis.intervals.map((row) => row[chart.field]),
                y: analysis.intervals.map((row) => row.midpoint_m),
                customdata: analysis.intervals.map((row) => [row.shallow.depth_m, row.deep.depth_m, row.shallow.source_row, row.deep.source_row]),
                marker: { size: analysis.intervals.map((row) => row === selected ? 11 : 6),
                  color: analysis.intervals.map((row) => row === selected ? "#ffe066" : chart.color) },
                error_y: { type: "data", array: analysis.intervals.map((row) => row.separation_m / 2),
                  visible: true, color: chart.color, thickness: 1, width: 3 },
                hovertemplate: `${chart.label}: %{x:.5f} ${chart.unit}` +
                  "<br>Interval: %{customdata[0]:.1f}–%{customdata[1]:.1f} m" +
                  "<br>Source rows: %{customdata[2]} and %{customdata[3]}<extra></extra>",
              }]} layout={{
                autosize: true, height: 470, paper_bgcolor: "#0d1b2b", plot_bgcolor: "#0d1b2b",
                font: { color: "#b6c9da" }, margin: { l: 70, r: 25, t: 25, b: 70 }, showlegend: false,
                xaxis: { title: { text: chart.unit }, gridcolor: "#203244", zeroline: true, zerolinecolor: "#9cb0c3" },
                yaxis: { title: { text: "Calculated depth (m)" }, range: [maxDepth, 0], gridcolor: "#203244" },
              }} config={{ responsive: true, displaylogo: false, scrollZoom: false }}
                useResizeHandler style={{ width: "100%", height: "470px" }}
                onClick={(event) => {
                  const index = event.points[0]?.pointNumber;
                  if (typeof index === "number") {
                    const interval = analysis.intervals[index];
                    if (interval) setSelectedPair(pairId(interval));
                  }
                }} />
            </article>
          ))}
        </div>
        <p className="profile-note">Points are placed at interval midpoints. Vertical bars show the two measured depths,
          not uncertainty. The gradient is an average across that interval; no smoothing is applied.</p>
        <label>Inspect an interval{" "}<select style={{ ...controlStyle, maxWidth: "100%" }}
          value={selected ? pairId(selected) : ""} onChange={(event) => setSelectedPair(event.target.value)}>
          {analysis.intervals.map((row) => <option key={pairId(row)} value={pairId(row)}>
            {row.shallow.depth_m.toFixed(1)}–{row.deep.depth_m.toFixed(1)} m · rows {row.shallow.source_row}, {row.deep.source_row}
          </option>)}
        </select></label>
      </>}
      {selected && <div className="ocean-chat-filters">
        <h3>Evidence for the selected interval</h3>
        <p>File: {profile.evidence.local_dataset} · Depth separation: {selected.separation_m.toFixed(3)} m</p>
        <div className="ocean-query-table-wrap">
          <table className="ocean-query-table">
            <caption>Two accepted source measurements</caption>
            <thead><tr><th scope="col">Endpoint</th><th scope="col">Source row</th><th scope="col">Depth (m)</th>
              <th scope="col">Temperature (°C)</th><th scope="col">Salinity (PSU)</th></tr></thead>
            <tbody>{[selected.shallow, selected.deep].map((row, index) => <tr key={row.source_row}>
              <th scope="row">{index === 0 ? "Shallower" : "Deeper"}</th><td>{row.source_row}</td>
              <td>{row.depth_m.toFixed(3)}</td><td>{row.temperature_c.toFixed(5)}</td><td>{row.salinity_psu.toFixed(5)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p>ΔT / Δdepth = {signed(selected.temperature_per_m)} °C/m · ΔS / Δdepth = {signed(selected.salinity_per_m)} PSU/m</p>
        <p className="profile-note">Calculated using full stored precision; displayed values are rounded. QC: {profile.evidence.qc_policy}</p>
      </div>}
      <details className="profile-evidence">
        <summary>Method and excluded intervals</summary>
        <p>Only neighbouring accepted levels in depth order with consecutive local source-row numbers are used.
          Both endpoints must lie inside the window. Intervals touching duplicate depths or duplicate row IDs are excluded.</p>
        <p>The minimum separation is 2 m; maximum separation is {maxSeparation} m.
          These are prototype analysis choices, not Argo QC rules or uncertainty estimates.</p>
        <ul>
          <li>Invalid levels omitted: {analysis.invalidLevels}</li>
          <li>Candidate pairs outside window: {analysis.skipped.outsideWindow}</li>
          <li>Pairs touching duplicates: {analysis.skipped.duplicate}</li>
          <li>Nonconsecutive source-row pairs: {analysis.skipped.sourceGap}</li>
          <li>Pairs less than 2 m apart: {analysis.skipped.tooClose}</li>
          <li>Pairs exceeding maximum separation: {analysis.skipped.tooFar}</li>
        </ul>
        <p>Each excluded candidate pair is counted once, under the first applicable rule.
          Gradients describe this profile only; no regional trend, heatwave or forecast is inferred.</p>
      </details>
    </section>
  );
}

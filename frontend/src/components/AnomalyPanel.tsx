import { useState } from "react";
import { useOceanFetch } from "../hooks/useOceanData";
import Plot from "react-plotly.js";

type AnomalyPoint = {
  source_row: number;
  depth_m: number;
  pressure_dbar: number;
  value: number;
  z_score: number;
  anomaly_type: string;
};

type AnomalyResult = {
  float_id: number;
  cycle: number;
  variable: string;
  unit: string;
  method: string;
  total_levels: number;
  anomalies_detected: number;
  anomalies: AnomalyPoint[];
  summary: string;
  statistics: { mean: number; std: number; min: number; max: number };
  evidence: Record<string, unknown>;
};

type Props = {
  floatId: number;
  cycle: number;
};

export default function AnomalyPanel({ floatId, cycle }: Props) {
  const { data, loading, error, fetch: fetchData } = useOceanFetch<AnomalyResult>();
  const [variable, setVariable] = useState("temperature");
  const [method, setMethod] = useState("zscore");
  const [threshold, setThreshold] = useState(2.0);

  function detect() {
    fetchData(`/api/tools/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "detect_anomalies",
        arguments: { float_id: floatId, cycle, variable, method, threshold },
      }),
    });
  }

  return (
    <section className="ocean-query-panel" aria-labelledby="anomaly-title">
      <p className="eyebrow">ANOMALY DETECTION</p>
      <h2 id="anomaly-title">Statistical anomaly detection</h2>

      <p className="profile-note">
        Identifies observations that deviate significantly from the profile
        mean using Z-score or IQR methods. Statistical detection only — does
        not imply measurement error.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 20, alignItems: "end" }}>
        <label>
          Variable{" "}
          <select
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #365269",
              background: "#132a3b",
              color: "#e5eff8",
            }}
          >
            <option value="temperature">Temperature</option>
            <option value="salinity">Salinity</option>
          </select>
        </label>

        <label>
          Method{" "}
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #365269",
              background: "#132a3b",
              color: "#e5eff8",
            }}
          >
            <option value="zscore">Z-score</option>
            <option value="iqr">IQR</option>
          </select>
        </label>

        <label>
          Threshold{" "}
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="5"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #365269",
              background: "#132a3b",
              color: "#e5eff8",
              width: 80,
            }}
          />
        </label>

        <button type="button" onClick={detect} disabled={loading}>
          {loading ? "Detecting..." : "Detect anomalies"}
        </button>
      </div>

      {error && (
        <p className="error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      {data && (
        <div style={{ marginTop: 24 }}>
          <p role="status">{data.summary}</p>

          {data.anomalies.length > 0 && (
            <>
              <Plot
                data={[
                  {
                    x: data.anomalies.map((a) => a.depth_m),
                    y: data.anomalies.map((a) => a.value),
                    type: "scatter",
                    mode: "markers",
                    marker: {
                      color: data.anomalies.map((a) =>
                        a.anomaly_type === "high" ? "#ff6b6b" : "#4ecdc4"
                      ),
                      size: data.anomalies.map((a) =>
                        Math.min(20, 8 + a.z_score * 2)
                      ),
                      symbol: "diamond",
                      line: { color: "#fff", width: 1 },
                    },
                    text: data.anomalies.map(
                      (a) =>
                        `Row ${a.source_row}<br>Depth: ${a.depth_m.toFixed(1)}m<br>Value: ${a.value.toFixed(3)}<br>Z-score: ${a.z_score.toFixed(2)}`
                    ),
                    hovertemplate: "%{text}<extra></extra>",
                    name: "Anomalies",
                  },
                ]}
                layout={{
                  height: 400,
                  autosize: true,
                  paper_bgcolor: "#0d1b2b",
                  plot_bgcolor: "#0d1b2b",
                  font: { color: "#b6c9da" },
                  margin: { l: 70, r: 25, t: 25, b: 60 },
                  xaxis: {
                    title: { text: "Depth (m)" },
                    gridcolor: "#203244",
                  },
                  yaxis: {
                    title: { text: `${data.variable} (${data.unit})` },
                    gridcolor: "#203244",
                  },
                }}
                config={{ responsive: true, displaylogo: false }}
                useResizeHandler
                style={{ width: "100%", height: "400px" }}
              />

              <div className="ocean-query-table-wrap" style={{ marginTop: 16 }}>
                <table className="ocean-query-table">
                  <caption>Detected anomalies</caption>
                  <thead>
                    <tr>
                      <th>Depth (m)</th>
                      <th>Pressure (dbar)</th>
                      <th>Value</th>
                      <th>Z-score</th>
                      <th>Type</th>
                      <th>Source row</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.anomalies.map((a) => (
                      <tr key={a.source_row}>
                        <td>{a.depth_m.toFixed(1)}</td>
                        <td>{a.pressure_dbar.toFixed(1)}</td>
                        <td>
                          {a.value.toFixed(3)} {data.unit}
                        </td>
                        <td>{a.z_score.toFixed(2)}</td>
                        <td style={{ color: a.anomaly_type === "high" ? "#ff6b6b" : "#4ecdc4" }}>
                          {a.anomaly_type}
                        </td>
                        <td>{a.source_row}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <details className="profile-evidence" style={{ marginTop: 16 }}>
            <summary>Detection evidence</summary>
            <p>Method: {data.method}</p>
            <p>Total levels: {data.total_levels}</p>
            <p>Anomalies found: {data.anomalies_detected}</p>
            <p>
              Mean: {data.statistics.mean.toFixed(3)} {data.unit}
            </p>
            <p>
              Std: {data.statistics.std.toFixed(3)} {data.unit}
            </p>
          </details>
        </div>
      )}
    </section>
  );
}

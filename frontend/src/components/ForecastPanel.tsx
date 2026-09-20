import { useState } from "react";
import Plot from "react-plotly.js";
import { useForecast } from "../hooks/useForecast";

type Props = {
  floatId: number;
};

export default function ForecastPanel({ floatId }: Props) {
  const { data, loading, error, fetchForecast } = useForecast();
  const [variable, setVariable] = useState("temperature");
  const [horizon, setHorizon] = useState(30);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchForecast(floatId, variable, horizon);
  }

  return (
    <section className="ocean-query-panel" aria-labelledby="forecast-title">
      <p className="eyebrow">FORECAST ENGINE</p>
      <h2 id="forecast-title">Statistical forecast</h2>

      <p className="profile-note">
        Extrapolates observed trends using polynomial fitting. This is NOT a
        physical ocean model. Confidence intervals widen with forecast horizon.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "end" }}>
          <label>
            Variable{" "}
            <select
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
            >
              <option value="temperature">Temperature</option>
              <option value="salinity">Salinity</option>
            </select>
          </label>

          <label>
            Horizon (days){" "}
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Computing..." : "Generate forecast"}
          </button>
        </div>
      </form>

      {error && (
        <p className="error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      {data && (
        <div style={{ marginTop: 24 }}>
          <p className="profile-note" style={{ color: "var(--accent-coral)" }}>
            {data.disclaimer}
          </p>

          <Plot
            data={[
              {
                x: data.forecasts.map((f) => f.days_ahead),
                y: data.forecasts.map((f) => f.confidence_upper),
                type: "scatter",
                mode: "lines",
                line: { width: 0 },
                showlegend: false,
                hoverinfo: "skip",
              },
              {
                x: data.forecasts.map((f) => f.days_ahead),
                y: data.forecasts.map((f) => f.confidence_lower),
                type: "scatter",
                mode: "lines",
                fill: "tonexty",
                fillcolor: "rgba(56, 189, 248, 0.15)",
                line: { width: 0 },
                name: "95% confidence",
                hoverinfo: "skip",
              },
              {
                x: data.forecasts.map((f) => f.days_ahead),
                y: data.forecasts.map((f) => f.predicted_value),
                type: "scatter",
                mode: "lines+markers",
                line: { color: "#38bdf8", width: 2 },
                marker: { size: 4 },
                name: `Predicted ${data.variable}`,
                hovertemplate:
                  `Day %{x}<br>${data.variable}: %{y:.3f} ${data.unit}` +
                  "<extra></extra>",
              },
            ]}
            layout={{
              height: 400,
              autosize: true,
              paper_bgcolor: "#0f172a",
              plot_bgcolor: "#0f172a",
              font: { color: "#94a3b8" },
              margin: { l: 70, r: 25, t: 25, b: 60 },
              showlegend: true,
              legend: { x: 0.02, y: 0.98 },
              xaxis: {
                title: { text: "Days ahead" },
                gridcolor: "#1e293b",
              },
              yaxis: {
                title: { text: `${data.variable} (${data.unit})` },
                gridcolor: "#1e293b",
              },
            }}
            config={{ responsive: true, displaylogo: false }}
            useResizeHandler
            style={{ width: "100%", height: "400px" }}
          />

          <details className="profile-evidence" style={{ marginTop: 16 }}>
            <summary>Forecast evidence</summary>
            <p>Float: {data.float_id}</p>
            <p>Variable: {data.variable} ({data.unit})</p>
            <p>Historical points: {data.historical_points}</p>
            <p>Horizon: {data.forecast_horizon_days} days</p>
            <p>Method: {data.forecasts[0]?.method || "N/A"}</p>
          </details>
        </div>
      )}
    </section>
  );
}

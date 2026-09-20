import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import type { ProfileSelection } from "./profileSelection";

type Observation = {
  source_row: number;
  pressure_dbar: number;
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
  evidence: { local_dataset: string };
  observations: Observation[];
};

type History = {
  profiles: Profile[];
  excluded_profiles: { cycle: number; reason: string }[];
};

type Props = {
  onViewProfile: (selection: ProfileSelection) => void;
};

type CatalogFloat = {
  float_id: number;
  profile_count: number;
};

type FloatSectionProps = Props & {
  floatId: number;
};

type Variable = "temperature_c" | "salinity_psu";

const variables = {
  temperature_c: {
    label: "Temperature",
    unit: "°C",
    scale: "Plasma",
  },
  salinity_psu: {
    label: "Practical salinity",
    unit: "PSU",
    scale: "Viridis",
  },
};

function isCatalogFloat(value: unknown): value is CatalogFloat {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.float_id === "number" &&
    Number.isInteger(item.float_id) &&
    item.float_id > 0 &&
    typeof item.profile_count === "number" &&
    Number.isInteger(item.profile_count) &&
    item.profile_count > 0
  );
}

export default function OceanSection({ onViewProfile }: Props) {
  const [floats, setFloats] = useState<CatalogFloat[]>([]);
  const [selectedFloat, setSelectedFloat] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (attempt === 0) return;

    const controller = new AbortController();
    let active = true;
    let timedOut = false;

    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);

    async function loadCatalog() {
      setLoading(true);
      setLoaded(false);
      setError("");

      try {
        const response = await fetch("/api/catalog", {
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            typeof body?.detail === "string"
              ? body.detail
              : `Catalog request failed: HTTP ${response.status}`
          );
        }

        const data = await response.json();
        if (!active) return;

        if (
          !data ||
          !Array.isArray(data.floats) ||
          !data.floats.every(isCatalogFloat)
        ) {
          throw new Error("The API returned an invalid catalog response.");
        }

        setFloats(data.floats);
        setSelectedFloat((current) => current ?? data.floats[0]?.float_id ?? null);
        setLoaded(true);
      } catch (caught) {
        if (!active) return;
        if (controller.signal.aborted && !timedOut) return;
        setError(
          timedOut
            ? "Catalog load timed out. Verify backend service status."
            : caught instanceof Error
            ? caught.message
            : "Could not load dataset catalog."
        );
      } finally {
        window.clearTimeout(timer);
        if (active) setLoading(false);
      }
    }

    void loadCatalog();

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  return (
    <section className="catalog-search" aria-labelledby="transect-catalog-title">
      <p className="eyebrow">ARGO TRANSECT ENGINE</p>
      <h2 id="transect-catalog-title">Vertical Ocean Hydrographic Transects</h2>

      <p className="profile-note" style={{ marginTop: "8px" }}>
        Loads NetCDF profile series across consecutive drift cycles to construct 2D depth-time cross sections.
      </p>

      {!loaded && !loading && !error && (
        <button
          type="button"
          onClick={() => setAttempt(1)}
          style={{ marginTop: "16px" }}
        >
          Load Catalog Transects
        </button>
      )}

      {loading && (
        <p role="status" style={{ color: "var(--accent-blue)", marginTop: "16px" }}>
          Loading dataset catalog…
        </p>
      )}

      {error && (
        <div style={{ marginTop: "16px" }}>
          <p className="error" role="alert">{error}</p>
          <button type="button" onClick={() => setAttempt((v) => v + 1)}>
            Retry Loading Catalog
          </button>
        </div>
      )}

      {loaded && floats.length === 0 && (
        <p style={{ marginTop: "16px" }}>No accepted floats were found in local storage.</p>
      )}

      {loaded && floats.length > 0 && selectedFloat !== null && (
        <div style={{ marginTop: "20px" }}>
          <label style={{ display: "block", marginBottom: "16px" }}>
            Select Float Platform{" "}
            <select
              value={selectedFloat}
              onChange={(e) => setSelectedFloat(Number(e.target.value))}
              style={{ marginLeft: "10px" }}
            >
              {floats.map((f) => (
                <option key={f.float_id} value={f.float_id}>
                  Float WMO {f.float_id} ({f.profile_count} profiles)
                </option>
              ))}
            </select>
          </label>

          <FloatSectionViewer
            key={selectedFloat}
            floatId={selectedFloat}
            onViewProfile={onViewProfile}
          />
        </div>
      )}
    </section>
  );
}

function FloatSectionViewer({ floatId, onViewProfile }: FloatSectionProps) {
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(1);

  const [variable, setVariable] = useState<Variable>("temperature_c");
  const [selectedPointIndex, setPointIndex] = useState(0);
  const [plotMode, setPlotMode] = useState<"contour" | "scatter">("contour");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;

    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);

    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/profiles/history?float_id=${encodeURIComponent(floatId)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            typeof body?.detail === "string"
              ? body.detail
              : `History request failed: HTTP ${response.status}`
          );
        }

        const data: History = await response.json();
        if (!active) return;

        if (!data || !Array.isArray(data.profiles)) {
          throw new Error("API returned an unexpected history schema.");
        }

        setHistory(data);
        setPointIndex(0);
      } catch (caught) {
        if (!active) return;
        if (controller.signal.aborted && !timedOut) return;
        setError(
          timedOut
            ? "Loading profiles timed out. Verify backend service status."
            : caught instanceof Error
            ? caught.message
            : "Could not load float history."
        );
      } finally {
        window.clearTimeout(timer);
        if (active) setLoading(false);
      }
    }

    void loadHistory();

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [floatId, attempt]);

  const config = variables[variable];
  const profiles = history?.profiles ?? [];

  const visible = profiles.flatMap((profile) =>
    profile.observations.map((row) => ({ profile, row }))
  );

  const values = visible.map(({ row }) => row[variable]);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const maxDepth = Math.max(
    ...profiles.flatMap((p) => p.observations.map((o) => o.depth_m)),
    500
  );

  const chosen = visible[selectedPointIndex] ?? null;

  function openPoint(idx: number) {
    const item = visible[idx];
    if (!item) return;

    onViewProfile({
      floatId: item.profile.float_id,
      cycle: item.profile.cycle,
      dataset: item.profile.evidence.local_dataset,
      sourceRow: item.row.source_row,
    });
  }

  const uniqueTimes = profiles.map((p) => p.time_utc.slice(0, 10));
  const depthBins = [10, 50, 100, 200, 400, 700, 1000, 1500, 2000].filter((d) => d <= maxDepth);
  const contourZ: number[][] = depthBins.map((d) => {
    return profiles.map((p) => {
      const closestObs = p.observations.reduce<Observation | null>((nearest, row) => {
        if (!nearest || Math.abs(row.depth_m - d) < Math.abs(nearest.depth_m - d)) return row;
        return nearest;
      }, null);
      return closestObs ? closestObs[variable] : 0;
    });
  });

  return (
    <section className="ocean-query-panel" aria-labelledby="section-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <p className="eyebrow">2D VERTICAL OCEAN TRANSECT</p>
          <h2 id="section-title" style={{ margin: 0 }}>Ocean Depth-Time Cross Section</h2>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setAttempt((v) => v + 1)}
            style={{ background: "#0f172a", color: "var(--text-muted)", border: "1px solid var(--bg-card-border)" }}
          >
            Reload Data
          </button>
          <button
            onClick={() => setPlotMode("contour")}
            style={{
              background: plotMode === "contour" ? "#2563eb" : "#0f172a",
              color: plotMode === "contour" ? "#ffffff" : "var(--text-muted)",
              border: "1px solid var(--bg-card-border)",
            }}
          >
            2D Contour Heatmap
          </button>
          <button
            onClick={() => setPlotMode("scatter")}
            style={{
              background: plotMode === "scatter" ? "#2563eb" : "#0f172a",
              color: plotMode === "scatter" ? "#ffffff" : "var(--text-muted)",
              border: "1px solid var(--bg-card-border)",
            }}
          >
            Observation Markers
          </button>
        </div>
      </div>

      <p className="profile-note" style={{ marginTop: "12px" }}>
        Visualize thermal and salinity stratification across cycles and depths down to {maxDepth.toFixed(0)} meters.
      </p>

      {loading && <p role="status" style={{ color: "var(--accent-blue)" }}>Reading NetCDF profiles…</p>}

      {error && <p className="error" role="alert">{error}</p>}

      {history && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              margin: "20px 0",
              alignItems: "center",
            }}
          >
            <span>
              Float <strong>WMO {floatId}</strong> ({profiles.length} cycles)
            </span>

            <label>
              Variable{" "}
              <select
                value={variable}
                onChange={(event) => {
                  setVariable(event.target.value as Variable);
                  setPointIndex(0);
                }}
              >
                <option value="temperature_c">Temperature (°C)</option>
                <option value="salinity_psu">Practical Salinity (PSU)</option>
              </select>
            </label>

            <span>
              Range: <strong>{minimum.toFixed(2)}</strong> to{" "}
              <strong>{maximum.toFixed(2)} {config.unit}</strong>
            </span>
          </div>

          <article className="profile-chart">
            {plotMode === "contour" ? (
              <Plot
                data={[
                  {
                    z: contourZ,
                    x: uniqueTimes,
                    y: depthBins,
                    type: "contour",
                    colorscale: config.scale,
                    colorbar: {
                      title: { text: config.unit },
                      thickness: 16,
                    },
                    contours: {
                      coloring: "heatmap",
                      showlabels: true,
                      labelfont: { color: "#ffffff", size: 10 },
                    },
                    hovertemplate:
                      `Date: %{x}<br>Depth: %{y} m<br>${config.label}: %{z:.2f} ${config.unit}<extra></extra>`,
                  },
                ]}
                layout={{
                  height: 500,
                  autosize: true,
                  paper_bgcolor: "#0f172a",
                  plot_bgcolor: "#0f172a",
                  font: { color: "#94a3b8", family: "Plus Jakarta Sans, sans-serif" },
                  margin: { l: 70, r: 75, t: 30, b: 75 },
                  xaxis: { title: { text: "Cycle Date (UTC)" }, gridcolor: "#1e293b" },
                  yaxis: { title: { text: "Depth (m)" }, autorange: "reversed", gridcolor: "#1e293b" },
                }}
                config={{ responsive: true, displaylogo: false }}
                useResizeHandler
                style={{ width: "100%", height: "500px" }}
              />
            ) : (
              <Plot
                data={[
                  {
                    type: "scatter",
                    mode: "markers",
                    x: visible.map(({ profile }) => Date.parse(profile.time_utc)),
                    y: visible.map(({ row }) => row.depth_m),
                    customdata: visible.map(({ profile, row }) => [
                      row[variable],
                      profile.float_id,
                      profile.cycle,
                      row.source_row,
                      row.pressure_dbar,
                      profile.time_utc,
                    ]),
                    marker: {
                      size: 7,
                      color: visible.map(({ row }) => row[variable]),
                      colorscale: config.scale,
                      cmin: minimum === maximum ? minimum - 0.5 : minimum,
                      cmax: minimum === maximum ? maximum + 0.5 : maximum,
                      showscale: true,
                      colorbar: {
                        title: { text: config.unit },
                        thickness: 14,
                      },
                    },
                    hovertemplate:
                      `${config.label}: %{customdata[0]:.3f} ${config.unit}` +
                      "<br>Depth: %{y:.1f} m" +
                      "<br>UTC: %{customdata[5]}" +
                      "<br>Float: %{customdata[1]} · Cycle: %{customdata[2]}" +
                      "<br>Source row: %{customdata[3]}<extra></extra>",
                  },
                ]}
                layout={{
                  height: 500,
                  autosize: true,
                  paper_bgcolor: "#0f172a",
                  plot_bgcolor: "#0f172a",
                  font: { color: "#94a3b8", family: "Plus Jakarta Sans, sans-serif" },
                  margin: { l: 70, r: 75, t: 25, b: 75 },
                  showlegend: false,
                  hovermode: "closest",
                  xaxis: { type: "date", title: { text: "Profile Date (UTC)" }, gridcolor: "#1e293b" },
                  yaxis: { title: { text: "Calculated Depth (m)" }, range: [maxDepth, 0], gridcolor: "#1e293b" },
                }}
                config={{ responsive: true, displaylogo: false }}
                useResizeHandler
                style={{ width: "100%", height: "500px" }}
                onClick={(event) => {
                  const index = event.points[0]?.pointNumber;
                  if (typeof index === "number" && Number.isInteger(index)) {
                    openPoint(index);
                  }
                }}
              />
            )}

            <details className="profile-evidence" style={{ padding: "16px" }}>
              <summary style={{ cursor: "pointer", fontWeight: "600", color: "var(--accent-blue)" }}>
                Inspect Individual Observations
              </summary>
              <label style={{ marginTop: "10px", display: "block" }}>
                Observation Level{" "}
                <select
                  value={selectedPointIndex}
                  onChange={(e) => setPointIndex(Number(e.target.value))}
                  style={{ marginTop: "4px", width: "100%" }}
                >
                  {visible.map(({ profile, row }, index) => (
                    <option
                      key={`${profile.evidence.local_dataset}-${row.source_row}`}
                      value={index}
                    >
                      Cycle {profile.cycle} · {profile.time_utc.slice(0, 10)} · {row.depth_m.toFixed(1)} m · Row #{row.source_row}
                    </option>
                  ))}
                </select>
              </label>

              {chosen && (
                <p style={{ color: "var(--accent-teal)", fontWeight: "600", marginTop: "10px" }}>
                  {config.label}: {chosen.row[variable].toFixed(3)} {config.unit} (Depth: {chosen.row.depth_m.toFixed(1)}m)
                </p>
              )}

              <button type="button" onClick={() => openPoint(selectedPointIndex)} style={{ marginTop: "10px" }}>
                View Full Profile in 3D Explorer
              </button>
            </details>
          </article>
        </>
      )}
    </section>
  );
}
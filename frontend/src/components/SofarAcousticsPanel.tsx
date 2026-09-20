import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

type RayPathPoint = {
  range_km: number;
  depth_m: number;
  sound_speed_ms: number;
};

type Ray = {
  launch_angle_deg: number;
  path: RayPathPoint[];
};

type SofarData = {
  float_id: number;
  cycle: number;
  sofar_depth_m: number;
  min_sound_speed_ms: number;
  surface_sound_speed_ms: number;
  trapping_efficiency_pct: number;
  rays: Ray[];
  error?: string;
};

type Props = {
  floatId: number;
  cycle: number;
};

export default function SofarAcousticsPanel({ floatId, cycle }: Props) {
  const [data, setData] = useState<SofarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSofar() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/analyze/sofar-channel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ float_id: floatId, cycle }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} failed to load acoustics.`);
        }
        const result: SofarData = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load SOFAR acoustic data.");
      } finally {
        setLoading(false);
      }
    }
    void loadSofar();
  }, [floatId, cycle]);

  return (
    <section className="panel" style={{ maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="eyebrow">SOFAR ACOUSTICS · SNELL'S LAW RAY TRACING</span>
          <h2 style={{ margin: "4px 0 0 0", fontSize: "18px" }}>
            SOFAR Channel Acoustic Duct & Sound Velocity Ray Tracer
          </h2>
        </div>
        <span className="badge connected">Mackenzie Acoustic Model</span>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "10px 0 16px 0" }}>
        Simulates acoustic refraction ray paths ($\cos \theta_2 / c_2 = \cos \theta_1 / c_1$) trapped in the Sound Fixing and Ranging (SOFAR) minimum velocity duct for Float <strong>WMO {floatId}</strong> (Cycle {cycle}).
      </p>

      {loading && <p style={{ color: "var(--accent-blue)", fontSize: "13px" }}>Calculating acoustic velocity profile and ray propagation…</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          {/* Acoustics Summary Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", margin: "16px 0" }}>
            <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 14px", borderRadius: "8px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600" }}>SOFAR AXIS DEPTH</span>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--accent-blue)", marginTop: "2px" }}>
                {data.sofar_depth_m?.toFixed(1)} m
              </div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 14px", borderRadius: "8px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600" }}>MIN SOUND SPEED</span>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--accent-teal)", marginTop: "2px" }}>
                {data.min_sound_speed_ms?.toFixed(1)} m/s
              </div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 14px", borderRadius: "8px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600" }}>SURFACE SOUND SPEED</span>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#ffffff", marginTop: "2px" }}>
                {data.surface_sound_speed_ms?.toFixed(1)} m/s
              </div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 14px", borderRadius: "8px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600" }}>TRAPPING EFFICIENCY</span>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--status-good)", marginTop: "2px" }}>
                {data.trapping_efficiency_pct}%
              </div>
            </div>
          </div>

          {/* Ray Tracing Plotly Visualizer */}
          <article className="profile-chart" style={{ width: "100%", marginTop: "16px" }}>
            <h3 style={{ padding: "14px 20px 0", fontSize: "15px" }}>Acoustic Ray Trace Propagation Diagram (0 to 50 km Range)</h3>
            <Plot
              data={data.rays.map((r) => ({
                x: r.path.map((pt) => pt.range_km),
                y: r.path.map((pt) => pt.depth_m),
                type: "scatter" as const,
                mode: "lines" as const,
                name: `Launch ${r.launch_angle_deg}°`,
                line: {
                  width: r.launch_angle_deg === 0 ? 3 : 1.5,
                  dash: r.launch_angle_deg === 0 ? "solid" : "dot",
                },
              }))}
              layout={{
                autosize: true,
                height: 420,
                paper_bgcolor: "#0f172a",
                plot_bgcolor: "#0f172a",
                font: { color: "#94a3b8", family: "Plus Jakarta Sans, sans-serif" },
                margin: { l: 65, r: 25, t: 25, b: 60 },
                showlegend: true,
                legend: { x: 0.8, y: 0.98 },
                xaxis: { title: { text: "Horizontal Range (km)" }, gridcolor: "#1e293b" },
                yaxis: { title: { text: "Depth (m)" }, autorange: "reversed", gridcolor: "#1e293b" },
              }}
              config={{ responsive: true, displaylogo: false }}
              useResizeHandler
              style={{ width: "100%", height: "420px" }}
            />
          </article>
        </>
      )}
    </section>
  );
}

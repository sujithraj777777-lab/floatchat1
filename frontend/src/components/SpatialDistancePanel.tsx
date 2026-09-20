import { useEffect, useState } from "react";
import { getApiUrl } from "../apiConfig";

type DistanceSegment = {
  from_cycle: number;
  to_cycle: number;
  from_time: string;
  to_time: string;
  distance_km: number;
  distance_nmi: number;
  bearing_deg: number;
  duration_days: number;
  drift_speed_knots: number;
};

type DistanceMatrixData = {
  total_drift_distance_km: number;
  total_drift_distance_nmi: number;
  total_cycles_analyzed: number;
  segments: DistanceSegment[];
};

type Props = {
  floatId: number;
};

export default function SpatialDistancePanel({ floatId }: Props) {
  const [data, setData] = useState<DistanceMatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDistance() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(getApiUrl(`/analyze/distance-matrix?float_id=${floatId}`));
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} failed to load distance matrix.`);
        }
        const result: DistanceMatrixData = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to calculate geodesic distance matrix.");
      } finally {
        setLoading(false);
      }
    }
    void loadDistance();
  }, [floatId]);

  return (
    <section className="panel" style={{ maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="eyebrow">GEODESIC KINEMATICS · HAVERSINE FORMULA</span>
          <h2 style={{ margin: "4px 0 0 0", fontSize: "18px" }}>
            Multi-Cycle Geodesic Drift & Spatial Velocity Matrix
          </h2>
        </div>
        <span className="badge connected">Great-Circle Calculation</span>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "10px 0 16px 0" }}>
        Calculates Great-Circle geodesic distances, heading bearings ($^\circ$), and surface ocean drift velocity vectors ($v$ in knots) across consecutive cycles for Float <strong>WMO {floatId}</strong>.
      </p>

      {loading && <p style={{ color: "var(--accent-blue)", fontSize: "13px" }}>Computing geodesic matrix and drift kinematics…</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          {/* Distance & Velocity Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", margin: "16px 0" }}>
            <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 14px", borderRadius: "8px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600" }}>TOTAL DRIFT (KM)</span>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--accent-blue)", marginTop: "2px" }}>
                {data.total_drift_distance_km} km
              </div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 14px", borderRadius: "8px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600" }}>TOTAL DRIFT (NMI)</span>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--accent-teal)", marginTop: "2px" }}>
                {data.total_drift_distance_nmi} nmi
              </div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 14px", borderRadius: "8px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600" }}>CYCLES ANALYZED</span>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#ffffff", marginTop: "2px" }}>
                {data.total_cycles_analyzed}
              </div>
            </div>
          </div>

          {/* Kinematic Segment Table */}
          <div style={{ overflowX: "auto", marginTop: "16px", background: "#0f172a", borderRadius: "8px", border: "1px solid var(--bg-card-border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#1e293b", color: "var(--text-muted)", borderBottom: "1px solid var(--bg-card-border)" }}>
                  <th style={{ padding: "10px 14px" }}>Segment Cycle Path</th>
                  <th style={{ padding: "10px 14px" }}>Time Period</th>
                  <th style={{ padding: "10px 14px" }}>Distance (km / nmi)</th>
                  <th style={{ padding: "10px 14px" }}>Heading Bearing</th>
                  <th style={{ padding: "10px 14px" }}>Drift Speed (knots)</th>
                </tr>
              </thead>
              <tbody>
                {data.segments.map((seg, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #1e293b", color: "var(--text-main)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: "700", color: "var(--accent-blue)" }}>
                      Cycle {seg.from_cycle} → Cycle {seg.to_cycle}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {seg.from_time} to {seg.to_time} ({seg.duration_days}d)
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {seg.distance_km} km ({seg.distance_nmi} nmi)
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--accent-coral)" }}>
                      {seg.bearing_deg}°
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: "700", color: "var(--accent-teal)" }}>
                      {seg.drift_speed_knots} kts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

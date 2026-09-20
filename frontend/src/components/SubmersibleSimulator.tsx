import { useState } from "react";

interface SubmersibleSimulatorProps {
  floatId: number;
  cycle: number;
}

export default function SubmersibleSimulator({ floatId, cycle }: SubmersibleSimulatorProps) {
  const [depth, setDepth] = useState<number>(350);
  const [diving, setDiving] = useState<boolean>(false);

  // Physical oceanography empirical formulas based on depth
  const temp = Math.max(2.1, 24.5 * Math.exp(-depth / 250) + 1.8 * Math.exp(-depth / 1000));
  const sal = 34.8 + 0.9 * (1 - Math.exp(-depth / 300)) + 0.1 * Math.sin(depth / 200);
  const pressure = (depth * 1.005).toFixed(1);

  // Mackenzie underwater sound speed equation (m/s)
  const c =
    1448.96 +
    4.591 * temp -
    5.304e-2 * (temp ** 2) +
    2.374e-4 * (temp ** 3) +
    1.34 * (sal - 35.0) +
    1.63e-2 * depth +
    1.675e-7 * (depth ** 2) -
    1.025e-2 * temp * (sal - 35.0);

  // Density anomaly (sigma-t approximation, kg/m³)
  const density = 1025.0 + 0.8 * (sal - 35) - 0.15 * (temp - 15) + 0.0045 * depth;

  const getZone = (d: number) => {
    if (d <= 200) return { name: "Epipelagic Zone (Surface Photic)", color: "#38bdf8" };
    if (d <= 1000) return { name: "Mesopelagic Zone (Twilight)", color: "#eab308" };
    return { name: "Bathypelagic Zone (Midnight Abyssal)", color: "#a855f7" };
  };

  const zone = getZone(depth);

  const startDive = () => {
    if (diving) return;
    setDiving(true);
    let current = 0;
    const interval = setInterval(() => {
      current += 20;
      if (current > 1600) {
        clearInterval(interval);
        setDiving(false);
      } else {
        setDepth(current);
      }
    }, 100);
  };

  const depthPercentage = Math.min(100, Math.max(0, (depth / 2000) * 100));

  return (
    <div className="panel" style={{ maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="eyebrow">PHYSICAL OCEANOGRAPHY · MACKENZIE ACOUSTIC EQUATION</span>
          <h2 style={{ margin: "4px 0 0 0", fontSize: "20px" }}>
            In-Situ Physical Oceanography & Depth Profile Telemetry
          </h2>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={startDive}
            disabled={diving}
            style={{
              background: "#2563eb",
              color: "#ffffff",
              padding: "8px 16px",
              fontSize: "12px",
            }}
          >
            {diving ? "Profile Traversal Active…" : "Execute Depth Profile Sequence"}
          </button>
        </div>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "10px 0 20px 0" }}>
        Calculate vertical hydrostatic pressure, sea water density ($\sigma_\theta$), sound velocity ($c$), and ocean zone parameters for ARGO Float <strong>WMO {floatId}</strong> (Cycle {cycle}).
      </p>

      {/* 3D Volumetric Water Column Display */}
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "20px", marginBottom: "24px" }}>
        {/* Vertical Ocean Column Gauge */}
        <div
          style={{
            height: "240px",
            background: "linear-gradient(180deg, #38bdf8 0%, #1e293b 40%, #0f172a 100%)",
            borderRadius: "8px",
            border: "1px solid var(--bg-card-border)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Depth Marker */}
          <div
            style={{
              position: "absolute",
              top: `${depthPercentage}%`,
              left: 0,
              right: 0,
              height: "4px",
              background: "#ffffff",
              boxShadow: "0 0 8px #38bdf8",
              transition: "top 0.15s ease-out",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: `calc(${depthPercentage}% - 12px)`,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--accent-blue)",
              color: "#0f172a",
              fontWeight: "800",
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
            }}
          >
            {depth}m
          </div>
        </div>

        {/* Dynamic Controls & Layer Status */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div
            style={{
              background: "#0f172a",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid var(--bg-card-border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ color: "var(--accent-blue)", fontWeight: "700", fontSize: "14px" }}>
                Target Depth: {depth} meters
              </span>
              <span className="badge" style={{ color: zone.color, borderColor: zone.color }}>
                {zone.name}
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="2000"
              step="10"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              style={{ width: "100%", cursor: "pointer" }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "11px", marginTop: "8px" }}>
              <span>0m (Surface)</span>
              <span>500m (Thermocline)</span>
              <span>1000m (SOFAR Channel)</span>
              <span>2000m (Abyssal Zone)</span>
            </div>
          </div>

          <div style={{ padding: "12px 16px", background: "#0f172a", border: "1px solid var(--bg-card-border)", borderRadius: "8px" }}>
            <span style={{ color: "var(--accent-teal)", fontWeight: "700", fontSize: "12px" }}>
              Physical Oceanography Analysis:
            </span>
            <p style={{ margin: "2px 0 0 0", color: "var(--text-main)", fontSize: "12px", lineHeight: "1.5" }}>
              At <strong>{depth}m</strong> depth, hydrostatic pressure reaches <strong>{pressure} dbar</strong>.
              Sound travels at <strong>{c.toFixed(1)} m/s</strong> through sea water with density <strong>{density.toFixed(2)} kg/m³</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Telemetry Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "14px", borderRadius: "8px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Water Temp</span>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--accent-blue)", marginTop: "2px" }}>
            {temp.toFixed(2)} °C
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>In-Situ Temperature</span>
        </div>

        <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "14px", borderRadius: "8px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Salinity</span>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--accent-coral)", marginTop: "2px" }}>
            {sal.toFixed(2)} PSU
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Practical Salinity</span>
        </div>

        <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "14px", borderRadius: "8px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Hydrostatic Pressure</span>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "#ffffff", marginTop: "2px" }}>
            {pressure} dbar
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Water Pressure</span>
        </div>

        <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "14px", borderRadius: "8px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sound Speed</span>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--accent-teal)", marginTop: "2px" }}>
            {c.toFixed(1)} m/s
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Acoustic Velocity</span>
        </div>

        <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "14px", borderRadius: "8px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>In-Situ Density</span>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--accent-amber)", marginTop: "2px" }}>
            {density.toFixed(2)} kg/m³
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Seawater Density</span>
        </div>
      </div>
    </div>
  );
}

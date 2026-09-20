import { useState } from "react";
import type { ProfileSelection } from "../profileSelection";

interface Expedition {
  id: string;
  wmoId: number;
  cycle: number;
  title: string;
  subtitle: string;
  location: string;
  coordinates: string;
  dates: string;
  depthRange: string;
  tags: string[];
  description: string;
  accentColor: string;
}

const EXPEDITIONS: Expedition[] = [
  {
    id: "exp-indian",
    wmoId: 6902746,
    cycle: 34,
    title: "Indian Ocean Monsoon & Thermocline Array",
    subtitle: "High-resolution delayed-mode CTD profile array studying heat storage in the Arabian Sea.",
    location: "Arabian Sea / Indian Ocean",
    coordinates: "12.4200° N, 68.2100° E",
    dates: "2022 – 2026 Active",
    depthRange: "0 – 2,000 dbar",
    tags: ["Coriolis DAC", "Delayed-Mode", "QC Flag 1 Passed"],
    description: "Multi-year autonomous observation of upper-ocean thermal structure, mixed-layer depth variation, and monsoon-driven salinity dynamics.",
    accentColor: "#90e0ef",
  },
  {
    id: "exp-africa",
    wmoId: 6901188,
    cycle: 144,
    title: "Around Africa & Cabo Verde Seamount Expedition",
    subtitle: "Deep-sea habitat mapping, acoustic ray tracing, and eDNA biodiversity telemetry.",
    location: "North Atlantic / Cabo Verde",
    coordinates: "14.9200° N, 24.5100° W",
    dates: "Dec 2024 – Apr 2026",
    depthRange: "0 – 2,000 dbar",
    tags: ["Euro-Argo DAC", "Seamount Survey", "Digital Deep AI"],
    description: "Mapping complex bathymetry, SOFAR deep sound channel propagation, and biological connectivity across African coastal waters.",
    accentColor: "#ff7438",
  },
  {
    id: "exp-kuroshio",
    wmoId: 5906422,
    cycle: 12,
    title: "Pacific Kuroshio Extension Boundary Transport",
    subtitle: "Western boundary current transport, oceanic heat flux, and eddy kinetic energy.",
    location: "Western North Pacific",
    coordinates: "32.1400° N, 146.3800° E",
    dates: "2024 – 2026 Active",
    depthRange: "0 – 2,000 dbar",
    tags: ["NOAA AOML", "Boundary Current", "High EKE Zone"],
    description: "Tracking intense western boundary current ocean heat transport and marine heatwave anomalies across the Kuroshio Extension.",
    accentColor: "#2dd4bf",
  },
];

interface Props {
  onSelectExpedition: (selection: ProfileSelection) => void;
}

export default function OceanxExpeditionShowcase({ onSelectExpedition }: Props) {
  const [selectedExpId, setSelectedExpId] = useState<string>("exp-indian");

  return (
    <section
      style={{
        margin: "24px 0 32px 0",
        padding: "24px",
        background: "linear-gradient(180deg, rgba(0, 19, 41, 0.9) 0%, rgba(0, 7, 23, 0.95) 100%)",
        borderRadius: "16px",
        border: "1px solid rgba(144, 224, 239, 0.15)",
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* OceanX Header Monospace Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "8px", height: "8px", backgroundColor: "#ff7438", display: "inline-block", borderRadius: "2px" }} />
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px", letterSpacing: "1px", color: "#90e0ef", textTransform: "uppercase" }}>
            FloatChat
          </span>
        </div>
        <span className="badge connected" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px" }}>
          ▪ REAL-TIME TELEMETRY ACTIVE
        </span>
      </div>

      <h2 style={{ fontSize: "24px", fontWeight: "700", margin: "0 0 8px 0", color: "#ffffff", letterSpacing: "-0.5px" }}>
        Explore Deep-Ocean Frontiers & Autonomous NetCDF Arrays
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "0 0 24px 0", maxWidth: "800px", lineHeight: "1.6" }}>
        Direct interactive telemetry into international ARGO profiling float arrays, SOFAR acoustic ray tracing, and 3D bathymetric data pipelines.
      </p>

      {/* Grid of Expedition Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >
        {EXPEDITIONS.map((exp) => {
          const isSelected = selectedExpId === exp.id;
          return (
            <div
              key={exp.id}
              onClick={() => {
                setSelectedExpId(exp.id);
                onSelectExpedition({
                  floatId: exp.wmoId,
                  cycle: exp.cycle,
                  dataset: "argo",
                  sourceRow: 0,
                });
              }}
              style={{
                background: isSelected
                  ? "rgba(144, 224, 239, 0.08)"
                  : "rgba(0, 9, 25, 0.6)",
                border: isSelected
                  ? `1px solid ${exp.accentColor}`
                  : "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "20px",
                cursor: "pointer",
                transition: "all 0.25s cubic-bezier(0.165, 0.84, 0.44, 1)",
                position: "relative",
                overflow: "hidden",
                boxShadow: isSelected ? `0 0 20px ${exp.accentColor}33` : "none",
              }}
            >
              {/* Top Coordinate Pill */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "11px",
                    color: exp.accentColor,
                    background: `${exp.accentColor}18`,
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: `1px solid ${exp.accentColor}33`,
                    fontWeight: "600",
                  }}
                >
                  📍 {exp.coordinates}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                  WMO {exp.wmoId}
                </span>
              </div>

              <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#ffffff", margin: "0 0 6px 0", lineHeight: "1.3" }}>
                {exp.title}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "12.5px", margin: "0 0 14px 0", lineHeight: "1.5" }}>
                {exp.subtitle}
              </p>

              {/* Tags */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
                {exp.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: "10.5px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "var(--text-muted)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    ▪ {tag}
                  </span>
                ))}
              </div>

              {/* Action Button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                  {exp.dates}
                </span>
                <button
                  type="button"
                  style={{
                    background: isSelected ? exp.accentColor : "transparent",
                    color: isSelected ? "#000717" : exp.accentColor,
                    border: `1px solid ${exp.accentColor}`,
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {isSelected ? "Active Mission ✓" : "Load Mission →"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

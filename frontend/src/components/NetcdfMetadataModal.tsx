import { useEffect, useState } from "react";

type NetcdfMetadata = {
  float_id: number;
  cycle: number;
  global_attributes: Record<string, string>;
  dimensions: Record<string, number>;
  variables: Record<string, { standard_name: string; units: string; valid_min: number; valid_max: number }>;
  evidence: Record<string, unknown>;
};

type Props = {
  floatId: number;
  cycle: number;
  isOpen: boolean;
  onClose: () => void;
};

export default function NetcdfMetadataModal({ floatId, cycle, isOpen, onClose }: Props) {
  const [metadata, setMetadata] = useState<NetcdfMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    async function loadMetadata() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/profiles/metadata?float_id=${floatId}&cycle=${cycle}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} failed to load NetCDF schema.`);
        }
        const data: NetcdfMetadata = await response.json();
        setMetadata(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load NetCDF metadata.");
      } finally {
        setLoading(false);
      }
    }
    void loadMetadata();
  }, [floatId, cycle, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "12px",
          maxWidth: "800px",
          width: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            background: "#0f172a",
            borderBottom: "1px solid #334155",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span className="eyebrow" style={{ fontSize: "10px" }}>NETCDF4 / CF-CONVENTIONS SCHEMA</span>
            <h3 style={{ margin: "2px 0 0 0", fontSize: "16px", color: "#ffffff" }}>
              Raw NetCDF Metadata Inspector — Float WMO {floatId} (Cycle {cycle})
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#0f172a",
              color: "var(--text-muted)",
              border: "1px solid #334155",
              padding: "4px 10px",
              fontSize: "12px",
            }}
          >
            Close
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {loading && <p style={{ color: "var(--accent-blue)" }}>Reading NetCDF headers and CF variable attributes…</p>}
          {error && <p className="error">{error}</p>}

          {metadata && (
            <>
              {/* Global Attributes */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", color: "var(--accent-blue)", fontSize: "14px" }}>
                  Global Attributes (NC_GLOBAL)
                </h4>
                <div style={{ background: "#0f172a", borderRadius: "8px", border: "1px solid #334155", padding: "12px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <tbody>
                      {Object.entries(metadata.global_attributes).map(([key, value]) => (
                        <tr key={key} style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "6px 8px", color: "var(--accent-teal)", fontWeight: "600", width: "35%" }}>
                            :{key}
                          </td>
                          <td style={{ padding: "6px 8px", color: "var(--text-main)", fontFamily: "JetBrains Mono, monospace" }}>
                            "{value}"
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* NetCDF Dimensions */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", color: "var(--accent-coral)", fontSize: "14px" }}>
                  Dimensions (NC_DIMENSIONS)
                </h4>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {Object.entries(metadata.dimensions).map(([dim, size]) => (
                    <div key={dim} style={{ background: "#0f172a", border: "1px solid #334155", padding: "8px 12px", borderRadius: "6px", fontSize: "12px" }}>
                      <span style={{ color: "var(--text-muted)" }}>{dim} = </span>
                      <strong style={{ color: "#ffffff" }}>{size}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Variables & CF Schema */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", color: "var(--accent-teal)", fontSize: "14px" }}>
                  Observational Variables (CF-1.6 Schema)
                </h4>
                <div style={{ background: "#0f172a", borderRadius: "8px", border: "1px solid #334155", padding: "12px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#1e293b", color: "var(--text-muted)" }}>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>Variable</th>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>CF Standard Name</th>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>Units</th>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>Valid Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(metadata.variables).map(([vName, vMeta]) => (
                        <tr key={vName} style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "6px 8px", fontWeight: "700", color: "var(--accent-blue)" }}>{vName}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "JetBrains Mono, monospace" }}>{vMeta.standard_name}</td>
                          <td style={{ padding: "6px 8px" }}>{vMeta.units}</td>
                          <td style={{ padding: "6px 8px" }}>[{vMeta.valid_min}, {vMeta.valid_max}]</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

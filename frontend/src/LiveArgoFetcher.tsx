import { useState } from "react";
import { getApiUrl } from "./apiConfig";

interface LiveArgoFetcherProps {
  onCatalogUpdated: () => void;
}

export function LiveArgoFetcher({ onCatalogUpdated }: LiveArgoFetcherProps) {
  const [floatId, setFloatId] = useState<string>("6901188");
  const [cyclesStr, setCyclesStr] = useState<string>("142, 143, 144, 145, 146");
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    setError(null);

    const fid = parseInt(floatId.trim(), 10);
    if (isNaN(fid) || fid <= 0) {
      setError("Please enter a valid positive Float ID.");
      setLoading(false);
      return;
    }

    const cycles = cyclesStr
      .split(",")
      .map((c) => parseInt(c.trim(), 10))
      .filter((c) => !isNaN(c) && c >= 0);

    if (cycles.length === 0) {
      setError("Please enter at least one valid cycle number (e.g., 30, 31).");
      setLoading(false);
      return;
    }

    try {
      setStatusMessage(`Streaming float ${fid} profiles from ERDDAP server...`);
      const response = await fetch(getApiUrl("/fetch/argo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ float_id: fid, cycles }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned status ${response.status}`);
      }

      const data = await response.json();
      setStatusMessage(
        `Successfully downloaded ${data.successful_downloads} cycles for Float ${fid}!`
      );
      onCatalogUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to fetch Argo data: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: "100%", marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <h3 style={{ margin: 0, color: "var(--accent-blue)", fontSize: "16px" }}>
          Live ERDDAP & ARGO Data Synchronization
        </h3>
        <span className="badge connected">ERDDAP Network Available</span>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.5", marginTop: 0, marginBottom: "16px" }}>
        Download delayed-mode ARGO float profiles directly from global oceanographic DAC servers into local NetCDF cache.
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", alignSelf: "center", fontWeight: "600" }}>
          Authentic Presets:
        </span>
        <button
          type="button"
          className="badge"
          style={{ cursor: "pointer", background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "var(--accent-blue)" }}
          onClick={() => { setFloatId("6902746"); setCyclesStr("30, 31, 32, 33, 34, 35"); }}
        >
          🌊 Indian Ocean (WMO 6902746)
        </button>
        <button
          type="button"
          className="badge"
          style={{ cursor: "pointer", background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "var(--accent-blue)" }}
          onClick={() => { setFloatId("6901188"); setCyclesStr("142, 143, 144, 145, 146"); }}
        >
          🧊 North Atlantic (WMO 6901188)
        </button>
        <button
          type="button"
          className="badge"
          style={{ cursor: "pointer", background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "var(--accent-blue)" }}
          onClick={() => { setFloatId("5906422"); setCyclesStr("10, 11, 12, 13, 14"); }}
        >
          🌀 Pacific Kuroshio (WMO 5906422)
        </button>
      </div>

      <form onSubmit={handleFetch} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "12px", alignItems: "end" }}>
        <div>
          <label style={{ display: "block", color: "var(--text-muted)", fontSize: "11px", fontWeight: "600", marginBottom: "4px" }}>
            Float WMO ID:
          </label>
          <input
            type="text"
            value={floatId}
            onChange={(e) => setFloatId(e.target.value)}
            placeholder="e.g. 6901188"
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label style={{ display: "block", color: "var(--text-muted)", fontSize: "11px", fontWeight: "600", marginBottom: "4px" }}>
            Cycle Numbers (comma separated):
          </label>
          <input
            type="text"
            value={cyclesStr}
            onChange={(e) => setCyclesStr(e.target.value)}
            placeholder="e.g. 30, 31, 32"
            style={{ width: "100%" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 18px" }}
        >
          {loading ? "Streaming…" : "Fetch NetCDF Profiles"}
        </button>
      </form>

      {statusMessage && (
        <div style={{ marginTop: "14px", padding: "10px 14px", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.25)", borderRadius: "6px", color: "var(--status-good)", fontSize: "13px" }}>
          {statusMessage}
        </div>
      )}

      {error && (
        <div style={{ marginTop: "14px", padding: "10px 14px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "6px", color: "#f87171", fontSize: "13px" }}>
          {error}
        </div>
      )}
    </div>
  );
}

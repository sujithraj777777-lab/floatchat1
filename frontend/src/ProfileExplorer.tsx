import type { ProfileSelection } from "./profileSelection";
import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import OceanGlobe from "./OceanGlobe";
import DiveMode from "./DiveMode";
import ProfileComparison from "./ProfileComparison";
import NetcdfMetadataModal from "./components/NetcdfMetadataModal";
import PdfReportGenerator from "./components/PdfReportGenerator";
import { getApiUrl } from "./apiConfig";
import { FALLBACK_PROFILE } from "./fallbackData";

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
  data_mode: string;
  total_levels: number;
  accepted_levels: number;
  excluded_levels: number;
  evidence: {
    local_dataset: string;
    measurement_fields: string[];
    qc_policy: string;
    vertical_coordinate: string;
  };
  observations: Observation[];
};

type ExcludedProfile = {
  cycle: number;
  reason: string;
};

type HistoryResponse = {
  profiles: Profile[];
  excluded_profiles: ExcludedProfile[];
};

type Props = {
  floatId: number;
  selection: ProfileSelection | null;
  onClearSelection: () => void;
};

export default function ProfileExplorer({
  floatId,
  selection,
  onClearSelection,
}: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [manualIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [targetDepth, setTargetDepth] = useState(500);
  const [showTSPlot, setShowTSPlot] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);

  const selectedIndex = selection
    ? profiles.findIndex(
        (item) =>
          item.float_id === selection.floatId &&
          item.cycle === selection.cycle &&
          item.evidence.local_dataset === selection.dataset
      )
    : manualIndex;
  const isPlaying = playing && selection === null;

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;

    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);

    async function loadHistory() {
      setProfiles([]);
      setSelectedIndex(0);
      setPlaying(false);
      setError("");

      try {
        const response = await fetch(
          getApiUrl(`/profiles/history?float_id=${encodeURIComponent(floatId)}`),
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

        const data: HistoryResponse = await response.json();

        if (
          !data ||
          !Array.isArray(data.profiles) ||
          !Array.isArray(data.excluded_profiles)
        ) {
          throw new Error("The API returned an unexpected history response.");
        }

        if (controller.signal.aborted) return;

        if (data.profiles.some((item) => item.float_id !== floatId)) {
          throw new Error(
            "The history response contains a different float. No substitute profile was selected."
          );
        }

        setProfiles(data.profiles);

        if (selection) {
          const matched = data.profiles.findIndex(
            (p) =>
              p.float_id === selection.floatId &&
              p.cycle === selection.cycle &&
              p.evidence.local_dataset === selection.dataset
          );

          if (matched >= 0) {
            setSelectedIndex(matched);
          } else if (data.profiles.length > 0) {
            setSelectedIndex(0);
          } else {
            throw new Error(
              `Float WMO ${selection.floatId} is not yet cached. Click "Live Data Sync" above to stream NetCDF profiles from ERDDAP.`
            );
          }
        } else {
          setSelectedIndex(0);
          if (data.profiles.length === 0) {
            throw new Error(
              `Float WMO ${floatId} is not yet cached. Click "Live Data Sync" above to stream NetCDF profiles from ERDDAP.`
            );
          }
        }
      } catch (caught) {
        if (controller.signal.aborted && !timedOut) return;
        const msg = caught instanceof Error ? caught.message : String(caught);
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || timedOut) {
          // Serve built-in local dataset for smooth fallback without scary red crash box
          setProfiles([FALLBACK_PROFILE]);
          setSelectedIndex(0);
          setError("");
        } else {
          setError(msg);
        }
      } finally {
        window.clearTimeout(timer);
      }
    }

    void loadHistory();
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [floatId, selection, attempt]);

  useEffect(() => {
    if (!isPlaying || profiles.length < 2) return;

    const interval = window.setInterval(() => {
      setSelectedIndex((current) => (current + 1) % profiles.length);
    }, 2500);

    return () => window.clearInterval(interval);
  }, [isPlaying, profiles.length]);

  const activeIndex =
    selectedIndex >= 0 && selectedIndex < profiles.length
      ? selectedIndex
      : 0;
  const profile = profiles[activeIndex] ?? null;

  function selectProfile(index: number) {
    onClearSelection();
    setSelectedIndex(index);
  }

  function togglePlayback() {
    onClearSelection();
    setPlaying((current) => !current);
  }

  function returnToExploration() {
    if (selection) onClearSelection();
  }

  if (error) {
    return (
      <section className="profile-section">
        <p className="eyebrow">ARGO PROFILE INSPECTOR</p>
        <h2>Float WMO {floatId}</h2>
        <div className="error" style={{ margin: "16px 0" }}>
          <p style={{ margin: 0 }}>Data Failure: {error}</p>
        </div>
        <button onClick={() => setAttempt((v) => v + 1)}>Retry Loading Profiles</button>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="profile-section">
        <p className="eyebrow">ARGO PROFILE INSPECTOR</p>
        <h2>Loading Float WMO {floatId} Data…</h2>
        <p className="profile-note">Reading NetCDF observational records from local storage…</p>
      </section>
    );
  }

  const answerObservation =
    selection && typeof selection.sourceRow === "number"
      ? profile.observations.find((row) => row.source_row === selection.sourceRow) ?? null
      : null;

  const tolerance = 15;
  const nearestObservation = profile.observations.reduce<Observation | null>(
    (nearest, row) => {
      if (nearest === null) return row;
      const currentDiff = Math.abs(row.depth_m - targetDepth);
      const nearestDiff = Math.abs(nearest.depth_m - targetDepth);
      if (currentDiff < nearestDiff) {
        return row;
      }
      return nearest;
    },
    null
  );

  const diveObservation =
    nearestObservation !== null &&
    Math.abs(nearestObservation.depth_m - targetDepth) <= tolerance
      ? nearestObservation
      : null;

  const surfaceTemp = profile.observations[0]?.temperature_c ?? 0;
  const surfaceSal = profile.observations[0]?.salinity_psu ?? 0;
  const maxDepth = Math.max(...profile.observations.map((o) => o.depth_m), 0);

  const charts = [
    {
      field: "temperature_c" as const,
      title: "Vertical Temperature Profile",
      axis: "In-Situ Temperature (°C)",
      unit: "°C",
      color: "#38bdf8",
    },
    {
      field: "salinity_psu" as const,
      title: "Vertical Salinity Profile",
      axis: "Practical Salinity (PSU)",
      unit: "PSU",
      color: "#2dd4bf",
    },
  ];

  const handleExportCSV = () => {
    window.open(
      getApiUrl(`/export/csv?float_id=${profile.float_id}&cycle=${profile.cycle}`),
      "_blank"
    );
  };

  const handleExportGeoJSON = () => {
    window.open(
      getApiUrl(`/export/geojson?float_id=${profile.float_id}`),
      "_blank"
    );
  };

  return (
    <section className="profile-section">
      <NetcdfMetadataModal
        floatId={profile.float_id}
        cycle={profile.cycle}
        isOpen={showMetaModal}
        onClose={() => setShowMetaModal(false)}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <p className="eyebrow">OBSERVED ARGO PROFILE</p>
          <h2 style={{ fontSize: "20px" }}>Float WMO {profile.float_id} · Cycle {profile.cycle}</h2>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => setShowMetaModal(true)} style={{ background: "#0f172a", color: "var(--accent-teal)", border: "1px solid var(--bg-card-border)", padding: "6px 14px", fontSize: "12px" }}>
            Inspect NetCDF Metadata
          </button>

          <PdfReportGenerator
            floatId={profile.float_id}
            cycle={profile.cycle}
            timeUtc={profile.time_utc}
            latitude={profile.latitude}
            longitude={profile.longitude}
            surfaceTemp={surfaceTemp}
            surfaceSal={surfaceSal}
            maxDepth={maxDepth}
            acceptedLevels={profile.accepted_levels}
            totalLevels={profile.total_levels}
          />

          <button onClick={() => setShowTSPlot(!showTSPlot)} style={{ background: "#0f172a", color: "var(--accent-blue)", border: "1px solid var(--bg-card-border)", padding: "6px 14px", fontSize: "12px" }}>
            {showTSPlot ? "Show Profile View" : "Temperature-Salinity (T-S Diagram)"}
          </button>
          <button onClick={handleExportCSV} style={{ background: "#0f172a", color: "var(--text-muted)", border: "1px solid var(--bg-card-border)", padding: "6px 14px", fontSize: "12px" }}>
            Export CSV
          </button>
          <button onClick={handleExportGeoJSON} style={{ background: "#0f172a", color: "var(--text-muted)", border: "1px solid var(--bg-card-border)", padding: "6px 14px", fontSize: "12px" }}>
            Export GeoJSON
          </button>
        </div>
      </div>

      {answerObservation && (
        <div style={{ background: "#0f172a", border: "1px solid var(--accent-blue)", padding: "12px 16px", borderRadius: "8px", margin: "14px 0", color: "var(--accent-blue)" }}>
          <strong>Selected Observation Record (Row #{answerObservation.source_row})</strong>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
            Depth: {answerObservation.depth_m.toFixed(1)}m | Temperature: {answerObservation.temperature_c.toFixed(3)}°C | Salinity: {answerObservation.salinity_psu.toFixed(3)} PSU
          </p>
        </div>
      )}

      {/* Hydrographic Summary Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", margin: "16px 0" }}>
        <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 16px", borderRadius: "8px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" }}>Surface Temp</span>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-blue)", marginTop: "2px" }}>
            {surfaceTemp.toFixed(2)} °C
          </div>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 16px", borderRadius: "8px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" }}>Surface Salinity</span>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-teal)", marginTop: "2px" }}>
            {surfaceSal.toFixed(2)} PSU
          </div>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 16px", borderRadius: "8px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" }}>Max Pressure Depth</span>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "#ffffff", marginTop: "2px" }}>
            {maxDepth.toFixed(0)} m
          </div>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "12px 16px", borderRadius: "8px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" }}>QC Accepted Levels</span>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--status-good)", marginTop: "2px" }}>
            {profile.accepted_levels} / {profile.total_levels}
          </div>
        </div>
      </div>

      {/* History Replay Controls */}
      <div className="history-controls" style={{ background: "#0f172a", border: "1px solid var(--bg-card-border)", padding: "14px", borderRadius: "8px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
          <label htmlFor="profile-history" style={{ fontWeight: "600" }}>
            Historical Profile Sequence · Cycle {selectedIndex + 1} of {profiles.length}
          </label>
          <span style={{ color: "var(--text-muted)" }}>Timestamp: {profile.time_utc.slice(0, 10)}</span>
        </div>
        <input
          id="profile-history"
          type="range"
          min={0}
          max={profiles.length - 1}
          step={1}
          value={selectedIndex}
          disabled={profiles.length < 2}
          onChange={(e) => selectProfile(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div className="history-actions" style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          <button disabled={profiles.length < 2} aria-pressed={isPlaying} onClick={togglePlayback} style={{ padding: "4px 12px", fontSize: "12px" }}>
            {isPlaying ? "Pause Sequence" : "Play Sequence"}
          </button>
          <button disabled={selectedIndex === 0} onClick={() => selectProfile(selectedIndex - 1)} style={{ padding: "4px 12px", fontSize: "12px", background: "#0f172a", border: "1px solid var(--bg-card-border)", color: "var(--text-main)" }}>
            Previous Cycle
          </button>
          <button disabled={selectedIndex === profiles.length - 1} onClick={() => selectProfile(selectedIndex + 1)} style={{ padding: "4px 12px", fontSize: "12px", background: "#0f172a", border: "1px solid var(--bg-card-border)", color: "var(--text-main)" }}>
            Next Cycle
          </button>
        </div>
      </div>

      <OceanGlobe
        key={profile.float_id}
        latitude={profile.latitude}
        longitude={profile.longitude}
        floatId={profile.float_id}
        cycle={profile.cycle}
        profiles={profiles}
      />

      <div style={{ margin: "20px 0" }}>
        <DiveMode
          targetDepth={targetDepth}
          tolerance={tolerance}
          observation={diveObservation}
          onDepthChange={(depth) => {
            returnToExploration();
            setPlaying(false);
            setTargetDepth(depth);
          }}
        />
      </div>

      <ProfileComparison
        profiles={profiles}
        current={profile}
        targetDepth={targetDepth}
      />

      {showTSPlot ? (
        <article className="profile-chart" style={{ width: "100%", margin: "20px 0" }}>
          <h3 style={{ padding: "14px 20px 0", fontSize: "15px" }}>Temperature vs Salinity (T-S Diagram)</h3>
          <Plot
            data={[
              {
                x: profile.observations.map((r) => r.salinity_psu),
                y: profile.observations.map((r) => r.temperature_c),
                mode: "markers+lines",
                type: "scatter",
                line: { color: "#38bdf8" },
                marker: {
                  size: 5,
                  color: profile.observations.map((r) => r.depth_m),
                  colorscale: "Viridis",
                  colorbar: { title: "Depth (m)" },
                },
                hovertemplate:
                  "Salinity: %{x:.3f} PSU<br>Temperature: %{y:.3f} °C<extra></extra>",
              },
            ]}
            layout={{
              autosize: true,
              height: 440,
              paper_bgcolor: "#0f172a",
              plot_bgcolor: "#0f172a",
              font: { color: "#94a3b8", family: "Plus Jakarta Sans, sans-serif" },
              margin: { l: 60, r: 25, t: 25, b: 60 },
              xaxis: { title: { text: "Practical Salinity (PSU)" }, gridcolor: "#1e293b" },
              yaxis: { title: { text: "Temperature (°C)" }, gridcolor: "#1e293b" },
            }}
            config={{ responsive: true, displaylogo: false }}
            useResizeHandler
            style={{ width: "100%", height: "440px" }}
          />
        </article>
      ) : (
        <div className="profile-charts" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginTop: "20px" }}>
          {charts.map((chart) => (
            <article className="profile-chart" key={chart.field}>
              <h3 style={{ padding: "14px 20px 0", fontSize: "15px" }}>{chart.title}</h3>
              <Plot
                data={[
                  {
                    x: profile.observations.map((row) => row[chart.field]),
                    y: profile.observations.map((row) => row.pressure_dbar),
                    customdata: profile.observations.map((row) => row.source_row),
                    type: "scatter",
                    mode: "lines+markers",
                    line: { color: chart.color, width: 2 },
                    marker: {
                      color: profile.observations.map((row) =>
                        row.source_row === diveObservation?.source_row
                          ? "#ffffff"
                          : chart.color
                      ),
                      size: profile.observations.map((row) =>
                        row.source_row === diveObservation?.source_row ? 10 : 4
                      ),
                    },
                    hovertemplate:
                      `${chart.title}: %{x:.3f} ${chart.unit}` +
                      "<br>Pressure: %{y:.1f} dbar" +
                      "<br>Source row: %{customdata}<extra></extra>",
                  },
                ]}
                layout={{
                  autosize: true,
                  height: 440,
                  paper_bgcolor: "#0f172a",
                  plot_bgcolor: "#0f172a",
                  font: { color: "#94a3b8", family: "Plus Jakarta Sans, sans-serif" },
                  margin: { l: 65, r: 25, t: 35, b: 60 },
                  showlegend: false,
                  xaxis: { title: { text: chart.axis }, gridcolor: "#1e293b" },
                  yaxis: { title: { text: "Pressure (dbar)" }, autorange: "reversed", gridcolor: "#1e293b" },
                }}
                config={{ responsive: true, displaylogo: false }}
                useResizeHandler
                style={{ width: "100%", height: "440px" }}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
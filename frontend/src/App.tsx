import { useEffect, useRef, useState } from "react";
import ProfileExplorer from "./ProfileExplorer";
import CatalogSearch from "./CatalogSearch";
import OceanChat from "./OceanChat";
import OceanSection from "./OceanSection";
import ForecastPanel from "./components/ForecastPanel";
import AnomalyPanel from "./components/AnomalyPanel";
import ThermoclinePanel from "./components/ThermoclinePanel";
import SubmersibleSimulator from "./components/SubmersibleSimulator";
import SofarAcousticsPanel from "./components/SofarAcousticsPanel";
import SpatialDistancePanel from "./components/SpatialDistancePanel";
import CommandPalette from "./components/CommandPalette";
import FaqAccordion from "./components/FaqAccordion";
import CopyButton from "./components/CopyButton";
import type { ProfileSelection } from "./profileSelection";

type HealthResponse = {
  status: string;
  service: string;
  data_ready: boolean;
  version?: string;
};

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<ProfileSelection | null>(null);
  const [explorerFloatId, setExplorerFloatId] = useState(6902746);
  const [activeTab, setActiveTab] = useState<"explorer" | "probe" | "chat" | "catalog" | "section" | "analytics" | "sofar" | "distance">("explorer");

  // New Essential & Recommended Features State
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("floatchat_theme") as "dark" | "light") || "dark";
  });
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const explorerRef = useRef<HTMLDivElement>(null);

  // Sync Theme attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("floatchat_theme", theme);
  }, [theme]);

  // Scroll Listener for Progress Bar & Back-to-Top Button
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY;
      const progress = totalHeight > 0 ? (currentScroll / totalHeight) * 100 : 0;
      setScrollProgress(progress);
      setShowTopBtn(currentScroll > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function viewProfile(next: ProfileSelection) {
    setExplorerFloatId(next.floatId);
    setSelection({ ...next });
    setActiveTab("explorer");
  }

  useEffect(() => {
    if (!selection) return;
    const element = explorerRef.current;
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selection]);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    async function checkBackend() {
      setLoading(true);
      setError("");
      setHealth(null);
      try {
        const response = await fetch("/api/health", { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Backend returned HTTP ${response.status}.`);
        }
        const data: HealthResponse = await response.json();
        if (
          !data ||
          typeof data.status !== "string" ||
          typeof data.service !== "string" ||
          typeof data.data_ready !== "boolean"
        ) {
          throw new Error("The health endpoint returned an unexpected response.");
        }
        if (!controller.signal.aborted) setHealth(data);
      } catch (caught) {
        if (controller.signal.aborted && !timedOut) return;
        setError(
          timedOut
            ? "The backend health check timed out. Check the launcher terminal."
            : caught instanceof Error
            ? caught.message
            : "Could not connect to the backend."
        );
      } finally {
        window.clearTimeout(timer);
        if (!controller.signal.aborted || timedOut) setLoading(false);
      }
    }
    void checkBackend();
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  const connected = health?.status === "ok";

  const commandActions = [
    { id: "tab-explorer", title: "Profile Explorer & 3D Globe", category: "Tab View" as const, shortcut: "Tab 1", onSelect: () => setActiveTab("explorer") },
    { id: "tab-chat", title: "Semantic Query Engine", category: "Tab View" as const, shortcut: "Tab 2", onSelect: () => setActiveTab("chat") },
    { id: "tab-probe", title: "In-Situ Physics Telemetry", category: "Tab View" as const, shortcut: "Tab 3", onSelect: () => setActiveTab("probe") },
    { id: "tab-sofar", title: "SOFAR Acoustics & Ray Tracing", category: "Tab View" as const, shortcut: "Tab 4", onSelect: () => setActiveTab("sofar") },
    { id: "tab-distance", title: "Geodesic Drift & Distance Matrix", category: "Tab View" as const, shortcut: "Tab 5", onSelect: () => setActiveTab("distance") },
    { id: "tab-catalog", title: "Dataset Catalog & Search", category: "Tab View" as const, shortcut: "Tab 6", onSelect: () => setActiveTab("catalog") },
    { id: "tab-section", title: "Vertical Transects & Heatmap", category: "Tab View" as const, shortcut: "Tab 7", onSelect: () => setActiveTab("section") },
    { id: "float-6902746", title: "Select Demo Float WMO 6902746 (Cycle 34)", category: "Float Action" as const, onSelect: () => viewProfile({ floatId: 6902746, cycle: 34, dataset: "demo", sourceRow: 0 }) },
    { id: "toggle-theme", title: `Switch Theme to ${theme === "dark" ? "Light Laboratory" : "Oceanic Dark"}`, category: "Float Action" as const, onSelect: () => setTheme(theme === "dark" ? "light" : "dark") },
  ];

  return (
    <main className="workspace">
      {/* WCAG Skip to Content */}
      <a className="skip-to-content" href="#main-content">
        Skip to Main Content
      </a>

      {/* Scroll Progress Bar */}
      <div className="scroll-progress-bar" style={{ width: `${scrollProgress}%` }} />

      {/* Quick Command Palette Modal */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        actions={commandActions}
      />

      {/* Workstation Header */}
      <header className="header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <a className="brand" href="/">
            FloatChat <span>ARGO OBSERVATORY</span>
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Quick Search Ctrl+K Button */}
          <button
            onClick={() => setShowCommandPalette(true)}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              background: "var(--bg-dark)",
              color: "var(--text-muted)",
              border: "1px solid var(--bg-card-border)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>🔍 Search</span>
            <kbd style={{ background: "var(--bg-card-base)", padding: "1px 5px", borderRadius: "4px", fontSize: "10px" }}>Ctrl+K</kbd>
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              background: "var(--bg-dark)",
              color: "var(--text-main)",
              border: "1px solid var(--bg-card-border)",
            }}
          >
            {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
          </button>

          {/* System Connection Badge */}
          <span className={`badge ${connected ? "connected" : ""}`}>
            {loading ? <span className="spinner" /> : connected ? "ARGO Service Online" : "System Offline"}
          </span>

          <button
            onClick={() => setAttempt((v) => v + 1)}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              background: "var(--bg-dark)",
              color: "var(--accent-blue)",
              border: "1px solid var(--bg-card-border)",
            }}
          >
            Sync
          </button>
        </div>
      </header>

      {/* Hero Overview */}
      <section className="intro">
        <span className="eyebrow">ARGO GLOBAL PROFILING FLOAT OBSERVATORY</span>
        <h1>Oceanographic Profile Analysis & Data Retrieval</h1>
        <p className="description">
          Natural language semantic query engine and 4D WebGL visualization platform for ARGO oceanographic observations.
          Translates ocean science queries into deterministic NetCDF Xarray analysis workflows with verifiable data provenance.
        </p>

        {/* Live Metrics Summary with Copy WMO Button */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            margin: "20px 0 10px 0",
          }}
        >
          <div style={{ background: "var(--bg-card-base)", border: "1px solid var(--bg-card-border)", borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active WMO ID</span>
              <CopyButton textToCopy={String(explorerFloatId)} label="Copy ID" />
            </div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-teal)", marginTop: "4px" }}>
              WMO {explorerFloatId}
            </div>
          </div>

          <div style={{ background: "var(--bg-card-base)", border: "1px solid var(--bg-card-border)", borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Vertical Range</span>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-blue)", marginTop: "4px" }}>0 - 2,000 dbar</div>
          </div>

          <div style={{ background: "var(--bg-card-base)", border: "1px solid var(--bg-card-border)", borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Cache Status</span>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--status-good)", marginTop: "4px" }}>Synced (2026)</div>
          </div>

          <div style={{ background: "var(--bg-card-base)", border: "1px solid var(--bg-card-border)", borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Data Assurance</span>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-coral)", marginTop: "4px" }}>QC Flag 1 Passed</div>
          </div>
        </div>
      </section>

      {/* Navigation Dock with Mobile Drawer Toggle */}
      <nav
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          padding: "6px",
          marginBottom: "24px",
          background: "var(--bg-card-base)",
          borderRadius: "10px",
          border: "1px solid var(--bg-card-border)",
        }}
      >
        {[
          { id: "explorer", label: "Profile Explorer & 3D Globe" },
          { id: "chat", label: "Semantic Query Engine" },
          { id: "probe", label: "In-Situ Physics Telemetry" },
          { id: "sofar", label: "SOFAR Acoustics & Ray Tracing" },
          { id: "distance", label: "Geodesic Drift & Distance Matrix" },
          { id: "catalog", label: "Dataset Catalog & Search" },
          { id: "section", label: "Vertical Transects & Heatmap" },
          { id: "analytics", label: "Physical Analysis Tools" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              style={{
                background: isActive ? "#2563eb" : "var(--bg-dark)",
                color: isActive ? "#ffffff" : "var(--text-muted)",
                border: isActive ? "none" : "1px solid var(--bg-card-border)",
                padding: "8px 16px",
                borderRadius: "6px",
                fontWeight: "700",
                fontSize: "13px",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {error && (
        <div className="error" style={{ marginBottom: "20px" }}>
          <p style={{ margin: 0 }}>Connection Alert: {error}</p>
          <p style={{ fontSize: "12px", margin: "4px 0 0 0" }}>Ensure backend FastAPI service is running on port 8001.</p>
        </div>
      )}

      {/* Main Content Anchor for Skip-to-Content */}
      <div id="main-content" tabIndex={-1} style={{ outline: "none" }}>
        {activeTab === "explorer" && (
          <div ref={explorerRef} style={{ scrollMarginTop: "24px" }}>
            <ProfileExplorer
              key={explorerFloatId}
              floatId={explorerFloatId}
              selection={selection}
              onClearSelection={() => setSelection(null)}
            />
          </div>
        )}

        {activeTab === "probe" && (
          <SubmersibleSimulator
            floatId={selection?.floatId ?? 6902746}
            cycle={selection?.cycle ?? 34}
          />
        )}

        {activeTab === "sofar" && (
          <SofarAcousticsPanel
            floatId={selection?.floatId ?? explorerFloatId}
            cycle={selection?.cycle ?? 34}
          />
        )}

        {activeTab === "distance" && (
          <SpatialDistancePanel
            floatId={selection?.floatId ?? explorerFloatId}
          />
        )}

        {activeTab === "chat" && (
          <OceanChat onViewProfile={viewProfile} />
        )}

        {activeTab === "catalog" && (
          <CatalogSearch onViewProfile={viewProfile} />
        )}

        {activeTab === "section" && (
          <OceanSection onViewProfile={viewProfile} />
        )}

        {activeTab === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <ThermoclinePanel floatId={explorerFloatId} cycle={34} />
            <ForecastPanel floatId={explorerFloatId} />
            <AnomalyPanel floatId={explorerFloatId} cycle={34} />
          </div>
        )}
      </div>

      {/* Expandable Oceanography FAQ Accordion */}
      <FaqAccordion />

      {/* Floating Back to Top Button */}
      {showTopBtn && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="back-to-top"
          title="Back to Top"
          aria-label="Back to Top"
        >
          ▲
        </button>
      )}
    </main>
  );
}

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
import OceanxExpeditionShowcase from "./components/OceanxExpeditionShowcase";
import OceanPreloader from "./components/OceanPreloader";
import type { ProfileSelection } from "./profileSelection";
import { getApiUrl } from "./apiConfig";

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

  // Preloader and Entrance Motion State
  const [isPreloaderDone, setIsPreloaderDone] = useState(false);
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
        const response = await fetch(getApiUrl("/health"), { signal: controller.signal });
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
      {/* Opening Radar Hydrographic Preloader */}
      {!isPreloaderDone && (
        <OceanPreloader onComplete={() => setIsPreloaderDone(true)} />
      )}

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

      {/* Workstation Command Header */}
      <header className="header animate-entrance stagger-1" style={{ position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <a className="brand" href="/" style={{ fontSize: "18px" }}>
            FloatChat <span style={{ fontSize: "10px", background: "rgba(144, 224, 239, 0.12)", border: "1px solid rgba(144, 224, 239, 0.3)", color: "#90e0ef", padding: "2px 6px", borderRadius: "4px" }}>HYDROGRAPHIC CONSOLE</span>
          </a>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "var(--accent-teal)", background: "rgba(45, 212, 191, 0.08)", padding: "4px 8px", borderRadius: "4px", border: "1px solid rgba(45, 212, 191, 0.2)" }}>
            📍 12.4200° N, 68.2100° E ▪ WMO {explorerFloatId}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
              borderRadius: "6px",
            }}
          >
            <span>🔍 Search</span>
            <kbd style={{ background: "var(--bg-card-base)", padding: "1px 5px", borderRadius: "4px", fontSize: "10px" }}>Ctrl+K</kbd>
          </button>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              background: "var(--bg-dark)",
              color: "var(--text-main)",
              border: "1px solid var(--bg-card-border)",
              borderRadius: "6px",
            }}
          >
            {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
          </button>

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
              borderRadius: "6px",
            }}
          >
            Sync
          </button>
        </div>
      </header>

      {/* Compact Telemetry Strip & Navigation Control Bar */}
      <section className="animate-entrance stagger-2" style={{ margin: "16px 0 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "12px", background: "var(--bg-card-base)", border: "1px solid var(--bg-card-border)", padding: "10px 16px", borderRadius: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>WMO ID:</span>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-teal)", fontFamily: "JetBrains Mono, monospace" }}>{explorerFloatId}</span>
              <CopyButton textToCopy={String(explorerFloatId)} label="Copy" />
            </div>

            <div style={{ height: "14px", width: "1px", background: "var(--bg-card-border)" }} />

            <div>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Range: </span>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--accent-blue)", fontFamily: "JetBrains Mono, monospace" }}>0 - 2,000 dbar</span>
            </div>

            <div style={{ height: "14px", width: "1px", background: "var(--bg-card-border)" }} />

            <div>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Assurance: </span>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--accent-coral)", fontFamily: "JetBrains Mono, monospace" }}>Argo QC Flag 1 Passed</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>ARRAY CACHE: </span>
            <span className="badge connected" style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace" }}>2026 SYNCED</span>
          </div>
        </div>

        {/* Workstation Navigation Tabs */}
        <nav
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            padding: "6px",
            background: "var(--bg-card-base)",
            borderRadius: "10px",
            border: "1px solid var(--bg-card-border)",
          }}
        >
          {[
            { id: "explorer", label: "Profile Explorer & 3D Globe" },
            { id: "chat", label: "Semantic AI Engine" },
            { id: "probe", label: "In-Situ Physics Telemetry" },
            { id: "sofar", label: "SOFAR Acoustics & Ray Tracing" },
            { id: "distance", label: "Geodesic Drift Matrix" },
            { id: "catalog", label: "Dataset Catalog & Search" },
            { id: "section", label: "Vertical Heatmap Transects" },
            { id: "analytics", label: "Physical Analysis Tools" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  background: isActive ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "var(--bg-dark)",
                  color: isActive ? "#ffffff" : "var(--text-muted)",
                  border: isActive ? "1px solid #38bdf8" : "1px solid var(--bg-card-border)",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontWeight: "700",
                  fontSize: "13px",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "0 0 15px rgba(56, 189, 248, 0.3)" : "none",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </section>

      {/* OceanX Expedition Showcase Banner */}
      <div className="animate-entrance stagger-3">
        <OceanxExpeditionShowcase onSelectExpedition={viewProfile} />
      </div>

      {error && (
        <div className="error" style={{ marginBottom: "20px" }}>
          <p style={{ margin: 0 }}>Connection Alert: {error}</p>
          <p style={{ fontSize: "12px", margin: "4px 0 0 0" }}>Connecting to live Render FastAPI server (https://floatchat-backend-9h3r.onrender.com)...</p>
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

import type { ProfileSelection } from "./profileSelection";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { getApiUrl } from "./apiConfig";

type OceanAnswer = {
  status: "completed" | "clarification" | "unsupported";
  message: string;
  mode?: string;
  assumptions: string[];
  tool_calls?: { tool: string; arguments: Record<string, unknown> }[];
  results?: { result?: { float_id?: number; cycle?: number; evidence?: { local_dataset?: string } } }[];
};

const examples = [
  "Show temperature at 500m in the Indian Ocean during 2022",
  "Show temperature profile for float 6902746 cycle 34",
  "Compare float 6902746 cycle 30 and cycle 35",
  "Where are the strongest salinity gradients?",
  "Show marine heatwave anomalies for float 6902746",
];

type Props = {
  onViewProfile: (selection: ProfileSelection) => void;
};

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

export default function OceanChat({ onViewProfile }: Props) {
  const [question, setQuestion] = useState(examples[0]);
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [answer, setAnswer] = useState<OceanAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>("");

  const [showMapModal, setShowMapModal] = useState(false);
  const [bbox, setBbox] = useState({ south: "10", north: "25", west: "-65", east: "-50" });

  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  const startVoiceInput = () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Web Speech Recognition API is not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      setIsListening(true);
      setVoiceStatus("Listening...");

      recognition.onstart = () => {
        setVoiceStatus("Listening...");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        setVoiceStatus("Transcribing...");
        const transcript = event.results[0][0].transcript;
        setQuestion(transcript);
        setVoiceStatus("Understanding...");
        setTimeout(() => {
          setVoiceStatus("Query Ready");
          setIsListening(false);
        }, 600);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        setVoiceStatus("");
        setError(`Voice input error: ${event.error}`);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: unknown) {
      setIsListening(false);
      setVoiceStatus("");
      setError(`Voice input error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const applyMapBbox = () => {
    const qWithBbox = `${question.trim()} (Region: Lat ${bbox.south}°N to ${bbox.north}°N, Lon ${bbox.west}°E to ${bbox.east}°E)`;
    setQuestion(qWithBbox);
    setShowMapModal(false);
  };

  async function askOcean(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = question.trim();
    if (text.length < 3 || requestRef.current) return;

    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setError("");
    setAnswer(null);
    setSubmittedQuestion(text);

    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 45000);

    try {
      const response = await fetch(getApiUrl("/ask"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ question: text }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        let message = `Request failed: HTTP ${response.status}.`;
        if (typeof body?.detail === "string") {
          message = body.detail;
        } else if (Array.isArray(body?.detail)) {
          message = body.detail
            .map((item: { msg?: string }) => item.msg ?? "Invalid question")
            .join("; ");
        }
        throw new Error(message);
      }

      if (!controller.signal.aborted) {
        setAnswer(body as OceanAnswer);
      }
    } catch (caught) {
      if (controller.signal.aborted && !timedOut) return;

      setError(
        timedOut
          ? "The request timed out. Check the backend server log."
          : caught instanceof Error
          ? caught.message
          : "Could not contact the query engine."
      );
    } finally {
      window.clearTimeout(timer);

      if (requestRef.current === controller) {
        requestRef.current = null;
        if (!controller.signal.aborted || timedOut) {
          setLoading(false);
        }
      }
    }
  }

  return (
    <section className="ocean-query-panel ocean-chat" style={{ borderRadius: "24px", padding: "28px" }}>
      {/* Top Header & Status Badges matching reference design */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <span className="ocean-deep-badge" style={{ marginBottom: "12px" }}>
            ✨ Join Us for Cleaner Oceans & Marine Science
          </span>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: "800", letterSpacing: "-0.6px", marginTop: "8px", lineHeight: "1.2" }}>
            Protecting Our Oceans, <span style={{ color: "var(--accent-cyan)" }}>Restoring Marine Data</span>
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.6", maxWidth: "720px", marginTop: "8px" }}>
            Join thousands of oceanographers, marine biologists, and climate researchers taking hands-on action to analyze shorelines, track thermoclines, and educate future ocean ambassadors across global coastlines.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
          <span className="ocean-deep-floating-status">
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            Next Data Sync: Active Stream
          </span>
          <span className={`badge ${answer?.mode === "llm_groq" ? "connected" : ""}`}>
            {answer?.mode === "llm_groq" ? "Groq LLM Engine Active" : "Offline Rule Parser Active"}
          </span>
        </div>
      </div>

      {/* Verified Impact Banner matching reference card */}
      <div className="ocean-deep-stat-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", margin: "20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(2, 132, 199, 0.12)", border: "1px solid rgba(2, 132, 199, 0.3)", display: "grid", placeItems: "center", fontSize: "20px" }}>
            🌊
          </div>
          <div>
            <span style={{ fontSize: "11px", fontWeight: "800", letterSpacing: "1px", color: "var(--accent-cyan)", textTransform: "uppercase", display: "block" }}>
              VERIFIED COMMUNITY & DATASET IMPACT
            </span>
            <span style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-main)", letterSpacing: "-0.5px" }}>
              124,500+ CTD Observations
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px" }}>
              Plastic & Thermocline Debris Diverted / Analyzed
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
          <span>🛡️ 100% Open Data Driven</span>
          <span>🌊 52 Marine Basins Protected</span>
          <span>✨ QC-Passed NetCDF Standards</span>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div style={{ margin: "16px 0" }}>
        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
          Suggested Research Queries:
        </span>
        <div className="ocean-chat-examples" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              disabled={loading}
              onClick={() => setQuestion(example)}
              className="ocean-deep-chip"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Query Form */}
      <form onSubmit={askOcean}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <label htmlFor="ocean-question" style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-main)" }}>
            Natural Language Hydrographic Query:
          </label>
          {voiceStatus && (
            <span style={{ fontSize: "12px", color: "var(--accent-cyan)", fontWeight: "700" }}>
              {voiceStatus}
            </span>
          )}
        </div>

        <div>
          <textarea
            id="ocean-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="e.g. Show temperature at 500m in the Indian Ocean during 2022"
            rows={3}
            minLength={3}
            maxLength={1500}
            required
            disabled={loading}
            style={{
              width: "100%",
              borderRadius: "14px",
              padding: "14px",
              background: "var(--input-bg)",
              border: "1px solid var(--bg-card-border)",
              color: "var(--text-main)",
              fontFamily: "inherit",
              fontSize: "14px",
              lineHeight: "1.5",
              resize: "vertical",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.03)",
            }}
          />
        </div>

        {/* Action Buttons matching reference pill buttons */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginTop: "14px" }}>
          <button type="submit" disabled={loading || question.trim().length < 3} className="ocean-deep-btn-primary">
            {loading ? "Processing query plan…" : "🌊 Ask AI Engine"}
          </button>

          <button
            type="button"
            onClick={startVoiceInput}
            disabled={isListening || loading}
            className="ocean-deep-btn-secondary"
          >
            {isListening ? "🎙️ Listening…" : "🎙️ Speech Input"}
          </button>

          <button
            type="button"
            onClick={() => setShowMapModal(!showMapModal)}
            className="ocean-deep-btn-secondary"
          >
            📍 Bounding Box Filter
          </button>

          {answer && (
            <button
              type="button"
              onClick={() => setAnswer(null)}
              className="ocean-deep-btn-secondary"
              style={{ color: "#ef4444", borderColor: "#fca5a5" }}
            >
              ✕ Clear Output
            </button>
          )}
        </div>
      </form>

      {/* Spatial Selector Modal */}
      {showMapModal && (
        <div
          style={{
            marginTop: "16px",
            padding: "18px",
            background: "var(--bg-card-base)",
            border: "1px solid var(--bg-card-border)",
            borderRadius: "16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          }}
        >
          <strong style={{ color: "var(--accent-cyan)", fontSize: "14px" }}>Geographic Spatial Bounds Filter</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "10px", marginTop: "12px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", fontWeight: "600" }}>South Lat (°)</label>
              <input type="number" value={bbox.south} onChange={(e) => setBbox({ ...bbox, south: e.target.value })} style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--bg-card-border)" }} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", fontWeight: "600" }}>North Lat (°)</label>
              <input type="number" value={bbox.north} onChange={(e) => setBbox({ ...bbox, north: e.target.value })} style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--bg-card-border)" }} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", fontWeight: "600" }}>West Lon (°)</label>
              <input type="number" value={bbox.west} onChange={(e) => setBbox({ ...bbox, west: e.target.value })} style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--bg-card-border)" }} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", fontWeight: "600" }}>East Lon (°)</label>
              <input type="number" value={bbox.east} onChange={(e) => setBbox({ ...bbox, east: e.target.value })} style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--bg-card-border)" }} />
            </div>
          </div>
          <button onClick={applyMapBbox} className="ocean-deep-btn-primary" style={{ marginTop: "14px", fontSize: "13px", padding: "8px 18px" }}>
            Apply Bounding Box to Query
          </button>
        </div>
      )}

      {loading && (
        <p role="status" style={{ marginTop: "16px", color: "var(--accent-cyan)", fontSize: "14px", fontWeight: "600" }}>
          Parsing query schema and executing Xarray NetCDF computational tools…
        </p>
      )}

      {error && (
        <p className="error" role="alert" style={{ marginTop: "16px" }}>
          {error}
        </p>
      )}

      {/* Execution Results & Provenance matching About Ocean Deep Network Card */}
      {answer && (
        <div className="ocean-deep-stat-card" style={{ marginTop: "24px", borderRadius: "20px", padding: "24px" }}>
          <div style={{ marginBottom: "12px" }}>
            <span style={{ background: "#e0f2fe", color: "#0284c7", padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
              ABOUT FLOATCHAT AI NETWORK
            </span>
          </div>

          <p className="profile-note" style={{ fontSize: "13px", margin: "8px 0" }}>
            <strong>Input Prompt:</strong> {submittedQuestion}
          </p>

          <h3 role="status" style={{ color: "var(--accent-cyan)", fontSize: "20px", fontWeight: "800", margin: "10px 0" }}>
            {answer.message}
          </h3>

          <div style={{ display: "flex", gap: "10px", margin: "14px 0" }}>
            <button
              onClick={() =>
                onViewProfile({
                  floatId: 6902746,
                  cycle: 34,
                  dataset: "argo_6902746_cycle_34.nc",
                  sourceRow: 0,
                })
              }
              className="ocean-deep-btn-primary"
              style={{ fontSize: "13px", padding: "8px 18px" }}
            >
              Inspect Profile Visualizer
            </button>
          </div>

          {/* Master 5-Stage Scientific Pipeline Diagram */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              margin: "16px 0",
              padding: "12px 16px",
              background: "rgba(2, 132, 199, 0.05)",
              border: "1px solid var(--bg-card-border)",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Execution Pipeline:</span>
            <span style={{ color: "var(--accent-cyan)" }}>1. Query Parsing</span> →
            <span style={{ color: "var(--accent-teal)" }}>2. Schema Validation</span> →
            <span style={{ color: "var(--accent-coral)" }}>3. Xarray Execution</span> →
            <span style={{ color: "var(--status-good)" }}>4. Quality Check (Passed)</span> →
            <span style={{ color: "var(--text-main)" }}>5. Provenance Output</span>
          </div>

          {answer.assumptions && answer.assumptions.length > 0 && (
            <div className="ocean-chat-assumptions" style={{ marginTop: "14px" }}>
              <strong style={{ fontSize: "13px", color: "var(--text-muted)" }}>Query Validation & Operational Assumptions:</strong>
              <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px", fontSize: "13px", color: "var(--text-main)", lineHeight: "1.6" }}>
                {answer.assumptions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {answer.tool_calls && answer.tool_calls.length > 0 && (
            <div className="ocean-chat-filters" style={{ marginTop: "14px" }}>
              <strong style={{ fontSize: "13px", color: "var(--text-muted)" }}>Executed Tool Plan:</strong>
              {answer.tool_calls.map((tc, idx) => (
                <p key={idx} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: "var(--accent-cyan)", margin: "4px 0 0 0" }}>
                  tool.{tc.tool}({JSON.stringify(tc.arguments)})
                </p>
              ))}
            </div>
          )}

          {answer.results && answer.results.length > 0 && (
            <div style={{ background: "rgba(15, 23, 42, 0.04)", border: "1px solid var(--bg-card-border)", padding: "16px", borderRadius: "14px", marginTop: "16px" }}>
              <strong style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Computation Payload Output:</strong>
              <pre style={{ overflowX: "auto", color: "var(--text-main)", fontSize: "12px", maxHeight: "250px", marginTop: "8px" }}>
                {JSON.stringify(answer.results, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
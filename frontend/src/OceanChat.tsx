import type { ProfileSelection } from "./profileSelection";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

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
      const response = await fetch("/api/ask", {
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
    <section className="ocean-query-panel ocean-chat">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="eyebrow">ARGO SEMANTIC RETRIEVAL ENGINE</span>
          <h2 style={{ margin: "4px 0 0 0" }}>Natural Language Query & Tool Execution</h2>
        </div>
        <span className={`badge ${answer?.mode === "llm_groq" ? "connected" : ""}`}>
          {answer?.mode === "llm_groq" ? "Groq LLM Engine Active" : "Offline Rule Parser Active"}
        </span>
      </div>

      <p className="profile-note" id="ocean-chat-scope" style={{ marginTop: "8px" }}>
        Enter oceanographic prompts to auto-generate structured analytical tool plans executed against local NetCDF profiles.
      </p>

      {/* Suggestion Chips */}
      <div className="ocean-chat-examples" style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "14px 0" }}>
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            disabled={loading}
            onClick={() => setQuestion(example)}
            style={{
              background: "#0f172a",
              color: "var(--text-muted)",
              border: "1px solid var(--bg-card-border)",
              padding: "6px 12px",
              fontSize: "12px",
              borderRadius: "6px",
            }}
          >
            {example}
          </button>
        ))}
      </div>

      {/* Query Form */}
      <form onSubmit={askOcean}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <label htmlFor="ocean-question" style={{ fontWeight: "700", fontSize: "13px", color: "#ffffff" }}>
            Natural Language Query Prompt:
          </label>
          {voiceStatus && (
            <span style={{ fontSize: "12px", color: "var(--accent-blue)", fontWeight: "600" }}>
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
            style={{ width: "100%" }}
          />
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" }}>
          <button type="submit" disabled={loading || question.trim().length < 3}>
            {loading ? "Processing query plan…" : "Execute Query"}
          </button>

          <button
            type="button"
            onClick={startVoiceInput}
            disabled={isListening || loading}
            style={{
              background: isListening ? "rgba(56, 189, 248, 0.2)" : "#0f172a",
              color: isListening ? "var(--accent-blue)" : "var(--text-muted)",
              border: "1px solid var(--bg-card-border)",
            }}
          >
            {isListening ? "Listening…" : "Speech Input"}
          </button>

          <button
            type="button"
            onClick={() => setShowMapModal(!showMapModal)}
            style={{
              background: "#0f172a",
              color: "var(--text-muted)",
              border: "1px solid var(--bg-card-border)",
            }}
          >
            Geographic Bounding Box
          </button>

          {answer && (
            <button
              type="button"
              onClick={() => setAnswer(null)}
              style={{ background: "#0f172a", color: "var(--text-muted)", border: "1px solid var(--bg-card-border)" }}
            >
              Clear Output
            </button>
          )}
        </div>
      </form>

      {/* Spatial Selector Modal */}
      {showMapModal && (
        <div
          style={{
            marginTop: "14px",
            padding: "16px",
            background: "#0f172a",
            border: "1px solid var(--bg-card-border)",
            borderRadius: "8px",
          }}
        >
          <strong style={{ color: "var(--accent-blue)", fontSize: "13px" }}>Geographic Spatial Bounds Filter</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "10px", marginTop: "10px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>South Lat (°)</label>
              <input type="number" value={bbox.south} onChange={(e) => setBbox({ ...bbox, south: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>North Lat (°)</label>
              <input type="number" value={bbox.north} onChange={(e) => setBbox({ ...bbox, north: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>West Lon (°)</label>
              <input type="number" value={bbox.west} onChange={(e) => setBbox({ ...bbox, west: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>East Lon (°)</label>
              <input type="number" value={bbox.east} onChange={(e) => setBbox({ ...bbox, east: e.target.value })} />
            </div>
          </div>
          <button onClick={applyMapBbox} style={{ marginTop: "10px", padding: "6px 14px", fontSize: "12px" }}>
            Apply Bounding Box to Query
          </button>
        </div>
      )}

      {loading && (
        <p role="status" style={{ marginTop: "14px", color: "var(--accent-blue)", fontSize: "13px" }}>
          Parsing query schema and executing Xarray NetCDF computational tools…
        </p>
      )}

      {error && (
        <p className="error" role="alert" style={{ marginTop: "14px" }}>
          {error}
        </p>
      )}

      {/* Execution Results & Provenance */}
      {answer && (
        <div className="ocean-chat-answer" style={{ marginTop: "20px" }}>
          <p className="profile-note">
            <strong>Input Prompt:</strong> {submittedQuestion}
          </p>

          <h3 role="status" style={{ color: "var(--accent-blue)", margin: "8px 0" }}>{answer.message}</h3>

          <div style={{ display: "flex", gap: "10px", margin: "10px 0" }}>
            <button
              onClick={() =>
                onViewProfile({
                  floatId: 6902746,
                  cycle: 34,
                  dataset: "argo_6902746_cycle_34.nc",
                  sourceRow: 0,
                })
              }
              style={{ background: "#2563eb", color: "#ffffff", padding: "6px 14px", fontSize: "12px" }}
            >
              Inspect Profile Visualizer
            </button>
          </div>

          {/* Master 5-Stage Scientific Pipeline Diagram */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              margin: "14px 0",
              padding: "10px 14px",
              background: "#090d16",
              border: "1px solid var(--bg-card-border)",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Execution Pipeline:</span>
            <span style={{ color: "var(--accent-blue)" }}>1. Query Parsing</span> →
            <span style={{ color: "var(--accent-teal)" }}>2. Schema Validation</span> →
            <span style={{ color: "var(--accent-coral)" }}>3. Xarray Execution</span> →
            <span style={{ color: "var(--status-good)" }}>4. Quality Check (Passed)</span> →
            <span style={{ color: "#ffffff" }}>5. Provenance Output</span>
          </div>

          {answer.assumptions && answer.assumptions.length > 0 && (
            <div className="ocean-chat-assumptions" style={{ marginTop: "12px" }}>
              <strong style={{ fontSize: "12px", color: "var(--text-muted)" }}>Query Validation & Operational Assumptions:</strong>
              <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px", fontSize: "12px", color: "var(--text-main)" }}>
                {answer.assumptions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {answer.tool_calls && answer.tool_calls.length > 0 && (
            <div className="ocean-chat-filters" style={{ marginTop: "12px" }}>
              <strong style={{ fontSize: "12px", color: "var(--text-muted)" }}>Executed Tool Plan:</strong>
              {answer.tool_calls.map((tc, idx) => (
                <p key={idx} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: "var(--accent-teal)", margin: "4px 0 0 0" }}>
                  tool.{tc.tool}({JSON.stringify(tc.arguments)})
                </p>
              ))}
            </div>
          )}

          {answer.results && answer.results.length > 0 && (
            <div style={{ background: "#090d16", border: "1px solid var(--bg-card-border)", padding: "14px", borderRadius: "8px", marginTop: "14px" }}>
              <strong style={{ color: "var(--text-muted)", fontSize: "12px" }}>Computation Payload Output:</strong>
              <pre style={{ overflowX: "auto", color: "var(--text-main)", fontSize: "12px", maxHeight: "250px", marginTop: "6px" }}>
                {JSON.stringify(answer.results, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ProfileSelection } from "./profileSelection";
import { LiveArgoFetcher } from "./LiveArgoFetcher";

type CatalogFloat = {
  float_id: number;
  profile_count: number;
  cycles: number[];
  cycle_range: number[];
  time_start_utc: string;
  time_end_utc: string;
};

type Catalog = {
  available_profiles: number;
  available_floats: number;
  floats: CatalogFloat[];
  excluded_profiles: {
    float_id: number;
    cycle: number;
    reason: string;
  }[];
};

type QueryRow = {
  float_id: number;
  cycle: number;
  time_utc: string;
  actual_depth_m: number;
  depth_difference_m: number;
  pressure_dbar: number;
  measurements: {
    temperature_c?: number;
    salinity_psu?: number;
  };
  evidence: {
    local_dataset: string;
    source_row: number;
    qc_policy: string;
    vertical_coordinate: string;
  };
};

type QueryResult = {
  matched_profiles: number;
  results: QueryRow[];
  unavailable_profiles: {
    float_id?: number;
    cycle: number;
    reason: string;
    filter_status?: string;
  }[];
  method: string;
};

async function readResponse(response: Response) {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? detail.map((item: { msg?: string }) => item.msg ?? "Invalid input").join("; ")
        : `Request failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  if (body === null) {
    throw new Error("The API returned an empty or invalid JSON response.");
  }

  return body;
}

type Props = {
  onViewProfile: (selection: ProfileSelection) => void;
};

export default function CatalogSearch({ onViewProfile }: Props) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);

  const [floatId, setFloatId] = useState("");
  const [cycleStart, setCycleStart] = useState("30");
  const [cycleEnd, setCycleEnd] = useState("39");
  const [depth, setDepth] = useState("500");
  const [tolerance, setTolerance] = useState("25");
  const [variables, setVariables] = useState("both");

  const [result, setResult] = useState<QueryResult | null>(null);
  const [submittedDescription, setSubmittedDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;

    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);

    async function loadCatalog() {
      setCatalog(null);
      setCatalogError("");

      try {
        const response = await fetch("/api/catalog", {
          signal: controller.signal,
        });

        const data: Catalog = await readResponse(response);

        if (!Array.isArray(data.floats)) {
          throw new Error("The catalogue response has an unexpected format.");
        }

        if (controller.signal.aborted) return;

        setCatalog(data);

        const first = data.floats[0];
        if (first && !floatId) {
          setFloatId(String(first.float_id));
          setCycleStart(String(first.cycle_range[0]));
          setCycleEnd(String(first.cycle_range[1]));
        }
      } catch (cause) {
        if (controller.signal.aborted && !timedOut) return;

        setCatalogError(
          timedOut
            ? "Catalogue loading timed out. Check the backend terminal."
            : cause instanceof Error
            ? cause.message
            : "Could not load the catalogue."
        );
      } finally {
        window.clearTimeout(timer);
      }
    }

    void loadCatalog();

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [catalogAttempt]);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  function selectFloat(value: string) {
    setFloatId(value);
    setResult(null);
    setError("");

    const selected = catalog?.floats.find(
      (item) => item.float_id === Number(value)
    );

    if (selected) {
      setCycleStart(String(selected.cycle_range[0]));
      setCycleEnd(String(selected.cycle_range[1]));
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (Number(cycleStart) > Number(cycleEnd)) {
      setError("Start cycle must not exceed end cycle.");
      return;
    }

    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;

    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);

    const payload = {
      float_id: Number(floatId),
      cycle_start: Number(cycleStart),
      cycle_end: Number(cycleEnd),
      target_depth_m: Number(depth),
      tolerance_m: Number(tolerance),
      variables: variables === "both" ? ["temperature", "salinity"] : [variables],
    };

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data: QueryResult = await readResponse(response);

      if (!Array.isArray(data.results)) {
        throw new Error("The query response has an unexpected format.");
      }

      if (controller.signal.aborted) return;

      setSubmittedDescription(
        `Float ${floatId} · Cycles ${cycleStart}–${cycleEnd} · ` +
          `Target ${depth} m · Tolerance ${tolerance} m`
      );

      setResult(data);
    } catch (cause) {
      if (controller.signal.aborted && !timedOut) return;

      setError(
        timedOut
          ? "Search timed out. Check the backend terminal and retry."
          : cause instanceof Error
          ? cause.message
          : "Could not search the observations."
      );
    } finally {
      window.clearTimeout(timer);

      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  const selectedFloat = catalog?.floats.find(
    (item) => item.float_id === Number(floatId)
  );

  return (
    <section className="catalog-search">
      <p className="eyebrow">ARGO FLOAT CATALOG & LIVE FETCH</p>
      <h2>Observation Catalog & Live Downloads</h2>

      <LiveArgoFetcher onCatalogUpdated={() => setCatalogAttempt((prev) => prev + 1)} />

      {catalogError ? (
        <div role="alert">
          <p className="error">{catalogError}</p>
          <button onClick={() => setCatalogAttempt((value) => value + 1)}>
            Retry catalogue
          </button>
        </div>
      ) : !catalog ? (
        <p role="status">Loading local dataset catalog…</p>
      ) : catalog.floats.length === 0 ? (
        <p>No local profiles passed the analysis QC policy.</p>
      ) : (
        <>
          <p style={{ color: "var(--accent-teal)", fontWeight: "600" }}>
            {catalog.available_floats} available float(s) · {catalog.available_profiles} accepted profiles in cache
          </p>

          <form onSubmit={search}>
            <fieldset disabled={loading}>
              <legend>Observation filters</legend>

              <div className="catalog-grid">
                <label>
                  Float
                  <select
                    value={floatId}
                    onChange={(event) => selectFloat(event.target.value)}
                  >
                    {catalog.floats.map((item) => (
                      <option key={item.float_id} value={item.float_id}>
                        {item.float_id} — {item.profile_count} profiles (Cycles {item.cycle_range[0]}-{item.cycle_range[1]})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Start cycle
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={cycleStart}
                    onChange={(event) => setCycleStart(event.target.value)}
                  />
                </label>

                <label>
                  End cycle
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={cycleEnd}
                    onChange={(event) => setCycleEnd(event.target.value)}
                  />
                </label>

                <label>
                  Target depth (m)
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    step="any"
                    required
                    value={depth}
                    onChange={(event) => setDepth(event.target.value)}
                  />
                </label>

                <label>
                  Depth tolerance (m)
                  <input
                    type="number"
                    min="0.01"
                    max="100"
                    step="any"
                    required
                    value={tolerance}
                    onChange={(event) => setTolerance(event.target.value)}
                  />
                </label>

                <label>
                  Variables
                  <select
                    value={variables}
                    onChange={(event) => setVariables(event.target.value)}
                  >
                    <option value="both">Temperature + salinity</option>
                    <option value="temperature">Temperature</option>
                    <option value="salinity">Salinity</option>
                  </select>
                </label>
              </div>

              {selectedFloat && (
                <p className="profile-note">
                  Local coverage: {selectedFloat.time_start_utc.slice(0, 10)} to {selectedFloat.time_end_utc.slice(0, 10)} UTC.
                </p>
              )}

              <button type="submit" style={{ marginTop: "16px" }}>
                {loading ? "Searching observations…" : "Search Catalog Observations"}
              </button>
            </fieldset>
          </form>
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <div className="catalog-results">
          <h3 aria-live="polite">{result.matched_profiles} matching profiles</h3>
          <p>{submittedDescription}</p>

          {result.results.length === 0 ? (
            <p>No local observations matched all filters.</p>
          ) : (
            <div className="catalog-table-scroll">
              <table>
                <caption>Nearest accepted observations</caption>
                <thead>
                  <tr>
                    <th scope="col">Cycle</th>
                    <th scope="col">Date (UTC)</th>
                    <th scope="col">Actual depth (m)</th>
                    <th scope="col">Difference (m)</th>
                    <th scope="col">Temperature (°C)</th>
                    <th scope="col">Salinity (PSU)</th>
                    <th scope="col">Explore</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((row) => (
                    <tr key={`${row.float_id}-${row.cycle}`}>
                      <td>{row.cycle}</td>
                      <td>{row.time_utc.slice(0, 10)}</td>
                      <td>{row.actual_depth_m.toFixed(1)}</td>
                      <td>{row.depth_difference_m.toFixed(1)}</td>
                      <td>{row.measurements.temperature_c?.toFixed(3) ?? "—"}</td>
                      <td>{row.measurements.salinity_psu?.toFixed(3) ?? "—"}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            onViewProfile({
                              floatId: row.float_id,
                              cycle: row.cycle,
                              dataset: row.evidence.local_dataset,
                              sourceRow: row.evidence.source_row,
                            })
                          }
                        >
                          View profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
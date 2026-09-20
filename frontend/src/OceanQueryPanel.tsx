import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { getApiUrl } from "./apiConfig";

type QueryResult = {
  float_id: number;
  cycle: number;
  time_utc: string;
  latitude: number;
  longitude: number;
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
  };
};

type QueryResponse = {
  query: {
    cycle_start: number;
    cycle_end: number;
    target_depth_m: number;
    tolerance_m: number;
    variables: string[];
  };
  dataset_scope: {
    float_id: number;
    available_cycle_range: number[];
  };
  matched_profiles: number;
  results: QueryResult[];
  unavailable_profiles: {
    cycle: number;
    reason: string;
  }[];
  method: string;
};

export default function OceanQueryPanel() {
  const [cycleStart, setCycleStart] = useState("32");
  const [cycleEnd, setCycleEnd] = useState("36");
  const [depth, setDepth] = useState("500");
  const [tolerance, setTolerance] = useState("25");
  const [variable, setVariable] = useState("both");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  async function runQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const start = Number(cycleStart);
    const end = Number(cycleEnd);
    const target = Number(depth);
    const allowedDifference = Number(tolerance);

    setError("");
    setResult(null);

    if (start > end) {
      setError("Start cycle must be less than or equal to end cycle.");
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);

    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);

    try {
      const response = await fetch(getApiUrl("/query"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          cycle_start: start,
          cycle_end: end,
          target_depth_m: target,
          tolerance_m: allowedDifference,
          variables:
            variable === "both"
              ? ["temperature", "salinity"]
              : [variable],
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        let message = `Query failed: HTTP ${response.status}.`;

        if (typeof body?.detail === "string") {
          message = body.detail;
        } else if (Array.isArray(body?.detail)) {
          message = body.detail
            .map((item: { msg?: string }) => item.msg ?? "Invalid input")
            .join("; ");
        }

        throw new Error(message);
      }

      if (
        !body ||
        !Array.isArray(body.results) ||
        !Array.isArray(body.unavailable_profiles) ||
        !body.query ||
        !body.dataset_scope
      ) {
        throw new Error("The backend returned an unexpected query response.");
      }

      setResult(body as QueryResponse);
    } catch (caught) {
      if (controller.signal.aborted && !timedOut) return;

      setError(
        timedOut
          ? "The query took longer than 30 seconds. Check the backend terminal and try again."
          : caught instanceof Error
            ? caught.message
            : "Could not run the query.",
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
    <section className="ocean-query-panel">
      <p className="eyebrow">QUERY REAL OBSERVATIONS</p>
      <h2>Search the ocean profiles</h2>

      <p className="profile-note">
        Current dataset: Argo float 6902746, cycles 30–39.
        Select a cycle range, target depth, and variables.
      </p>

      <form onSubmit={runQuery}>
        <fieldset className="ocean-query-fields" disabled={loading}>
          <legend>Search filters</legend>

          <label>
            Start cycle
            <input
              type="number"
              min={30}
              max={39}
              step={1}
              required
              value={cycleStart}
              onChange={(event) => setCycleStart(event.target.value)}
            />
          </label>

          <label>
            End cycle
            <input
              type="number"
              min={30}
              max={39}
              step={1}
              required
              value={cycleEnd}
              onChange={(event) => setCycleEnd(event.target.value)}
            />
          </label>

          <label>
            Target depth (m)
            <input
              type="number"
              min={0}
              max={2000}
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
              min={0.1}
              max={100}
              step="any"
              required
              value={tolerance}
              onChange={(event) => setTolerance(event.target.value)}
            />
          </label>

          <label>
            Variables
            <select
              value={variable}
              onChange={(event) => setVariable(event.target.value)}
            >
              <option value="both">Temperature + salinity</option>
              <option value="temperature">Temperature</option>
              <option value="salinity">Salinity</option>
            </select>
          </label>
        </fieldset>

        <p className="profile-note">
          Tolerance is the maximum allowed distance from the target depth.
          It is not measurement uncertainty.
        </p>

        <button type="submit" disabled={loading}>
          {loading ? "Searching observations…" : "Search observations"}
        </button>
      </form>

      {loading && <p role="status">Reading local ocean profiles…</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <div className="ocean-query-results">
          <h3 role="status">
            {result.matched_profiles} matching profiles
          </h3>

          <p className="profile-note">
            Float {result.dataset_scope.float_id} · Cycles{" "}
            {result.query.cycle_start}–{result.query.cycle_end} · Target{" "}
            {result.query.target_depth_m} m · Tolerance{" "}
            {result.query.tolerance_m} m
          </p>

          {result.results.length === 0 ? (
            <p>
              No observations matched these filters. Review the excluded
              profiles below or change the depth tolerance.
            </p>
          ) : (
            <div
              className="ocean-query-table-wrap"
              role="region"
              aria-label="Ocean query results"
              tabIndex={0}
            >
              <table className="ocean-query-table">
                <caption>
                  Nearest accepted observation per matching profile
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Cycle</th>
                    <th scope="col">Date (UTC)</th>
                    <th scope="col">Actual depth</th>
                    <th scope="col">Depth difference</th>
                    {result.query.variables.includes("temperature") && (
                      <th scope="col">Temperature</th>
                    )}
                    {result.query.variables.includes("salinity") && (
                      <th scope="col">Salinity</th>
                    )}
                    <th scope="col">Evidence</th>
                  </tr>
                </thead>

                <tbody>
                  {result.results.map((row) => (
                    <tr key={`${row.float_id}-${row.cycle}`}>
                      <td>{row.cycle}</td>
                      <td>{row.time_utc.slice(0, 10)}</td>
                      <td>{row.actual_depth_m.toFixed(1)} m</td>
                      <td>{row.depth_difference_m.toFixed(1)} m</td>

                      {result.query.variables.includes("temperature") && (
                        <td>
                          {row.measurements.temperature_c?.toFixed(3) ?? "—"}
                          {" "}°C
                        </td>
                      )}

                      {result.query.variables.includes("salinity") && (
                        <td>
                          {row.measurements.salinity_psu?.toFixed(3) ?? "—"}
                          {" "}PSU
                        </td>
                      )}

                      <td>
                        <details className="ocean-query-evidence">
                          <summary>View source</summary>
                          <p><strong>File:</strong> {row.evidence.local_dataset}</p>
                          <p><strong>Source row:</strong> {row.evidence.source_row}</p>
                          <p><strong>Time:</strong> {row.time_utc}</p>
                          <p>
                            <strong>Position:</strong>{" "}
                            {row.latitude.toFixed(3)}°,{" "}
                            {row.longitude.toFixed(3)}°
                          </p>
                          <p>
                            <strong>Pressure:</strong>{" "}
                            {row.pressure_dbar.toFixed(1)} dbar
                          </p>
                          <p><strong>QC:</strong> {row.evidence.qc_policy}</p>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.unavailable_profiles.length > 0 && (
            <details className="profile-evidence">
              <summary>
                {result.unavailable_profiles.length} profiles unavailable
                or outside tolerance
              </summary>
              {result.unavailable_profiles.map((item) => (
                <p key={item.cycle}>
                  Cycle {item.cycle}: {item.reason}
                </p>
              ))}
            </details>
          )}

          <p className="profile-note">{result.method}</p>
          <p className="profile-note">
            Profiles were recorded at different times and locations.
            Differences between them alone do not establish a regional trend.
          </p>
        </div>
      )}
    </section>
  );
}
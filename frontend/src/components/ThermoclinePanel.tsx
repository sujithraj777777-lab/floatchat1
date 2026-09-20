import { useState } from "react";
import { useOceanFetch } from "../hooks/useOceanData";

type ThermoclineResult = {
  detected: boolean;
  thermocline_depth_m?: number;
  gradient_per_m?: number;
  surface_temperature_c?: number;
  thermocline_temperature_c?: number;
  deep_temperature_c?: number;
  temperature_drop_c?: number;
  mixed_layer_depth_m?: number;
  observations_in_mixed_layer?: number;
  reason?: string;
  float_id: number;
  cycle: number;
  evidence: Record<string, unknown>;
};

type Props = {
  floatId: number;
  cycle: number;
};

export default function ThermoclinePanel({ floatId, cycle }: Props) {
  const thermo = useOceanFetch<ThermoclineResult>();
  const mixed = useOceanFetch<ThermoclineResult>();
  const [minGradient, setMinGradient] = useState(0.02);
  const [threshold, setThreshold] = useState(0.2);

  function detectThermocline() {
    thermo.fetch("/api/analyze/thermocline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ float_id: floatId, cycle, min_gradient: minGradient }),
    });
  }

  function detectMixedLayer() {
    mixed.fetch("/api/analyze/mixed-layer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ float_id: floatId, cycle, threshold_c: threshold }),
    });
  }

  return (
    <section className="ocean-query-panel" aria-labelledby="thermo-title">
      <p className="eyebrow">VERTICAL STRUCTURE</p>
      <h2 id="thermo-title">Thermocline & mixed layer detection</h2>

      <p className="profile-note">
        Detects the thermocline (steepest temperature gradient) and mixed layer
        (near-constant surface temperature) from the profile.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 20, alignItems: "end" }}>
        <label>
          Min gradient (°C/m){" "}
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="0.2"
            value={minGradient}
            onChange={(e) => setMinGradient(Number(e.target.value))}
            style={{ width: 100 }}
          />
        </label>
        <button type="button" onClick={detectThermocline} disabled={thermo.loading}>
          {thermo.loading ? "Detecting..." : "Detect thermocline"}
        </button>

        <label>
          Mixed layer threshold (°C){" "}
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="2"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ width: 100 }}
          />
        </label>
        <button type="button" onClick={detectMixedLayer} disabled={mixed.loading}>
          {mixed.loading ? "Detecting..." : "Detect mixed layer"}
        </button>
      </div>

      {thermo.error && (
        <p className="error" role="alert" style={{ marginTop: 16 }}>
          {thermo.error}
        </p>
      )}

      {thermo.data && (
        <div className="dive-readings" style={{ marginTop: 24 }}>
          {thermo.data.detected ? (
            <>
              <div>
                <span>Thermocline depth</span>
                <strong>{thermo.data.thermocline_depth_m?.toFixed(1)} m</strong>
              </div>
              <div>
                <span>Temperature drop</span>
                <strong>{thermo.data.temperature_drop_c?.toFixed(2)} °C</strong>
              </div>
              <div>
                <span>Gradient</span>
                <strong>{thermo.data.gradient_per_m?.toFixed(4)} °C/m</strong>
              </div>
              <div>
                <span>Surface temp</span>
                <strong>{thermo.data.surface_temperature_c?.toFixed(2)} °C</strong>
              </div>
              <div>
                <span>Thermocline temp</span>
                <strong>{thermo.data.thermocline_temperature_c?.toFixed(2)} °C</strong>
              </div>
              <div>
                <span>Deep temp</span>
                <strong>{thermo.data.deep_temperature_c?.toFixed(2)} °C</strong>
              </div>
            </>
          ) : (
            <div>
              <span>Thermocline</span>
              <strong>{thermo.data.reason || "Not detected"}</strong>
            </div>
          )}
        </div>
      )}

      {mixed.error && (
        <p className="error" role="alert" style={{ marginTop: 16 }}>
          {mixed.error}
        </p>
      )}

      {mixed.data && (
        <div className="dive-readings" style={{ marginTop: 16 }}>
          {mixed.data.detected ? (
            <>
              <div>
                <span>Mixed layer depth</span>
                <strong>{mixed.data.mixed_layer_depth_m?.toFixed(1)} m</strong>
              </div>
              <div>
                <span>Surface temperature</span>
                <strong>{mixed.data.surface_temperature_c?.toFixed(2)} °C</strong>
              </div>
              <div>
                <span>Observations in layer</span>
                <strong>{mixed.data.observations_in_mixed_layer}</strong>
              </div>
            </>
          ) : (
            <div>
              <span>Mixed layer</span>
              <strong>{mixed.data.reason || "Not detected"}</strong>
            </div>
          )}
        </div>
      )}

      <details className="profile-evidence" style={{ marginTop: 16 }}>
        <summary>Evidence</summary>
        <p>
          Float {floatId} · Cycle {cycle}
        </p>
        <p>
          Thermocline file:{" "}
          {(thermo.data?.evidence as Record<string, unknown>)?.file as string || "N/A"}
        </p>
        <p>
          Mixed layer file:{" "}
          {(mixed.data?.evidence as Record<string, unknown>)?.file as string || "N/A"}
        </p>
      </details>
    </section>
  );
}

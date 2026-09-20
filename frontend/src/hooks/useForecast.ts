import { useState, useCallback, useRef } from "react";
import { getApiUrl } from "../apiConfig";

type ForecastPoint = {
  days_ahead: number;
  predicted_value: number;
  confidence_lower: number;
  confidence_upper: number;
  method: string;
};

type ForecastResult = {
  float_id: number;
  variable: string;
  unit: string;
  forecast_horizon_days: number;
  historical_points: number;
  forecasts: ForecastPoint[];
  disclaimer: string;
  evidence: Record<string, unknown>;
};

export function useForecast() {
  const [data, setData] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  const fetchForecast = useCallback(
    async (floatId: number, variable: string, horizonDays: number) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      let timedOut = false;
      const timer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 30000);

      setData(null);
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          getApiUrl(`/forecast/${floatId}?variable=${variable}&horizon_days=${horizonDays}`),
          { signal: controller.signal }
        );

        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.detail || `HTTP ${response.status}`);
        }

        if (!controller.signal.aborted) {
          setData(body as ForecastResult);
        }
      } catch (caught) {
        if (controller.signal.aborted && !timedOut) return;
        setError(
          timedOut
            ? "Forecast request timed out."
            : caught instanceof Error
              ? caught.message
              : "Could not generate forecast."
        );
      } finally {
        window.clearTimeout(timer);
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    requestRef.current?.abort();
    setData(null);
    setLoading(false);
    setError("");
  }, []);

  return { data, loading, error, fetchForecast, reset };
}

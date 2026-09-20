import { useCallback, useRef, useState } from "react";
import { getApiUrl } from "../apiConfig";

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
};

export function useOceanFetch<T>() {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: false,
    error: "",
  });
  const requestRef = useRef<AbortController | null>(null);

  const fetch_ = useCallback(
    async (url: string, options?: RequestInit) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      let timedOut = false;
      const timer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 30000);

      setState({ data: null, loading: true, error: "" });

      try {
        const response = await fetch(getApiUrl(url), {
          ...options,
          signal: controller.signal,
        });

        const body = await response.json().catch(() => null);

        if (!response.ok) {
          const detail = body?.detail;
          throw new Error(
            typeof detail === "string"
              ? detail
              : `Request failed: HTTP ${response.status}`
          );
        }

        if (!controller.signal.aborted) {
          setState({ data: body as T, loading: false, error: "" });
        }
      } catch (caught) {
        if (controller.signal.aborted && !timedOut) return;

        setState({
          data: null,
          loading: false,
          error: timedOut
            ? "Request timed out."
            : caught instanceof Error
              ? caught.message
              : "Could not complete request.",
        });
      } finally {
        window.clearTimeout(timer);
        if (requestRef.current === controller) {
          requestRef.current = null;
        }
      }
    },
    []
  );

  const reset = useCallback(() => {
    requestRef.current?.abort();
    setState({ data: null, loading: false, error: "" });
  }, []);

  return { ...state, fetch: fetch_, reset };
}

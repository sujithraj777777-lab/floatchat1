export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://floatchat-backend-9h3r.onrender.com";

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/api/")
    ? path.slice(4)
    : path.startsWith("/api")
    ? path.slice(4)
    : path;
  return `${API_BASE_URL}${cleanPath.startsWith("/") ? cleanPath : "/" + cleanPath}`;
}

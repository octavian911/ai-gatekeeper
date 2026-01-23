export function apiBase(): string {
  const v =
    (import.meta.env.VITE_API_BASE as string | undefined) ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    "/api";

  return v.endsWith("/") ? v.slice(0, -1) : v;
}

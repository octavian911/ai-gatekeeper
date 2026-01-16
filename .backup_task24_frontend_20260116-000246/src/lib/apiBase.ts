export function apiBase(): string {
  // Empty means "same origin"
  const v = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!v) return "";
  return v.replace(/\/+$/, "");
}

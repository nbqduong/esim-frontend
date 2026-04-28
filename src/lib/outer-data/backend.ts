const configuredBackendUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  (["5173", "3000"].includes(window.location.port)
    ? `http://${window.location.hostname}:8000`
    : "");

export function backendUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return configuredBackendUrl ? `${configuredBackendUrl}${normalizedPath}` : normalizedPath;
}

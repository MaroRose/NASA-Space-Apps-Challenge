// In production the frontend is served by FastAPI itself, so the API is
// same-origin ("/api/v1"). In dev (npm run dev) we talk to local uvicorn.
const API_BASE = import.meta.env.PROD
  ? "/api/v1"
  : "http://127.0.0.1:8000/api/v1";

export async function fetchRoutePlan({
  startX,
  startY,
  endX,
  endY,
  maxSlopeDeg = 20,
}) {
  const response = await fetch(`${API_BASE}/route/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_x: startX,
      start_y: startY,
      end_x: endX,
      end_y: endY,
      max_slope_deg: maxSlopeDeg,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail ?? `Route request failed (${response.status})`,
    );
  }

  return response.json();
}
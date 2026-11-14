const API_BASE = "http://127.0.0.1:8000/api/v1";

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
async function test() {
  try {
    const testData = await fetchRoutePlan({
      startX: 100,
      startY: 100,
      endX: 200,
      endY: 200,
    });
    console.log(testData);
  } catch (err) {
    console.log(err);
  }
}
test();

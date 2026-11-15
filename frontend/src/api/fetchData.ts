import type {
  HealthStatus,
  RoutePlanRequest,
  RoutePlanResponse,
  SiteOverview,
  TerrainPointInfo,
} from "../types/terrain.ts";

const paths = {
  health: "/health",
  siteOverview: "/site/overview",
  terrainPoint: "/terrain/point",
  routePlan: "/route/plan",
} as const;

type EndpointPath = "/health" | "/site/overview" | "/terrain/point" | "/route/plan";

type QueryParams = Record<string, string | number>;

const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api/v1";

function buildUrl(path: EndpointPath, params?: QueryParams): string {
  if (!params) return `${API_BASE}${path}`;
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  );
  return `${API_BASE}${path}?${query}`;
}

async function getJson<T>(
  path: EndpointPath,
  params?: QueryParams,
): Promise<T> {
  const response = await fetch(buildUrl(path, params));
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${response.status})`);
  }
  return response.json();
}

export function fetchHealth(): Promise<HealthStatus> {
  return getJson<HealthStatus>(paths.health);
}

export function fetchSiteOverview(): Promise<SiteOverview> {
  return getJson<SiteOverview>(paths.siteOverview);
}

export function fetchTerrainPoint(
  x: number,
  y: number,
): Promise<TerrainPointInfo> {
  return getJson<TerrainPointInfo>(paths.terrainPoint, {
    x: Math.round(x),
    y: Math.round(y),
  });
}

export async function fetchRoutePlan({
  startX,
  startY,
  endX,
  endY,
  startWaypoint,
  endWaypoint,
  maxSlopeDeg = 20,
}: RoutePlanRequest): Promise<RoutePlanResponse> {
  const response = await fetch(buildUrl(paths.routePlan), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_x: startX,
      start_y: startY,
      end_x: endX,
      end_y: endY,
      start_waypoint: startWaypoint,
      end_waypoint: endWaypoint,
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

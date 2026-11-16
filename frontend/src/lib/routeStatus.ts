import type { RoutePlanResponse } from "../types/terrain.ts";

export type RouteStatus = "GO" | "CAUTION" | "NO-GO";

export interface RouteStatusBadge {
  status: RouteStatus;
  color: string;
  inkColor: string;
}

// Within this many degrees of the suit limit the route is walkable but worth a warning.
const CAUTION_MARGIN_DEG = 5;

const BADGES: Record<RouteStatus, RouteStatusBadge> = {
  "NO-GO": { status: "NO-GO", color: "var(--danger)", inkColor: "#fff" },
  CAUTION: { status: "CAUTION", color: "var(--accent)", inkColor: "var(--accent-ink)" },
  GO: { status: "GO", color: "var(--info)", inkColor: "var(--accent-ink)" },
};

export function classifyRouteStatus(route: RoutePlanResponse | null, maxSlopeDeg: number): RouteStatusBadge | null {
  if (!route) return null;
  const steepestSlopeDeg = route.max_slope_encountered_deg;
  if (steepestSlopeDeg > maxSlopeDeg) return BADGES["NO-GO"];
  if (steepestSlopeDeg > maxSlopeDeg - CAUTION_MARGIN_DEG) return BADGES.CAUTION;
  return BADGES.GO;
}

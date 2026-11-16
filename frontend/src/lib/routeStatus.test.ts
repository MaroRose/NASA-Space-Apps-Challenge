import { describe, expect, it } from "vitest";
import type { RoutePlanResponse } from "../types/terrain.ts";
import { classifyRouteStatus } from "./routeStatus.ts";

function routeWithSteepestSlope(maxSlopeEncounteredDeg: number): RoutePlanResponse {
  return {
    status: "ok",
    storage_mode: "memory",
    compute_ms: 1,
    resolved_start: { x: 0, y: 0 },
    resolved_end: { x: 1, y: 1 },
    max_slope_limit_deg: 20,
    max_slope_encountered_deg: maxSlopeEncounteredDeg,
    total_distance_m: 100,
    waypoint_count: 2,
    path_coordinates: [],
    telemetry: [],
  };
}

describe("classifyRouteStatus", () => {
  it("returns null when no route has been computed", () => {
    expect(classifyRouteStatus(null, 20)).toBeNull();
  });

  it("flags NO-GO when the route is steeper than the suit limit", () => {
    expect(classifyRouteStatus(routeWithSteepestSlope(22.5), 20)?.status).toBe("NO-GO");
  });

  it("flags CAUTION within 5 degrees of the limit", () => {
    expect(classifyRouteStatus(routeWithSteepestSlope(16), 20)?.status).toBe("CAUTION");
    expect(classifyRouteStatus(routeWithSteepestSlope(20), 20)?.status).toBe("CAUTION");
  });

  it("returns GO when the route stays well under the limit", () => {
    const badge = classifyRouteStatus(routeWithSteepestSlope(15), 20);
    expect(badge?.status).toBe("GO");
    expect(badge?.color).toBe("var(--info)");
  });
});

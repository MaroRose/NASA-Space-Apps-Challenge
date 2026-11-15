import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRoutePlan } from "../api/fetchData.ts";
import type { RoutePlanResponse, SiteOverview } from "../types/terrain.ts";

export function useRoutePlan() {
  const [route, setRoute] = useState<RoutePlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const plan = useCallback((site: SiteOverview, maxSlopeDeg: number) => {
    if (site.waypoints.length < 2) return;
    const [from, to] = site.waypoints;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    fetchRoutePlan(
      { startWaypoint: from.id, endWaypoint: to.id, maxSlopeDeg },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setRoute(result);
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (controllerRef.current === controller) setLoading(false);
      });
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { route, loading, error, plan };
}

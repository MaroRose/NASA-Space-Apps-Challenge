import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRoutePlan } from "../api/fetchData.ts";
import type { GridCell, RoutePlanResponse } from "../types/terrain.ts";

export interface RoutePlanInput {
  start: GridCell;
  end: GridCell;
  maxSlopeDeg: number;
}

export function useRoutePlan() {
  const [route, setRoute] = useState<RoutePlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const plan = useCallback(({ start, end, maxSlopeDeg }: RoutePlanInput) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    fetchRoutePlan(
      { startX: start.x, startY: start.y, endX: end.x, endY: end.y, maxSlopeDeg },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setRoute(result);
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        setRoute(null);
        setError(err.message);
      })
      .finally(() => {
        if (controllerRef.current === controller) setLoading(false);
      });
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { route, loading, error, plan };
}

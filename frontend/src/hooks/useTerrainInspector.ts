import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTerrainPoint } from "../api/fetchData.ts";
import type { TerrainPointInfo } from "../types/terrain.ts";

export function useTerrainInspector(throttleMs = 150) {
  const [inspected, setInspected] = useState<TerrainPointInfo | null>(null);
  const lastRequestRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  const request = useCallback((x: number, y: number) => {
    lastRequestRef.current = performance.now();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    fetchTerrainPoint(x, y, controller.signal)
      .then((info) => {
        if (!controller.signal.aborted) setInspected(info);
      })
      .catch(() => {
        if (!controller.signal.aborted) setInspected(null);
      });
  }, []);

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const onHover = useCallback(
    (x: number, y: number) => {
      const elapsed = performance.now() - lastRequestRef.current;
      if (elapsed >= throttleMs) {
        cancelPending();
        request(x, y);
        return;
      }
      pendingRef.current = { x, y };
      if (timerRef.current !== null) return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) request(pending.x, pending.y);
      }, throttleMs - elapsed);
    },
    [throttleMs, request, cancelPending],
  );

  const clear = useCallback(() => {
    cancelPending();
    controllerRef.current?.abort();
    setInspected(null);
  }, [cancelPending]);

  useEffect(
    () => () => {
      cancelPending();
      controllerRef.current?.abort();
    },
    [cancelPending],
  );

  return { inspected, onHover, clear };
}

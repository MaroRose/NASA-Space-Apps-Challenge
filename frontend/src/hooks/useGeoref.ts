import { useEffect, useState } from "react";
import type { GridGeoref } from "../lib/marsCoords.ts";

const GEOREF_URL = "/terrain/georef.json";

export function useGeoref() {
  const [georef, setGeoref] = useState<GridGeoref | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(GEOREF_URL, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((info: GridGeoref | null) => {
        if (
          info &&
          typeof info.left_m === "number" &&
          typeof info.top_m === "number" &&
          typeof info.mars_radius_m === "number"
        ) {
          setGeoref(info);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return georef;
}

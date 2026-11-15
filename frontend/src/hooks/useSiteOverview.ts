import { useEffect, useState } from "react";
import { fetchSiteOverview } from "../api/fetchData.ts";
import type { SiteOverview } from "../types/terrain.ts";

export function useSiteOverview() {
  const [site, setSite] = useState<SiteOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchSiteOverview(controller.signal)
      .then(setSite)
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, []);

  return { site, error };
}

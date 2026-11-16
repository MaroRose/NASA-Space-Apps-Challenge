import { useEffect, useState } from "react";
import type { MarsLatLon } from "../lib/marsCoords.ts";

export const ROVER_PATH_URL = "/terrain/rover-path.json";

export interface RoverPathPoint extends MarsLatLon {
  sol: number;
  odometryKm: number;
}

export interface RoverSite extends MarsLatLon {
  name: string;
}

export interface RoverPath {
  source: string;
  points: RoverPathPoint[];
  sites: RoverSite[];
  landing: RoverPathPoint;
  latest: RoverPathPoint;
}

interface RoverPathFile {
  source: string;
  points: [number, number, number, number][];
  sites: RoverSite[];
}

export function useRoverPath() {
  const [roverPath, setRoverPath] = useState<RoverPath | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(ROVER_PATH_URL, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((file: RoverPathFile | null) => {
        if (!file || !Array.isArray(file.points) || file.points.length < 2) return;
        const points = file.points.map(([lon, lat, sol, odometryKm]) => ({
          lon,
          lat,
          sol,
          odometryKm,
        }));
        setRoverPath({
          source: file.source,
          points,
          sites: Array.isArray(file.sites) ? file.sites : [],
          landing: points[0],
          latest: points[points.length - 1],
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return roverPath;
}

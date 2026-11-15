import type { GridCell } from "../types/terrain.ts";

export interface GridGeoref {
  left_m: number;
  top_m: number;
  right_m: number;
  bottom_m: number;
  mars_radius_m: number;
  accuracy_m?: number;
}

export interface MarsLatLon {
  lat: number;
  lon: number;
}

const DEG = 180 / Math.PI;

export function metersPerDegree(georef: GridGeoref) {
  return (2 * Math.PI * georef.mars_radius_m) / 360;
}

export function cellToLatLon(georef: GridGeoref, x: number, y: number, resolutionM: number): MarsLatLon {
  const k = metersPerDegree(georef);
  return {
    lon: (georef.left_m + (x + 0.5) * resolutionM) / k,
    lat: (georef.top_m - (y + 0.5) * resolutionM) / k,
  };
}

export function latLonToCell(
  georef: GridGeoref,
  latLon: MarsLatLon,
  resolutionM: number,
): GridCell {
  const k = metersPerDegree(georef);
  return {
    x: Math.floor((latLon.lon * k - georef.left_m) / resolutionM),
    y: Math.floor((georef.top_m - latLon.lat * k) / resolutionM),
  };
}

export function latLonToGridPoint(
  georef: GridGeoref,
  latLon: MarsLatLon,
  resolutionM: number,
): { x: number; y: number } {
  const k = metersPerDegree(georef);
  return {
    x: (latLon.lon * k - georef.left_m) / resolutionM - 0.5,
    y: (georef.top_m - latLon.lat * k) / resolutionM - 0.5,
  };
}

export function isInsideGrid(cell: GridCell, cols: number, rows: number) {
  return cell.x >= 0 && cell.y >= 0 && cell.x < cols && cell.y < rows;
}

export function formatLatLon({ lat, lon }: MarsLatLon, decimals = 4) {
  const ns = lat < 0 ? "S" : "N";
  return `${Math.abs(lat).toFixed(decimals)}°${ns} ${lon.toFixed(decimals)}°E`;
}

export function bearingDeg(from: GridCell, to: GridCell) {
  const dx = to.x - from.x;
  const dy = from.y - to.y;
  return ((Math.atan2(dx, dy) * DEG) % 360 + 360) % 360;
}

export function compassLabel(bearing: number) {
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round(bearing / 45) % 8];
}

export function distanceM(from: GridCell, to: GridCell, resolutionM: number) {
  return Math.hypot(to.x - from.x, to.y - from.y) * resolutionM;
}

export function parseLatLon(input: string): MarsLatLon | null {
  const cleaned = input.trim().replace(/°/g, " ");
  const match = cleaned.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*([NS])?\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*([EW])?\s*$/i,
  );
  if (!match) return null;
  let lat = Number(match[1]);
  let lon = Number(match[3]);
  if (match[2]?.toUpperCase() === "S") lat = -Math.abs(lat);
  if (match[4]?.toUpperCase() === "W") lon = -Math.abs(lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) return null;
  if (lon < 0) lon += 360;
  return { lat, lon };
}

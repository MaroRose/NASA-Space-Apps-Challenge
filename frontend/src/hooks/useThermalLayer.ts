import { useCallback, useEffect, useState } from "react";

export interface ThermalLegendInfo {
  min: number;
  max: number;
  units: string;
  stops: [number, number, number][];
  value_min: number;
  value_max: number;
}

interface ValueGrid {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export const THERMAL_IMAGE_URL = "/terrain/thermal.png";
const THERMAL_VALUES_URL = "/terrain/thermal-values.png";
const THERMAL_LEGEND_URL = "/terrain/thermal.json";

async function loadLegend(signal: AbortSignal): Promise<ThermalLegendInfo | null> {
  const response = await fetch(THERMAL_LEGEND_URL, { signal });
  if (!response.ok) return null;
  const info: ThermalLegendInfo = await response.json();
  const complete =
    typeof info.min === "number" &&
    typeof info.max === "number" &&
    typeof info.value_min === "number" &&
    typeof info.value_max === "number" &&
    Array.isArray(info.stops) &&
    info.stops.length >= 2;
  return complete ? info : null;
}

async function loadValueGrid(signal: AbortSignal): Promise<ValueGrid | null> {
  const response = await fetch(THERMAL_VALUES_URL, { signal });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) return null;
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none" });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  return { width: bitmap.width, height: bitmap.height, data };
}

export function useThermalLayer() {
  const [legend, setLegend] = useState<ThermalLegendInfo | null>(null);
  const [grid, setGrid] = useState<ValueGrid | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadLegend(controller.signal)
      .then(setLegend)
      .catch(() => {});
    loadValueGrid(controller.signal)
      .then(setGrid)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const valueAt = useCallback(
    (x: number, y: number): number | null => {
      if (!legend || !grid) return null;
      const col = Math.round(x);
      const row = Math.round(y);
      if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) return null;
      const offset = (row * grid.width + col) * 4;
      if (grid.data[offset + 3] === 0) return null;
      const level = grid.data[offset] / 255;
      return legend.value_min + level * (legend.value_max - legend.value_min);
    },
    [legend, grid],
  );

  return { legend, valueAt };
}

import type { TerrainPointInfo } from "../types/terrain.ts";

interface PointInspectorProps {
  inspected: TerrainPointInfo;
  latLonLabel: string | null;
  thermalValue: number | null;
}

export function PointInspector({ inspected, latLonLabel, thermalValue }: PointInspectorProps) {
  const slopeColor = inspected.is_hazard ? "var(--danger)" : "var(--text)";

  return (
    <div className="map-overlay map-overlay--inspector" role="group" aria-label="Point inspector">
      <span className="eyebrow" style={{ fontFamily: "var(--font-body)" }}>
        POINT INSPECTOR
      </span>
      <span>{latLonLabel ?? "position unavailable"}</span>
      <span>elev {inspected.elev_m.toFixed(1)} m</span>
      <span style={{ color: slopeColor }}>
        slope {inspected.slope_deg.toFixed(1)}° {inspected.is_hazard ? "HAZARD" : ""}
      </span>
      {thermalValue !== null && <span>thermal inertia {thermalValue.toFixed(0)}</span>}
    </div>
  );
}

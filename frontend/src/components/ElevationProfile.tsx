import type { RoutePlanResponse } from "../types/terrain.ts";

interface ElevationProfileProps {
  route: RoutePlanResponse | null;
  maxSlopeDeg: number;
}

const VIEW_W = 1000;
const VIEW_H = 120;

/**
 * Built entirely from a real /route/plan response's path_coordinates
 * (elev_m + slope_deg per step) — no backend work needed for this one.
 */
export function ElevationProfile({ route, maxSlopeDeg }: ElevationProfileProps) {
  if (!route || route.path_coordinates.length < 2) {
    return (
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface)",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        Elevation profile appears once a route is computed.
      </div>
    );
  }

  const points = route.path_coordinates;
  // Walked in grid-cell units for proportional spacing along the x-axis;
  // rescaled below to the backend's authoritative total_distance_m, since a
  // cell is only 1:1 with meters when resolution_m happens to be 1.
  let cumulativeCells = 0;
  const cellDistances: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    cumulativeCells += Math.hypot(dx, dy);
    cellDistances.push(cumulativeCells);
  }
  const totalCells = cumulativeCells || 1;
  const metersPerCell = route.total_distance_m / totalCells;
  const distances = cellDistances.map((d) => d * metersPerCell);
  const totalDist = route.total_distance_m || 1;

  const elevations = points.map((p) => p.elev_m);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevSpan = Math.max(maxElev - minElev, 1);

  const toX = (d: number) => 40 + (d / totalDist) * (VIEW_W - 50);
  const toY = (e: number) => VIEW_H - 20 - ((e - minElev) / elevSpan) * (VIEW_H - 40);

  const segments: { d: string; caution: boolean }[] = [];
  for (let i = 1; i < points.length; i++) {
    const prevCaution = (points[i - 1].slope_deg ?? 0) > maxSlopeDeg - 5;
    const curCaution = (points[i].slope_deg ?? 0) > maxSlopeDeg - 5;
    segments.push({
      d: `M${toX(distances[i - 1])} ${toY(elevations[i - 1])} L${toX(distances[i])} ${toY(elevations[i])}`,
      caution: prevCaution || curCaution,
    });
  }

  const areaD =
    `M${toX(0)} ${toY(elevations[0])} ` +
    points.map((p, i) => `L${toX(distances[i])} ${toY(p.elev_m)}`).join(" ") +
    ` L${toX(totalDist)} ${VIEW_H - 10} L${toX(0)} ${VIEW_H - 10} Z`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 16px 12px",
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.1em", color: "var(--text-muted)" }}>
          ELEVATION PROFILE
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {points.length} path points · {(totalDist).toFixed(0)} m
        </span>
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" style={{ width: "100%", height: 110 }}>
        <g stroke="var(--border)" strokeWidth={1}>
          <path d={`M40 20 H${VIEW_W - 10} M40 50 H${VIEW_W - 10} M40 80 H${VIEW_W - 10}`} />
        </g>
        <path d={areaD} fill="var(--accent)" fillOpacity={0.12} />
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            fill="none"
            stroke={seg.caution ? "var(--accent)" : "var(--info)"}
            strokeWidth={3}
            strokeDasharray={seg.caution ? "4 3" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <text x={toX(0)} y={VIEW_H - 4} className="mono" fontSize={9} fill="var(--text-muted)">
          0 m
        </text>
        <text x={toX(totalDist)} y={VIEW_H - 4} textAnchor="end" className="mono" fontSize={9} fill="var(--text-muted)">
          {totalDist.toFixed(0)} m
        </text>
      </svg>
    </div>
  );
}

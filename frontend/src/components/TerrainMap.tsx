import { useRef } from "react";
import type { RoutePlanResponse, SiteOverview } from "../types/terrain.ts";

export interface LayerVisibility {
  imagery: boolean;
  hazard: boolean;
  route: boolean;
  waypoints: boolean;
  walkbackRing: boolean;
}

interface TerrainMapProps {
  site: SiteOverview;
  route: RoutePlanResponse | null;
  layers: LayerVisibility;
  walkbackM: number;
  habitatId?: string;
  terrainImageUrl?: string;
  hazardImageUrl?: string;
  onPointHover?: (gridX: number, gridY: number) => void;
  onPointLeave?: () => void;
}

export function TerrainMap({
  site,
  route,
  layers,
  walkbackM,
  habitatId = "hab_alpha",
  terrainImageUrl,
  hazardImageUrl,
  onPointHover,
  onPointLeave,
}: TerrainMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rows, cols] = site.grid_shape;

  const habitat = site.waypoints.find((w) => w.id === habitatId) ?? site.waypoints[0];
  const pois = site.waypoints.filter((w) => w !== habitat);

  const walkbackCells = site.resolution_m > 0 ? walkbackM / site.resolution_m : 0;

  function handleMove(evt: React.MouseEvent<SVGSVGElement>) {
    if (!onPointHover || !svgRef.current) return;
    const point = svgRef.current.createSVGPoint();
    point.x = evt.clientX;
    point.y = evt.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const userPoint = point.matrixTransform(ctm.inverse());
    onPointHover(userPoint.x, userPoint.y);
  }

  const pathD = route
    ? "M " + route.path_coordinates.map((p) => `${p.x} ${p.y}`).join(" L ")
    : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Map of ${site.site_name}`}
      onMouseMove={handleMove}
      onMouseLeave={onPointLeave}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        background: "var(--bg)",
      }}
    >
      {layers.imagery && (
        terrainImageUrl ? (
          <image href={terrainImageUrl} x={0} y={0} width={cols} height={rows} opacity={0.9} />
        ) : (
          <g opacity={0.9}>
            <rect x={0} y={0} width={cols} height={rows} fill="var(--terrain-base)" />
            <text
              x={cols / 2}
              y={rows / 2}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontFamily="var(--font-mono)"
              fontSize={Math.max(cols, rows) / 40}
            >
              imagery layer: awaiting backend raster
            </text>
          </g>
        )
      )}

      {layers.hazard && hazardImageUrl && (
        <image href={hazardImageUrl} x={0} y={0} width={cols} height={rows} opacity={0.75} />
      )}

      {layers.walkbackRing && habitat && walkbackCells > 0 && (
        <circle
          cx={habitat.x}
          cy={habitat.y}
          r={walkbackCells}
          fill="var(--info)"
          fillOpacity={0.05}
          stroke="var(--info)"
          strokeWidth={Math.max(cols, rows) / 400}
          strokeDasharray={`${Math.max(cols, rows) / 100} ${Math.max(cols, rows) / 120}`}
        />
      )}

      {layers.route && pathD && (
        <g>
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent-ink)"
            strokeOpacity={0.5}
            strokeWidth={Math.max(cols, rows) / 140}
            strokeLinejoin="round"
          />
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={Math.max(cols, rows) / 290}
            strokeLinejoin="round"
          />
        </g>
      )}

      {layers.waypoints && habitat && (
        <g transform={`translate(${habitat.x} ${habitat.y})`}>
          <rect
            x={-cols / 90}
            y={-cols / 90}
            width={cols / 45}
            height={cols / 45}
            rx={cols / 400}
            fill="var(--info)"
            stroke="var(--bg)"
            strokeWidth={cols / 400}
          />
          <text
            x={cols / 60}
            y={-cols / 90}
            fontFamily="var(--font-body)"
            fontWeight={600}
            fontSize={cols / 50}
            fill="var(--text)"
          >
            {habitat.id}
          </text>
        </g>
      )}
      {layers.waypoints &&
        pois.map((wp) => (
          <g key={wp.id} transform={`translate(${wp.x} ${wp.y})`}>
            <path
              d={`M0 ${-cols / 90} L${cols / 90} 0 L0 ${cols / 90} L${-cols / 90} 0 Z`}
              fill="var(--surface)"
              stroke="var(--text-soft)"
              strokeWidth={cols / 500}
            />
            <text
              x={cols / 60}
              y={cols / 150}
              fontFamily="var(--font-body)"
              fontSize={cols / 55}
              fill="var(--text)"
            >
              {wp.id}
            </text>
          </g>
        ))}

      {layers.route && route && (
        <>
          <circle
            cx={route.resolved_start.x}
            cy={route.resolved_start.y}
            r={cols / 110}
            fill="var(--accent)"
            stroke="var(--bg)"
            strokeWidth={cols / 400}
          />
          <circle
            cx={route.resolved_end.x}
            cy={route.resolved_end.y}
            r={cols / 110}
            fill="var(--accent)"
            stroke="var(--bg)"
            strokeWidth={cols / 400}
          />
        </>
      )}
    </svg>
  );
}

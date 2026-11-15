import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Marker,
  Pane,
  Polyline,
  Rectangle,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "../styles/map.css";
import type { GridCell, RoutePlanResponse, SiteOverview } from "../types/terrain.ts";
import { GridCRS, cellToLatLng } from "../lib/gridCrs.ts";

export interface LayerVisibility {
  imagery: boolean;
  optical: boolean;
  thermal: boolean;
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
  opticalImageUrl?: string;
  thermalImageUrl?: string;
  hazardImageUrl?: string;
  start?: GridCell | null;
  end?: GridCell | null;
  position?: GridCell | null;
  onPointHover?: (gridX: number, gridY: number) => void;
  onPointLeave?: () => void;
  onPointPick?: (gridX: number, gridY: number) => void;
}

const habitatIcon = L.divIcon({
  className: "",
  iconSize: [0, 0],
  html: '<span class="wp-marker wp-marker--hab"></span>',
});

const poiIcon = L.divIcon({
  className: "",
  iconSize: [0, 0],
  html: '<span class="wp-marker"></span>',
});

const positionIcon = L.divIcon({
  className: "",
  iconSize: [0, 0],
  html: '<span class="position-marker"></span>',
});

const ENDPOINT_STYLE = { color: "var(--bg)", weight: 2, fillColor: "var(--accent)", fillOpacity: 1 };

function FitGrid({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    let userMoved = false;
    let fitting = false;
    const markMoved = () => {
      if (!fitting) userMoved = true;
    };
    // Leaflet only tracks window resizes; the map area also changes size when
    // the elevation profile below it appears, so re-measure on container resize.
    const refit = () => {
      fitting = true;
      map.invalidateSize({ animate: false });
      map.setMinZoom(-10);
      const fitZoom = map.getBoundsZoom(bounds);
      if (!userMoved) map.fitBounds(bounds, { animate: false });
      map.setMinZoom(fitZoom - 0.5);
      fitting = false;
    };
    refit();
    const observer = new ResizeObserver(refit);
    observer.observe(map.getContainer());
    map.on("dragstart zoomstart", markMoved);
    return () => {
      observer.disconnect();
      map.off("dragstart zoomstart", markMoved);
    };
  }, [map, bounds]);
  return null;
}

interface MapEventsProps {
  rows: number;
  cols: number;
  onPointHover?: (gridX: number, gridY: number) => void;
  onPointLeave?: () => void;
  onPointPick?: (gridX: number, gridY: number) => void;
}

function MapEvents({ rows, cols, onPointHover, onPointLeave, onPointPick }: MapEventsProps) {
  useMapEvents({
    mousemove: (e) => onPointHover?.(e.latlng.lng, e.latlng.lat),
    mouseout: () => onPointLeave?.(),
    click: (e) => {
      const x = Math.round(e.latlng.lng);
      const y = Math.round(e.latlng.lat);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      onPointPick?.(x, y);
    },
  });
  return null;
}

export function TerrainMap({
  site,
  route,
  layers,
  walkbackM,
  habitatId = "hab_alpha",
  terrainImageUrl,
  opticalImageUrl,
  thermalImageUrl,
  hazardImageUrl,
  start,
  end,
  position,
  onPointHover,
  onPointLeave,
  onPointPick,
}: TerrainMapProps) {
  const [rows, cols] = site.grid_shape;

  // Half-cell inset: routes run through cell centres at integer coordinates,
  // so raster pixel (0, 0) must be centred on (0, 0) rather than start there.
  const bounds = useMemo(
    () => L.latLngBounds([-0.5, -0.5], [rows - 0.5, cols - 0.5]),
    [rows, cols],
  );

  const habitat = site.waypoints.find((w) => w.id === habitatId) ?? site.waypoints[0];
  const pois = site.waypoints.filter((w) => w !== habitat);
  const walkbackCells = site.resolution_m > 0 ? walkbackM / site.resolution_m : 0;
  // Safe zone follows the chosen start point; falls back to the habitat.
  const safeCenter = start ?? habitat;

  const path = route?.path_coordinates.map((p) => cellToLatLng(p.x, p.y)) ?? [];
  const routeStart = route?.path_coordinates[0] ?? start;
  const routeEnd = route?.path_coordinates[route.path_coordinates.length - 1] ?? end;

  return (
    <MapContainer
      className="terrain-map"
      crs={GridCRS}
      bounds={bounds}
      maxBounds={bounds.pad(0.25)}
      maxBoundsViscosity={1}
      minZoom={-10}
      maxZoom={8}
      zoomSnap={0.25}
      zoomControl={false}
      doubleClickZoom={false}
      attributionControl={false}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    >
      <FitGrid bounds={bounds} />
      <ZoomControl position="bottomright" />
      <MapEvents
        rows={rows}
        cols={cols}
        onPointHover={onPointHover}
        onPointLeave={onPointLeave}
        onPointPick={onPointPick}
      />

      <Pane name="imagery" style={{ zIndex: 200 }}>
        {layers.imagery &&
          (terrainImageUrl ? (
            <ImageOverlay url={terrainImageUrl} bounds={bounds} />
          ) : (
            <Rectangle
              bounds={bounds}
              interactive={false}
              pathOptions={{ stroke: false, fillColor: "var(--terrain-base)", fillOpacity: 0.9 }}
            />
          ))}
      </Pane>

      <Pane name="optical" style={{ zIndex: 220 }}>
        {layers.optical && opticalImageUrl && <ImageOverlay url={opticalImageUrl} bounds={bounds} />}
      </Pane>

      <Pane name="thermal" style={{ zIndex: 225 }}>
        {layers.thermal && thermalImageUrl && <ImageOverlay url={thermalImageUrl} bounds={bounds} />}
      </Pane>

      <Pane name="hazard" style={{ zIndex: 250 }}>
        {layers.hazard && hazardImageUrl && (
          <ImageOverlay url={hazardImageUrl} bounds={bounds} className="hazard-raster" />
        )}
      </Pane>

      {layers.walkbackRing && safeCenter && walkbackCells > 0 && (
        <Circle
          center={cellToLatLng(safeCenter.x, safeCenter.y)}
          radius={walkbackCells}
          interactive={false}
          pathOptions={{
            color: "var(--info)",
            weight: 1.5,
            dashArray: "8 6",
            fillColor: "var(--info)",
            fillOpacity: 0.05,
          }}
        />
      )}

      {layers.route && path.length > 1 && (
        <>
          <Polyline
            positions={path}
            interactive={false}
            pathOptions={{ color: "var(--accent-ink)", opacity: 0.5, weight: 7 }}
          />
          <Polyline
            positions={path}
            interactive={false}
            pathOptions={{ color: "var(--accent)", weight: 3 }}
          />
        </>
      )}

      {layers.waypoints && habitat && (
        <Marker
          position={cellToLatLng(habitat.x, habitat.y)}
          icon={habitatIcon}
          eventHandlers={{ click: () => onPointPick?.(habitat.x, habitat.y) }}
        >
          <Tooltip permanent direction="right" offset={[10, 0]} className="wp-label">
            {habitat.id}
          </Tooltip>
        </Marker>
      )}
      {layers.waypoints &&
        pois.map((wp) => (
          <Marker
            key={wp.id}
            position={cellToLatLng(wp.x, wp.y)}
            icon={poiIcon}
            eventHandlers={{ click: () => onPointPick?.(wp.x, wp.y) }}
          >
            <Tooltip permanent direction="right" offset={[10, 0]} className="wp-label">
              {wp.id}
            </Tooltip>
          </Marker>
        ))}

      {layers.route && routeStart && (
        <CircleMarker
          center={cellToLatLng(routeStart.x, routeStart.y)}
          radius={6}
          interactive={false}
          pathOptions={ENDPOINT_STYLE}
        />
      )}
      {layers.route && routeEnd && (
        <CircleMarker
          center={cellToLatLng(routeEnd.x, routeEnd.y)}
          radius={6}
          interactive={false}
          pathOptions={ENDPOINT_STYLE}
        />
      )}

      {position && (
        <Marker position={cellToLatLng(position.x, position.y)} icon={positionIcon} interactive={false}>
          <Tooltip permanent direction="right" offset={[12, 0]} className="wp-label">
            you
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}

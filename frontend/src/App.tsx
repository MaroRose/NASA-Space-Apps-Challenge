import { useEffect, useState } from "react";
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/stage.css";
import { TerrainMap, type LayerVisibility } from "./components/TerrainMap.tsx";
import { LayerRail } from "./components/LayerRail.tsx";
import { RoutePanel, type PlacingTarget } from "./components/RoutePanel.tsx";
import { ElevationProfile } from "./components/ElevationProfile.tsx";
import { useSiteOverview } from "./hooks/useSiteOverview.ts";
import { useRoutePlan } from "./hooks/useRoutePlan.ts";
import { useTerrainInspector } from "./hooks/useTerrainInspector.ts";
import type { GridCell } from "./types/terrain.ts";
import { TelemetryPanel } from "./components/TelemetryPanel.tsx";
import { ThermalLegend } from "./components/ThermalLegend.tsx";
import { THERMAL_IMAGE_URL, useThermalLayer } from "./hooks/useThermalLayer.ts";
import { PositionPanel } from "./components/PositionPanel.tsx";
import { useGeoref } from "./hooks/useGeoref.ts";
import { cellToLatLon, formatLatLon } from "./lib/marsCoords.ts";
import { useRoverPath } from "./hooks/useRoverPath.ts";
import { usePanelNavigation } from "./hooks/usePanelNavigation.ts";
import { PanelSwitcher } from "./components/PanelSwitcher.tsx";
import { PointInspector } from "./components/PointInspector.tsx";
import { classifyRouteStatus } from "./lib/routeStatus.ts";

const DEFAULT_LAYERS: LayerVisibility = {
  imagery: true,
  optical: false,
  thermal: false,
  hazard: true,
  route: true,
  waypoints: true,
  walkbackRing: true,
  roverPath: true,
};

const WALKBACK_M = 1500;
const HABITAT_ID = "hab_alpha";
const MIN_SLOPE_LIMIT_DEG = 10;
const MAX_SLOPE_LIMIT_DEG = 30;
const HOVER_THROTTLE_MS = 150;
const DEFAULT_DEPARTURE_HOUR = 9;

function App() {
  const { site, error: siteError } = useSiteOverview();
  const { route, loading: routeLoading, error: routeError, plan } = useRoutePlan();
  const { inspected, onHover, clear: clearInspected } = useTerrainInspector(HOVER_THROTTLE_MS);
  const { legend: thermalLegend, valueAt: thermalValueAt } = useThermalLayer();
  const inspectedThermal = inspected ? thermalValueAt(inspected.x, inspected.y) : null;
  const georef = useGeoref();
  const roverPath = useRoverPath();
  const { activePanel, selectPanel, closePanel } = usePanelNavigation();

  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [maxSlopeDeg, setMaxSlopeDeg] = useState(20);
  const [departureHour, setDepartureHour] = useState(DEFAULT_DEPARTURE_HOUR);


  const [pickedStart, setPickedStart] = useState<GridCell | null>(null);
  const [pickedEnd, setPickedEnd] = useState<GridCell | null>(null);
  const [placing, setPlacing] = useState<PlacingTarget>("end");
  const [position, setPosition] = useState<GridCell | null>(null);
  const [placingPosition, setPlacingPosition] = useState(false);

  const habitat = site?.waypoints.find((w) => w.id === HABITAT_ID) ?? site?.waypoints[0];
  const firstPoi = site?.waypoints.find((w) => w !== habitat);
  const start = pickedStart ?? habitat ?? null;
  const end = pickedEnd ?? firstPoi ?? null;
  const startX = start?.x;
  const startY = start?.y;
  const endX = end?.x;
  const endY = end?.y;

  useEffect(() => {
    if (startX === undefined || startY === undefined || endX === undefined || endY === undefined) return;
    plan({ start: { x: startX, y: startY }, end: { x: endX, y: endY }, maxSlopeDeg });
  }, [startX, startY, endX, endY, plan]);

  function handlePick(x: number, y: number) {
    onHover(x, y);
    if (placingPosition) {
      setPosition({ x, y });
      setPlacingPosition(false);
      return;
    }
    if (placing === "start") setPickedStart({ x, y });
    else setPickedEnd({ x, y });
  }

  function routeHome() {
    if (!position || !habitat) return;
    setPickedStart(position);
    setPickedEnd({ x: habitat.x, y: habitat.y });
    closePanel();
  }

  function choosePlacingTarget(target: PlacingTarget) {
    setPlacing(target);
    closePanel();
  }

  function togglePlacingPosition(isPlacing: boolean) {
    setPlacingPosition(isPlacing);
    if (isPlacing) closePanel();
  }

  const inspectedLatLon =
    georef && inspected && site
      ? formatLatLon(cellToLatLon(georef, inspected.x, inspected.y, site.resolution_m))
      : null;

  const hazardLimit = Math.min(
    MAX_SLOPE_LIMIT_DEG,
    Math.max(MIN_SLOPE_LIMIT_DEG, Math.round(route?.max_slope_limit_deg ?? maxSlopeDeg)),
  );

  if (siteError) {
    return (
      <main style={{ padding: 24, color: "var(--danger)" }}>
        Could not reach the backend: {siteError}. Is backend running on{" "}
        <code>http://127.0.0.1:8000</code>?
      </main>
    );
  }

  if (!site) {
    return <main style={{ padding: 24, color: "var(--text-muted)" }}>Loading site…</main>;
  }

  return (
    <div className="app-shell" data-active-panel={activePanel}>
      <header className="app-header">
        <div className="app-header__titles">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.04em",
            }}
          >
            MARSWALK PLANNER
          </span>
          <span className="app-header__subtitle">
            {site.site_name} · {site.grid_shape[1]}×{site.grid_shape[0]} cells ·{" "}
            {site.resolution_m} m/px
          </span>
        </div>
      </header>

      <LayerRail layers={layers} onChange={setLayers} />

      <section className="map-stage">
        <div className="map-stage__viewport">
          <TerrainMap
            site={site}
            route={route}
            layers={layers}
            walkbackM={WALKBACK_M}
            habitatId={HABITAT_ID}
            terrainImageUrl="/terrain/hillshade.png"
            opticalImageUrl={site.layers?.find((l) => l.id === "optical")?.url}
            thermalImageUrl={THERMAL_IMAGE_URL}
            hazardImageUrl={`/terrain/hazard-${hazardLimit}.png`}
            start={start}
            end={end}
            position={position}
            georef={georef}
            roverPath={roverPath}
            onPointHover={onHover}
            onPointLeave={clearInspected}
            onPointPick={handlePick}
          />

          {layers.thermal && <ThermalLegend legend={thermalLegend} cursorValue={inspectedThermal} />}

          {inspected && (
            <PointInspector inspected={inspected} latLonLabel={inspectedLatLon} thermalValue={inspectedThermal} />
          )}
        </div>

        <ElevationProfile route={route} maxSlopeDeg={maxSlopeDeg} />
      </section>

      <RoutePanel
        site={site}
        route={route}
        loading={routeLoading}
        error={routeError}
        maxSlopeDeg={maxSlopeDeg}
        minSlopeDeg={MIN_SLOPE_LIMIT_DEG}
        maxSlopeLimitDeg={MAX_SLOPE_LIMIT_DEG}
        start={start}
        end={end}
        placing={placing}
        onPlacingChange={choosePlacingTarget}
        onMaxSlopeChange={setMaxSlopeDeg}
        onRecompute={() => {
          if (start && end) plan({ start, end, maxSlopeDeg });
        }}
        georef={georef}
      >
        <PositionPanel
          site={site}
          georef={georef}
          position={position}
          habitat={habitat ?? null}
          walkbackM={WALKBACK_M}
          placingPosition={placingPosition}
          onPlacingPositionChange={togglePlacingPosition}
          onPositionChange={setPosition}
          onRouteHome={routeHome}
        />
        <TelemetryPanel
          telemetry={site.hourly_telemetry}
          distanceM={route?.total_distance_m ?? null}
          departureHour={departureHour}
          onDepartureHourChange={setDepartureHour}
        />
      </RoutePanel>

      <div className="panel-scrim" aria-hidden="true" onClick={closePanel} />
      <PanelSwitcher
        activePanel={activePanel}
        onSelect={selectPanel}
        routeStatus={classifyRouteStatus(route, maxSlopeDeg)}
      />
    </div>
  );
}

export default App;

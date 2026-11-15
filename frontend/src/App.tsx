import { useEffect, useState } from "react";
import "./styles/tokens.css";
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


const DEFAULT_LAYERS: LayerVisibility = {
  imagery: true,
  optical: true,
  thermal: false,
  hazard: true,
  route: true,
  waypoints: true,
  walkbackRing: true,
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

  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [maxSlopeDeg, setMaxSlopeDeg] = useState(20);
  const [departureHour, setDepartureHour] = useState(DEFAULT_DEPARTURE_HOUR);


  const [pickedStart, setPickedStart] = useState<GridCell | null>(null);
  const [pickedEnd, setPickedEnd] = useState<GridCell | null>(null);
  const [placing, setPlacing] = useState<PlacingTarget>("end");

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
    // Slope is left out on purpose: the slider only applies on Recompute,
    // so dragging it doesn't spam the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startX, startY, endX, endY, plan]);

  function handlePick(x: number, y: number) {
    if (placing === "start") setPickedStart({ x, y });
    else setPickedEnd({ x, y });
  }

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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          padding: "10px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
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
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {site.site_name} · {site.grid_shape[1]}×{site.grid_shape[0]} cells ·{" "}
            {site.resolution_m} m/px
          </span>
        </div>
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          flex: "1 1 auto",
          minHeight: 0,
        }}
      >
        <LayerRail layers={layers} onChange={setLayers} />

        <section
          style={{
            flex: "999 1 560px",
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0 }}>
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
              onPointHover={onHover}
              onPointLeave={clearInspected}
              onPointPick={handlePick}
            />

            {layers.thermal && <ThermalLegend legend={thermalLegend} cursorValue={inspectedThermal} />}

            {inspected && (
              <div
                style={{
                  position: "absolute",
                  left: 16,
                  top: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "10px 12px",
                  minWidth: 180,
                  background: "rgba(18,22,29,0.94)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  pointerEvents: "none",
                }}
              >
                <span
                  className="eyebrow"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  POINT INSPECTOR
                </span>
                <span>
                  cell ({inspected.x}, {inspected.y})
                </span>
                <span>elev {inspected.elev_m.toFixed(1)} m</span>
                <span
                  style={{
                    color: inspected.is_hazard
                      ? "var(--danger)"
                      : "var(--text)",
                  }}
                >
                  slope {inspected.slope_deg.toFixed(1)}°{" "}
                  {inspected.is_hazard ? "HAZARD" : ""}
                </span>
                {inspectedThermal !== null && <span>thermal inertia {inspectedThermal.toFixed(0)}</span>}
              </div>
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
          onPlacingChange={setPlacing}
          onMaxSlopeChange={setMaxSlopeDeg}
          onRecompute={() => {
            if (start && end) plan({ start, end, maxSlopeDeg });
          }}
        >
          <TelemetryPanel
            telemetry={site.hourly_telemetry}
            distanceM={route?.total_distance_m ?? null}
            departureHour={departureHour}
            onDepartureHourChange={setDepartureHour}
          />
        </RoutePanel>
      </div>
    </div>
  );
}

export default App;

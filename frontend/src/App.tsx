import { useEffect, useState } from "react";
import "./styles/tokens.css";
import { TerrainMap, type LayerVisibility } from "./components/TerrainMap.tsx";
import { LayerRail } from "./components/LayerRail.tsx";
import { RoutePanel } from "./components/RoutePanel.tsx";
import { ElevationProfile } from "./components/ElevationProfile.tsx";
import { useSiteOverview } from "./hooks/useSiteOverview.ts";
import { useRoutePlan } from "./hooks/useRoutePlan.ts";
import { useTerrainInspector } from "./hooks/useTerrainInspector.ts";

const DEFAULT_LAYERS: LayerVisibility = {
  imagery: true,
  hazard: true,
  route: true,
  waypoints: true,
  walkbackRing: true,
};

const WALKBACK_M = 1500;
const HOVER_THROTTLE_MS = 150;

function App() {
  const { site, error: siteError } = useSiteOverview();
  const { route, loading: routeLoading, error: routeError, plan } = useRoutePlan();
  const { inspected, onHover, clear: clearInspected } = useTerrainInspector(HOVER_THROTTLE_MS);

  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [maxSlopeDeg, setMaxSlopeDeg] = useState(20);

  useEffect(() => {
    if (site) plan(site, maxSlopeDeg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, plan]);

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
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.04em" }}>
            MARSWALK PLANNER
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {site.site_name} · {site.grid_shape[1]}×{site.grid_shape[0]} cells ·{" "}
            {site.resolution_m} m/px
          </span>
        </div>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", flex: "1 1 auto", minHeight: 0 }}>
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
              onPointHover={onHover}
              onPointLeave={clearInspected}
            />

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
                }}
              >
                <span className="eyebrow" style={{ fontFamily: "var(--font-body)" }}>
                  POINT INSPECTOR
                </span>
                <span>cell ({inspected.x}, {inspected.y})</span>
                <span>elev {inspected.elev_m.toFixed(1)} m</span>
                <span style={{ color: inspected.is_hazard ? "var(--danger)" : "var(--text)" }}>
                  slope {inspected.slope_deg.toFixed(1)}° {inspected.is_hazard ? "HAZARD" : ""}
                </span>
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
          onMaxSlopeChange={setMaxSlopeDeg}
          onRecompute={() => plan(site, maxSlopeDeg)}
        />
      </div>
    </div>
  );
}

export default App;

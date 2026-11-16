import type { LayerVisibility } from "./TerrainMap.tsx";

const LAYER_LABELS: Record<keyof LayerVisibility, { name: string; source: string }> = {
  imagery: { name: "Imagery", source: "/terrain/hillshade.png (pre-rendered)" },
  optical: { name: "Surface photo", source: "HiRISE ortho via /api/v1/site/overview" },
  thermal: { name: "Thermal inertia", source: "THEMIS · /terrain/thermal.png" },
  hazard: { name: "Slope hazard", source: "/terrain/hazard-N.png (pre-rendered)" },
  route: { name: "Planned route", source: "/api/v1/route/plan" },
  waypoints: { name: "Waypoints", source: "/api/v1/site/overview" },
  walkbackRing: { name: "Walk-back ring", source: "computed client-side" },
  roverPath: { name: "Curiosity traverse", source: "MSL localization · /terrain/rover-path.json" },
};

interface LayerRailProps {
  layers: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
}

export function LayerRail({ layers, onChange }: LayerRailProps) {
  const on = Object.values(layers).filter(Boolean).length;

  return (
    <aside className="side-panel side-panel--layers">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 13,
            letterSpacing: "0.1em",
            color: "var(--text-muted)",
          }}
        >
          LAYERS
        </h2>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{on} on</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(Object.keys(layers) as (keyof LayerVisibility)[]).map((key) => {
          const isOn = layers[key];
          const label = LAYER_LABELS[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isOn}
              onClick={() => onChange({ ...layers, [key]: !isOn })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                minHeight: 48,
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--surface-2)",
                color: "var(--text)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{label.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {label.source}
                </span>
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  width: 34,
                  height: 20,
                  borderRadius: 10,
                  padding: 2,
                  boxSizing: "border-box",
                  background: isOn ? "var(--accent)" : "var(--border-muted)",
                  justifyContent: isOn ? "flex-end" : "flex-start",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "var(--bg)",
                    opacity: isOn ? 1 : 0.6,
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

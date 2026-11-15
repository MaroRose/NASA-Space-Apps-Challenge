import type { LayerVisibility } from "./TerrainMap.tsx";

const LAYER_LABELS: Record<keyof LayerVisibility, { name: string; source: string }> = {
  imagery: { name: "Imagery", source: "backend raster — not shipped yet" },
  hazard: { name: "Slope hazard", source: "backend raster — not shipped yet" },
  route: { name: "Planned route", source: "/api/v1/route/plan" },
  waypoints: { name: "Waypoints", source: "/api/v1/site/overview" },
  walkbackRing: { name: "Walk-back ring", source: "computed client-side" },
};

interface LayerRailProps {
  layers: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
}

export function LayerRail({ layers, onChange }: LayerRailProps) {
  const on = Object.values(layers).filter(Boolean).length;

  return (
    <aside
      style={{
        flex: "0 1 236px",
        minWidth: 200,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
        overflowY: "auto",
      }}
    >
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

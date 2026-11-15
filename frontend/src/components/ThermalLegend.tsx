import type { ThermalLegendInfo } from "../hooks/useThermalLayer.ts";

interface ThermalLegendProps {
  legend: ThermalLegendInfo | null;
  cursorValue: number | null;
}

export function ThermalLegend({ legend, cursorValue }: ThermalLegendProps) {
  const span = legend ? Math.max(legend.max - legend.min, 1e-6) : 1;
  const markerPct =
    legend && cursorValue !== null
      ? Math.min(100, Math.max(0, ((cursorValue - legend.min) / span) * 100))
      : null;

  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        width: 220,
        background: "rgba(18,22,29,0.94)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        fontSize: 11,
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="eyebrow">THERMAL INERTIA</span>
        <span className="mono" style={{ color: "var(--text)" }}>
          {cursorValue !== null ? cursorValue.toFixed(0) : "—"}
        </span>
      </div>
      {legend ? (
        <>
          <div style={{ position: "relative", height: 10 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 4,
                background: `linear-gradient(to right, ${legend.stops
                  .map((stop) => `rgb(${stop.join(",")})`)
                  .join(", ")})`,
              }}
            />
            {markerPct !== null && (
              <div
                style={{
                  position: "absolute",
                  top: -3,
                  bottom: -3,
                  left: `${markerPct}%`,
                  width: 3,
                  marginLeft: -1.5,
                  borderRadius: 2,
                  background: "var(--text)",
                  boxShadow: "0 0 0 1px var(--bg)",
                }}
              />
            )}
          </div>
          <div className="mono" style={{ display: "flex", justifyContent: "space-between", color: "var(--text)" }}>
            <span>{legend.min.toFixed(0)}</span>
            <span>{legend.max.toFixed(0)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
            <span>loose dust, sand</span>
            <span>rock</span>
          </div>
          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
            {legend.units} · THEMIS, 100 m per pixel, approximate
          </span>
        </>
      ) : (
        <span style={{ color: "var(--text-muted)" }}>
          No thermal data yet. Run build_thermal.py, then render_rasters.py.
        </span>
      )}
    </div>
  );
}

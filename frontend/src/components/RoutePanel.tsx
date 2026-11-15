import type { GridCell, RoutePlanResponse, SiteOverview } from "../types/terrain.ts";

export type PlacingTarget = "start" | "end";

interface RoutePanelProps {
  site: SiteOverview;
  route: RoutePlanResponse | null;
  loading: boolean;
  error: string | null;
  maxSlopeDeg: number;
  minSlopeDeg: number;
  maxSlopeLimitDeg: number;
  start: GridCell | null;
  end: GridCell | null;
  placing: PlacingTarget;
  onPlacingChange: (target: PlacingTarget) => void;
  onMaxSlopeChange: (value: number) => void;
  onRecompute: () => void;
}

const PLACING_OPTIONS: { target: PlacingTarget; label: string }[] = [
  { target: "start", label: "Start" },
  { target: "end", label: "Destination" },
];

function formatCell(cell: GridCell | null) {
  return cell ? `(${cell.x}, ${cell.y})` : "—";
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "10px 12px",
        borderRadius: 10,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <span className="eyebrow">{label}</span>
      <span
        className="mono"
        style={{ fontSize: 20, fontWeight: 600, color: accent ? "var(--accent)" : "var(--text)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function RoutePanel({
  site,
  route,
  loading,
  error,
  maxSlopeDeg,
  minSlopeDeg,
  maxSlopeLimitDeg,
  start,
  end,
  placing,
  onPlacingChange,
  onMaxSlopeChange,
  onRecompute,
}: RoutePanelProps) {
  const exceedsLimit = route && route.max_slope_encountered_deg > maxSlopeDeg;
  const nearLimit = route && !exceedsLimit && route.max_slope_encountered_deg > maxSlopeDeg - 5;
  const status = exceedsLimit ? "NO-GO" : nearLimit ? "CAUTION" : "GO";
  const statusColor = exceedsLimit ? "var(--danger)" : nearLimit ? "var(--accent)" : "var(--info)";

  return (
    <aside
      style={{
        flex: "0 1 320px",
        minWidth: 260,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 16,
        borderLeft: "1px solid var(--border)",
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
          ROUTE
        </h2>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: "0.06em",
            color: exceedsLimit ? "#fff" : "var(--accent-ink)",
            background: statusColor,
          }}
        >
          {route ? status : "—"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="eyebrow">CLICK THE MAP TO SET</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
          {PLACING_OPTIONS.map(({ target, label }) => {
            const active = placing === target;
            return (
              <button
                key={target}
                type="button"
                aria-pressed={active}
                onClick={() => onPlacingChange(target)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  minHeight: 44,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 12 }}>{label}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {formatCell(target === "start" ? start : end)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
        Suit slope limit
        <input
          type="range"
          min={minSlopeDeg}
          max={maxSlopeLimitDeg}
          value={maxSlopeDeg}
          onChange={(e) => onMaxSlopeChange(Number(e.target.value))}
        />
        <span className="mono" style={{ color: "var(--text)" }}>
          {maxSlopeDeg}°
        </span>
      </label>

      {error && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--danger)",
            background: "rgba(229,72,77,0.08)",
            fontSize: 11,
            color: "var(--text)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <StatTile label="DISTANCE" value={route ? `${(route.total_distance_m / 1000).toFixed(2)} km` : "—"} />
        <StatTile
          label="MAX SLOPE"
          value={route ? `${route.max_slope_encountered_deg.toFixed(1)}°` : "—"}
          accent
        />
        <StatTile label="PATH POINTS" value={route ? String(route.waypoint_count) : "—"} />
        <StatTile label="COMPUTE" value={route ? `${route.compute_ms.toFixed(1)} ms` : "—"} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="eyebrow">WAYPOINTS · {site.site_name}</span>
        {site.waypoints.map((wp) => (
          <div
            key={wp.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--text-soft)",
              padding: "4px 0",
            }}
          >
            <span>{wp.id}</span>
            <span className="mono">
              ({wp.x}, {wp.y})
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onRecompute}
        disabled={loading}
        style={{
          marginTop: "auto",
          minHeight: 44,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: loading ? "var(--surface-2)" : "var(--accent)",
          color: loading ? "var(--text-muted)" : "var(--accent-ink)",
          fontWeight: 700,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Computing…" : "Recompute route"}
      </button>
    </aside>
  );
}

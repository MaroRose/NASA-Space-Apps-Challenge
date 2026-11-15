import { useState } from "react";
import type { GridCell, SiteOverview } from "../types/terrain.ts";
import {
  type GridGeoref,
  bearingDeg,
  cellToLatLon,
  compassLabel,
  distanceM,
  formatLatLon,
  isInsideGrid,
  latLonToCell,
  parseLatLon,
} from "../lib/marsCoords.ts";

interface PositionPanelProps {
  site: SiteOverview;
  georef: GridGeoref | null;
  position: GridCell | null;
  habitat: GridCell | null;
  walkbackM: number;
  placingPosition: boolean;
  onPlacingPositionChange: (on: boolean) => void;
  onPositionChange: (cell: GridCell | null) => void;
  onRouteHome: () => void;
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="mono" style={{ color: accent ?? "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

const buttonStyle = (active: boolean): React.CSSProperties => ({
  minHeight: 36,
  padding: "6px 10px",
  borderRadius: 10,
  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
});

export function PositionPanel({
  site,
  georef,
  position,
  habitat,
  walkbackM,
  placingPosition,
  onPlacingPositionChange,
  onPositionChange,
  onRouteHome,
}: PositionPanelProps) {
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [rows, cols] = site.grid_shape;
  const res = site.resolution_m;

  function applyInput() {
    if (!georef) return;
    const parsed = parseLatLon(input);
    if (!parsed) {
      setInputError("Use lat, lon in degrees, e.g. 4.5872 S, 137.4262 E");
      return;
    }
    const cell = latLonToCell(georef, parsed, res);
    if (!isInsideGrid(cell, cols, rows)) {
      setInputError("That point is outside the mapped sector.");
      return;
    }
    setInputError(null);
    onPositionChange(cell);
  }

  const posLatLon = georef && position ? cellToLatLon(georef, position.x, position.y, res) : null;
  const toHome = position && habitat ? distanceM(position, habitat, res) : null;
  const bearing = position && habitat ? bearingDeg(position, habitat) : null;
  const insideRing = toHome !== null && toHome <= walkbackM;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="eyebrow">MY POSITION</span>

      {!georef && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          No georeference for this grid (terrain/georef.json missing), so Mars coordinates are unavailable.
        </span>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button
          type="button"
          aria-pressed={placingPosition}
          onClick={() => onPlacingPositionChange(!placingPosition)}
          style={buttonStyle(placingPosition)}
        >
          {placingPosition ? "Click the map…" : "Mark on map"}
        </button>
        <button
          type="button"
          onClick={() => onPositionChange(null)}
          disabled={!position}
          style={{ ...buttonStyle(false), opacity: position ? 1 : 0.5, cursor: position ? "pointer" : "default" }}
        >
          Clear
        </button>
      </div>

      {georef && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyInput();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
        >
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Or enter a fix (lat, lon)
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="4.5872 S, 137.4262 E"
              className="mono"
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${inputError ? "var(--danger)" : "var(--border)"}`,
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 12,
              }}
            />
          </label>
          {inputError && <span style={{ fontSize: 10, color: "var(--danger)" }}>{inputError}</span>}
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Row label="Cell" value={position ? `(${position.x}, ${position.y})` : "—"} />
        <Row label="Mars coordinates" value={posLatLon ? formatLatLon(posLatLon) : "—"} />
        <Row label="Distance to habitat" value={toHome !== null ? `${toHome.toFixed(0)} m` : "—"} />
        <Row
          label="Heading home"
          value={bearing !== null ? `${compassLabel(bearing)} ${bearing.toFixed(0)}°` : "—"}
        />
        <Row
          label="Walk-back ring"
          value={toHome === null ? "—" : insideRing ? "INSIDE" : "OUTSIDE"}
          accent={toHome === null ? undefined : insideRing ? "var(--info)" : "var(--danger)"}
        />
      </div>

      <button
        type="button"
        onClick={onRouteHome}
        disabled={!position || !habitat}
        style={{
          ...buttonStyle(false),
          background: position && habitat ? "var(--accent)" : "var(--surface-2)",
          color: position && habitat ? "var(--accent-ink)" : "var(--text-muted)",
          cursor: position && habitat ? "pointer" : "default",
        }}
      >
        Route home from here
      </button>

      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
        Position is entered, not sensed: Mars has no GPS. Grid location is estimated to about{" "}
        {georef?.accuracy_m ?? 10} m by matching the terrain to the USGS Gale DEM.
      </span>
    </section>
  );
}

import type { HourlyTelemetry } from "../types/terrain.ts";
import {
  WALK_SPEED_M_PER_S,
  estimateEva,
  isPlaceholderTelemetry,
} from "../lib/eva.ts";

interface TelemetryPanelProps {
  telemetry: HourlyTelemetry[];
  distanceM: number | null;
  departureHour: number;
  onDepartureHourChange: (hour: number) => void;
}

const VIEW_W = 240;
const VIEW_H = 56;
const PAD_Y = 6;
const HOUR_W = VIEW_W / 24;

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatDuration(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function formatTempRange(minC: number, maxC: number) {
  const low = minC.toFixed(0);
  const high = maxC.toFixed(0);
  return low === high ? `${low} °C` : `${low} to ${high} °C`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 11,
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="mono" style={{ color: "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

export function TelemetryPanel({
  telemetry,
  distanceM,
  departureHour,
  onDepartureHourChange,
}: TelemetryPanelProps) {
  const hours = [...telemetry].sort((a, b) => a.sol_hour - b.sol_hour);
  const estimate =
    distanceM !== null ? estimateEva(distanceM, hours, departureHour) : null;
  const covered = new Set(estimate?.hoursCovered ?? [departureHour]);

  const temps = hours.map((reading) => reading.ambient_temp_c);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const span = Math.max(maxTemp - minTemp, 1);
  const toX = (solHour: number) => (solHour + 0.5) * HOUR_W;
  const toY = (tempC: number) =>
    VIEW_H - PAD_Y - ((tempC - minTemp) / span) * (VIEW_H - PAD_Y * 2);
  const lineD = hours
    .map(
      (reading, i) =>
        `${i === 0 ? "M" : "L"}${toX(reading.sol_hour)} ${toY(reading.ambient_temp_c)}`,
    )
    .join(" ");

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="eyebrow">EVA CONDITIONS</span>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        Departure (sol hour)
        <input
          type="range"
          min={0}
          max={23}
          value={departureHour}
          onChange={(e) => onDepartureHourChange(Number(e.target.value))}
        />
        <span className="mono" style={{ color: "var(--text)" }}>
          {formatHour(departureHour)}
        </span>
      </label>

      {hours.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            <span>Air temperature</span>
            <span className="mono">{formatTempRange(minTemp, maxTemp)}</span>
          </div>
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Air temperature by sol hour, with the EVA window highlighted"
            style={{ width: "100%", height: 56, display: "block" }}
          >
            <path
              d={`M0 ${VIEW_H - 0.5} H${VIEW_W}`}
              stroke="var(--border)"
              strokeWidth={1}
            />
            {hours.map((reading) => (
              <rect
                key={reading.sol_hour}
                x={reading.sol_hour * HOUR_W}
                y={0}
                width={HOUR_W}
                height={VIEW_H}
                fill="var(--info)"
                fillOpacity={covered.has(reading.sol_hour) ? 0.18 : 0}
                onClick={() => onDepartureHourChange(reading.sol_hour)}
                style={{ cursor: "pointer" }}
              >
                <title>
                  {`${formatHour(reading.sol_hour)} · ${reading.ambient_temp_c.toFixed(1)} °C · ${(
                    reading.radiation_mgy_hr * 1000
                  ).toFixed(1)} µGy/h`}
                </title>
              </rect>
            ))}
            <path
              d={lineD}
              fill="none"
              stroke="var(--info)"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          </svg>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--text-muted)",
            }}
            className="mono"
          >
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Stat
          label="Walk time"
          value={estimate ? formatDuration(estimate.durationHours) : "—"}
        />
        <Stat
          label="Temperature on route"
          value={
            estimate
              ? formatTempRange(estimate.minTempC, estimate.maxTempC)
              : "—"
          }
        />
        <Stat
          label="Radiation dose"
          value={estimate ? `${(estimate.doseMgy * 1000).toFixed(1)} µGy` : "—"}
        />
      </div>

      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
        One-way walk at {WALK_SPEED_M_PER_S.toFixed(1)} m/s. Radiation is a
        pressure-based estimate.
        {isPlaceholderTelemetry(hours) &&
          " Telemetry is placeholder: the pipeline ran without REMS data."}
      </span>
    </section>
  );
}

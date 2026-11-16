import type { HourlyTelemetry } from "../types/terrain.ts";

export const WALK_SPEED_M_PER_S = 1.0;

export interface EvaEstimate {
  durationHours: number;
  minTempC: number;
  maxTempC: number;
  doseMgy: number;
  hoursCovered: number[];
}

export function estimateEva(
  distanceM: number,
  telemetry: HourlyTelemetry[],
  departureHour: number,
  speedMPerS: number = WALK_SPEED_M_PER_S,
): EvaEstimate | null {
  if (distanceM <= 0 || speedMPerS <= 0 || telemetry.length === 0) return null;

  const byHour = new Map(
    telemetry.map((reading) => [reading.sol_hour, reading]),
  );
  const durationHours = distanceM / speedMPerS / 3600;

  let remaining = durationHours;
  let hour = departureHour;
  let doseMgy = 0;
  let minTempC = Infinity;
  let maxTempC = -Infinity;
  const hoursCovered: number[] = [];

  while (remaining > 1e-9 && hoursCovered.length < 24 * 7) {
    const solHour = ((hour % 24) + 24) % 24;
    const reading = byHour.get(solHour);
    const slice = Math.min(1, remaining);
    if (reading) {
      doseMgy += reading.radiation_mgy_hr * slice;
      minTempC = Math.min(minTempC, reading.ambient_temp_c);
      maxTempC = Math.max(maxTempC, reading.ambient_temp_c);
    }
    hoursCovered.push(solHour);
    remaining -= slice;
    hour += 1;
  }

  if (minTempC === Infinity) return null;
  return { durationHours, minTempC, maxTempC, doseMgy, hoursCovered };
}

export function isPlaceholderTelemetry(telemetry: HourlyTelemetry[]): boolean {
  if (telemetry.length < 2) return false;
  const first = telemetry[0];
  return telemetry.every(
    (reading) =>
      reading.ambient_temp_c === first.ambient_temp_c &&
      reading.radiation_mgy_hr === first.radiation_mgy_hr,
  );
}

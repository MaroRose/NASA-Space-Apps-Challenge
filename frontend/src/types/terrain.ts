export interface Waypoint {
  id: string;
  x: number;
  y: number;
}

export interface GridCell {
  x: number;
  y: number;
}

export interface HourlyTelemetry {
  sol_hour: number;
  ambient_temp_c: number;
  radiation_mgy_hr: number;
}

export interface SiteOverview {
  site_name: string;
  storage_status?: string;
  grid_shape: [rows: number, cols: number];
  resolution_m: number;
  extent_m: { width: number; height: number };
  elevation_stats_m: { min: number; max: number };
  waypoints: Waypoint[];
  hourly_telemetry: HourlyTelemetry[];
}

export interface TerrainPointInfo {
  x: number;
  y: number;
  elev_m: number;
  slope_deg: number;
  is_hazard: boolean;
}

export interface PathPoint {
  x: number;
  y: number;
  elev_m: number;
  slope_deg?: number;
}

export interface RoutePlanResponse {
  status: string;
  storage_mode: string;
  compute_ms: number;
  resolved_start: { x: number; y: number };
  resolved_end: { x: number; y: number };
  max_slope_limit_deg: number;
  max_slope_encountered_deg: number;
  total_distance_m: number;
  waypoint_count: number;
  path_coordinates: PathPoint[];
  telemetry: HourlyTelemetry[];
}

export interface RoutePlanRequest {
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  startWaypoint?: string;
  endWaypoint?: string;
  maxSlopeDeg?: number;
}

export interface HealthStatus {
  status: string;
  storage_mode: string;
  grid_shape: [rows: number, cols: number];
}
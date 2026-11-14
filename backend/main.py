from contextlib import asynccontextmanager
import json
import math
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from pydantic import BaseModel, Field
import router_engine
from terrain_tiles import TiledRasterGrid

PROCESSED_DIR = Path(__file__).resolve().parent / "data" / "processed"
TILES_DIR = Path(__file__).resolve().parent.parent / "gale_tiles"
martian_state = {}


def _generate_teammate_fallback_grid(size: int = 1000):
    """Generate an in-memory synthetic grid when neither tiles nor source data exist."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    print("[BOOT] Gale tiles not found. Generating synthetic Gale Crater fallback grid for dev...")
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    dem = (
        -4500.0
        + 25.0 * np.sin(x / 120.0) * np.cos(y / 120.0)
        + 12.0 * np.sin((x + y) / 45.0)
    ).astype(np.float32)
    dy, dx = np.gradient(dem, 1.0)
    slope = np.degrees(np.arctan(np.hypot(dx, dy))).astype(np.float32)

    metadata = {
        "site_name": "Gale Crater - Mount Sharp (Synthetic Teammate Dev Grid)",
        "storage_status": "synthetic_dev_fallback",
        "grid_shape": [size, size],
        "resolution_m": 1.0,
        "extent_m": {"width": float(size), "height": float(size)},
        "elevation_stats_m": {"min": round(float(np.min(dem)), 2), "max": round(float(np.max(dem)), 2)},
        "waypoints": [
            {"id": "hab_alpha", "x": 100, "y": 100},
            {"id": "wp_ridge", "x": 500, "y": 500},
            {"id": "wp_boxwork", "x": 800, "y": 800},
        ],
        "hourly_telemetry": [
            {"sol_hour": hr, "ambient_temp_c": round(-65.0 + 40.0 * math.sin(hr / 24.0 * math.pi), 1), "radiation_mgy_hr": 0.011}
            for hr in range(24)
        ],
    }
    with open(PROCESSED_DIR / "site_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    return dem, slope


def ensure_local_terrain_grid() -> str:
    """Set up lazy tiled terrain data, or use an in-memory synthetic dev grid."""
    meta_file = PROCESSED_DIR / "site_metadata.json"

    tile_files = list(TILES_DIR.glob("tile_r*_c*.tif"))
    if tile_files:
        terrain = TiledRasterGrid(TILES_DIR)
        if meta_file.exists():
            with open(meta_file) as f:
                metadata = json.load(f)
        else:
            metadata = {}

        grid_shape = list(terrain.shape)
        if (
            metadata.get("grid_shape") != grid_shape
            or metadata.get("storage_status") != "local_tiled_cache"
        ):
            metadata.update(
                {
                    "site_name": "Gale Crater - Mount Sharp EVA Sector",
                    "cloud_provider": "Microsoft Azure Hybrid Edge",
                    "storage_status": "local_tiled_cache",
                    "grid_shape": grid_shape,
                    "resolution_m": round(terrain.resolution_m, 2),
                    "extent_m": {
                        "width": round(terrain.shape[1] * terrain.resolution_m, 2),
                        "height": round(terrain.shape[0] * terrain.resolution_m, 2),
                    },
                }
            )
            metadata.pop("elevation_stats_m", None)
            metadata.setdefault(
                "waypoints",
                [
                    {"id": "hab_alpha", "x": 200, "y": 200},
                    {"id": "wp_ridge", "x": 1500, "y": 1800},
                    {"id": "wp_boxwork", "x": 3200, "y": 3200},
                ],
            )
            metadata.setdefault(
                "hourly_telemetry",
                [
                    {"sol_hour": hr, "ambient_temp_c": -65.0, "radiation_mgy_hr": 0.011}
                    for hr in range(24)
                ],
            )
            PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
            with open(meta_file, "w") as f:
                json.dump(metadata, f, indent=2)

        martian_state["dem"] = terrain.dem
        martian_state["slope"] = terrain.slope
        martian_state["metadata"] = metadata
        martian_state["terrain"] = terrain
        martian_state["storage_mode"] = "local_tiled_cache"
        print(
            f"[BOOT] Tiled terrain indexed ({terrain.shape[1]}x{terrain.shape[0]}); "
            "tiles load on demand."
        )
        return "local_tiled_cache"

    dem, slope = _generate_teammate_fallback_grid()
    with open(meta_file) as f:
        metadata = json.load(f)
    martian_state["dem"] = dem
    martian_state["slope"] = slope
    martian_state["metadata"] = metadata
    martian_state["storage_mode"] = "synthetic_dev_fallback"
    return "synthetic_dev_fallback"


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage_mode = ensure_local_terrain_grid()
    martian_state["storage_mode"] = storage_mode
    print(f"[BOOT] Martian terrain ready ({storage_mode}).")
    yield
    martian_state.clear()


app = FastAPI(
    title="MarsWalk: Martian EVA Navigation API",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PointCoord(BaseModel):
    x: float
    y: float


class RouteRequest(BaseModel):
    start_x: Optional[float] = Field(None, description="Start X grid coordinate")
    start_y: Optional[float] = Field(None, description="Start Y grid coordinate")
    end_x: Optional[float] = Field(None, description="Target X grid coordinate")
    end_y: Optional[float] = Field(None, description="Target Y grid coordinate")
    start: Optional[PointCoord] = None
    end: Optional[PointCoord] = None
    start_waypoint: Optional[str] = None
    end_waypoint: Optional[str] = None
    max_slope_deg: float = Field(20.0, gt=1.0, le=45.0, description="Max allowable slope in degrees")


def _resolve_coordinates(req: RouteRequest, meta: dict, rows: int, cols: int) -> tuple[int, int, int, int]:
    """Resolves flat coords, nested coords, or waypoint IDs and clamps them safely inside grid bounds."""
    wp_map = {w["id"]: (w["x"], w["y"]) for w in meta.get("waypoints", [])}

    sx, sy = req.start_x, req.start_y
    ex, ey = req.end_x, req.end_y

    if req.start is not None:
        sx, sy = req.start.x, req.start.y
    elif req.start_waypoint and req.start_waypoint in wp_map:
        sx, sy = wp_map[req.start_waypoint]

    if req.end is not None:
        ex, ey = req.end.x, req.end.y
    elif req.end_waypoint and req.end_waypoint in wp_map:
        ex, ey = wp_map[req.end_waypoint]

    if sx is None or sy is None or ex is None or ey is None:
        raise HTTPException(
            status_code=400,
            detail="Provide start_x/start_y & end_x/end_y, nested start/end objects, or valid start_waypoint/end_waypoint IDs.",
        )

    clamped_sx = max(0, min(cols - 1, int(round(sx))))
    clamped_sy = max(0, min(rows - 1, int(round(sy))))
    clamped_ex = max(0, min(cols - 1, int(round(ex))))
    clamped_ey = max(0, min(rows - 1, int(round(ey))))
    return clamped_sx, clamped_sy, clamped_ex, clamped_ey


def _execute_routing(req: RouteRequest) -> dict:
    dem = martian_state["dem"]
    slope = martian_state["slope"]
    meta = martian_state["metadata"]
    rows, cols = dem.shape

    sx, sy, ex, ey = _resolve_coordinates(req, meta, rows, cols)

    result = router_engine.calculate_path(
        sx, sy, ex, ey, dem, slope, max_slope_deg=req.max_slope_deg
    )

    if not result["path"]:
        raise HTTPException(status_code=422, detail=result["reason"])

    path = result["path"]
    total_dist = 0.0
    for i in range(1, len(path)):
        total_dist += math.hypot(
            path[i]["x"] - path[i - 1]["x"], path[i]["y"] - path[i - 1]["y"]
        )

    return {
        "status": "success",
        "storage_mode": martian_state["storage_mode"],
        "compute_ms": result["compute_ms"],
        "resolved_start": {"x": sx, "y": sy},
        "resolved_end": {"x": ex, "y": ey},
        "max_slope_limit_deg": req.max_slope_deg,
        "max_slope_encountered_deg": result["max_slope_deg"],
        "total_distance_m": round(total_dist * meta["resolution_m"], 2),
        "waypoint_count": len(path),
        "path_coordinates": path,
        "telemetry": meta["hourly_telemetry"],
    }


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "online",
        "storage_mode": martian_state.get("storage_mode", "unknown"),
        "grid_shape": list(martian_state["dem"].shape),
    }


@app.get("/api/v1/site/overview")
async def get_site_overview():
    return martian_state["metadata"]


@app.get("/api/v1/terrain/point")
async def inspect_point(x: float = Query(...), y: float = Query(...)):
    """Allows frontend to query elevation and slope under the mouse cursor."""
    dem = martian_state["dem"]
    slope = martian_state["slope"]
    rows, cols = dem.shape
    ix = max(0, min(cols - 1, int(round(x))))
    iy = max(0, min(rows - 1, int(round(y))))
    s_val = float(slope[iy, ix])
    return {
        "x": ix,
        "y": iy,
        "elev_m": round(float(dem[iy, ix]), 2),
        "slope_deg": round(s_val, 2),
        "is_hazard": s_val > 20.0,
    }


@app.post("/api/v1/route/plan")
@app.post("/api/v1/route")
async def calculate_route_post(request: RouteRequest):
    return _execute_routing(request)


@app.get("/api/v1/route/plan")
async def calculate_route_get(
    start_x: float = Query(100),
    start_y: float = Query(100),
    end_x: float = Query(500),
    end_y: float = Query(500),
    max_slope_deg: float = Query(20.0),
):
    """GET helper so teammates can test route calculation directly in a browser URL bar."""
    req = RouteRequest(
        start_x=start_x, start_y=start_y, end_x=end_x, end_y=end_y, max_slope_deg=max_slope_deg
    )
    return _execute_routing(req)
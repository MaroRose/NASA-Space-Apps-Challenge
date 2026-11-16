import json
from pathlib import Path
import numpy as np
import pandas as pd
import rasterio
from rasterio.windows import Window, bounds as window_bounds, from_bounds

RAW_DIR = Path("../../")
PROCESSED_DIR = Path("data/processed")
SECTOR_SIZE = 4000
OPTICAL_PX = 1600  # 2.5 m/px cut of the HiRISE ortho (4x sharper than the 10 m grid)
TARGET_RESOLUTION_M = 10.0
WAYPOINTS_M = [
    ("hab_alpha", 200, 200),
    ("bradbury_landing", 2920, 2140),
    ("yellowknife_bay", 3180, 2190),
]

def _parse_rems_hourly(rems_path: Path) -> list[dict]:
    """Parses real 24-hour diurnal Curiosity REMS telemetry from a NASA PDS .tab file."""
    df = pd.read_csv(
        rems_path,
        sep=",",
        header=None,
        usecols=[1, 11, 15, 37],
        on_bad_lines="skip",
    )
    hours = df[1].astype(str).str.extract(r"M(\d{2}):")[0]
    df = df[hours.notna()].copy()
    df["sol_hour"] = hours[hours.notna()].astype(int)

    t1 = pd.to_numeric(df[11], errors="coerce")
    t2 = pd.to_numeric(df[15], errors="coerce")
    t1 = t1.where((t1 > 100.0) & (t1 < 350.0))
    t2 = t2.where((t2 > 100.0) & (t2 < 350.0))
    df["temp_k"] = t1.fillna(t2)

    p = pd.to_numeric(df[37], errors="coerce")
    df["press_pa"] = p.where((p > 100.0) & (p < 2000.0))

    grouped = (
        df.groupby("sol_hour")[["temp_k", "press_pa"]]
        .median()
        .reindex(range(24))
        .interpolate(method="linear", limit_direction="both")
    )

    telemetry = []
    for hr in range(24):
        tk = grouped.loc[hr, "temp_k"]
        pa = grouped.loc[hr, "press_pa"]
        temp_c = round(float(tk) - 273.15, 1) if pd.notna(tk) else -65.0
        rad = round(0.011 * (720.0 / float(pa)), 4) if pd.notna(pa) and pa > 0 else 0.011
        telemetry.append({
            "sol_hour": int(hr),
            "ambient_temp_c": temp_c,
            "radiation_mgy_hr": rad,
        })
    return telemetry


def build_site_bundle():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    dem_path = RAW_DIR / "Gale_DEM_SMG_1m.tif"
    rems_path = RAW_DIR / "rems_data.tab"

    print(f"[1/5] Window-extracting {SECTOR_SIZE}x{SECTOR_SIZE}m center sector from {dem_path.name}...")
    with rasterio.open(dem_path) as src:
        row_off = max(0, (src.height // 2) - (SECTOR_SIZE // 2))
        col_off = max(0, (src.width // 2) - (SECTOR_SIZE // 2))
        win_h = min(SECTOR_SIZE, src.height - row_off)
        win_w = min(SECTOR_SIZE, src.width - col_off)

        window = Window(col_off, row_off, win_w, win_h)
        win_bounds = window_bounds(window, src.transform)  # (west, south, east, north) in Mars degrees
        dem = src.read(1, window=window).astype(np.float32)

        if src.nodata is not None:
            dem = np.where(dem == src.nodata, np.nan, dem)
        dem = np.where(dem < -10000.0, np.nan, dem)

        degree_res = float(src.res[0])
        res_m = degree_res * 59270.0 if degree_res < 0.01 else degree_res

    nan_mask = np.isnan(dem)
    median_elev = float(np.nanmedian(dem)) if not np.all(nan_mask) else -4500.0
    dem_clean = np.where(nan_mask, median_elev, dem)

    print(f"[2/5] Downsampling native {round(res_m, 1)}m grid to {TARGET_RESOLUTION_M}m...")
    if res_m < TARGET_RESOLUTION_M:
        stride = int(TARGET_RESOLUTION_M / res_m)
        dem_clean = dem_clean[::stride, ::stride]
        nan_mask = nan_mask[::stride, ::stride]
        res_m = res_m * stride
        print(f"      -> Grid reduced by a factor of {stride}x (ultra-lightweight).")
    else:
        print("      -> Source resolution already exceeds target. Stride skipped.")

    print("[3/5] Computing physical slope gradients on the lightweight grid...")
    dy, dx = np.gradient(dem_clean, res_m)
    slope_deg = np.degrees(np.arctan(np.hypot(dx, dy))).astype(np.float32)
    slope_deg = np.where(nan_mask, 90.0, slope_deg)

    print(f"[4/5] Parsing Curiosity REMS weather telemetry from {rems_path.name}...")
    if rems_path.exists():
        hourly_telemetry = _parse_rems_hourly(rems_path)
    else:
        hourly_telemetry = [
            {"sol_hour": hr, "ambient_temp_c": -65.0, "radiation_mgy_hr": 0.011}
            for hr in range(24)
        ]

    optical_path = RAW_DIR / "curiosity_hirise_mosaic.tif"
    has_optical = optical_path.exists()
    if has_optical:
        print("[4b/5] Cutting the matching HiRISE ortho window (optical layer)...")
        with rasterio.open(optical_path) as osrc:
            owin = from_bounds(*win_bounds, transform=osrc.transform)
            optical = osrc.read(1, window=owin, out_shape=(OPTICAL_PX, OPTICAL_PX))
        np.save(PROCESSED_DIR / "optical.npy", optical.astype(np.uint8))
    else:
        print(f"[4b/5] {optical_path.name} not found. Skipping optical layer.")

    print("[5/5] Writing memory-mapped arrays and site_metadata.json...")
    np.save(PROCESSED_DIR / "dem.npy", dem_clean.astype(np.float32))
    np.save(PROCESSED_DIR / "slope.npy", slope_deg.astype(np.float32))

    rows, cols = dem_clean.shape
    metadata = {
        "site_name": "Gale Crater - Mount Sharp EVA Sector",
        "storage_status": "local_mmap_cache",
        "grid_shape": [int(rows), int(cols)],
        "resolution_m": round(float(res_m), 2),
        "extent_m": {
            "width": round(float(cols * res_m), 2),
            "height": round(float(rows * res_m), 2),
        },
        "elevation_stats_m": {
            "min": round(float(np.nanmin(dem_clean)), 2),
            "max": round(float(np.nanmax(dem_clean)), 2),
        },
        "waypoints": [
            {"id": wp_id, "x": int(round(x_m / res_m)), "y": int(round(y_m / res_m))}
            for wp_id, x_m, y_m in WAYPOINTS_M
        ],
        "hourly_telemetry": hourly_telemetry,
        "window_bounds_deg": {
            "west": round(win_bounds[0], 6), "south": round(win_bounds[1], 6),
            "east": round(win_bounds[2], 6), "north": round(win_bounds[3], 6),
        },
        "layers": [
            {"id": "imagery", "name": "Hillshade", "url": "/terrain/hillshade.png",
             "attribution": "NASA/JPL/UArizona HiRISE DEM"},
        ] + ([
            {"id": "optical", "name": "Surface photo", "url": "/terrain/optical.png",
             "attribution": "NASA/JPL/UArizona HiRISE orthoimage"},
        ] if has_optical else []),
    }

    with open(PROCESSED_DIR / "site_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print("Done! Processed bundle saved to data/processed/.")


if __name__ == "__main__":
    build_site_bundle()

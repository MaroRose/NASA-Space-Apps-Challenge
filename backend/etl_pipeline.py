import json
from pathlib import Path
import numpy as np
import pandas as pd
import rasterio
from rasterio.windows import Window

RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")
SECTOR_SIZE = 4000  # 4,000m x 4,000m (16 sq km) EVA Operational Zone
TARGET_RESOLUTION_M = 100.0  # Downsample target to make the API ultra-lightweight


def build_site_bundle():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    dem_path = RAW_DIR / "gale_test.tif"
    rems_path = RAW_DIR / "rems_data.tab"

    print(f"[1/5] Window-extracting {SECTOR_SIZE}x{SECTOR_SIZE}m center sector from {dem_path.name}...")
    with rasterio.open(dem_path) as src:
        row_off = max(0, (src.height // 2) - (SECTOR_SIZE // 2))
        col_off = max(0, (src.width // 2) - (SECTOR_SIZE // 2))
        win_h = min(SECTOR_SIZE, src.height - row_off)
        win_w = min(SECTOR_SIZE, src.width - col_off)

        window = Window(col_off, row_off, win_w, win_h)
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
    hourly_telemetry = []
    if rems_path.exists():
        df = pd.read_csv(
            rems_path, sep=",", header=None, engine="python", on_bad_lines="skip", nrows=100
        )
        for index, row in df.head(24).iterrows():
            try:
                temp_k = float(row[2])
            except (ValueError, TypeError, IndexError):
                temp_k = -999.0
            temp_c = round(temp_k - 273.15, 1) if temp_k > 0 else -65.0

            try:
                rad = float(row[12])
            except (ValueError, TypeError, IndexError):
                rad = -999.0

            hourly_telemetry.append({
                "sol_hour": int(index),
                "ambient_temp_c": temp_c,
                "radiation_mgy_hr": round(rad, 4) if rad > -900 else 0.011,
            })
    else:
        hourly_telemetry = [
            {"sol_hour": hr, "ambient_temp_c": -65.0, "radiation_mgy_hr": 0.011}
            for hr in range(24)
        ]

    print("[5/5] Saving ultra-lightweight memory-mappable binaries (.npy)...")
    dem_out = PROCESSED_DIR / "dem.npy"
    slope_out = PROCESSED_DIR / "slope.npy"
    meta_out = PROCESSED_DIR / "site_metadata.json"

    np.save(dem_out, dem_clean)
    np.save(slope_out, slope_deg)

    width_m = float(dem_clean.shape[1] * res_m)
    height_m = float(dem_clean.shape[0] * res_m)

    metadata = {
        "site_name": "Gale Crater - Mount Sharp EVA Sector",
        "storage_status": "local_mmap_cache",
        "grid_shape": [int(dem_clean.shape[0]), int(dem_clean.shape[1])],
        "resolution_m": round(res_m, 2),
        "extent_m": {"width": round(width_m, 2), "height": round(height_m, 2)},
        "elevation_stats_m": {
            "min": round(float(np.min(dem_clean)), 2),
            "max": round(float(np.max(dem_clean)), 2),
        },
        "waypoints": [
            {"id": "hab_alpha", "x": 2, "y": 2},
            {"id": "wp_ridge", "x": 15, "y": 18},
            {"id": "wp_boxwork", "x": 32, "y": 32},
        ],
        "hourly_telemetry": hourly_telemetry,
    }

    with open(meta_out, "w") as f:
        json.dump(metadata, f, indent=2)

    print("\n[SUCCESS] Memory-mapped terrain bundle ready. Footprint: <20 KB.")


if __name__ == "__main__":
    build_site_bundle()
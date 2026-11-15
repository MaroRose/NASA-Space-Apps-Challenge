import json
import os
from pathlib import Path
import re

import pandas as pd
from terrain_tiles import TiledRasterGrid

# Optional Azure Blob Storage integration for Hackathon Cloud Criteria
try:
    from azure.storage.blob import BlobServiceClient
    AZURE_AVAILABLE = True
except ImportError:
    AZURE_AVAILABLE = False

RAW_DIR = Path(__file__).resolve().parent / "data" / "raw"
PROCESSED_DIR = Path(__file__).resolve().parent / "data" / "processed"
TILES_DIR = Path(__file__).resolve().parent.parent / "gale_tiles"
TILE_PATTERN = re.compile(r"tile_r\d+_c\d+\.tif$")


def upload_to_azure_blob(file_paths: list[Path]) -> str:
    """Uploads terrain tile files to Azure Blob Storage if configured."""
    conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    container_name = os.getenv("AZURE_CONTAINER_NAME", "marswalk-terrain")

    if not AZURE_AVAILABLE or not conn_str:
        print("[AZURE] No AZURE_STORAGE_CONNECTION_STRING set. Using local edge storage.")
        return "local_edge_only"

    try:
        print(f"[AZURE] Syncing compiled matrices to Azure Blob Container '{container_name}'...")
        blob_service = BlobServiceClient.from_connection_string(conn_str)
        container_client = blob_service.get_container_client(container_name)
        if not container_client.exists():
            container_client.create_container()

        for path in file_paths:
            with open(path, "rb") as data:
                container_client.upload_blob(name=path.name, data=data, overwrite=True)
            print(f"[AZURE] Uploaded {path.name} ({path.stat().st_size / 1e6:.1f} MB)")
        return f"synced_to_azure:{container_name}"
    except Exception as exc:
        print(f"[AZURE] Warning: Cloud sync skipped ({exc}). Falling back to local storage.")
        return "local_fallback"


def build_site_bundle():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    rems_path = RAW_DIR / "rems_data.tab"

    tile_files = sorted(
        path for path in TILES_DIR.glob("tile_r*_c*.tif")
        if TILE_PATTERN.fullmatch(path.name)
    )
    if not tile_files:
        raise FileNotFoundError(
            f"No split Gale DEM tiles found in {TILES_DIR}. "
            "Run split_gale_dem.py before the terrain pipeline."
        )

    print(f"[1/3] Scanning {len(tile_files)} DEM tiles one at a time...")
    terrain = TiledRasterGrid(TILES_DIR)
    elevation_stats = terrain.elevation_stats_m()

    print(f"[2/3] Parsing Curiosity REMS weather telemetry from {rems_path.name}...")
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

    print("[3/3] Saving tile-backed site metadata...")
    meta_out = PROCESSED_DIR / "site_metadata.json"

    width_m = float(terrain.shape[1] * terrain.resolution_m)
    height_m = float(terrain.shape[0] * terrain.resolution_m)
    azure_status = upload_to_azure_blob(list(terrain.tile_paths))

    metadata = {
        "site_name": "Gale Crater - Mount Sharp EVA Sector",
        "cloud_provider": "Microsoft Azure Hybrid Edge",
        "azure_blob_status": azure_status,
        "storage_status": "local_tiled_cache",
        "grid_shape": [int(terrain.shape[0]), int(terrain.shape[1])],
        "resolution_m": round(terrain.resolution_m, 2),
        "extent_m": {"width": round(width_m, 2), "height": round(height_m, 2)},
        "elevation_stats_m": elevation_stats,
        "waypoints": [
            {"id": "hab_alpha", "x": 200, "y": 200},
            {"id": "wp_ridge", "x": 1500, "y": 1800},
            {"id": "wp_boxwork", "x": 3200, "y": 3200},
        ],
        "hourly_telemetry": hourly_telemetry,
    }

    with open(meta_out, "w") as f:
        json.dump(metadata, f, indent=2)

    if AZURE_AVAILABLE and os.getenv("AZURE_STORAGE_CONNECTION_STRING"):
        upload_to_azure_blob([meta_out])

    print("\n[SUCCESS] Tile-backed terrain metadata is ready.")


if __name__ == "__main__":
    build_site_bundle()
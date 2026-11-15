"""Records where the terrain window sits on Mars, so other datasets can be aligned to it.

Run from backend/ with `python export_georef.py`, on the machine that has gale_test.tif.
Writes data/processed/georef.json.
"""
import json

import rasterio
from rasterio.windows import Window

from etl_pipeline import PROCESSED_DIR, RAW_DIR, SECTOR_SIZE

with rasterio.open(RAW_DIR / "gale_test.tif") as src:
    row_off = max(0, (src.height // 2) - (SECTOR_SIZE // 2))
    col_off = max(0, (src.width // 2) - (SECTOR_SIZE // 2))
    win_h = min(SECTOR_SIZE, src.height - row_off)
    win_w = min(SECTOR_SIZE, src.width - col_off)
    left, bottom, right, top = src.window_bounds(Window(col_off, row_off, win_w, win_h))
    georef = {
        "crs_wkt": src.crs.to_wkt() if src.crs else None,
        "bounds": {"left": left, "bottom": bottom, "right": right, "top": top},
        "source_shape": [src.height, src.width],
        "source_resolution": list(src.res),
    }

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
(PROCESSED_DIR / "georef.json").write_text(json.dumps(georef, indent=2))
print(json.dumps(georef, indent=2))

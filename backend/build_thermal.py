"""Aligns the THEMIS thermal inertia mosaic of Gale crater to the terrain grid.

Run from backend/ with `python build_thermal.py`. Needs:
  data/raw/Gale_crater_THEMIS_qualTI.tif  ASU THEMIS landing-site mosaic, 100 m per pixel
  data/processed/georef.json              written by export_georef.py
Writes data/processed/thermal.npy on the same grid as dem.npy, then re-run render_rasters.py.
"""
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject

BACKEND_DIR = Path(__file__).resolve().parent
RAW_DIR = BACKEND_DIR / "data" / "raw"
PROCESSED_DIR = BACKEND_DIR / "data" / "processed"
THERMAL_SOURCE = RAW_DIR / "Gale_crater_THEMIS_qualTI.tif"

# From the mosaic's own scale bar: grey levels 1..255 span 50..520 J m^-2 K^-1 s^-1/2.
TI_AT_GREY_MIN = 50.0
TI_AT_GREY_MAX = 520.0


def main() -> None:
    dem_file = PROCESSED_DIR / "dem.npy"
    georef_file = PROCESSED_DIR / "georef.json"
    for required in (dem_file, georef_file, THERMAL_SOURCE):
        if not required.exists():
            raise SystemExit(f"Missing {required}. See the notes at the top of this script.")

    rows, cols = np.load(dem_file, mmap_mode="r").shape
    georef = json.loads(georef_file.read_text())
    bounds = georef["bounds"]
    grid_crs = CRS.from_wkt(georef["crs_wkt"])
    grid_transform = from_bounds(
        bounds["left"], bounds["bottom"], bounds["right"], bounds["top"], cols, rows
    )

    grey = np.zeros((rows, cols), dtype=np.float32)
    with rasterio.open(THERMAL_SOURCE) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=grey,
            dst_transform=grid_transform,
            dst_crs=grid_crs,
            src_nodata=0,
            dst_nodata=0,
            resampling=Resampling.bilinear,
        )

    covered = grey > 0
    if not covered.any():
        raise SystemExit("The terrain window lies outside the thermal mosaic. Check georef.json.")

    scale = (TI_AT_GREY_MAX - TI_AT_GREY_MIN) / 254.0
    thermal = np.where(covered, TI_AT_GREY_MIN + (grey - 1.0) * scale, np.nan).astype(np.float32)
    np.save(PROCESSED_DIR / "thermal.npy", thermal)
    print(
        f"Wrote thermal.npy ({cols}x{rows}), {covered.mean() * 100:.0f}% covered, "
        f"thermal inertia {np.nanmin(thermal):.0f} to {np.nanmax(thermal):.0f}"
    )


if __name__ == "__main__":
    main()

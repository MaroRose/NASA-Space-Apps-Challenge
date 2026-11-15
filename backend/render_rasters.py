"""Pre-renders the terrain grids as static PNGs for the frontend map layers.

Run from backend/ with `python render_rasters.py`. Output goes to
frontend/public/terrain/. Re-run whenever data/processed/ changes.
"""
import json
import struct
import zlib
from pathlib import Path

import numpy as np

BACKEND_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BACKEND_DIR / "data" / "processed"
OUTPUT_DIR = BACKEND_DIR.parent / "frontend" / "public" / "terrain"

SLOPE_LIMITS_DEG = range(10, 31)
CAUTION_MARGIN_DEG = 5.0
CAUTION_RGBA = (245, 165, 36, 110)
NO_GO_RGBA = (229, 72, 77, 170)
SHADOW_RGB = np.array([36, 22, 16], dtype=np.float32)
HIGHLIGHT_RGB = np.array([156, 114, 86], dtype=np.float32)
THERMAL_STOPS_RGB = [
    (35, 60, 200),
    (40, 170, 235),
    (60, 200, 90),
    (245, 215, 50),
    (215, 40, 40),
]
THERMAL_ALPHA = 200
THERMAL_VALUE_MIN = 50.0
THERMAL_VALUE_MAX = 520.0
THERMAL_UNITS = "J m\u207b\u00b2 K\u207b\u00b9 s\u207b\u00bd"


def _png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def encode_png(pixels: np.ndarray) -> bytes:
    """Encodes an HxWx3 (RGB) or HxWx4 (RGBA) uint8 array as a PNG using only the standard library."""
    height, width, channels = pixels.shape
    color_type = {3: 2, 4: 6}[channels]
    scanlines = np.hstack([np.zeros((height, 1), dtype=np.uint8), pixels.reshape(height, -1)])
    header = struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", header)
        + _png_chunk(b"IDAT", zlib.compress(scanlines.tobytes(), 9))
        + _png_chunk(b"IEND", b"")
    )


def render_hillshade(dem: np.ndarray, resolution_m: float, sun_altitude_deg: float = 45.0) -> np.ndarray:
    """Shaded relief lit from the top-left, contrast-stretched and tinted, one pixel per grid cell."""
    elevation = np.asarray(dem, dtype=np.float32)
    dy, dx = np.gradient(elevation, resolution_m)
    altitude = np.radians(sun_altitude_deg)
    light_xy = -np.cos(altitude) / np.sqrt(2.0)
    shade = (-dx * light_xy - dy * light_xy + np.sin(altitude)) / np.sqrt(dx**2 + dy**2 + 1.0)
    low, high = np.percentile(shade, [2, 98])
    stretched = np.clip((shade - low) / max(high - low, 1e-6), 0.0, 1.0)[..., None]
    return (SHADOW_RGB + stretched * (HIGHLIGHT_RGB - SHADOW_RGB)).astype(np.uint8)


def render_hazard(slope: np.ndarray, max_slope_deg: float) -> np.ndarray:
    """Transparent where safe, amber near the limit, red where the router refuses to go."""
    slope_deg = np.asarray(slope, dtype=np.float32)
    rgba = np.zeros((*slope_deg.shape, 4), dtype=np.uint8)
    rgba[slope_deg > max_slope_deg - CAUTION_MARGIN_DEG] = CAUTION_RGBA
    rgba[np.isnan(slope_deg) | (slope_deg > max_slope_deg)] = NO_GO_RGBA
    return rgba


def render_thermal(thermal: np.ndarray) -> tuple[np.ndarray, float, float]:
    """Blue-green-red ramp over the local 2nd-98th percentile range. Returns the image and that range."""
    values = np.asarray(thermal, dtype=np.float32)
    valid = ~np.isnan(values)
    low, high = (float(v) for v in np.percentile(values[valid], [2, 98]))
    stretched = np.clip((np.nan_to_num(values, nan=low) - low) / max(high - low, 1e-6), 0.0, 1.0)
    stops = np.array(THERMAL_STOPS_RGB, dtype=np.float32)
    positions = np.linspace(0.0, 1.0, len(stops))
    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    for channel in range(3):
        rgba[..., channel] = np.interp(stretched, positions, stops[:, channel]).astype(np.uint8)
    rgba[..., 3] = np.where(valid, THERMAL_ALPHA, 0)
    return rgba, low, high


def render_thermal_values(thermal: np.ndarray) -> np.ndarray:
    """Grey image holding the actual values on a fixed scale, read by the frontend for the cursor readout."""
    values = np.asarray(thermal, dtype=np.float32)
    valid = ~np.isnan(values)
    span = THERMAL_VALUE_MAX - THERMAL_VALUE_MIN
    level = np.clip((np.nan_to_num(values, nan=THERMAL_VALUE_MIN) - THERMAL_VALUE_MIN) / span, 0.0, 1.0)
    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    rgba[..., :3] = np.round(level * 255.0).astype(np.uint8)[..., None]
    rgba[..., 3] = np.where(valid, 255, 0)
    return rgba


def main() -> None:
    dem_file = PROCESSED_DIR / "dem.npy"
    slope_file = PROCESSED_DIR / "slope.npy"
    meta_file = PROCESSED_DIR / "site_metadata.json"
    if not (dem_file.exists() and slope_file.exists() and meta_file.exists()):
        raise SystemExit(
            f"No processed terrain in {PROCESSED_DIR}. Start the API once (it builds a dev grid) "
            "or run etl_pipeline.py, then re-run this script."
        )

    dem = np.load(dem_file)
    slope = np.load(slope_file)
    with open(meta_file) as f:
        resolution_m = float(json.load(f)["resolution_m"])

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "hillshade.png").write_bytes(encode_png(render_hillshade(dem, resolution_m)))
    for limit in SLOPE_LIMITS_DEG:
        (OUTPUT_DIR / f"hazard-{limit}.png").write_bytes(encode_png(render_hazard(slope, float(limit))))

    rows, cols = dem.shape
    print(f"Wrote hillshade.png and {len(SLOPE_LIMITS_DEG)} hazard overlays ({cols}x{rows} px) to {OUTPUT_DIR}")

    thermal_file = PROCESSED_DIR / "thermal.npy"
    if thermal_file.exists():
        thermal = np.load(thermal_file)
        image, low, high = render_thermal(thermal)
        (OUTPUT_DIR / "thermal.png").write_bytes(encode_png(image))
        (OUTPUT_DIR / "thermal-values.png").write_bytes(encode_png(render_thermal_values(thermal)))
        legend = {
            "min": round(low, 1),
            "max": round(high, 1),
            "units": THERMAL_UNITS,
            "stops": THERMAL_STOPS_RGB,
            "value_min": THERMAL_VALUE_MIN,
            "value_max": THERMAL_VALUE_MAX,
        }
        (OUTPUT_DIR / "thermal.json").write_text(json.dumps(legend, ensure_ascii=False, indent=2))
        print(f"Wrote thermal.png, thermal-values.png and thermal.json (thermal inertia {low:.0f} to {high:.0f})")
    else:
        print("No thermal.npy found, skipped the thermal layer (run build_thermal.py first).")


if __name__ == "__main__":
    main()

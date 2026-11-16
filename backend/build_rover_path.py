"""Build frontend/public/terrain/rover-path.json from the MSL localization GeoJSON.

Usage (from the repo root):
    python backend/build_rover_path.py

Reads frontend/data/MSL_waypoints.json (one point per drive end, with sol
and odometry) and frontend/data/MSL_SurfaceSites.json (named study areas),
and writes a compact file the frontend draws as the Curiosity traverse layer.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WAYPOINTS = ROOT / "frontend" / "data" / "MSL_waypoints.json"
SITES = ROOT / "frontend" / "data" / "MSL_SurfaceSites.json"
OUT = ROOT / "frontend" / "public" / "terrain" / "rover-path.json"


def load_features(path: Path) -> list[dict]:
    with path.open() as fh:
        return json.load(fh)["features"]


def build() -> dict:
    points = []
    for feature in load_features(WAYPOINTS):
        props = feature["properties"]
        lon, lat = feature["geometry"]["coordinates"][:2]
        points.append(
            [
                round(float(lon), 6),
                round(float(lat), 6),
                int(props["sol"]),
                round(float(props.get("dist_km", 0.0)), 2),
            ]
        )
    points.sort(key=lambda p: p[2])

    sites = []
    for feature in load_features(SITES):
        ring = feature["geometry"]["coordinates"][0]
        lons = [float(p[0]) for p in ring]
        lats = [float(p[1]) for p in ring]
        sites.append(
            {
                "name": feature["properties"]["Name"],
                "lon": round(sum(lons) / len(lons), 6),
                "lat": round(sum(lats) / len(lats), 6),
            }
        )

    last = points[-1]
    return {
        "source": "NASA/JPL MSL rover localization (site/drive waypoints), planetocentric lat/lon",
        "fields": ["lon", "lat", "sol", "odometry_km"],
        "points": points,
        "sites": sites,
        "landing": {"lon": points[0][0], "lat": points[0][1], "sol": points[0][2]},
        "current": {"lon": last[0], "lat": last[1], "sol": last[2], "odometry_km": last[3]},
    }


def main() -> None:
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w") as fh:
        json.dump(data, fh, separators=(",", ":"))
    print(f"wrote {OUT} ({len(data['points'])} points, {len(data['sites'])} sites)")


if __name__ == "__main__":
    main()

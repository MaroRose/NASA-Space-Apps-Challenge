# MarsWalk

A route planner for astronauts walking on the surface of Mars. Pick a start and an end point on a real terrain map of Gale Crater, and MarsWalk plans a walking route that avoids slopes too steep to cross safely. It then reports the distance, the steepest slope along the way, an elevation profile, and an estimate of the walk's duration, temperature and radiation dose.

Built for the NASA Space Apps Challenge 2026.

- **Live demo:** https://nasa-space-apps-g0bkbggbftahaxdg.westus-01.azurewebsites.net/
- **Presentation:** [Google Slides](https://docs.google.com/presentation/d/1ATL4ayR9_s-c0j1mtpyUdosl9v84o_iIXj_7twgj_FQ/edit?usp=sharing)

## Features

- **Safe route planning:** an A* pathfinder finds a walkable route under a slope limit you choose (10° to 30° in the app).
- **Map layers:** shaded relief, a HiRISE surface photo, THEMIS thermal inertia, slope hazard zones, and the real path Curiosity drove.
- **Walk-back ring:** shows how far an astronaut can go and still walk back to the habitat.
- **EVA estimate:** uses real Curiosity weather data to estimate time outside, temperature range and radiation dose for a chosen departure hour.
- **Point inspector:** elevation, slope, thermal inertia and Mars latitude/longitude for any spot on the map.
- **Route home:** mark your current position and plan the way back to the habitat.

## Data

The map covers a 4 km × 4 km sector of Gale Crater near Mount Sharp, at 10 m per cell.

| Dataset                        | Used for                         |
| ------------------------------ | -------------------------------- |
| HiRISE digital elevation model | Terrain, slopes, shaded relief   |
| HiRISE orthoimage              | Surface photo layer              |
| Curiosity REMS weather data    | Temperature and radiation estimate |
| THEMIS thermal inertia mosaic  | Thermal layer                    |
| MSL localization data          | Curiosity traverse layer         |

## Team

| Area                   | Who          |
| ---------------------- | ------------ |
| Frontend               | Gabriel      |
| Microsoft Azure        | Dev          |
| Pathfinder algorithm   | Maro         |
| Backend                | John & Chris |

## Stack

- **Frontend:** React, TypeScript, Vite, Leaflet
- **Backend:** Python, FastAPI, NumPy
- **Cloud:** Microsoft Azure App Service, deployed with GitHub Actions

## Project structure

```
backend/
  main.py               FastAPI server (also serves the built frontend in production)
  router_engine.py      A* pathfinder
  etl_pipeline.py       NASA terrain and weather data → processed grids
  render_rasters.py     pre-renders the map layer images
  build_thermal.py      aligns THEMIS thermal data to the terrain grid
  build_rover_path.py   builds the Curiosity traverse layer
  data/processed/       processed terrain grids the server loads
frontend/
  src/                  React app
  src/api/              calls to the backend
  public/terrain/       pre-rendered map layers
.github/workflows/      build and deploy to Azure
```

## Running locally

### Requirements

- Python 3.9 or newer
- Node.js 20.19 or newer

### 1. Backend

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install fastapi "uvicorn[standard]" numpy
cd backend
uvicorn main:app --reload --port 8000
```

The API runs at `http://127.0.0.1:8000`, with interactive docs at `http://127.0.0.1:8000/docs`.

The processed terrain data is already in the repository, so no NASA downloads are needed to run the app. The scripts that build it from the raw files (`etl_pipeline.py` and the others above) need the full requirements, `pip install -r requirements.txt`, plus the original NASA files, which are several GB and not included.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`. The backend must be running for the app to load.

## Deployment

Every push to `main` runs a GitHub Actions workflow that builds the frontend, bundles it into the FastAPI backend, and deploys it to Azure App Service. The app and the API are served from the same address.

## API

All endpoints are under `/api/v1`.

| Method | Endpoint          | Description                                          |
| ------ | ----------------- | ---------------------------------------------------- |
| GET    | `/health`         | Server status and terrain grid size                  |
| GET    | `/site/overview`  | Site metadata, waypoints and hourly weather data     |
| GET    | `/terrain/point`  | Elevation and slope at `?x=&y=`, plus a hazard flag  |
| POST   | `/route/plan`     | Plan a route                                         |
| GET    | `/route/plan`     | Same as above, with query parameters                 |

Example route request against the live demo:

```bash
curl -X POST https://nasa-space-apps-g0bkbggbftahaxdg.westus-01.azurewebsites.net/api/v1/route/plan \
  -H "Content-Type: application/json" \
  -d '{"start_x":100,"start_y":100,"end_x":200,"end_y":200}'
```

Coordinates are grid cells (0 to 399). `max_slope_deg` is optional and accepts values above 1 up to 45 (default 20). The response includes `path_coordinates` (each point's x, y, elevation and slope), `total_distance_m`, `waypoint_count`, `max_slope_encountered_deg` and `compute_ms`. If no safe route exists, the API returns `422` with the reason.

## Processing prototype

The `.pde` files and the root `data/` folder are an earlier prototype of the pathfinder, built in [Processing](https://processing.org/download) on lunar elevation data. It isn't used by the app. To run it, open `Elevation_Map_Challenge.pde` in the Processing IDE.

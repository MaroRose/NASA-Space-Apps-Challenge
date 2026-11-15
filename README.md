# MarsWalk

<<<<<<< HEAD
1. Dowload the Processing library at https://processing.org/download
2. Make sure all asset files are present in the data folder
3. Enter Mission data into "MissionInputData.csv"
4. Run the "Elevation_Map_Challenge.pde" file in the Processing IDE or in VSCode.


# To Do

1. Switch from Processing Mode to Native Java
=======
A 2D path planner for astronauts on the surface of Mars. Pick a start and an end point on the terrain map, and MarsWalk plans a walking route that avoids slopes too steep to cross safely, then reports its distance, waypoints and the steepest slope along the way.

Built for Hackathon 2026.

## Team

| Area                   | Who          |
| ---------------------- | ------------ |
| Frontend               | Gabriel      |
| Microsoft Azure        | Dev          |
| Pathfinder algorithm   | Maro         |
| Backend                | John & Chris |

## Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI, NumPy
- **Cloud:** Microsoft Azure Blob Storage, for the processed terrain data

## Project structure

```
backend/
  main.py             FastAPI server
  router_engine.py    A* pathfinder
  etl_pipeline.py     NASA terrain → processed grids (+ Azure upload)
  requirements.txt
  data/raw/           raw NASA input files (not committed)
  data/processed/     generated grids the server loads (not committed)
frontend/
  src/                React app
  src/api/            calls to the backend
```

## Getting started

### Requirements

- Python 3.9 or newer
- Node.js 20 or newer

### 1. Backend

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi "uvicorn[standard]" numpy
cd backend
uvicorn main:app --reload --port 8000
```

The API runs at `http://127.0.0.1:8000`, with interactive docs at `http://127.0.0.1:8000/docs`.

If there are no processed terrain files in `backend/data/processed/`, the server generates a synthetic Gale Crater grid, so you can develop without the NASA data.

To run the terrain pipeline as well, install the full requirements with `pip install -r requirements.txt`, which adds pandas, rasterio and the Azure SDK. Put `gale_test.tif` and `rems_data.tab` in `backend/data/raw/`, then run:

```bash
python etl_pipeline.py
```

To upload the results to Azure, set `AZURE_STORAGE_CONNECTION_STRING` before running the pipeline. `AZURE_CONTAINER_NAME` is optional and defaults to `marswalk-terrain`.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`. The backend must be running for the app to load route data.

## API

All endpoints are under `/api/v1`.

| Method | Endpoint          | Description                                          |
| ------ | ----------------- | ---------------------------------------------------- |
| GET    | `/health`         | Server status and terrain grid size                  |
| GET    | `/site/overview`  | Site metadata, including weather telemetry           |
| GET    | `/terrain/point`  | Elevation and slope at `?x=&y=`, plus a hazard flag  |
| POST   | `/route/plan`     | Plan a route (also available at `POST /route`)       |
| GET    | `/route/plan`     | Same as above, with query parameters, for testing    |

Example route request:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/route/plan \
  -H "Content-Type: application/json" \
  -d '{"start_x":100,"start_y":100,"end_x":200,"end_y":200}'
```

`max_slope_deg` is optional and accepts values above 1 up to 45 (default 20). The response includes `path_coordinates` (each point's x, y, elevation and slope), `total_distance_m`, `waypoint_count`, `max_slope_encountered_deg` and `compute_ms`. If no safe route exists, the API returns `422` with the reason.

## Processing prototype

The `.pde` files and the root `data/` folder are an earlier prototype of the pathfinder, built in [Processing](https://processing.org/download) on lunar elevation data. It isn't used by the app. To run it, open `Elevation_Map_Challenge.pde` in the Processing IDE.
>>>>>>> 2b6f15d420920d7b4110507f279835cf86cec91d

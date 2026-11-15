# Standalone p5.js sketch

This folder contains a browser JavaScript conversion of the Processing sketch,
including the A* path finder and JSON helper. It uses the map and mission files
from the repository's `data/` directory.

## Run locally

From the repository root, start a local static server:

```powershell
py -m http.server 8000
```

Open <http://localhost:8000/p5js/> in a browser. The page loads p5.js from a
CDN, so an internet connection is needed.

Use the buttons to download the mission metrics or path coordinates as CSV.
The mission's `initialFuel` column is optional and defaults to `0`; the current
sketch does not model travel time or fuel consumption.

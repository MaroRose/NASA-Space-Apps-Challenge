import { JSONHandler } from "./json-handler.js";
import { parseMissionCsv, PathFinder } from "./path-finder.js";

const mapPath = "../data/Martian_Elevation_Map.jpg";
const missionPath = "../data/MissionInputData.csv";
const metadataPath = "../data/gale_dem_info.json";

const statusElement = document.querySelector("#status");
const metricsElement = document.querySelector("#metrics");
const missionInputElement = document.querySelector("#mission-input");
const missionUpload = document.querySelector("#upload-data");
const missionDownload = document.querySelector("#download-mission");
const pathDownload = document.querySelector("#download-path");

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.dataset.error = String(isError);
}

function downloadCsv(filename, contents) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatMissionInput(pathFinder) {
  const { payloadWeight, initialFuel, velocity, fuelEfficiency } = pathFinder.missionInputData;
  return [
    `Start: (${pathFinder.startPoint.x}, ${pathFinder.startPoint.y})`,
    `Destination: (${pathFinder.endPoint.x}, ${pathFinder.endPoint.y})`,
    `Payload: ${payloadWeight}`,
    `Initial fuel: ${initialFuel}`,
    `Velocity: ${velocity}`,
    `Fuel efficiency: ${fuelEfficiency}`,
  ].join(" | ");
}

new window.p5((p) => {
  let mapImage;
  let pathFinder;
  let metadataHandler;
  let elevationGrid;
  let imageLoadError;

  function loadMissionData(missionCsv, statusMessage, validateMapDimensions = false) {
    const mission = parseMissionCsv(missionCsv);
    const width = mapImage.width;
    const height = mapImage.height;
    if (validateMapDimensions && mission.width && Number(mission.width) !== width) {
      throw new Error(`Mission map width (${mission.width}) does not match the image (${width}).`);
    }
    if (validateMapDimensions && mission.height && Number(mission.height) !== height) {
      throw new Error(`Mission map height (${mission.height}) does not match the image (${height}).`);
    }

    const nextPathFinder = new PathFinder(elevationGrid, width, height, missionCsv);
    nextPathFinder.calculatePath();
    pathFinder = nextPathFinder;
    p.resizeCanvas(width, height);
    missionDownload.disabled = false;
    pathDownload.disabled = false;
    missionUpload.disabled = false;
    missionInputElement.textContent = formatMissionInput(pathFinder);
    metricsElement.textContent =
      `Path length: ${pathFinder.calculateTotalPathLength().toFixed(2)} | ` +
      `Time: ${pathFinder.calculateTotalTime().toFixed(2)} | ` +
      `Fuel cost: ${pathFinder.calculateFuelCost().toFixed(2)} | ` +
      `Payload: ${pathFinder.calculatePayloadWeight()}`;
    setStatus(statusMessage);
  }

  p.preload = () => {
    mapImage = p.loadImage(
      mapPath,
      undefined,
      (error) => {
        imageLoadError = error;
      },
    );
  };

  p.setup = async () => {
    p.createCanvas(100, 100).parent("sketch-container");
    p.frameRate(30);

    try {
      if (imageLoadError || !mapImage) {
        throw new Error(`Unable to load elevation map: ${mapPath}`);
      }
      const [missionResponse, metadataResponse] = await Promise.all([
        fetch(missionPath),
        fetch(metadataPath),
      ]);
      if (!missionResponse.ok) {
        throw new Error(`Unable to load mission data: ${missionPath}`);
      }
      if (!metadataResponse.ok) {
        throw new Error(`Unable to load metadata: ${metadataPath}`);
      }

      const [missionCsv, metadata] = await Promise.all([
        missionResponse.text(),
        metadataResponse.json(),
      ]);
      metadataHandler = new JSONHandler(metadata);
      const width = mapImage.width;
      const height = mapImage.height;

      mapImage.loadPixels();
      elevationGrid = new Float32Array(width * height);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const pixelOffset = 4 * (y * width + x);
          const brightness = Math.max(
            mapImage.pixels[pixelOffset],
            mapImage.pixels[pixelOffset + 1],
            mapImage.pixels[pixelOffset + 2],
          ) / 255 * 100;
          elevationGrid[x * height + y] = brightness;
        }
      }

      const metadataFile = metadataHandler.getJSON().metadata?.file;
      loadMissionData(
        missionCsv,
        metadataFile ? `Map ready. Metadata source: ${metadataFile}` : "Map ready.",
        true,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), true);
    }
  };

  p.draw = () => {
    if (!mapImage || !pathFinder) return;

    p.image(mapImage, 0, 0);
    p.push();
    p.noFill();
    p.stroke(255);
    p.strokeWeight(1);
    p.beginShape();
    for (const point of pathFinder.path) {
      p.vertex(point.x, point.y);
    }
    p.endShape();

    p.strokeWeight(5);
    p.stroke(255, 0, 0);
    p.point(pathFinder.startPoint.x, pathFinder.startPoint.y);
    p.stroke(0, 0, 255);
    p.point(pathFinder.endPoint.x, pathFinder.endPoint.y);

    const x = Math.floor(p.mouseX);
    const y = Math.floor(p.mouseY);
    if (x >= 0 && x < pathFinder.width && y >= 0 && y < pathFinder.height) {
      const elevation = elevationGrid[pathFinder.index(x, y)];
      const label = `Coordinates: (${x}, ${y}, ${elevation.toFixed(1)})`;
      p.noStroke();
      p.fill(0, 180);
      p.rect(0, p.height - 26, p.width, 26);
      p.fill(255);
      p.text(label, 8, p.height - 8);
    }
    p.pop();
  };

  missionUpload.addEventListener("click", () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".csv,text/csv";
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      missionUpload.disabled = true;
      try {
        loadMissionData(await file.text(), `Mission data loaded from ${file.name}.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), true);
      } finally {
        missionUpload.disabled = false;
      }
    });
    fileInput.click();
  });

  missionDownload.addEventListener("click", () => {
    if (pathFinder) {
      downloadCsv("MissionOutputData.csv", pathFinder.missionOutputCsv());
    }
  });

  pathDownload.addEventListener("click", () => {
    if (pathFinder) {
      downloadCsv("PathOutputData.csv", pathFinder.pathOutputCsv());
    }
  });
});
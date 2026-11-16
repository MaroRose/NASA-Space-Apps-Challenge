import { MissionMetrics } from "./missionMetrics.js";

export function parseMissionCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error("Mission input CSV must contain a header and a data row.");
  }

  const parseRow = (line) => {
    const fields = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
      const character = line[i];
      if (character === '"') {
        if (quoted && line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        fields.push(field.trim());
        field = "";
      } else {
        field += character;
      }
    }

    if (quoted) {
      throw new Error("Mission input CSV contains an unterminated quoted field.");
    }
    fields.push(field.trim());
    return fields;
  };

  const headers = parseRow(lines[0]);
  const values = parseRow(lines[1]);
  if (values.length !== headers.length) {
    throw new Error("Mission input CSV row does not match its header.");
  }

  return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
}

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(node) {
    const items = this.items;
    items.push(node);
    let index = items.length - 1;

    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (items[parent].fCost <= node.fCost) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = node;
  }

  pop() {
    const items = this.items;
    const first = items[0];
    const last = items.pop();
    if (items.length === 0) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= items.length) break;
      const child = right < items.length && items[right].fCost < items[left].fCost
        ? right
        : left;
      if (items[child].fCost >= last.fCost) break;
      items[index] = items[child];
      index = child;
    }
    items[index] = last;
    return first;
  }

  get length() {
    return this.items.length;
  }
}

export class PathFinder {
  constructor(elevationGrid, width, height, missionCsv) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new RangeError("Mission map dimensions must be positive integers.");
    }
    if (elevationGrid.length !== width * height) {
      throw new RangeError("Elevation data does not match the map dimensions.");
    }

    this.elevationGrid = elevationGrid;
    this.width = width;
    this.height = height;
    this.mission = parseMissionCsv(missionCsv);
    this.path = [];
    this.startPoint = {
      x: this.readCoordinate("xStartPosition"),
      y: this.readCoordinate("yStartPosition"),
    };
    this.waypoints = this.readWaypoints();

    this.missionInputData = {
      payloadWeight: this.readNumber("payloadWeight"),
      initialFuel: this.mission.initialFuel === undefined || this.mission.initialFuel === ""
        ? 0
        : this.readNumber("initialFuel"),
      remainingFuel: this.mission.initialFuel === undefined || this.mission.initialFuel === ""
        ? 0
        : this.readNumber("initialFuel"),
      velocity: this.readNumber("velocity"),
      fuelEfficiency: this.readNumber("fuelEfficiency"),
      totalPathLength: 0,
      totalTime: 0,
      fuelCost: 0,
      fuelConsumptionRate: 0 
    }

    console.log(this.missionInputData);
    
    this.missionMetrics = new MissionMetrics(this);
  }

  readWaypoints() {
    const waypointIndices = new Set();
    for (const field of Object.keys(this.mission)) {
      const match = field.match(/^[xy]Waypoint(\d+)Position$/);
      if (match) waypointIndices.add(Number(match[1]));
    }

    if (waypointIndices.size === 0) {
      return [{
        x: this.readCoordinate("xEndPosition"),
        y: this.readCoordinate("yEndPosition"),
      }];
    }

    const orderedIndices = [...waypointIndices].sort((a, b) => a - b);
    if (orderedIndices.some((index, position) => index !== position + 1)) {
      throw new Error("Waypoint columns must be numbered consecutively starting at 1.");
    }

    return orderedIndices.map((index) => {
      const xField = `xWaypoint${index}Position`;
      const yField = `yWaypoint${index}Position`;
      if (!this.mission[xField]?.trim() || !this.mission[yField]?.trim()) {
        throw new Error(`Waypoint ${index} must include both X and Y coordinates.`);
      }
      return {
        x: this.readCoordinate(xField),
        y: this.readCoordinate(yField),
      };
    });
  }

  readNumber(field) {
    const value = Number(this.mission[field]);
    if (!Number.isFinite(value)) {
      throw new Error(`Mission input is missing a valid "${field}" value.`);
    }
    if ((field === "velocity" || field === "fuelEfficiency") && value <= 0) {
      throw new RangeError(`Mission input "${field}" must be greater than zero.`);
    }
    return value;
  }

  readCoordinate(field) {
    return Math.trunc(this.readNumber(field));
  }

  index(x, y) {
    return x * this.height + y;
  }

  elevationAt(x, y) {
    return this.elevationGrid[this.index(x, y)];
  }

  isTraversable(x, y) {
    return Number.isFinite(this.elevationAt(x, y));
  }

  distance(first, second) {
    return Math.hypot(
      first.x - second.x,
      first.y - second.y,
      (first.z ?? 0) - (second.z ?? 0),
    );
  }

  heuristic(x, y, endX, endY) {
    return Math.hypot(endX - x, endY - y);
  }

  buildPath(parent, endX, endY) {
    const reversed = [];
    let index = this.index(endX, endY);

    while (index !== -1) {
      const x = Math.floor(index / this.height);
      const y = index % this.height;
      reversed.push({ x, y, z: this.elevationAt(x, y) });
      index = parent[index];
    }
    return reversed.reverse();
  }

  calculateLeg(startPoint, endPoint, legNumber) {
    const { x: startX, y: startY } = startPoint;
    const { x: endX, y: endY } = endPoint;
    const insideMap = (x, y) => x >= 0 && x < this.width && y >= 0 && y < this.height;

    if (!insideMap(startX, startY) || !insideMap(endX, endY)) {
      throw new RangeError(`Route leg ${legNumber} has a waypoint outside the map.`);
    }
    if (!this.isTraversable(startX, startY) || !this.isTraversable(endX, endY)) {
      throw new Error(`Route leg ${legNumber} has a waypoint without valid elevation data.`);
    }

    const cellCount = this.width * this.height;
    const gScore = new Float64Array(cellCount);
    gScore.fill(Infinity);
    const parent = new Int32Array(cellCount);
    parent.fill(-1);
    const closed = new Uint8Array(cellCount);
    const startIndex = this.index(startX, startY);
    const endIndex = this.index(endX, endY);
    const open = new MinHeap();

    gScore[startIndex] = 0;
    open.push({ x: startX, y: startY, gCost: 0, fCost: this.heuristic(startX, startY, endX, endY) });

    while (open.length > 0) {
      const current = open.pop();
      const currentIndex = this.index(current.x, current.y);
      if (current.gCost > gScore[currentIndex] || closed[currentIndex]) continue;
      if (currentIndex === endIndex) {
        return this.buildPath(parent, endX, endY);
      }

      closed[currentIndex] = 1;
      const currentPoint = {
        x: current.x,
        y: current.y,
        z: this.elevationAt(current.x, current.y),
      };

      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          const x = current.x + dx;
          const y = current.y + dy;
          if (!insideMap(x, y) || !this.isTraversable(x, y)) continue;

          const neighborIndex = this.index(x, y);
          if (closed[neighborIndex]) continue;
          const neighbor = { x, y, z: this.elevationAt(x, y) };
          const tentativeG = current.gCost + this.distance(currentPoint, neighbor);
          if (tentativeG < gScore[neighborIndex]) {
            parent[neighborIndex] = currentIndex;
            gScore[neighborIndex] = tentativeG;
            open.push({
              x,
              y,
              gCost: tentativeG,
              fCost: tentativeG + this.heuristic(x, y, endX, endY),
            });
          }
        }
      }
    }

    throw new Error("No traversable path exists between the mission points.");
  }

  calculatePath() {
    this.path = [];
    let legStart = this.startPoint;

    this.waypoints.forEach((waypoint, index) => {
      const legPath = this.calculateLeg(legStart, waypoint, index + 1);
      this.path.push(...(index === 0 ? legPath : legPath.slice(1)));
      legStart = waypoint;
    });

    return this.path;
  }

  calculateTotalPathLength() {
    return this.missionMetrics.calculateTotalPathLength();
  }

  calculateTotalTime() {
    return this.missionMetrics.calculateTotalTime();
  }

  calculateTotalTimeWithStops(totalStopTime, k_p, k_f) {
    return this.missionMetrics.calculateTotalTimeWithStops(totalStopTime, k_p, k_f);
  }

  calculateFuelCost() {
    return this.missionMetrics.calculateFuelCost();
  }

  calculatePayloadWeight() {
    return this.missionMetrics.calculatePayloadWeight();
  }

  missionOutputCsv() {
    this.calculateTotalPathLength();
    this.calculateFuelCost();
    return [
      "totalPathLength,totalTime,fuelCost,payload,initialFuel,remainingFuel,velocity,fuelEfficiency,fuelConsumptionRate",
      [
        this.missionInputData.totalPathLength,
        this.missionInputData.totalTime,
        this.missionInputData.fuelCost,
        this.calculatePayloadWeight(),
        this.missionInputData.initialFuel,
        this.missionInputData.remainingFuel,
        this.missionInputData.velocity,
        this.missionInputData.fuelEfficiency,
        this.missionInputData.fuelConsumptionRate,
      ].join(","),
    ].join("\n");
  }

  pathOutputCsv() {
    return ["xPosition,yPosition,zPosition", ...this.path.map(({ x, y, z}) => `${x},${y},${z}`)].join("\n");
  }
}
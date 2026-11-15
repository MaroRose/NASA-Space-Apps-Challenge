export class MissionMetrics {
  constructor(pathFinder) {
    this.pathFinder = pathFinder;
    this.missionInputData = pathFinder.missionInputData;
  }

  calculateTotalPathLength() {
    const path = this.pathFinder.path;
    this.missionInputData.totalPathLength = 0;
    for (let i = 1; i < path.length; i++) {
      this.missionInputData.totalPathLength += this.pathFinder.distance(path[i - 1], path[i]);
    }
    return this.missionInputData.totalPathLength;
  }

  calculateTotalTime() {
    const totalPathLength = this.calculateTotalPathLength();
    this.missionInputData.totalTime = totalPathLength / this.missionInputData.velocity;
    return this.missionInputData.totalTime;
  }

  calculateFuelCost() {
    const totalPathLength = this.calculateTotalPathLength();
    this.missionInputData.fuelConsumptionRate = 1 / this.missionInputData.fuelEfficiency;
    this.missionInputData.fuelCost = totalPathLength * this.missionInputData.fuelConsumptionRate;
    this.missionInputData.remainingFuel =
      this.missionInputData.initialFuel - this.missionInputData.fuelCost;
    return this.missionInputData.fuelCost;
  }

  calculatePayloadWeight() {
    return this.missionInputData.payloadWeight;
  }

  calculateVelocity() {
    return this.missionInputData.velocity;
  }
}
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

  calculateTotalTime(k_p, k_f) {
    const totalPathLength = this.calculateTotalPathLength();
    const payloadWeight = this.missionInputData.payloadWeight;
    this.missionInputData.totalTime = totalPathLength * (k_p * payloadWeight + k_f) / this.missionInputData.velocity;
    return this.missionInputData.totalTime;
  }

    calculateTotalTimeWithStops(totalStopTime, k_p, k_f) {
    const totalPathLength = this.calculateTotalPathLength();
    const payloadWeight = this.missionInputData.payloadWeight;
    this.missionInputData.totalTime = totalPathLength * (k_p * payloadWeight + k_f) / this.missionInputData.velocity + totalStopTime;
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
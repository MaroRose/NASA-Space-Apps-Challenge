import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TerrainPointInfo } from "../types/terrain.ts";
import { PointInspector } from "./PointInspector.tsx";

afterEach(cleanup);

const HAZARD_CELL: TerrainPointInfo = { x: 10, y: 20, elev_m: -4412.37, slope_deg: 27.84, is_hazard: true };
const SAFE_CELL: TerrainPointInfo = { ...HAZARD_CELL, slope_deg: 4.2, is_hazard: false };

function inspectorText() {
  return screen.getByRole("group",{ name: "Point inspector" }).textContent ?? "";
}

describe("PointInspector", () => {
  it("shows position, elevation and a HAZARD flag for a hazardous cell", () => {
    render(<PointInspector inspected={HAZARD_CELL} latLonLabel="4.5872° S, 137.4262° E" thermalValue={null} />);

    const text = inspectorText();
    expect(text).toContain("4.5872° S, 137.4262° E");
    expect(text).toContain("elev -4412.4 m");
    expect(text).toContain("slope 27.8°");
    expect(text).toContain("HAZARD");
    expect(text).not.toContain("thermal inertia");
  });

  it("says the position is unavailable when there is no georeference", () => {
    render(<PointInspector inspected={SAFE_CELL} latLonLabel={null} thermalValue={null} />);

    expect(inspectorText()).toContain("position unavailable");
    expect(inspectorText()).not.toContain("HAZARD");
  });

  it("adds the thermal inertia reading when one is available", () => {
    render(<PointInspector inspected={SAFE_CELL} latLonLabel={null} thermalValue={312.6} />);

    expect(inspectorText()).toContain("thermal inertia 313");
  });
});

import { describe, expect, it } from "vitest";
import { PANEL_TABS, resolveNextPanel } from "./panelNavigation.ts";

describe("resolveNextPanel", () => {
  it("opens the requested panel from the bare map", () => {
    expect(resolveNextPanel("map", "layers")).toBe("layers");
  });

  it("closes back to the map when the open panel is requested again", () => {
    expect(resolveNextPanel("route", "route")).toBe("map");
  });

  it("switches straight from one panel to another", () => {
    expect(resolveNextPanel("layers", "route")).toBe("route");
  });

  it("keeps the map selected when Map is tapped while already on the map", () => {
    expect(resolveNextPanel("map", "map")).toBe("map");
  });
});

describe("PANEL_TABS", () => {
  it("lists Map, Layers and Route in tab-bar order", () => {
    expect(PANEL_TABS.map((tab) => tab.panel)).toEqual(["map", "layers", "route"]);
  });
});

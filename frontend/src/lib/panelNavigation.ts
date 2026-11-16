export type ActivePanel = "map" | "layers" | "route";

export interface PanelTab {
  panel: ActivePanel;
  label: string;
}

export const PANEL_TABS: readonly PanelTab[] = [
  { panel: "map", label: "Map" },
  { panel: "layers", label: "Layers" },
  { panel: "route", label: "Route" },
];

// Tapping the tab that's already open acts like a toggle and goes back to the bare map.
export function resolveNextPanel(currentPanel: ActivePanel, requestedPanel: ActivePanel): ActivePanel {
  if (currentPanel === requestedPanel) return "map";
  return requestedPanel;
}

import { useCallback, useEffect, useState } from "react";
import { type ActivePanel, resolveNextPanel } from "../lib/panelNavigation.ts";

export interface PanelNavigation {
  activePanel: ActivePanel;
  selectPanel: (panel: ActivePanel) => void;
  closePanel: () => void;
}

// Only drives which overlay is open on phone/tablet. Desktop CSS ignores it,
// so this hook never needs to know the viewport size.
export function usePanelNavigation(): PanelNavigation {
  const [activePanel, setActivePanel] = useState<ActivePanel>("map");

  const selectPanel = useCallback((requestedPanel: ActivePanel) => {
    setActivePanel((currentPanel) => resolveNextPanel(currentPanel, requestedPanel));
  }, []);

  const closePanel = useCallback(() => setActivePanel("map"), []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closePanel]);

  return { activePanel, selectPanel, closePanel };
}

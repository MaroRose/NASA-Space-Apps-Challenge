import { type ActivePanel, PANEL_TABS } from "../lib/panelNavigation.ts";
import type { RouteStatusBadge } from "../lib/routeStatus.ts";

interface PanelSwitcherProps {
  activePanel: ActivePanel;
  onSelect: (panel: ActivePanel) => void;
  routeStatus?: RouteStatusBadge | null;
}

function StatusBadge({ badge }: { badge: RouteStatusBadge }) {
  return (
    <span className="panel-switcher__badge" style={{ background: badge.color, color: badge.inkColor }}>
      {badge.status}
    </span>
  );
}

// Bottom tab bar on phones; on tablets CSS hides every button except "Layers".
// Hidden entirely on desktop, where all panels are docked.
export function PanelSwitcher({ activePanel, onSelect, routeStatus = null }: PanelSwitcherProps) {
  return (
    <nav className="panel-switcher" aria-label="Panels">
      {PANEL_TABS.map(({ panel, label }) => (
        <button
          key={panel}
          type="button"
          className="panel-switcher__tab"
          data-panel={panel}
          aria-pressed={activePanel === panel}
          onClick={() => onSelect(panel)}
        >
          {label}
          {panel === "route" && routeStatus && <StatusBadge badge={routeStatus} />}
        </button>
      ))}
    </nav>
  );
}

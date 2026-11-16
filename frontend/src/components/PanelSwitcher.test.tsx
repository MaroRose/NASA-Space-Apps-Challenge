import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelSwitcher } from "./PanelSwitcher.tsx";

afterEach(cleanup);

describe("PanelSwitcher", () => {
  it("renders Map, Layers and Route with aria-pressed matching the open panel", () => {
    render(<PanelSwitcher activePanel="route" onSelect={() => {}} />);

    const pressedByLabel = screen
      .getAllByRole("button")
      .map((button) => [button.textContent, button.getAttribute("aria-pressed")]);

    expect(pressedByLabel).toEqual([
      ["Map", "false"],
      ["Layers", "false"],
      ["Route", "true"],
    ]);
  });

  it("reports the tapped panel to onSelect", () => {
    const onSelect = vi.fn();
    render(<PanelSwitcher activePanel="map" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Layers" }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("layers");
  });

  it("shows the route status badge on the Route tab only", () => {
    const badge = { status: "NO-GO", color: "var(--danger)", inkColor: "#fff" } as const;
    render(<PanelSwitcher activePanel="map" onSelect={() => {}} routeStatus={badge} />);

    expect(screen.getByRole("button", { name: /Route/ }).textContent).toBe("RouteNO-GO");
    expect(screen.getByRole("button", { name: "Layers" }).textContent).toBe("Layers");
  });

  it("exposes the tab bar as a labelled navigation landmark", () => {
    render(<PanelSwitcher activePanel="map" onSelect={() => {}} />);

    expect(screen.getByRole("navigation", { name: "Panels" })).toBeTruthy();
  });
});

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePanelNavigation } from "./usePanelNavigation.ts";

afterEach(cleanup);

function pressKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key }));
  });
}

describe("usePanelNavigation", () => {
  it("starts on the map and opens the selected panel", () => {
    const { result } = renderHook(() => usePanelNavigation());
    expect(result.current.activePanel).toBe("map");

    act(() => result.current.selectPanel("layers"));

    expect(result.current.activePanel).toBe("layers");
  });

  it("closes the open panel when Escape is pressed", () => {
    const { result } = renderHook(() => usePanelNavigation());
    act(() => result.current.selectPanel("route"));

    pressKey("Escape");

    expect(result.current.activePanel).toBe("map");
  });

  it("ignores keys other than Escape", () => {
    const { result } = renderHook(() => usePanelNavigation());
    act(() => result.current.selectPanel("route"));

    pressKey("Enter");

    expect(result.current.activePanel).toBe("route");
  });

  it("closePanel returns to the map from any panel", () => {
    const { result } = renderHook(() => usePanelNavigation());
    act(() => result.current.selectPanel("layers"));

    act(() => result.current.closePanel());

    expect(result.current.activePanel).toBe("map");
  });

  it("stops listening for Escape after unmount", () => {
    const { result, unmount } = renderHook(() => usePanelNavigation());
    act(() => result.current.selectPanel("layers"));
    unmount();

    expect(() => pressKey("Escape")).not.toThrow();
    expect(result.current.activePanel).toBe("layers");
  });
});

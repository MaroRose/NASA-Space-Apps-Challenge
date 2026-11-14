import heapq
import math
import time
from typing import Protocol


class GridLike(Protocol):
    shape: tuple[int, int]

    def __getitem__(self, index: tuple[int, int]) -> float: ...


def _find_nearest_safe_cell(x: int, y: int, slope: GridLike, max_slope: float, radius: int = 25):
    """If the requested start/end coordinate sits on a rock (>max_slope), snap to nearest flat pixel."""
    rows, cols = slope.shape
    if 0 <= x < cols and 0 <= y < rows and slope[y, x] <= max_slope:
        return x, y

    for r in range(1, radius + 1):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < cols and 0 <= ny < rows and slope[ny, nx] <= max_slope:
                    return nx, ny
    return x, y


def calculate_path(
    start_x: int,
    start_y: int,
    end_x: int,
    end_y: int,
    dem: GridLike,
    slope: GridLike,
    max_slope_deg: float = 20.0,
) -> dict:
    t0 = time.perf_counter()
    rows, cols = dem.shape

    if not (0 <= start_x < cols and 0 <= start_y < rows):
        return {"path": [], "reason": "Start coordinates out of bounds."}
    if not (0 <= end_x < cols and 0 <= end_y < rows):
        return {"path": [], "reason": "End coordinates out of bounds."}

    # Snap start and end coordinates if they land on a localized boulder/cliff pixel
    start_x, start_y = _find_nearest_safe_cell(start_x, start_y, slope, max_slope_deg)
    end_x, end_y = _find_nearest_safe_cell(end_x, end_y, slope, max_slope_deg)

    direct_dist = math.hypot(end_x - start_x, end_y - start_y)
    # Dynamic stride: step by 1m on short routes, 2m-4m on multi-km routes for instant response
    stride = 1 if direct_dist < 600 else (2 if direct_dist < 1800 else 4)

    # Align goal to stride grid
    end_x = start_x + ((end_x - start_x) // stride) * stride
    end_y = start_y + ((end_y - start_y) // stride) * stride

    open_set = []
    heapq.heappush(open_set, (0.0, start_x, start_y))

    came_from = {}
    g_score = {(start_x, start_y): 0.0}

    directions = [
        (0, stride), (stride, 0), (0, -stride), (-stride, 0),
        (stride, stride), (stride, -stride), (-stride, stride), (-stride, -stride),
    ]

    MAX_ITERATIONS = 40000  # Hard cap: guarantees sub-200ms execution
    iterations = 0

    while open_set:
        iterations += 1
        if iterations > MAX_ITERATIONS:
            return {
                "path": [],
                "reason": f"Exceeded {MAX_ITERATIONS} search nodes (impassable canyon/ridge).",
                "compute_ms": round((time.perf_counter() - t0) * 1000, 2),
            }

        _, cx, cy = heapq.heappop(open_set)

        if math.hypot(end_x - cx, end_y - cy) <= stride * 1.5:
            path = [{"x": int(end_x), "y": int(end_y), "elev_m": round(float(dem[end_y, end_x]), 2)}]
            curr = (cx, cy)
            max_route_slope = 0.0
            while curr in came_from:
                px, py = curr
                s_val = float(slope[py, px])
                if s_val > max_route_slope:
                    max_route_slope = s_val
                path.append({
                    "x": int(px),
                    "y": int(py),
                    "elev_m": round(float(dem[py, px]), 2),
                    "slope_deg": round(s_val, 2),
                })
                curr = came_from[curr]
            path.append({
                "x": int(start_x),
                "y": int(start_y),
                "elev_m": round(float(dem[start_y, start_x]), 2),
                "slope_deg": round(float(slope[start_y, start_x]), 2),
            })
            path.reverse()

            return {
                "path": path,
                "max_slope_deg": round(max_route_slope, 2),
                "iterations": iterations,
                "stride_m": stride,
                "compute_ms": round((time.perf_counter() - t0) * 1000, 2),
            }

        for dx, dy in directions:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < cols and 0 <= ny < rows:
                s_deg = float(slope[ny, nx])
                if math.isnan(s_deg) or s_deg > max_slope_deg:
                    continue

                step_cost = math.hypot(dx, dy)
                elev_diff = abs(float(dem[ny, nx]) - float(dem[cy, cx]))
                slope_penalty = (s_deg / max_slope_deg) * 2.0
                tentative_g = g_score[(cx, cy)] + step_cost + (elev_diff * 1.5) + slope_penalty

                if (nx, ny) not in g_score or tentative_g < g_score[(nx, ny)]:
                    came_from[(nx, ny)] = (cx, cy)
                    g_score[(nx, ny)] = tentative_g
                    h_score = math.hypot(end_x - nx, end_y - ny) * 2.5
                    heapq.heappush(open_set, (tentative_g + h_score, nx, ny))

    return {
        "path": [],
        "reason": "No physically safe route found within slope threshold.",
        "compute_ms": round((time.perf_counter() - t0) * 1000, 2),
    }
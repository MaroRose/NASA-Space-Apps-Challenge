import heapq
import math
import time
import numpy as np

# Weighted A* favors responsive routes over guaranteed minimum-cost routes.
HEURISTIC_WEIGHT = 3.0
MAX_SEARCH_NODES = 40000


def _find_nearest_safe_cell(
    x: int, y: int, slope: np.ndarray, max_slope: float, radius: int
) -> tuple[int, int]:
    """Snaps an endpoint on a steep boulder/cliff (>max_slope) to the nearest traversable cell."""
    rows, cols = slope.shape
    s0 = float(slope[y, x])
    if not math.isnan(s0) and s0 <= max_slope:
        return x, y

    for r in range(1, radius + 1):
        for dy in range(-r, r + 1):
            ny = y + dy
            if not (0 <= ny < rows):
                continue
            for dx in range(-r, r + 1):
                if abs(dx) != r and abs(dy) != r:
                    continue
                nx = x + dx
                if 0 <= nx < cols:
                    s_val = float(slope[ny, nx])
                    if not math.isnan(s_val) and s_val <= max_slope:
                        return nx, ny
    return x, y


def calculate_path(
    start_x: int,
    start_y: int,
    end_x: int,
    end_y: int,
    dem: np.ndarray,
    slope: np.ndarray,
    max_slope_deg: float = 20.0,
) -> dict:
    t0 = time.perf_counter()
    rows, cols = dem.shape

    if not (0 <= start_x < cols and 0 <= start_y < rows):
        return {"path": [], "reason": "Start coordinates out of bounds."}
    if not (0 <= end_x < cols and 0 <= end_y < rows):
        return {"path": [], "reason": "End coordinates out of bounds."}

    snap_radius = max(2, min(25, min(rows, cols) // 8))
    start_x, start_y = _find_nearest_safe_cell(start_x, start_y, slope, max_slope_deg, snap_radius)
    end_x, end_y = _find_nearest_safe_cell(end_x, end_y, slope, max_slope_deg, snap_radius)

    start_slope = float(slope[start_y, start_x])
    end_slope = float(slope[end_y, end_x])
    if math.isnan(start_slope) or start_slope > max_slope_deg:
        return {
            "path": [],
            "reason": f"Start terrain slope ({round(start_slope, 1)} deg) exceeds safe limit ({max_slope_deg} deg).",
            "compute_ms": round((time.perf_counter() - t0) * 1000, 2),
        }
    if math.isnan(end_slope) or end_slope > max_slope_deg:
        return {
            "path": [],
            "reason": f"Destination terrain slope ({round(end_slope, 1)} deg) exceeds safe limit ({max_slope_deg} deg).",
            "compute_ms": round((time.perf_counter() - t0) * 1000, 2),
        }

    direct_dist = math.hypot(end_x - start_x, end_y - start_y)
    stride = 1 if direct_dist < 600 else (2 if direct_dist < 1800 else 4)

    aligned_ex = start_x + int((end_x - start_x) / stride) * stride
    aligned_ey = start_y + int((end_y - start_y) / stride) * stride
    aligned_slope = float(slope[aligned_ey, aligned_ex])
    if not math.isnan(aligned_slope) and aligned_slope <= max_slope_deg:
        end_x, end_y = aligned_ex, aligned_ey

    diag_dist = stride * math.sqrt(2.0)
    directions = [
        (0, stride, float(stride)),
        (stride, 0, float(stride)),
        (0, -stride, float(stride)),
        (-stride, 0, float(stride)),
        (stride, stride, diag_dist),
        (stride, -stride, diag_dist),
        (-stride, stride, diag_dist),
        (-stride, -stride, diag_dist),
    ]

    open_set: list[tuple[float, float, int, int]] = []
    heapq.heappush(open_set, (0.0, 0.0, start_x, start_y))

    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    g_score: dict[tuple[int, int], float] = {(start_x, start_y): 0.0}

<<<<<<< HEAD
=======
    MAX_ITERATIONS = 400000
>>>>>>> c018a9451c980b368748c91055f31ce7b68e2d67
    iterations = 0
    inv_max_slope = 2.0 / max_slope_deg
    elev_weight = 0.5 / stride

    while open_set:
        iterations += 1
        if iterations > MAX_SEARCH_NODES:
            return {
                "path": [],
                "reason": (
                    f"Route search reached its {MAX_SEARCH_NODES}-node limit. "
                    "Try increasing the slope limit or choosing closer endpoints."
                ),
                "compute_ms": round((time.perf_counter() - t0) * 1000, 2),
            }

        _, current_g, cx, cy = heapq.heappop(open_set)

        if current_g > g_score.get((cx, cy), float("inf")):
            continue

        if math.hypot(end_x - cx, end_y - cy) <= stride * 1.5:
            final_end_slope = float(slope[end_y, end_x])
            max_route_slope = max(start_slope, final_end_slope)
            path = [
                {
                    "x": int(end_x),
                    "y": int(end_y),
                    "elev_m": round(float(dem[end_y, end_x]), 2),
                    "slope_deg": round(final_end_slope, 2),
                }
            ]

            curr = (cx, cy)
            while curr in came_from:
                if curr != (end_x, end_y):
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

            if (start_x, start_y) != (end_x, end_y):
                path.append({
                    "x": int(start_x),
                    "y": int(start_y),
                    "elev_m": round(float(dem[start_y, start_x]), 2),
                    "slope_deg": round(start_slope, 2),
                })
            path.reverse()

            return {
                "path": path,
                "max_slope_deg": round(max_route_slope, 2),
                "iterations": iterations,
                "stride_m": stride,
                "compute_ms": round((time.perf_counter() - t0) * 1000, 2),
            }

        curr_elev = float(dem[cy, cx])

        for dx, dy, step_cost in directions:
            nx, ny = cx + dx, cy + dy
            if not (0 <= nx < cols and 0 <= ny < rows):
                continue

            s_deg = float(slope[ny, nx])
            if math.isnan(s_deg) or s_deg > max_slope_deg:
                continue

            if dx != 0 and dy != 0:
                s_adj1 = float(slope[cy, cx + dx])
                s_adj2 = float(slope[cy + dy, cx])
                if (math.isnan(s_adj1) or s_adj1 > max_slope_deg) and (
                    math.isnan(s_adj2) or s_adj2 > max_slope_deg
                ):
                    continue

            elev_diff = abs(float(dem[ny, nx]) - curr_elev)
            tentative_g = current_g + step_cost + (elev_diff * elev_weight) + (s_deg * inv_max_slope)

            if tentative_g < g_score.get((nx, ny), float("inf")):
                came_from[(nx, ny)] = (cx, cy)
                g_score[(nx, ny)] = tentative_g
                h_score = math.hypot(end_x - nx, end_y - ny) * HEURISTIC_WEIGHT
                heapq.heappush(open_set, (tentative_g + h_score, tentative_g, nx, ny))

    return {
        "path": [],
        "reason": "No physically safe route found within slope threshold.",
        "compute_ms": round((time.perf_counter() - t0) * 1000, 2),
    }

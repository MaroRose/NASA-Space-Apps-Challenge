"""Lazy access to the row/column GeoTIFF tiles produced by split_gale_dem.py."""

from bisect import bisect_right
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
import re

import numpy as np
import rasterio
from rasterio.windows import Window


_TILE_NAME = re.compile(r"tile_r(\d+)_c(\d+)\.tif$")


@dataclass(frozen=True)
class _TileInfo:
    path: Path
    height: int
    width: int
    nodata: float | None


class TileBand:
    """Array-like view of one band in a TiledRasterGrid."""

    def __init__(self, grid: "TiledRasterGrid", band: str) -> None:
        self._grid = grid
        self._band = band

    @property
    def shape(self) -> tuple[int, int]:
        return self._grid.shape

    def __getitem__(self, index: tuple[int, int]) -> float:
        if not isinstance(index, tuple) or len(index) != 2:
            raise TypeError("Terrain data must be indexed as [row, column].")
        row, column = index
        if not isinstance(row, (int, np.integer)) or not isinstance(
            column, (int, np.integer)
        ):
            raise TypeError("Terrain indices must be integers.")
        return self._grid.value(int(row), int(column), self._band)


class TiledRasterGrid:
    """Loads a tile's elevation and slope only when a coordinate needs it."""

    def __init__(self, tiles_dir: Path, cache_size: int = 2) -> None:
        if cache_size < 1:
            raise ValueError("cache_size must be at least one tile.")

        self.tiles_dir = Path(tiles_dir)
        self.cache_size = cache_size
        self._tiles: dict[tuple[int, int], _TileInfo] = {}
        self._cache: OrderedDict[
            tuple[int, int], tuple[np.ndarray, np.ndarray]
        ] = OrderedDict()
        self._load_tile_index()
        self.dem = TileBand(self, "dem")
        self.slope = TileBand(self, "slope")

    def _load_tile_index(self) -> None:
        for path in self.tiles_dir.glob("tile_r*_c*.tif"):
            match = _TILE_NAME.fullmatch(path.name)
            if match is None:
                continue
            row, column = (int(value) for value in match.groups())
            with rasterio.open(path) as source:
                if source.count != 1:
                    raise ValueError(f"{path} must contain exactly one raster band.")
                self._tiles[(row, column)] = _TileInfo(
                    path=path,
                    height=source.height,
                    width=source.width,
                    nodata=source.nodata,
                )

        if not self._tiles:
            raise FileNotFoundError(f"No Gale DEM tiles found in {self.tiles_dir}.")

        row_ids = sorted({row for row, _ in self._tiles})
        column_ids = sorted({column for _, column in self._tiles})
        if row_ids != list(range(len(row_ids))) or column_ids != list(
            range(len(column_ids))
        ):
            raise ValueError("Tile row and column indices must be contiguous from zero.")

        expected = {
            (row, column)
            for row in row_ids
            for column in column_ids
        }
        missing = expected.difference(self._tiles)
        if missing:
            row, column = min(missing)
            raise FileNotFoundError(
                f"Missing terrain tile tile_r{row:02d}_c{column:02d}.tif "
                f"in {self.tiles_dir}."
            )

        row_heights = []
        for row in row_ids:
            heights = {self._tiles[(row, column)].height for column in column_ids}
            if len(heights) != 1:
                raise ValueError(f"Tiles in row {row} have inconsistent heights.")
            row_heights.append(heights.pop())

        column_widths = []
        for column in column_ids:
            widths = {self._tiles[(row, column)].width for row in row_ids}
            if len(widths) != 1:
                raise ValueError(f"Tiles in column {column} have inconsistent widths.")
            column_widths.append(widths.pop())

        self._row_offsets = [0]
        for height in row_heights:
            self._row_offsets.append(self._row_offsets[-1] + height)
        self._column_offsets = [0]
        for width in column_widths:
            self._column_offsets.append(self._column_offsets[-1] + width)
        self.shape = (self._row_offsets[-1], self._column_offsets[-1])

        first_tile = self._tiles[(0, 0)]
        with rasterio.open(first_tile.path) as source:
            resolution = abs(source.res[0])
            self.resolution_m = (
                resolution * 59270.0 if resolution < 0.01 else resolution
            )

        self.tile_paths = tuple(
            self._tiles[key].path
            for key in sorted(self._tiles)
        )

    @staticmethod
    def _clean_elevation(data: np.ndarray, nodata: float | None) -> np.ndarray:
        data = data.astype(np.float32, copy=False)
        invalid = ~np.isfinite(data) | (data < -10000.0)
        if nodata is not None:
            if np.isnan(nodata):
                invalid |= np.isnan(data)
            else:
                invalid |= data == nodata
        data[invalid] = np.nan
        return data

    def _read_tile(self, key: tuple[int, int]) -> np.ndarray:
        info = self._tiles[key]
        with rasterio.open(info.path) as source:
            data = source.read(1)
        return self._clean_elevation(data, info.nodata)

    def _read_neighbor_border(
        self, key: tuple[int, int], row_delta: int, column_delta: int
    ) -> np.ndarray:
        neighbor_key = (key[0] + row_delta, key[1] + column_delta)
        info = self._tiles[neighbor_key]

        row_offset = info.height - 1 if row_delta < 0 else 0
        column_offset = info.width - 1 if column_delta < 0 else 0
        height = 1 if row_delta else info.height
        width = 1 if column_delta else info.width
        with rasterio.open(info.path) as source:
            border = source.read(
                1,
                window=Window(column_offset, row_offset, width, height),
            )
        return self._clean_elevation(border, info.nodata)

    def _calculate_slope(
        self, key: tuple[int, int], elevation: np.ndarray
    ) -> np.ndarray:
        height, width = elevation.shape
        padded = np.empty((height + 2, width + 2), dtype=np.float32)
        padded[1:-1, 1:-1] = elevation
        padded[0, 1:-1] = elevation[0, :]
        padded[-1, 1:-1] = elevation[-1, :]
        padded[1:-1, 0] = elevation[:, 0]
        padded[1:-1, -1] = elevation[:, -1]
        padded[0, 0] = elevation[0, 0]
        padded[0, -1] = elevation[0, -1]
        padded[-1, 0] = elevation[-1, 0]
        padded[-1, -1] = elevation[-1, -1]

        for row_delta in (-1, 0, 1):
            for column_delta in (-1, 0, 1):
                if row_delta == 0 and column_delta == 0:
                    continue
                neighbor_key = (key[0] + row_delta, key[1] + column_delta)
                if neighbor_key not in self._tiles:
                    continue

                if row_delta < 0:
                    destination_rows = slice(0, 1)
                elif row_delta > 0:
                    destination_rows = slice(height + 1, height + 2)
                else:
                    destination_rows = slice(1, height + 1)

                if column_delta < 0:
                    destination_columns = slice(0, 1)
                elif column_delta > 0:
                    destination_columns = slice(width + 1, width + 2)
                else:
                    destination_columns = slice(1, width + 1)

                padded[destination_rows, destination_columns] = (
                    self._read_neighbor_border(key, row_delta, column_delta)
                )

        valid_values = padded[np.isfinite(padded)]
        median_elevation = (
            float(np.median(valid_values)) if valid_values.size else -4500.0
        )
        filled = np.where(np.isfinite(padded), padded, median_elevation)
        dy, dx = np.gradient(filled, self.resolution_m)
        slope = np.degrees(np.arctan(np.hypot(dx, dy))).astype(np.float32)
        slope = slope[1:-1, 1:-1]
        slope[~np.isfinite(elevation)] = 90.0
        return slope

    def _load_tile(
        self, key: tuple[int, int]
    ) -> tuple[np.ndarray, np.ndarray]:
        cached = self._cache.get(key)
        if cached is not None:
            self._cache.move_to_end(key)
            return cached

        elevation = self._read_tile(key)
        slope = self._calculate_slope(key, elevation)
        self._cache[key] = (elevation, slope)
        self._cache.move_to_end(key)
        while len(self._cache) > self.cache_size:
            self._cache.popitem(last=False)
        return elevation, slope

    def value(self, row: int, column: int, band: str) -> float:
        if not (0 <= row < self.shape[0] and 0 <= column < self.shape[1]):
            raise IndexError("Terrain coordinate is outside the tile grid.")

        tile_row = bisect_right(self._row_offsets, row) - 1
        tile_column = bisect_right(self._column_offsets, column) - 1
        key = (tile_row, tile_column)
        elevation, slope = self._load_tile(key)
        local_row = row - self._row_offsets[tile_row]
        local_column = column - self._column_offsets[tile_column]
        data = elevation if band == "dem" else slope
        return float(data[local_row, local_column])

    def elevation_stats_m(self) -> dict[str, float]:
        minimum = float("inf")
        maximum = float("-inf")
        for key in sorted(self._tiles):
            elevation = self._read_tile(key)
            valid = elevation[np.isfinite(elevation)]
            if valid.size:
                minimum = min(minimum, float(np.min(valid)))
                maximum = max(maximum, float(np.max(valid)))

        if minimum == float("inf"):
            return {"min": -4500.0, "max": -4500.0}
        return {"min": round(minimum, 2), "max": round(maximum, 2)}

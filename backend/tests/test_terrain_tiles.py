import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import rasterio
from rasterio.transform import from_origin

import etl_pipeline
import main
from terrain_tiles import TiledRasterGrid


class TiledRasterGridTests(unittest.TestCase):
    def test_loads_tiles_on_demand_and_preserves_slope_across_seams(self):
        resolution = 0.0000168706
        with tempfile.TemporaryDirectory() as temp_dir:
            tiles_dir = Path(temp_dir)
            full_grid = np.fromfunction(
                lambda row, column: row * 2 + column, (4, 4), dtype=np.float32
            ).astype(np.float32)

            for tile_row in range(2):
                for tile_column in range(2):
                    tile_path = tiles_dir / (
                        f"tile_r{tile_row:02d}_c{tile_column:02d}.tif"
                    )
                    row_start = tile_row * 2
                    column_start = tile_column * 2
                    with rasterio.open(
                        tile_path,
                        "w",
                        driver="GTiff",
                        width=2,
                        height=2,
                        count=1,
                        dtype="float32",
                        crs="EPSG:4326",
                        transform=from_origin(
                            column_start * resolution,
                            4 * resolution - row_start * resolution,
                            resolution,
                            resolution,
                        ),
                        nodata=-9999,
                    ) as tile:
                        tile.write(
                            full_grid[
                                row_start : row_start + 2,
                                column_start : column_start + 2,
                            ],
                            1,
                        )

            terrain = TiledRasterGrid(tiles_dir, cache_size=2)
            self.assertEqual(terrain.shape, (4, 4))
            self.assertEqual(len(terrain._cache), 0)
            self.assertEqual(terrain.dem[1, 1], float(full_grid[1, 1]))
            self.assertEqual(len(terrain._cache), 1)
            self.assertEqual(terrain.dem[2, 2], float(full_grid[2, 2]))
            self.assertEqual(len(terrain._cache), 2)

            expected_slope = np.degrees(np.arctan(np.hypot(2.0, 1.0)))
            self.assertAlmostEqual(terrain.slope[1, 1], expected_slope, places=2)
            self.assertAlmostEqual(terrain.slope[2, 2], expected_slope, places=2)

    def test_api_routes_using_lazily_loaded_terrain(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            tiles_dir = root / "gale_tiles"
            tiles_dir.mkdir()
            processed_dir = root / "processed"

            for tile_row in range(2):
                for tile_column in range(2):
                    tile_path = tiles_dir / (
                        f"tile_r{tile_row:02d}_c{tile_column:02d}.tif"
                    )
                    with rasterio.open(
                        tile_path,
                        "w",
                        driver="GTiff",
                        width=2,
                        height=2,
                        count=1,
                        dtype="float32",
                        crs="EPSG:4326",
                        transform=from_origin(
                            tile_column * 2,
                            4 - tile_row * 2,
                            1,
                            1,
                        ),
                        nodata=-9999,
                    ) as tile:
                        tile.write(np.zeros((2, 2), dtype=np.float32), 1)

            original_tiles_dir = main.TILES_DIR
            original_processed_dir = main.PROCESSED_DIR
            try:
                main.TILES_DIR = tiles_dir
                main.PROCESSED_DIR = processed_dir
                self.assertEqual(main.ensure_local_terrain_grid(), "local_tiled_cache")
                self.assertEqual(len(main.martian_state["terrain"]._cache), 0)
                result = main._execute_routing(
                    main.RouteRequest(start_x=0, start_y=0, end_x=3, end_y=3)
                )
                self.assertEqual(result["storage_mode"], "local_tiled_cache")
                self.assertEqual(result["resolved_end"], {"x": 3, "y": 3})
                self.assertEqual(
                    {path.name for path in processed_dir.iterdir()},
                    {"site_metadata.json"},
                )
            finally:
                main.martian_state.clear()
                main.TILES_DIR = original_tiles_dir
                main.PROCESSED_DIR = original_processed_dir

    def test_etl_writes_metadata_without_monolithic_grids(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            tiles_dir = root / "gale_tiles"
            tiles_dir.mkdir()
            processed_dir = root / "processed"
            raw_dir = root / "raw"

            for tile_row in range(2):
                for tile_column in range(2):
                    tile_path = tiles_dir / (
                        f"tile_r{tile_row:02d}_c{tile_column:02d}.tif"
                    )
                    with rasterio.open(
                        tile_path,
                        "w",
                        driver="GTiff",
                        width=2,
                        height=2,
                        count=1,
                        dtype="float32",
                        crs="EPSG:4326",
                        transform=from_origin(tile_column * 2, 4 - tile_row * 2, 1, 1),
                        nodata=-9999,
                    ) as tile:
                        tile.write(np.full((2, 2), -4400, dtype=np.float32), 1)

            original_tiles_dir = etl_pipeline.TILES_DIR
            original_processed_dir = etl_pipeline.PROCESSED_DIR
            original_raw_dir = etl_pipeline.RAW_DIR
            try:
                etl_pipeline.TILES_DIR = tiles_dir
                etl_pipeline.PROCESSED_DIR = processed_dir
                etl_pipeline.RAW_DIR = raw_dir
                with patch.object(etl_pipeline, "upload_to_azure_blob", return_value="test"):
                    etl_pipeline.build_site_bundle()

                with open(processed_dir / "site_metadata.json") as metadata_file:
                    metadata = etl_pipeline.json.load(metadata_file)
                self.assertEqual(metadata["grid_shape"], [4, 4])
                self.assertEqual(metadata["elevation_stats_m"], {"min": -4400.0, "max": -4400.0})
                self.assertEqual(
                    {path.name for path in processed_dir.iterdir()},
                    {"site_metadata.json"},
                )
            finally:
                etl_pipeline.TILES_DIR = original_tiles_dir
                etl_pipeline.PROCESSED_DIR = original_processed_dir
                etl_pipeline.RAW_DIR = original_raw_dir

if __name__ == "__main__":
    unittest.main()

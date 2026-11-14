"""Split the Gale DEM into a 10-by-10 grid of georeferenced GeoTIFFs."""

import argparse
from pathlib import Path

import rasterio
from rasterio.windows import Window


GRID_SIZE = 10
DEFAULT_INPUT = Path(__file__).resolve().with_name("Gale_DEM_SMG_1m.tif")
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().with_name("gale_tiles")


def split_raster(input_path: Path, output_dir: Path) -> int:
    """Write the input raster as 100 evenly sized, georeferenced tiles."""
    output_dir.mkdir(parents=True, exist_ok=True)

    with rasterio.open(input_path) as source:
        if source.width < GRID_SIZE or source.height < GRID_SIZE:
            raise ValueError(
                f"Raster dimensions ({source.width}x{source.height}) are too "
                f"small for a {GRID_SIZE}x{GRID_SIZE} split."
            )

        for row in range(GRID_SIZE):
            row_start = row * source.height // GRID_SIZE
            row_end = (row + 1) * source.height // GRID_SIZE

            for column in range(GRID_SIZE):
                column_start = column * source.width // GRID_SIZE
                column_end = (column + 1) * source.width // GRID_SIZE
                window = Window(
                    column_start,
                    row_start,
                    column_end - column_start,
                    row_end - row_start,
                )

                profile = source.profile.copy()
                profile.pop("blockxsize", None)
                profile.pop("blockysize", None)
                profile.update(
                    width=int(window.width),
                    height=int(window.height),
                    transform=source.window_transform(window),
                    tiled=True,
                    blockxsize=256,
                    blockysize=256,
                    compress="deflate",
                    predictor=3,
                )

                tile_path = output_dir / f"tile_r{row:02d}_c{column:02d}.tif"
                with rasterio.open(tile_path, "w", **profile) as tile:
                    tile.write(source.read(window=window))
                    tile.update_tags(**source.tags())
                    for band_index, tags in enumerate(
                        (source.tags(index) for index in source.indexes),
                        start=1,
                    ):
                        tile.update_tags(band_index, **tags)

                    for band_index, description in enumerate(
                        source.descriptions, start=1
                    ):
                        if description is not None:
                            tile.set_band_description(band_index, description)

                    for band_index, unit in enumerate(source.units, start=1):
                        if unit is not None:
                            tile.set_band_unit(band_index, unit)

    return GRID_SIZE * GRID_SIZE


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Split Gale_DEM_SMG_1m.tif into a 10-by-10 tile grid."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Source GeoTIFF (default: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory for output tiles (default: {DEFAULT_OUTPUT_DIR})",
    )
    args = parser.parse_args()

    if not args.input.is_file():
        parser.error(f"Input raster does not exist: {args.input}")

    tile_count = split_raster(args.input, args.output_dir)
    print(f"Wrote {tile_count} tiles to {args.output_dir.resolve()}")


if __name__ == "__main__":
    main()

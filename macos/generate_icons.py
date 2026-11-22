#!/usr/bin/env python3
"""Draw the Dayflow icon with Pillow and compile a macOS iconset."""

from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

CANVAS_SIZE = 1024
SUPERSAMPLE = 4
UNIT = 16 * SUPERSAMPLE  # SVG viewBox is 64 × 64.
INDIGO = "#5E5CE6"
ORANGE = "#FF9F0A"
WHITE = "#FFFFFF"


def scaled_box(values: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(round(value * UNIT) for value in values)  # type: ignore[return-value]


def rounded_line(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    width: float,
    fill: str,
) -> None:
    pixels = [(round(x * UNIT), round(y * UNIT)) for x, y in points]
    line_width = round(width * UNIT)
    draw.line(pixels, fill=fill, width=line_width, joint="curve")
    radius = line_width / 2
    for x, y in pixels:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def draw_icon() -> Image.Image:
    image = Image.new("RGBA", (CANVAS_SIZE * SUPERSAMPLE,) * 2, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle(
        scaled_box((4, 4, 60, 60)),
        radius=17 * UNIT,
        fill=INDIGO,
    )
    rounded_line(draw, [(23, 14), (23, 22)], 4, WHITE)
    rounded_line(draw, [(41, 14), (41, 22)], 4, WHITE)
    draw.rounded_rectangle(
        scaled_box((15, 17, 49, 50)),
        radius=9 * UNIT,
        fill=WHITE,
    )
    draw.line(
        [(15 * UNIT, 28 * UNIT), (49 * UNIT, 28 * UNIT)],
        fill=INDIGO,
        width=3 * UNIT,
    )
    rounded_line(draw, [(23, 38), (29, 44), (42, 31)], 4, INDIGO)
    draw.ellipse(
        scaled_box((42, 9, 56, 23)),
        fill=ORANGE,
        outline=INDIGO,
        width=3 * UNIT,
    )

    return image.resize((CANVAS_SIZE, CANVAS_SIZE), Image.Resampling.LANCZOS)


def build_icns(output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    png_path = output_dir / "Dayflow-1024.png"
    icns_path = output_dir / "Dayflow.icns"
    iconset = output_dir / "Dayflow.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir()

    source = draw_icon()
    source.save(png_path, format="PNG", optimize=True)

    sizes = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }
    for name, size in sizes.items():
        resized = source if size == CANVAS_SIZE else source.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(iconset / name, format="PNG", optimize=True)

    subprocess.run(
        ["iconutil", "-c", "icns", str(iconset), "-o", str(icns_path)],
        check=True,
    )
    return png_path, icns_path


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=script_dir / ".build" / "icons",
        help="Directory for the 1024 px PNG, iconset and Dayflow.icns",
    )
    args = parser.parse_args()
    png_path, icns_path = build_icns(args.output_dir.resolve())
    print(f"Created {png_path}")
    print(f"Created {icns_path}")


if __name__ == "__main__":
    main()

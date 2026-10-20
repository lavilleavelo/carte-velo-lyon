"""Downloads the OpenFreeMap vector tiles (OpenMapTiles schema) covering the print extent.

Usage: python3 print/fetch-tiles.py
"""

import json
import math
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ZOOM = 14
# Métropole de Lyon bounding box, with a margin so the map frame is never empty.
WEST, SOUTH, EAST, NORTH = 4.64, 45.52, 5.11, 45.98

OUT = Path(__file__).parent / "out" / "tiles"
TILEJSON = "https://tiles.openfreemap.org/planet"
HEADERS = {"User-Agent": "carte-velo-lyon print map"}


def tile_xy(lon, lat, z):
    n = 2**z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as r:
        return r.read()


def main():
    tilejson = json.loads(get(TILEJSON))
    template = tilejson["tiles"][0]
    x0, y0 = tile_xy(WEST, NORTH, ZOOM)
    x1, y1 = tile_xy(EAST, SOUTH, ZOOM)
    jobs = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]

    def fetch(xy):
        x, y = xy
        path = OUT / str(ZOOM) / str(x) / f"{y}.pbf"
        if path.exists():
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(get(template.format(z=ZOOM, x=x, y=y)))

    with ThreadPoolExecutor(8) as pool:
        list(pool.map(fetch, jobs))

    # metadata.json lets GDAL's MVT driver read the folder as one dataset.
    metadata = {
        "name": "openfreemap",
        "format": "pbf",
        "minzoom": str(ZOOM),
        "maxzoom": str(ZOOM),
        "bounds": f"{WEST},{SOUTH},{EAST},{NORTH}",
        "json": json.dumps({"vector_layers": tilejson["vector_layers"]}),
    }
    (OUT / "metadata.json").write_text(json.dumps(metadata))
    print(f"{len(jobs)} tiles ({x1 - x0 + 1}x{y1 - y0 + 1}) in {OUT}")


if __name__ == "__main__":
    main()

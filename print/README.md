# Carte vélo Lyon imprimable (QGIS)

Builds an A0 landscape vector PDF (1:12 500, Lyon, Villeurbanne and around) of the cycling network,
with the layers visible by default on the web map: OSM cycleways, built Voies Lyonnaises, vélostations
and bike rooms in car parks, plus metro, funicular and railway stations (`transit.json`, from cyclopolis),
Navigône river shuttle stops and a curated list of landmarks (`landmarks.json`). Scale, centre and page size are constants at the top of `build_map.py`.

Requires QGIS 4 (`brew install --cask qgis`) and the dev server running.

```bash
node print/export-layers.mjs http://localhost:5173
python3 print/fetch-tiles.py
python3 print/fetch-data.py
QT_QPA_PLATFORM=offscreen /Applications/QGIS*.app/Contents/MacOS/python print/build_map.py
```

- `export-layers.mjs` saves the GeoJSON the app renders (`print/out/data/`).
- `fetch-tiles.py` downloads the OpenFreeMap z14 vector tiles of the area (`print/out/tiles/`).
- `fetch-data.py` downloads tram stops and lines, Navigône stops and route, pumps (data.grandlyon.com) and repair stands
  (OpenStreetMap, or the app's `.cache/overpassPOIs.json` when Overpass is down).
- `build_map.py` merges the tiles into Lambert-93 basemap layers (first run only, ~3 min), styles
  everything in millimetres and exports `print/out/carte-velo-lyon-A0.pdf` (vector, for printing, ~60 MB),
  `print/out/carte-velo-lyon-A0-web.pdf` (one 200 dpi JPEG, for screens, ~10 MB) and the QGIS project
  `print/out/carte-velo-lyon.qgz`. `--no-pdf` skips both PDFs, `--crops` writes 300 dpi detail images.

Text uses Avenir Next and Avenir Next Condensed, which come with macOS.

The QR code (`icons/qr-carte-lavilleavelo.svg`) points to https://carte.lavilleavelo.org. It was generated
once with [segno](https://pypi.org/project/segno/) and written as a single filled path at 10 SVG units per
module: QGIS outlines SVG shapes by one unit when exporting to PDF, which at one unit per module fills in
the white modules.

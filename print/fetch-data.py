"""Downloads the extra point data of the print map into print/out/data/:

  tram-stops.geojson         TCL tram stops (T1–T7), one feature per platform    data.grandlyon.com
  tram-lines.geojson         TCL tram lines, to find the end of each line          data.grandlyon.com
  pumps.geojson              self-service bike pumps of the Métropole              data.grandlyon.com
  racks.geojson              free bike racks (arceaux) of the Métropole, with their places  data.grandlyon.com
  repair-stations.geojson    self-service bike repair stands (amenity=bicycle_repair_station)  OpenStreetMap
  dem/                       elevation (IGN RGE ALTI, 2.5 m), as EHdr .bil tiles in Lambert-93   data.geopf.fr
  roads.geojson              street sections with speed limit and slope (pvochausseetrottoir) data.grandlyon.com
  arrondissements.geojson    outlines of the 9 arrondissements of Lyon                         geo.api.gouv.fr

Usage: python3 print/fetch-data.py [--cyclopolis ~/projects/perso/cyclopolis | --relief]

With --cyclopolis, only vl-lines.geojson is rebuilt, from a local copy of the cyclopolis repository
(for example after print/snap-vl.py) instead of the version the app serves.
"""

import json
import math
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).parent / "out" / "data"
APP_CACHE = Path(__file__).parent.parent / ".cache" / "overpassPOIs.json"
HEADERS = {"User-Agent": "carte-velo-lyon print map"}
WFS = "https://data.grandlyon.com/geoserver/{workspace}/ows?" + urllib.parse.urlencode({
    "SERVICE": "WFS", "VERSION": "2.0.0", "request": "GetFeature", "outputFormat": "application/json",
    "SRSNAME": "EPSG:4326", "sortBy": "gid",
}) + "&typename={workspace}:{layer}"
TRAM_LINES = {f"T{n}" for n in range(1, 8)}
OVERPASS_SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
                    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
# Same box as fetch-tiles.py: south, west, north, east for Overpass.
BBOX = (45.52, 4.64, 45.98, 5.11)


def get(url, data=None):
    request = urllib.request.Request(url, data=data, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(response.read())


def wfs(workspace, layer):
    return get(WFS.format(workspace=workspace, layer=layer))


def save(name, collection):
    (OUT / name).write_text(json.dumps(collection))
    print(f"{name}: {len(collection['features'])} features")


def line_length(coordinates):
    """Length in metres, like calculateLineDistance in the app."""
    total = 0
    for (lon1, lat1), (lon2, lat2) in zip(coordinates, coordinates[1:]):
        p1, p2 = math.radians(lat1), math.radians(lat2)
        a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
        total += 2 * 6371000 * math.asin(math.sqrt(a))
    return total


def local_voies_lyonnaises(repository):
    """Built sections of the Voies Lyonnaises, as export-layers.mjs writes them, from local files."""
    features = []
    for path in sorted((repository / "content" / "voies-cyclables").glob("ligne-*.json")):
        line = int(re.search(r"\d+", path.stem).group())
        for f in json.loads(path.read_text(encoding="utf-8"))["features"]:
            if f["geometry"]["type"] == "LineString" and f["properties"].get("status") == "done":
                coordinates = [c[:2] for c in f["geometry"]["coordinates"]]
                properties = {**f["properties"], "line": line, "vl": line, "distance": line_length(coordinates)}
                features.append({**f, "properties": properties})
    save("vl-lines.geojson", {"type": "FeatureCollection", "features": features})


# Elevation: the map extent (Lambert-93) with a margin, in tiles small enough for the WMS.
DEM_BBOX = (836000, 6513000, 852000, 6525500)
DEM_RESOLUTION = 2.5  # m
DEM_TILE = 2000  # px
DEM_URL = ("https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap"
           "&LAYERS=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES&STYLES=&CRS=EPSG:2154"
           "&BBOX={x0},{y0},{x1},{y1}&WIDTH={w}&HEIGHT={h}&FORMAT=image/x-bil;bits=32")


def fetch_dem():
    """Downloads the elevation as 32-bit float tiles, each with an EHdr header so that GDAL reads it."""
    folder = OUT / "dem"
    folder.mkdir(exist_ok=True)
    x0, y0, x1, y1 = DEM_BBOX
    size = DEM_TILE * DEM_RESOLUTION
    count = 0
    y = y0
    while y < y1:
        x = x0
        while x < x1:
            w = int(min(size, x1 - x) / DEM_RESOLUTION)
            h = int(min(size, y1 - y) / DEM_RESOLUTION)
            name = folder / f"dem_{int(x)}_{int(y)}"
            if not name.with_suffix(".bil").exists():
                url = DEM_URL.format(x0=x, y0=y, x1=x + w * DEM_RESOLUTION, y1=y + h * DEM_RESOLUTION, w=w, h=h)
                with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=180) as r:
                    data = r.read()
                assert len(data) == w * h * 4, f"unexpected size for {url}"
                name.with_suffix(".bil").write_bytes(data)
                name.with_suffix(".hdr").write_text(
                    f"BYTEORDER I\nLAYOUT BIL\nNROWS {h}\nNCOLS {w}\nNBANDS 1\nNBITS 32\nPIXELTYPE FLOAT\n"
                    f"ULXMAP {x + DEM_RESOLUTION / 2}\nULYMAP {y + h * DEM_RESOLUTION - DEM_RESOLUTION / 2}\n"
                    f"XDIM {DEM_RESOLUTION}\nYDIM {DEM_RESOLUTION}\nNODATA -99999\n")
            count += 1
            x += size
        y += size
    print(f"dem: {count} tiles")


def fetch_racks():
    """Racks anyone can use: the vélostations and bike rooms come from the app (parkings.geojson)."""
    racks = wfs("metropole-de-lyon", "pvo_patrimoine_voirie.pvostationnementvelo")
    features = []
    for f in racks["features"]:
        p = f["properties"]
        if (p["validite"] == "Validé" and p["tarification"] == "Accès libre"
                and p["mobiliervelo"] in ("Arceaux Wilmotte", "Arceaux en U inversé", "Autre mobilier")):
            features.append({**f, "properties": {"places": p["capacite"] or 0}})
    save("racks.geojson", {"type": "FeatureCollection", "features": features})


def fetch_arrondissements():
    url = ("https://geo.api.gouv.fr/communes?codeDepartement=69&type=arrondissement-municipal"
           "&format=geojson&geometry=contour&fields=nom,code")
    save("arrondissements.geojson", get(url))


def fetch_roads():
    """Street sections of the Métropole with their speed limit and slope, in the frame only."""
    x0, y0, x1, y1 = DEM_BBOX
    url = WFS.format(workspace="metropole-de-lyon", layer="pvo_patrimoine_voirie.pvochausseetrottoir")
    url = url.replace("SRSNAME=EPSG%3A4326", "SRSNAME=EPSG%3A2154") + f"&BBOX={x0},{y0},{x1},{y1},EPSG:2154"
    roads = get(url)
    keep = ("nomvoie1", "limitationvitesse", "pentemoyenne", "pentemaximale", "senscirculation",
            "hierarchiefonctionnelle", "longueurcalculee")
    for f in roads["features"]:
        f["properties"] = {k: f["properties"].get(k) for k in keep}
    roads["crs"] = {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::2154"}}
    save("roads.geojson", roads)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if "--relief" in sys.argv:  # only the elevation and street data
        fetch_dem()
        fetch_roads()
        fetch_arrondissements()
        return
    if "--cyclopolis" in sys.argv:
        local_voies_lyonnaises(Path(sys.argv[sys.argv.index("--cyclopolis") + 1]).expanduser())
        return

    stops = wfs("sytral", "tcl_sytral.tclarret")
    tram = []
    for f in stops["features"]:
        lines = {code.split(":")[0] for code in re.split(r",\s*", f["properties"].get("desserte") or "") if code}
        lines &= TRAM_LINES
        if lines:
            f["properties"] = {"nom": f["properties"]["nom"], "lignes": ",".join(sorted(lines))}
            tram.append(f)
    save("tram-stops.geojson", {"type": "FeatureCollection", "features": tram})

    # Navigône, the TCL river shuttle on the Saône (line NAVI1): bikes are allowed on board.
    boat = [f for f in stops["features"] if "NAVI" in (f["properties"].get("desserte") or "")]
    for f in boat:
        f["properties"] = {"nom": f["properties"]["nom"]}
    save("navigone-stops.geojson", {"type": "FeatureCollection", "features": boat})
    route = wfs("sytral", "tcl_sytral.tcllignefluv")
    for f in route["features"]:
        f["properties"] = {"ligne": f["properties"]["ligne"], "trace": f["properties"]["code_trace"]}
    save("navigone-route.geojson", route)

    lines = wfs("sytral", "tcl_sytral.tcllignetram_2_0_0")
    for f in lines["features"]:
        f["properties"] = {"ligne": f["properties"]["ligne"]}
    save("tram-lines.geojson", lines)

    save("pumps.geojson", wfs("metropole-de-lyon", "pvo_patrimoine_voirie.pvostationvelovpompe"))
    fetch_racks()

    south, west, north, east = BBOX
    query = (f'[out:json][timeout:60];nwr["amenity"="bicycle_repair_station"]'
             f'({south},{west},{north},{east});out center tags;')
    result = None
    for server in OVERPASS_SERVERS:  # the main server is often busy
        try:
            result = get(server, urllib.parse.urlencode({"data": query}).encode())
            break
        except (urllib.error.URLError, TimeoutError) as error:
            print(f"{server}: {error}")
    if result is None:
        # Fall back on the Overpass results cached by the app's server (.cache/overpassPOIs.json).
        if not APP_CACHE.exists():
            raise SystemExit("Overpass is unavailable and the app has no cached POIs, try again later")
        result = json.loads(APP_CACHE.read_text())
        print(f"using {APP_CACHE} ({result['osm3s']['timestamp_osm_base']})")
    features = []
    for element in result["elements"]:
        if element.get("tags", {}).get("amenity") != "bicycle_repair_station":
            continue
        lon, lat = (element["lon"], element["lat"]) if "lon" in element else (
            element["center"]["lon"], element["center"]["lat"])
        tags = element.get("tags", {})
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"osm_id": f"{element['type']}/{element['id']}", "name": tags.get("name"),
                           "pump": tags.get("service:bicycle:pump"), "tools": tags.get("service:bicycle:tools")},
        })
    save("repair-stations.geojson", {"type": "FeatureCollection", "features": features})
    fetch_dem()
    fetch_roads()
    fetch_arrondissements()


if __name__ == "__main__":
    main()

"""Snaps the built sections of the Voies Lyonnaises (cyclopolis) onto the cycle facilities mapped in OSM.

For each section with status "done" that strays from OSM (90 % of its length within `--min-drift` m
or more), the shortest route through the nearby OSM cycle facilities between its two ends is
looked for, favouring facilities close to the original line. The new geometry is kept only when it
is a confident match: it stays within 25 m of the original, covers it, and has a similar length.
Consecutive sections must still meet: an end shared only with other snapped sections moves onto the
OSM route (to the same point for all of them), an end shared with a section left as it is stays.

Sections along a street with a one-way cycle track on each side keep their geometry (the street
centre is right there), as do sections with no OSM facility to follow (listed in the report: OSM
may be missing the facility).

Only the "coordinates" of the changed sections are rewritten in the files, the rest of each file is
left as it is.

Run with the Python of QGIS:
  QT_QPA_PLATFORM=offscreen /Applications/QGIS*.app/Contents/MacOS/python print/snap-vl.py \
      ~/projects/perso/cyclopolis/content/voies-cyclables [--dry-run]
"""

import heapq
import json
import math
import os
import re
import sys
from pathlib import Path

_resources = Path(sys.executable).resolve().parent.parent / "Resources" / "qgis"
os.environ.setdefault("PROJ_DATA", str(_resources / "proj"))

from qgis.core import (  # noqa: E402
    QgsApplication,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsGeometry,
    QgsPointXY,
    QgsProject,
    QgsSpatialIndex,
    QgsVectorLayer,
)

ROOT = Path(__file__).resolve().parent
OSM = ROOT / "out" / "data" / "cycleways.geojson"  # exported from the app by export-layers.mjs
REPORT = ROOT / "out" / "snap-vl-report.json"
PREVIEW = ROOT / "out" / "snap-vl-preview.geojson"  # before/after geometries, to review them

CORRIDOR = 30  # m around the original line where OSM facilities are looked for
MAX_GAP = 8  # m: OSM lines whose ends are this close are considered connected
MIN_DRIFT = 4  # m: sections closer than this to OSM (90th percentile) are left alone
ACCEPT_HAUSDORFF = 25  # m
ACCEPT_COVERED = 0.9  # share of the original within 12 m of the new line
ACCEPT_LENGTH = (0.8, 1.35)  # new length / original length

WGS84 = QgsCoordinateReferenceSystem("EPSG:4326")
L93 = QgsCoordinateReferenceSystem("EPSG:2154")


# --- OSM network -------------------------------------------------------------------------------
class Network:
    def __init__(self, path):
        layer = QgsVectorLayer(str(path), "osm", "ogr")
        assert layer.isValid(), path
        transform = QgsCoordinateTransform(layer.crs(), L93, QgsProject.instance())
        self.lines = {}
        self.index = QgsSpatialIndex()
        for f in layer.getFeatures():
            g = QgsGeometry(f.geometry())
            g.transform(transform)
            self.lines[f.id()] = (g, f["typeamenagement"], bool(f["bidirectional"]), f["highway"])
            feat = QgsFeature(f.id())
            feat.setGeometry(g)
            self.index.addFeature(feat)

    def near(self, geometry, distance):
        box = geometry.boundingBox().buffered(distance)
        zone = geometry.buffer(distance, 8)
        return [i for i in self.index.intersects(box) if self.lines[i][0].intersects(zone)]


def drift(geometry, network, step=5):
    """90th percentile of the distance from points along `geometry` to the nearest OSM facility."""
    candidates = [network.lines[i][0] for i in network.near(geometry, 60)]
    if not candidates:
        return math.inf
    length = geometry.length()
    n = max(2, int(length / step))
    distances = sorted(
        min(min(c.distance(geometry.interpolate(length * k / n)) for c in candidates), 60) for k in range(n + 1))
    return distances[int(len(distances) * 0.9)]


# --- routing -----------------------------------------------------------------------------------
def key(point):
    return round(point.x(), 1), round(point.y(), 1)


def route(original, network):
    """Shortest path through the OSM facilities near `original`, between the points of the network
    closest to its two ends. Returns (polyline, ids of the OSM lines used) or (None, reason)."""
    ids = network.near(original, CORRIDOR)
    if not ids:
        return None, "aucun aménagement OSM à proximité"
    graph = {}
    points = {}

    def edge(a, b, cost):
        graph.setdefault(a, []).append((b, cost))
        graph.setdefault(b, []).append((a, cost))

    owners = {}
    for i in ids:
        g = network.lines[i][0]
        for part in g.asGeometryCollection() if g.isMultipart() else [g]:
            line = part.asPolyline()
            for a, b in zip(line, line[1:]):
                ka, kb = key(a), key(b)
                points[ka], points[kb] = a, b
                mid = QgsGeometry.fromPointXY(QgsPointXY((a.x() + b.x()) / 2, (a.y() + b.y()) / 2))
                d = original.distance(mid)
                length = math.dist(ka, kb)
                edge(ka, kb, length * (1 + (d / 8) ** 2))
                owners[(ka, kb)] = owners[(kb, ka)] = i
    # Join line ends to nearby vertices: OSM facilities are not always connected.
    nodes = list(points)
    degree = {n: len(graph[n]) for n in nodes}
    for n in nodes:
        if degree[n] == 1:
            for m in nodes:
                if m != n and 0 < math.dist(n, m) <= MAX_GAP and (m, n) not in owners:
                    edge(n, m, math.dist(n, m) * 3)

    def attach(point):
        """Adds a node on the network, at its closest point to `point`."""
        best = None
        for (ka, kb), i in owners.items():
            segment = QgsGeometry.fromPolylineXY([points[ka], points[kb]])
            d = segment.distance(QgsGeometry.fromPointXY(point))
            if best is None or d < best[0]:
                best = (d, ka, kb, segment)
        if best is None or best[0] > CORRIDOR:
            return None
        d, ka, kb, segment = best
        projected = segment.nearestPoint(QgsGeometry.fromPointXY(point)).asPoint()
        k = key(projected)
        points[k] = projected
        edge(k, ka, math.dist(k, ka))
        edge(k, kb, math.dist(k, kb))
        return k

    line = original.asPolyline()
    start, end = attach(line[0]), attach(line[-1])
    if start is None or end is None:
        return None, "extrémité loin de tout aménagement OSM"
    best, previous, queue = {start: 0}, {}, [(0, start)]
    while queue:
        cost, node = heapq.heappop(queue)
        if node == end:
            break
        if cost > best.get(node, math.inf):
            continue
        for other, step in graph.get(node, []):
            if cost + step < best.get(other, math.inf):
                best[other] = cost + step
                previous[other] = node
                heapq.heappush(queue, (cost + step, other))
    if end not in best:
        return None, "pas de chemin continu dans OSM"
    path, node = [end], end
    while node != start:
        node = previous[node]
        path.append(node)
    path.reverse()
    used = {owners[(a, b)] for a, b in zip(path, path[1:]) if (a, b) in owners}
    return [points[k] for k in path], used


def two_sided(polyline, used, network):
    """True when the route follows one-way tracks and another one-way track runs alongside it, on the
    other side of the street."""
    used_oneway = [i for i in used if network.lines[i][1] == "Piste Cyclable" and not network.lines[i][2]]
    if not used_oneway:
        return False
    route_geometry = QgsGeometry.fromPolylineXY(polyline)
    zone = route_geometry.buffer(30, 8)
    for i in network.near(route_geometry, 30):
        g, kind, bidirectional, _ = network.lines[i]
        if i in used or kind != "Piste Cyclable" or bidirectional:
            continue
        shared = g.intersection(zone).length()
        if shared > 0.5 * route_geometry.length() and route_geometry.distance(g) > 4:
            return True
    return False


def with_ends(route_points, start, end):
    """The route, starting at `start` and ending at `end` when they are not already its ends."""
    points = list(route_points)
    if math.dist(key(start), key(points[0])) > 0.5:
        points.insert(0, start)
    if math.dist(key(end), key(points[-1])) > 0.5:
        points.append(end)
    return QgsGeometry.fromPolylineXY(points).simplify(0.5)


def snap(original, network):
    """Returns (route through OSM, None) for a confident match, or (None, reason)."""
    polyline, used = route(original, network)
    if polyline is None:
        return None, used
    if two_sided(polyline, used, network):
        return None, "pistes unidirectionnelles des deux côtés : axe de la rue conservé"
    line = original.asPolyline()
    snapped = with_ends(polyline, line[0], line[-1])
    hausdorff = original.hausdorffDistance(snapped)
    ratio = snapped.length() / original.length()
    n = max(2, int(original.length() / 5))
    covered = sum(snapped.distance(original.interpolate(original.length() * k / n)) <= 12
                  for k in range(n + 1)) / (n + 1)
    if hausdorff > ACCEPT_HAUSDORFF or covered < ACCEPT_COVERED or not ACCEPT_LENGTH[0] <= ratio <= ACCEPT_LENGTH[1]:
        return None, f"correspondance incertaine (écart max {hausdorff:.0f} m, couverture {covered:.0%}, longueur ×{ratio:.2f})"
    if drift(snapped, network) >= drift(original, network):
        return None, "pas d'amélioration"
    return polyline, None


# --- files -------------------------------------------------------------------------------------
def coordinate_spans(raw, count):
    """Spans of the "coordinates" arrays of the `count` features, in file order."""
    spans = []
    for match in re.finditer(r'"geometry"\s*:', raw):
        start = raw.index('"coordinates"', match.end())
        start = raw.index("[", start)
        depth, i = 0, start
        while True:
            depth += {"[": 1, "]": -1}.get(raw[i], 0)
            if depth == 0:
                break
            i += 1
        spans.append((start, i + 1))
    assert len(spans) == count, f"{len(spans)} geometries for {count} features"
    return spans


def format_coordinates(points, indent):
    pad = " " * indent
    rows = ",\n".join(f"{pad}  [{x:.7f}, {y:.7f}]" for x, y in points)
    return f"[\n{rows}\n{pad}]"


def cluster_ends(ends, tolerance=0.6):
    """Groups section ends closer than `tolerance` m: {end key: cluster id}."""
    keys = sorted(set(ends))
    parent = {k: k for k in keys}

    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            if b[0] - a[0] > tolerance:
                break
            if math.dist(a, b) <= tolerance:
                parent[find(a)] = find(b)
    return {k: find(k) for k in keys}


def main():
    folder = Path(sys.argv[1]).expanduser()
    dry_run = "--dry-run" in sys.argv
    network = Network(OSM)
    to_l93 = QgsCoordinateTransform(WGS84, L93, QgsProject.instance())
    to_wgs = QgsCoordinateTransform(L93, WGS84, QgsProject.instance())
    paths = sorted(folder.glob("ligne-*.json"), key=lambda p: int(re.search(r"\d+", p.stem).group()))

    # Pass 1: route every built section that strays from OSM, and note which sections end where.
    files, sections, ends, cache = {}, {}, {}, {}
    for path in paths:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        files[path] = (raw, coordinate_spans(raw, len(data["features"])))
        for index, feature in enumerate(data["features"]):
            p, geometry = feature["properties"], feature["geometry"]
            if geometry["type"] != "LineString":
                continue
            original = QgsGeometry.fromPolylineXY([QgsPointXY(*c[:2]) for c in geometry["coordinates"]])
            original.transform(to_l93)
            line = original.asPolyline()
            for end in (line[0], line[-1]):
                ends.setdefault(key(end), set()).add((path, index))
            if p.get("status") != "done" or original.length() < 20:
                continue
            signature = original.asWkt(1)  # sections shared by several lines get the same result
            if signature not in cache:
                before = drift(original, network)
                result = (None, None) if before <= MIN_DRIFT else snap(original, network)
                cache[signature] = (*result, before)
            sections[(path, index)] = (p, original, *cache[signature])

    # Pass 2: an end shared only with other snapped sections moves onto the OSM route (the same point
    # for all of them); an end shared with a section left as it is stays, joined to the route.
    snapped_keys = {k for k, (_, _, route_points, _, _) in sections.items() if route_points}
    cluster = cluster_ends(ends)
    users = {}
    for k, owners in ends.items():
        users.setdefault(cluster[k], set()).update(owners)
    moved = {}
    report, preview, replacements = [], [], {}
    for (path, index), (p, original, route_points, reason, before) in sections.items():
        entry = {"file": path.name, "line": p.get("line"), "name": p.get("name"),
                 "length": round(original.length()), "drift_before": round(before, 1)}
        if not route_points:
            if reason:
                report.append({**entry, "status": "à vérifier", "reason": reason})
            continue
        line = original.asPolyline()
        ends = []
        for end, own in ((line[0], route_points[0]), (line[-1], route_points[-1])):
            k = cluster[key(end)]
            if users[k] <= snapped_keys:
                ends.append(moved.setdefault(k, own))
            else:
                ends.append(end)
        snapped = with_ends(route_points, *ends)
        after = drift(snapped, network)
        wgs = QgsGeometry(snapped)
        wgs.transform(to_wgs)
        raw, spans = files[path]
        span = spans[index]
        indent = len(raw[:span[0]].rsplit("\n", 1)[1]) - len('"coordinates": ')
        replacements.setdefault(path, []).append(
            (span, format_coordinates([(pt.x(), pt.y()) for pt in wgs.asPolyline()], indent)))
        report.append({**entry, "status": "recalé", "drift_after": round(after, 1)})
        for state, g in (("avant", original), ("après", snapped)):
            out = QgsGeometry(g)
            out.transform(to_wgs)
            preview.append({"type": "Feature", "properties": {**entry, "state": state},
                            "geometry": json.loads(out.asJson(7))})

    for path in paths:
        changes = replacements.get(path, [])
        if changes and not dry_run:
            raw = files[path][0]
            for (start, end), text in sorted(changes, reverse=True):
                raw = raw[:start] + text + raw[end:]
            json.loads(raw)  # still valid
            path.write_text(raw, encoding="utf-8")
        print(f"{path.name}: {len(changes)} sections recalées")
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=1))
    PREVIEW.write_text(json.dumps({"type": "FeatureCollection", "features": preview}, ensure_ascii=False))
    done = [r for r in report if r["status"] == "recalé"]
    todo = [r for r in report if r["status"] != "recalé"]
    print(f"\n{len(done)} recalées ({sum(r['length'] for r in done) / 1000:.1f} km), "
          f"{len(todo)} à vérifier ({sum(r['length'] for r in todo) / 1000:.1f} km) — {REPORT}")
    print(f"{len(moved)} extrémités déplacées sur le tracé OSM")


if __name__ == "__main__":
    # A profile folder of our own, or QGIS creates its style database in the current directory.
    app = QgsApplication([], False, str(ROOT / "out" / "qgis-profile"))
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()

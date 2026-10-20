"""Builds the print map of the cycling network of Lyon and Villeurbanne with QGIS.

Inputs (see print/README.md):
  print/out/data/*.geojson   exported from the app by export-layers.mjs
  print/out/tiles/           OpenFreeMap vector tiles downloaded by fetch-tiles.py

Outputs in print/out/:
  basemap/*.fgb              basemap layers, merged across tiles, in Lambert-93
  cycleways.fgb, vl.fgb      cycle lanes and Voies Lyonnaises as drawn (deduplicated, merged)
  vl-shields.fgb             positions of the Voies Lyonnaises numbers
  carte-velo-lyon.qgz        QGIS project with the print layout
  carte-velo-lyon-A0.pdf     vector PDF
  preview.png, crop-*.png    previews

Run with the Python of QGIS, e.g.:
  QT_QPA_PLATFORM=offscreen /Applications/QGIS*.app/Contents/MacOS/python print/build_map.py
"""

import json
import math
import os
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

# Outside of the QGIS app, its Python does not know where PROJ and GDAL keep their data.
_resources = Path(sys.executable).resolve().parent.parent / "Resources" / "qgis"
os.environ.setdefault("PROJ_DATA", str(_resources / "proj"))
os.environ.setdefault("GDAL_DATA", str(_resources / "gdal"))

from osgeo import gdal, ogr, osr
from qgis.core import (
    Qgis,
    QgsApplication,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsFeatureRequest,
    QgsField,
    QgsFields,
    QgsFillSymbol,
    QgsFontMarkerSymbolLayer,
    QgsGeometry,
    QgsLayoutExporter,
    QgsLayoutItem,
    QgsLayoutItemLabel,
    QgsLayoutItemLegend,
    QgsLayoutItemMap,
    QgsLayoutItemPicture,
    QgsLayoutItemScaleBar,
    QgsLayoutItemShape,
    QgsLayoutMeasurement,
    QgsLayoutPoint,
    QgsLayoutSize,
    QgsLegendRenderer,
    QgsMapLayerLegendUtils,
    QgsLegendStyle,
    QgsLineSymbol,
    QgsMarkerLineSymbolLayer,
    QgsMarkerSymbol,
    QgsPalLayerSettings,
    QgsPointXY,
    QgsPrintLayout,
    QgsProject,
    QgsProperty,
    QgsRectangle,
    QgsRuleBasedRenderer,
    QgsSimpleFillSymbolLayer,
    QgsSimpleLineSymbolLayer,
    QgsSimpleMarkerSymbolLayer,
    QgsSpatialIndex,
    QgsSingleSymbolRenderer,
    QgsSvgMarkerSymbolLayer,
    QgsSymbolLayer,
    QgsTextBackgroundSettings,
    QgsTextBufferSettings,
    QgsTextFormat,
    QgsVectorFileWriter,
    QgsVectorLayer,
    QgsRasterLayer,
    QgsBilinearRasterResampler,
    QgsVariantUtils,
    QgsVectorLayerSimpleLabeling,
)
from qgis.PyQt.QtCore import QMetaType, QPointF, QRectF, QSize, QSizeF, Qt
from qgis.PyQt.QtGui import QColor, QFont, QFontMetricsF

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
DATA = OUT / "data"
TILES = OUT / "tiles"
ICONS = ROOT / "icons"
BASEMAP = OUT / "basemap"

CRS = QgsCoordinateReferenceSystem("EPSG:2154")  # Lambert-93
SCALE = 12_500
CENTER = (4.853, 45.757)  # lon, lat: between Presqu'île and Part-Dieu
PAGE_W, PAGE_H = 1189, 841  # A0 landscape, mm
MARGIN = 12

TITLE = "Carte vélo Lyon"
SITE_URL = "carte.lavilleavelo.org"

FONT = "Avenir Next"
FONT_CONDENSED = "Avenir Next Condensed"
STREET_FONT_STYLES = ("Demi Bold", "Medium", "Medium Italic")  # main streets, streets, pedestrian

# --- palette -------------------------------------------------------------------------------
LAND = "#f7f5f0"
BUILDING = "#e7e2d9"
INDUSTRIAL = "#efebe4"
GREEN = "#d3e7c1"
WOOD = "#c6deb2"
GREEN_TEXT = "#4c7a36"
WATER = "#c3dfeb"
WATER_TEXT = "#4a82ab"
CASING = "#d3ccc0"
MAJOR_CASING = "#c4bcae"
MOTORWAY = "#e6e1d9"
RAIL = "#a9a39a"
TEXT = "#24211e"
TRAM = "#9b9286"
TEXT_SOFT = "#4d4842"
QUARTER_TEXT = "#958d81"
INK = "#14213d"

SEPARATED = "#0a5a94"  # cycle tracks and greenways
SEPARATED_DARK = "#073c63"
PAINTED = "#2e8fd3"  # painted lanes, bus lanes, cycle streets
CONTRAFLOW = "#73b3e0"
VL_COLORS = [
    "#60A75B", "#AC4D35", "#3B7B64", "#DC8953", "#AF7392", "#396083",
    "#75BCAE", "#7E6D98", "#EAAB50", "#9A8A4B", "#4DADC9", "#DBABB7",
]
VL_COLOR_EXPRESSION = "CASE " + " ".join(f"WHEN \"vl\" = {i + 1} THEN '{c}'" for i, c in enumerate(VL_COLORS)) + " END"


# --- basemap preparation ---------------------------------------------------------------------
BASEMAP_LAYERS = {
    # output: (tile layer, fields to keep, dissolve fields or None, extra SQL condition)
    "water": ("water", ["class"], ["class"], None),
    "landcover": ("landcover", ["class", "subclass"], ["class", "subclass"], None),
    "landuse": ("landuse", ["class"], ["class"], None),
    "park": ("park", ["class"], ["class"], None),
    "park_names": ("park", ["name"], ["name"], "name IS NOT NULL"),
    "building": ("building", [], [], None),
    "aeroway": ("aeroway", ["class"], ["class"], None),
    "waterway": ("waterway", ["class", "name", "brunnel"], None, None),
    "transportation": ("transportation", ["class", "subclass", "brunnel", "ramp", "layer", "service"], None, None),
    "transportation_name": ("transportation_name", ["class", "subclass", "name", "ref", "brunnel"], None, None),
    "place": ("place", ["class", "name", "rank", "capital"], None, None),
    "water_name": ("water_name", ["class", "name"], None, None),
}


def prepare_basemap():
    """Reads the tile folder with GDAL and writes one Lambert-93 FlatGeobuf file per layer.

    Polygons are clipped at tile edges in vector tiles: dissolving them by class removes the seams
    that would otherwise show as hairlines in PDF viewers. Files that already exist are kept.
    FlatGeobuf rather than GeoPackage: QGIS reads the files concurrently without SQLite locking issues.
    """
    missing = {k: v for k, v in BASEMAP_LAYERS.items() if not (BASEMAP / f"{k}.fgb").exists()}
    if not missing:
        return
    BASEMAP.mkdir(exist_ok=True)
    gdal.UseExceptions()
    src = gdal.OpenEx(str(TILES / "14"), gdal.OF_VECTOR, open_options=["CLIP=YES"])
    tmp = OUT / "basemap-raw.gpkg"
    tmp.unlink(missing_ok=True)
    gdal.VectorTranslate(
        str(tmp),
        src,
        format="GPKG",
        layers=sorted({source for source, *_ in missing.values()}),
        dstSRS="EPSG:2154",
        reproject=True,
        makeValid=True,
    )
    raw = ogr.Open(str(tmp))
    driver = ogr.GetDriverByName("FlatGeobuf")
    for name, (source, fields, dissolve, condition) in missing.items():
        layer = raw.GetLayerByName(source)
        defn = layer.GetLayerDefn()
        names = {defn.GetFieldDefn(i).GetName() for i in range(defn.GetFieldCount())}
        cols = "".join(f'"{f}", ' for f in fields if f in names)
        where = [condition] if condition else []
        if dissolve is not None:
            where.append("GeometryType(geom) LIKE '%POLYGON%'")
            group = ", ".join(f'"{f}"' for f in dissolve if f in names)
            sql = f'SELECT {cols}ST_Multi(ST_Union(geom)) AS geom FROM "{source}"'
        else:
            group = ""
            sql = f'SELECT {cols}geom FROM "{source}"'
        if where:
            sql += " WHERE " + " AND ".join(where)
        if group:
            sql += f" GROUP BY {group}"
        result = raw.ExecuteSQL(sql, dialect="SQLITE")
        dst = driver.CreateDataSource(str(BASEMAP / f"{name}.fgb"))
        out = dst.CopyLayer(result, name, ["SPATIAL_INDEX=YES"])
        raw.ReleaseResultSet(result)
        print(f"basemap {name}: {out.GetFeatureCount()} features")
        dst = None
    raw = None
    tmp.unlink()


# --- helpers -----------------------------------------------------------------------------------
MM = Qgis.RenderUnit.Millimeters


def basemap_layer(name, subset=None, title=None):
    layer = QgsVectorLayer(str(BASEMAP / f"{name}.fgb"), title or name, "ogr")
    if subset:
        layer.setSubsetString(subset)
    assert layer.isValid(), name
    return layer


def geojson_layer(file, title, subset=None):
    layer = QgsVectorLayer(str(DATA / file), title, "ogr")
    if subset:
        layer.setSubsetString(subset)
    assert layer.isValid(), file
    return layer


def fill(color, outline=None, outline_width=0.0):
    sl = QgsSimpleFillSymbolLayer(QColor(color))
    if outline:
        sl.setStrokeColor(QColor(outline))
        sl.setStrokeWidth(outline_width)
        sl.setStrokeWidthUnit(MM)
    else:
        sl.setStrokeStyle(Qt.PenStyle.NoPen)
    sym = QgsFillSymbol()
    sym.changeSymbolLayer(0, sl)
    return sym


def line_layer(color, width, dash=None, cap="round", offset=None, opacity=1.0, rendering_pass=0):
    c = QColor(color)
    c.setAlphaF(opacity)
    sl = QgsSimpleLineSymbolLayer(c, width)
    sl.setWidthUnit(MM)
    sl.setPenCapStyle({"round": Qt.PenCapStyle.RoundCap, "butt": Qt.PenCapStyle.FlatCap}[cap])
    sl.setPenJoinStyle(Qt.PenJoinStyle.RoundJoin)
    if dash:
        sl.setUseCustomDashPattern(True)
        sl.setCustomDashVector(dash)
        sl.setCustomDashPatternUnit(MM)
    if offset is not None:
        sl.setOffsetUnit(MM)
        if isinstance(offset, str):
            sl.setDataDefinedProperty(QgsSymbolLayer.Property.Offset, QgsProperty.fromExpression(offset))
        else:
            sl.setOffset(offset)
    sl.setRenderingPass(rendering_pass)
    return sl


def line_symbol(*layers):
    sym = QgsLineSymbol()
    sym.deleteSymbolLayer(0)
    for sl in layers:
        sym.appendSymbolLayer(sl)
    return sym


def invisible_line():
    return line_symbol(line_layer("#000000", 0.0, opacity=0))


def invisible_point():
    sym = QgsMarkerSymbol.createSimple({"size": "0"})
    sym.setOpacity(0)
    return sym


def rule(label, expression, symbol=None, children=()):
    r = QgsRuleBasedRenderer.Rule(symbol, 0, 0, expression, label)
    for child in children:
        r.appendChild(child)
    return r


def rule_renderer(rules, symbol_levels=False):
    """rules: Rule objects, or (label, filter expression, symbol) tuples."""
    root = QgsRuleBasedRenderer.Rule(None)
    for r in rules:
        root.appendChild(r if isinstance(r, QgsRuleBasedRenderer.Rule) else rule(*r))
    renderer = QgsRuleBasedRenderer(root)
    renderer.setUsingSymbolLevels(symbol_levels)
    return renderer


def text_format(size, color=TEXT, family=FONT, style="Regular", buffer=0.0, buffer_color="#ffffff",
                buffer_opacity=1.0, spacing=0.0, caps=False, line_height=0.85):
    fmt = QgsTextFormat()
    # Avenir Next has generous line spacing: wrapped names (landmarks, communes) read as two labels without this.
    fmt.setLineHeight(line_height)
    font = QFont(family)
    font.setStyleName(style)
    font.setLetterSpacing(QFont.SpacingType.AbsoluteSpacing, spacing)
    fmt.setFont(font)
    fmt.setNamedStyle(style)
    fmt.setSize(size)
    fmt.setSizeUnit(Qgis.RenderUnit.Points)
    fmt.setColor(QColor(color))
    if caps:
        fmt.setCapitalization(Qgis.Capitalization.AllUppercase)
    if buffer:
        b = QgsTextBufferSettings()
        b.setEnabled(True)
        b.setSize(buffer)
        b.setSizeUnit(MM)
        b.setColor(QColor(buffer_color))
        b.setOpacity(buffer_opacity)
        b.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
        fmt.setBuffer(b)
    return fmt


def set_labels(layer, field, fmt, placement, priority=5, merge=False, repeat=None, min_length=None, extra=None):
    """Labels only collide with other labels: the features of the label layers are not obstacles,
    otherwise street names could not cross the other named streets of a grid."""
    s = QgsPalLayerSettings()
    s.obstacleSettings().setIsObstacle(False)
    s.fieldName = field
    s.isExpression = not field.isidentifier()
    s.setFormat(fmt)
    s.placement = placement
    s.priority = priority
    if merge:
        s.lineSettings().setMergeLines(True)
    if repeat:
        s.repeatDistance = repeat
        s.repeatDistanceUnit = MM
    if min_length:
        s.thinningSettings().setMinimumFeatureSize(min_length)
    if extra:
        extra(s)
    layer.setLabeling(QgsVectorLayerSimpleLabeling(s))
    layer.setLabelsEnabled(True)


def save_layer(layer, path):
    """Writes a memory layer next to the project so the .qgz works without this script."""
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "FlatGeobuf"
    QgsVectorFileWriter.writeAsVectorFormatV3(layer, str(path), QgsProject.instance().transformContext(), options)
    saved = QgsVectorLayer(str(path), layer.name(), "ogr")
    saved.setRenderer(layer.renderer().clone())
    if layer.labeling():
        saved.setLabeling(layer.labeling().clone())
        saved.setLabelsEnabled(True)
    return saved


# --- basemap -----------------------------------------------------------------------------------
def basemap_layers(extent):
    layers = []

    landuse = basemap_layer("landuse", title="Occupation du sol")
    landuse.setRenderer(rule_renderer([
        ("industrie", "\"class\" IN ('industrial','commercial','retail','railway','garages')", fill(INDUSTRIAL)),
        ("cimetières", "\"class\" = 'cemetery'", fill("#dfe8d6")),
    ]))
    layers.append(landuse)

    landcover = basemap_layer("landcover", title="Végétation")
    landcover.setRenderer(rule_renderer([
        ("bois", "\"class\" = 'wood'", fill(WOOD)),
        ("herbe", "\"class\" IN ('grass','wetland')", fill(GREEN)),
    ]))
    layers.append(landcover)

    # No "park" layer: in OpenMapTiles it holds protected areas, such as the UNESCO site of the old town,
    # which would be painted like a park. The parks themselves are in landcover.

    water = basemap_layer("water", title="Eau")
    water.setRenderer(QgsSingleSymbolRenderer(fill(WATER)))
    layers.append(water)

    waterway = basemap_layer("waterway", "\"brunnel\" IS NULL OR \"brunnel\" <> 'tunnel'", "Cours d'eau")
    waterway.setRenderer(rule_renderer([
        ("rivière", "\"class\" IN ('river','canal')", line_symbol(line_layer(WATER, 0.9))),
        ("ruisseau", "\"class\" NOT IN ('river','canal')", line_symbol(line_layer(WATER, 0.4))),
    ]))
    layers.append(waterway)

    building = basemap_layer("building", title="Bâtiments")
    building.setRenderer(QgsSingleSymbolRenderer(fill(BUILDING)))
    layers.append(building)
    layers.append(shading_layer())

    # Roads: every casing is drawn before every fill so junctions stay clean (symbol levels).
    road_classes = [
        # label, filter, casing width, fill width, casing color, fill color
        ("rues piétonnes", "\"class\" = 'path' AND \"subclass\" = 'pedestrian'", 0.7, 0.5, CASING, "#fbfaf7"),
        ("dessertes", "\"class\" IN ('service','track')", 0.55, 0.36, CASING, "#ffffff"),
        ("rues", "\"class\" IN ('minor','busway')", 0.95, 0.72, CASING, "#ffffff"),
        ("rues principales", "\"class\" = 'tertiary'", 1.3, 1.02, CASING, "#ffffff"),
        ("avenues", "\"class\" IN ('secondary','primary')", 1.75, 1.4, MAJOR_CASING, "#ffffff"),
        ("voies rapides", "\"class\" IN ('trunk','motorway')", 2.0, 1.6, MAJOR_CASING, MOTORWAY),
    ]
    surface = "(\"brunnel\" IS NULL OR \"brunnel\" <> 'tunnel')"
    rules = [
        ("chemins", f"\"class\" = 'path' AND \"subclass\" IN ('footway','path','cycleway','steps','bridleway') AND {surface}",
         line_symbol(line_layer("#cbc4b8", 0.18, dash=[0.6, 0.4], cap="butt", rendering_pass=0))),
    ]
    n = len(road_classes)
    for i, (label, expression, cw, fw, cc, fc) in enumerate(road_classes):
        rules.append((label + " (tunnel)", f"{expression} AND \"brunnel\" = 'tunnel'",
                      line_symbol(line_layer("#e2dcd2", fw, dash=[1.2, 0.8], cap="butt", rendering_pass=1))))
        # Streets at 50 km/h or more get a pale warm fill (fast roads keep their grey).
        road_fill = line_layer(fc, fw, rendering_pass=2 + n + i)
        if fc == "#ffffff":
            road_fill.setDataDefinedProperty(QgsSymbolLayer.Property.StrokeColor, QgsProperty.fromExpression(
                f"CASE WHEN \"busy\" = 1 THEN '{BUSY_FILL}' ELSE '{fc}' END"))
        rules.append((label, f"{expression} AND {surface}", line_symbol(
            line_layer(cc, cw, rendering_pass=2 + i),
            road_fill,
        )))
    rail = f"\"class\" = 'rail' AND {surface} AND \"service\" IS NULL"
    rules.append(("voies ferrées", rail, line_symbol(
        line_layer(RAIL, 0.6, rendering_pass=2 + 2 * n),
        line_layer("#ffffff", 0.3, dash=[2.0, 2.0], cap="butt", rendering_pass=3 + 2 * n))))
    rules.append(("tramway", f"\"class\" = 'transit' AND \"subclass\" IN ('tram','light_rail') AND {surface}",
                  line_symbol(line_layer(TRAM, 0.35, rendering_pass=3 + 2 * n))))
    transportation = QgsVectorLayer(str(mark_busy_roads(basemap_layer("transportation"), extent)), "Voirie", "ogr")
    transportation.setRenderer(rule_renderer(rules, symbol_levels=True))
    layers.append(transportation)
    return layers


# --- relief and traffic ------------------------------------------------------------------------
DEM = DATA / "dem"
SHADING = OUT / "shading.fgb"
SHADE_COLOR = "#4a3a2c"  # warm dark brown, laid over the map with a varying transparency
SHADE_THRESHOLDS = [0.03, 0.06, 0.11]  # darkness from which each nested class starts
# Stacked, these give 4 %, 9 % and 15 % of shade.
SHADE_OPACITIES = [0.04, 0.052, 0.066]
SLOPE_COLOR = "#a2401b"
BUSY_FILL = "#f7e6cf"  # streets at 50 km/h or more: a pale warm fill
FAST_SPEEDS = ("50", "70", "80", "90", "110", "130")


def dem_vrt():
    path = OUT / "dem.vrt"
    if not path.exists():
        gdal.BuildVRT(str(path), sorted(str(p) for p in DEM.glob("*.bil")))
    return path


def prepare_shading():
    """A light relief, as vector areas of shade: no image in the PDF, so it stays small and has no tile
    seams. The elevation is smoothed to 10 m first so that walls and ditches do not show; the shading
    combines slope and orientation (light from the north-west), so that slopes facing the light show
    too, and flat ground stays clear. The classes are nested (each contains the darker ones) and drawn
    on top of each other, so their smoothed outlines never leave gaps."""
    if SHADING.exists():
        return SHADING
    import numpy as np

    gdal.UseExceptions()
    dem10 = gdal.Warp("", str(dem_vrt()), format="MEM", xRes=10, yRes=10, resampleAlg="average")
    shade = gdal.DEMProcessing("", dem10, "hillshade", format="MEM", azimuth=315, zFactor=1.8,
                               combined=True, computeEdges=True)
    darkness = np.clip((255 - shade.GetRasterBand(1).ReadAsArray().astype("float32")) / 255, 0, 1)
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(2154)
    layer = QgsVectorLayer("MultiPolygon?crs=EPSG:2154", "shading", "memory")
    layer.dataProvider().addAttributes([QgsField("class", QMetaType.Type.Int)])
    layer.updateFields()
    features = []
    for i, threshold in enumerate(SHADE_THRESHOLDS, start=1):
        raster = gdal.GetDriverByName("MEM").Create("", shade.RasterXSize, shade.RasterYSize, 1, gdal.GDT_Byte)
        raster.SetGeoTransform(shade.GetGeoTransform())
        raster.SetProjection(shade.GetProjection())
        band = raster.GetRasterBand(1)
        band.WriteArray((darkness >= threshold).astype("uint8"))
        band.SetNoDataValue(0)
        gdal.SieveFilter(band, None, band, 10, 8)  # no specks under 1000 m²
        memory = ogr.GetDriverByName("Memory").CreateDataSource("")
        polygons = memory.CreateLayer("shading", srs, ogr.wkbPolygon)
        polygons.CreateField(ogr.FieldDefn("value", ogr.OFTInteger))
        gdal.Polygonize(band, band, polygons, 0)
        for polygon in polygons:
            # The cells' staircase outline, simplified then rounded.
            g = QgsGeometry.fromWkt(polygon.GetGeometryRef().ExportToWkt()).simplify(6).smooth(3, 0.25)
            if g.isEmpty() or g.area() < 1000:
                continue
            feat = QgsFeature(layer.fields())
            feat.setGeometry(g)
            feat.setAttributes([i])
            features.append(feat)
    layer.dataProvider().addFeatures(features)
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "FlatGeobuf"
    QgsVectorFileWriter.writeAsVectorFormatV3(layer, str(SHADING), QgsProject.instance().transformContext(), options)
    print(f"shading: {len(features)} polygons")
    return SHADING


def shading_layer():
    layer = QgsVectorLayer(str(prepare_shading()), "Relief", "ogr")
    assert layer.isValid()
    rules = []
    for i, opacity in enumerate(SHADE_OPACITIES, start=1):
        color = QColor(SHADE_COLOR)
        color.setAlphaF(opacity)
        sl = QgsSimpleFillSymbolLayer(color)
        sl.setStrokeStyle(Qt.PenStyle.NoPen)
        symbol = QgsFillSymbol()
        symbol.changeSymbolLayer(0, sl)
        rules.append((f"ombre {i}", f"\"class\" = {i}", symbol))
    layer.setRenderer(rule_renderer(rules))
    return layer


def fast_roads(extent):
    """Street sections of the Métropole at 50 km/h or more, in Lambert-93."""
    layer = QgsVectorLayer(str(DATA / "roads.geojson"), "roads", "ogr")
    layer.setSubsetString(f"\"limitationvitesse\" IN ({', '.join(repr(s) for s in FAST_SPEEDS)})")
    return [g for _, g in to_lambert(layer) if g.boundingBox().intersects(extent)]


def bearing(g):
    """Direction of a line from its first to its last point, in degrees modulo 180."""
    line = g.asPolyline() if not g.isMultipart() else [p for part in g.asMultiPolyline() for p in part]
    if len(line) < 2:
        return None
    a, b = line[0], line[-1]
    return math.degrees(math.atan2(b.y() - a.y(), b.x() - a.x())) % 180


def mark_busy_roads(transportation, extent):
    """Writes the basemap streets with a `busy` flag: 1 when the street runs along a section of the
    Métropole at 50 km/h or more, in the same direction (OSM and the Métropole do not share
    geometries). Service roads and stubs shorter than 25 m are never flagged."""
    path = BASEMAP / "transportation_busy.fgb"
    if path.exists():
        return path
    fast = fast_roads(extent)
    index = QgsSpatialIndex()
    for i, g in enumerate(fast):
        feat = QgsFeature(i)
        feat.setGeometry(g)
        index.addFeature(feat)
    layer = QgsVectorLayer("MultiLineString?crs=EPSG:2154", "transportation", "memory")
    fields = transportation.fields()
    layer.dataProvider().addAttributes([*fields.toList(), QgsField("busy", QMetaType.Type.Int)])
    layer.updateFields()
    roads = {"minor", "tertiary", "secondary", "primary", "trunk", "motorway", "busway"}
    features = []
    for f in transportation.getFeatures():
        g = f.geometry()
        if g.type() != Qgis.GeometryType.Line:
            # Squares and road areas (polygons), and collections: keep their lines only.
            parts = [p for p in g.asGeometryCollection() if p.type() == Qgis.GeometryType.Line]
            if not parts:
                continue
            g = QgsGeometry.collectGeometry(parts)
        busy = 0
        if f["class"] in roads and g.length() >= 25 and g.boundingBox().intersects(extent):
            near = [fast[i] for i in index.intersects(g.boundingBox().buffered(12))]
            own = bearing(g)
            aligned = [n for n in near if own is None or bearing(n) is None
                       or min(abs(own - bearing(n)), 180 - abs(own - bearing(n))) <= 30]
            busy = int(bool(aligned) and covered(g, aligned, 12) >= 0.6)
        feat = QgsFeature(layer.fields())
        multi = QgsGeometry(g)
        multi.convertToMultiType()
        feat.setGeometry(multi)
        feat.setAttributes([*f.attributes(), busy])
        features.append(feat)
    layer.dataProvider().addFeatures(features)
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "FlatGeobuf"
    QgsVectorFileWriter.writeAsVectorFormatV3(layer, str(path), QgsProject.instance().transformContext(), options)
    print(f"busy roads: {sum(f['busy'] for f in features if f['busy'])} of {len(features)} street segments")
    return path


def slope_layer(extent, frame, cycleways, hidden, blockers, min_slope=7, min_length=70, spacing=18):
    """Chevrons pointing uphill on steep streets (one from 7 %, two from 10 %, which also show the slope).

    Street sections of the Métropole with an average slope of `min_slope` % or more are joined into
    climbs (same street, touching, slope class alike). A climb of at least `min_length` metres gets one
    marker at its middle, no two markers closer than `spacing` mm, and none closer than 4 mm to the
    points of `blockers` (VL numbers). Climbs on the cycle network come first, then the main streets,
    then the others; climbs of 7 to 9 % only show on the cycle network or a main street. Car-only
    sections (tunnels, ramps, fast roads) and dead ends are left out, as are climbs whose elevation
    (RGE ALTI) at both ends does not confirm half of their slope. `hidden`: areas under the panels."""
    u = unit()
    layer = QgsVectorLayer(str(DATA / "roads.geojson"), "roads", "ogr")
    layer.setSubsetString(
        f"\"pentemoyenne\" >= {min_slope} AND (\"limitationvitesse\" IS NULL OR \"limitationvitesse\" "
        f"NOT IN ('70','80','90','110','130')) AND \"nomvoie1\" NOT LIKE 'Trémie%' "
        f"AND \"nomvoie1\" NOT LIKE 'Tunnel%' AND \"nomvoie1\" NOT LIKE 'Bretelle%' "
        f"AND \"nomvoie1\" NOT LIKE 'Impasse%' AND \"nomvoie1\" NOT LIKE 'Viaduc%'")
    sections = [(f["nomvoie1"], f["pentemoyenne"], not is_null(f["hierarchiefonctionnelle"]), g)
                for f, g in to_lambert(layer) if g.boundingBox().intersects(extent)]
    groups = {}
    for name, slope, main, g in sections:
        groups.setdefault((name, slope >= 10), []).append((slope, main, g))
    line_geoms = {f.id(): f.geometry() for f in cycleways.getFeatures()}
    line_index = QgsSpatialIndex(cycleways.getFeatures())
    climbs = []
    for (name, _), items in groups.items():
        merged = QgsGeometry.unaryUnion([g for _, _, g in items]).mergeLines()
        for part in merged.asGeometryCollection():
            mine = [(s, m, g) for s, m, g in items if g.intersects(part.buffer(1, 4))]
            total = sum(g.length() for _, _, g in mine) or 1
            slope = sum(s * g.length() for s, _, g in mine) / total
            near = [line_geoms[i] for i in line_index.intersects(part.boundingBox().buffered(10))]
            on_route = 2 if near and covered(part, near, 10) >= 0.5 else int(any(m for _, m, _ in mine))
            climbs.append((name, slope, on_route, part))

    dem = QgsRasterLayer(str(dem_vrt()), "dem", "gdal")
    provider = dem.dataProvider()

    def elevation(point):
        value, ok = provider.sample(point, 1)
        return value if ok else None

    def direction(g, middle):
        """Direction at the middle of the climb, from the straightest 40 m window near it."""
        best = None
        for shift in (0, -20, 20, -40, 40):
            centre = min(max(middle + shift, 20), g.length() - 20)
            a, b = g.interpolate(centre - 20).asPoint(), g.interpolate(centre + 20).asPoint()
            chord = math.dist((a.x(), a.y()), (b.x(), b.y()))
            if best is None or chord > best[0]:
                best = (chord, a, b)
        return best[1], best[2]

    rows, placed = [], [QgsGeometry(b) for b in blockers]
    shown = 0
    for name, slope, on_route, g in sorted(climbs, key=lambda c: (-c[2], -round(c[1]), -c[3].length())):
        if g.length() < min_length or (slope < 10 and on_route == 0):
            continue
        line = g.asPolyline()
        if not line:
            continue
        start, end = elevation(line[0]), elevation(line[-1])
        if start is None or end is None or abs(end - start) / g.length() * 100 < 0.5 * slope:
            continue
        middle = g.interpolate(g.length() / 2)
        if not frame.contains(middle.asPoint()) or any(h.contains(middle) for h in hidden):
            continue
        if any(middle.distance(p) < spacing * u for p in placed[len(blockers):]) or any(
                middle.distance(b) < 4 * u for b in placed[:len(blockers)]):
            continue
        a, b = direction(g, g.length() / 2)
        dx, dy = b.x() - a.x(), b.y() - a.y()
        if end < start:
            dx, dy = -dx, -dy
        angle = -math.degrees(math.atan2(dy, dx))  # clockwise from east, as QGIS rotates markers
        # On a cycle line the chevron would hide it, or be hidden: set it beside the line.
        def clearance(point):
            return min((line_geoms[i].distance(point) for i in line_index.intersects(point.boundingBox().buffered(40))),
                       default=math.inf)

        if clearance(middle) < 1.2 * u:
            norm = math.hypot(dx, dy) or 1
            nx, ny = -dy / norm, dx / norm
            options = [QgsGeometry.fromPointXY(QgsPointXY(middle.asPoint().x() + side * nx * 2.4 * u,
                                                          middle.asPoint().y() + side * ny * 2.4 * u))
                       for side in (1, -1)]
            middle = max(options, key=clearance)
        placed.append(middle)
        shown += slope >= 10
        rows.append((middle, [name, round(slope), angle, 2 if slope >= 10 else 1]))

    out = QgsVectorLayer("Point?crs=EPSG:2154", "Pentes", "memory")
    out.dataProvider().addAttributes([QgsField("name", QMetaType.Type.QString), QgsField("slope", QMetaType.Type.Int),
                                      QgsField("angle", QMetaType.Type.Double), QgsField("chevrons", QMetaType.Type.Int)])
    out.updateFields()
    features = []
    for point, attributes in rows:
        feat = QgsFeature(out.fields())
        feat.setGeometry(point)
        feat.setAttributes(attributes)
        features.append(feat)
    out.dataProvider().addFeatures(features)

    def chevrons(svg):
        icon = QgsSvgMarkerSymbolLayer(str(ICONS / svg), 3.0)
        icon.setSizeUnit(MM)
        icon.setDataDefinedProperty(QgsSymbolLayer.Property.Angle, QgsProperty.fromExpression("coalesce(\"angle\", 0)"))
        return QgsMarkerSymbol([icon])

    out.setRenderer(rule_renderer([
        (f"Montée de {min_slope} à 9 %|(la pointe indique le haut de la côte)", "\"chevrons\" = 1",
         chevrons("uphill.svg")),
        ("Montée de 10 % ou plus|(pente moyenne indiquée)", "\"chevrons\" = 2", chevrons("uphill2.svg")),
    ]))

    def slope_labels(s):
        place_labels(s, priority=5)
        s.dist = 0.4

    # Only the steepest climbs show their slope: a single chevron already says 7 to 9 %.
    set_labels(out, "CASE WHEN \"slope\" >= 10 THEN concat(\"slope\", '\u00a0%') END",
               text_format(6.5, SLOPE_COLOR, family=FONT_CONDENSED, style="Bold", buffer=0.3),
               Qgis.LabelPlacement.AroundPoint, extra=slope_labels)
    print(f"slopes: {len(climbs)} climbs, {len(rows)} markers ({shown} of 10 % or more)")
    return save_layer(out, OUT / "slopes.fgb")


# --- cycling data ------------------------------------------------------------------------------
PAVED = {"asphalt", "paved", "concrete", "concrete:plates", "paving_stones", "sett", "cobblestone",
         "unhewn_cobblestone", "metal"}
# Most separated from traffic first: a lane running along a higher ranked one is not drawn.
KINDS = ["piste2", "piste", "vv", "vv_unpaved", "pieton", "velorue", "bande", "bus", "dsc"]
SIDE_KINDS = {"piste", "bande", "bus"}  # drawn on the side of the street they are on
SIDE_OFFSET = 0.4  # mm


def unit():
    """Metres per millimetre on paper."""
    return SCALE / 1000


def map_extent(center):
    map_w, map_h = PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN
    half_w, half_h = map_w * unit() / 2, map_h * unit() / 2
    return QgsRectangle(center.x() - half_w, center.y() - half_h, center.x() + half_w, center.y() + half_h)


def is_null(value):
    return value is None or QgsVariantUtils.isNull(value)


def cycleway_kind(f):
    t = f["typeamenagement"]
    if t == "Piste Cyclable":
        return "piste2" if not is_null(f["bidirectional"]) and f["bidirectional"] else "piste"
    if t == "Voie verte":
        if f["highway"] in ("pedestrian", "footway"):
            return "pieton"  # shared with pedestrians: bikes at walking pace
        surface = f["surface"]
        return "vv" if is_null(surface) or surface in PAVED else "vv_unpaved"
    return {"Vélorue": "velorue", "Bande Cyclable": "bande", "Couloir bus vélo": "bus",
            "Double sens cyclable": "dsc"}.get(t)


def covered(geometry, others, distance):
    """Share of the length of `geometry` lying within `distance` metres of `others`."""
    if not others:
        return 0
    zone = QgsGeometry.unaryUnion([o.buffer(distance, 4) for o in others])
    return geometry.intersection(zone).length() / (geometry.length() or 1)


def to_lambert(layer):
    transform = QgsCoordinateTransform(layer.crs(), CRS, QgsProject.instance())
    for f in layer.getFeatures():
        g = QgsGeometry(f.geometry())
        g.transform(transform)
        yield f, g


def prepare_vl(extent):
    """Built Voies Lyonnaises sections, with their position among the lines sharing the same street."""
    groups = {}
    for f, g in to_lambert(geojson_layer("vl-lines.geojson", "vl")):
        if g.boundingBox().intersects(extent):
            groups.setdefault(g.asWkt(1), (g, {}))[1][f["vl"]] = f["distance"] or 0

    layer = QgsVectorLayer("LineString?crs=EPSG:2154", "Sections réalisées", "memory")
    layer.dataProvider().addAttributes([
        QgsField("vl", QMetaType.Type.Int), QgsField("slot", QMetaType.Type.Int),
        QgsField("n", QMetaType.Type.Int), QgsField("distance", QMetaType.Type.Double)])
    layer.updateFields()
    features = []
    for g, lines in groups.values():
        for slot, (line, distance) in enumerate(sorted(lines.items())):
            feat = QgsFeature(layer.fields())
            feat.setGeometry(g)
            feat.setAttributes([line, slot, len(lines), distance])
            features.append(feat)
    layer.dataProvider().addFeatures(features)
    return layer


def prepare_cycleways(extent, vl):
    """OSM cycleways as they are drawn: one kind each, lanes hidden when they run along a better facility,
    duplicates removed, and lines without offset merged so dash patterns do not restart at every way."""
    items = []
    for f, g in to_lambert(geojson_layer("cycleways.geojson", "cycleways")):
        kind = cycleway_kind(f)
        if kind and g.boundingBox().intersects(extent):
            items.append({"geom": g, "kind": kind, "rank": KINDS.index(kind), "osm": f["osmId"],
                          "side": 0 if is_null(f["offset"]) else (f["offset"] > 0) - (f["offset"] < 0),
                          "oneway": None if is_null(f["oneway"]) else f["oneway"],
                          "name": None if is_null(f["name"]) else f["name"]})
    index = QgsSpatialIndex()
    for i, item in enumerate(items):
        index.addFeature(i, item["geom"].boundingBox())
    vl_lines = {f.id(): f.geometry() for f in vl.getFeatures()}
    vl_index = QgsSpatialIndex(vl.getFeatures())

    kept = []
    for i, item in enumerate(items):
        g = item["geom"]
        near = [items[j] for j in index.intersects(g.boundingBox().buffered(10))
                if j != i and items[j]["osm"] != item["osm"]]
        if covered(g, [o["geom"] for o in near if o["rank"] < item["rank"]], 10) >= 0.6:
            continue
        longer = [o["geom"] for o in near if o["kind"] == item["kind"] and o["geom"].length() > g.length()]
        # Two-way tracks closer than 12 m are the same facility mapped twice (or an old alignment).
        if covered(g, longer, 12 if item["kind"] == "piste2" else 6) >= 0.6:
            continue
        # Along a Voie Lyonnaise the track is drawn in the middle of its band.
        on_vl = covered(g, [vl_lines[j] for j in vl_index.intersects(g.boundingBox().buffered(12))], 12) >= 0.6
        offset = item["side"] * SIDE_OFFSET if item["kind"] in SIDE_KINDS and not on_vl else 0
        kept.append({**item, "offset": offset})

    kept = without_stubs(kept)
    contraflow_arrows(kept)

    layer = QgsVectorLayer("LineString?crs=EPSG:2154", "cycleways", "memory")
    layer.dataProvider().addAttributes([QgsField("kind", QMetaType.Type.QString),
                                        QgsField("offset", QMetaType.Type.Double),
                                        QgsField("reverse", QMetaType.Type.Int),
                                        QgsField("arrow", QMetaType.Type.Int),
                                        QgsField("line", QMetaType.Type.Int)])
    layer.updateFields()
    features = []

    def add(kind, offset, geometry, reverse=0, arrow=0, line=1):
        for part in geometry.asGeometryCollection():
            feat = QgsFeature(layer.fields())
            feat.setGeometry(part)
            feat.setAttributes([kind, offset, reverse, arrow, line])
            features.append(feat)

    # Contraflow lanes keep their direction (their arrows show it) and are not merged.
    for kind in KINDS:
        centred = [k["geom"] for k in kept if k["kind"] == kind and k["offset"] == 0 and kind != "dsc"]
        if centred:
            add(kind, 0.0, QgsGeometry.unaryUnion(centred).mergeLines())
        for k in kept:
            if k["kind"] == kind and (k["offset"] != 0 or kind == "dsc"):
                add(kind, k["offset"], k["geom"], int(k["oneway"] == "-1"), k.get("arrow", 0), k.get("line", 1))
    layer.dataProvider().addFeatures(features)
    print(f"cycleways: {len(items)} in the frame, {len(kept)} drawn, {len(features)} after merging")
    return save_layer(layer, OUT / "cycleways.fgb")


def without_stubs(kept, min_length=30, max_ring=200, gap=3, hook=35, free=10):
    """Drops the pieces of track that read as noise at this scale: isolated stubs under `min_length` m
    (both ends more than `gap` m from any other line), hooks under `hook` m (one end connected, the other
    more than `free` m from any line) and small closed rings."""
    index = QgsSpatialIndex()
    for i, k in enumerate(kept):
        feat = QgsFeature(i)
        feat.setGeometry(k["geom"])
        index.addFeature(feat)
    result = []
    for i, k in enumerate(kept):
        g = k["geom"]
        line = g.asPolyline() if not g.isMultipart() else [p for part in g.asMultiPolyline() for p in part]
        if len(line) >= 2 and line[0] == line[-1] and g.length() < max_ring:
            continue
        if g.length() < hook and len(line) >= 2:
            def nearest(point, reach):
                p = QgsGeometry.fromPointXY(point)
                return min((kept[j]["geom"].distance(p) for j in index.intersects(p.boundingBox().buffered(reach))
                            if j != i), default=math.inf)
            ends = sorted(nearest(point, free) for point in (line[0], line[-1]))
            if g.length() < min_length and ends[0] > gap:
                continue  # isolated
            if ends[0] <= gap and ends[1] > free:
                continue  # a hook hanging from another line
        result.append(k)
    print(f"stubs: {len(kept) - len(result)} pieces left out")
    return result


def contraflow_arrows(kept, min_length=70, spacing=6, same_street=25):
    """Chooses which contraflow lanes get an arrow: only one-way streets (an arrow on a two-way street
    would be wrong), the longest first, at least `spacing` mm from any other arrow and `same_street`
    mm from another arrow on the same street. A contraflow lane whose way also has a painted lane or
    a bus lane is not drawn as a line (the lane is), only its arrow."""
    u = unit()
    lanes = {k["osm"] for k in kept if k["kind"] in ("bande", "bus")}
    placed = []
    candidates = [k for k in kept if k["kind"] == "dsc"]
    for k in candidates:
        k["line"] = int(k["osm"] not in lanes)
        k["arrow"] = 0
    for k in sorted(candidates, key=lambda k: -k["geom"].length()):
        if k["oneway"] not in ("yes", "-1") or k["geom"].length() < min_length:
            continue
        centre = k["geom"].interpolate(k["geom"].length() / 2)
        if any(centre.distance(p) < spacing * u or (name and name == k["name"] and centre.distance(p) < same_street * u)
               for p, name in placed):
            continue
        k["arrow"] = 1
        placed.append((centre, k["name"]))
    print(f"contraflow arrows: {len(placed)} of {len(candidates)} lanes")


# --- cycling layers ----------------------------------------------------------------------------
VL_BAND = 2.6  # mm, width of the coloured band of the Voies Lyonnaises (split between shared lines)
# Opaque tints of the line colours (60 % over the land colour), so the cycle track on top stays readable.
VL_TINTS = [
    "#9cc697", "#ca9080", "#86ac9c", "#e7b492", "#cca7b8", "#859caf",
    "#a9d3c8", "#aea3bb", "#efc990", "#bfb58d", "#91cad9", "#e6c9ce",
]
VL_TINT_EXPRESSION = "CASE " + " ".join(f"WHEN \"vl\" = {i + 1} THEN '{c}'" for i, c in enumerate(VL_TINTS)) + " END"
GREENWAY = "#237a45"


def dsc_arrows(rendering_pass, size=3.2):
    """Two opposite arrows in the middle of the contraflow lanes chosen by contraflow_arrows: bikes
    against the traffic (dark blue), cars (light grey). The icon points along the line (OSM oneway=yes);
    lanes drawn the other way round (oneway=-1) flip it."""
    icon = QgsSvgMarkerSymbolLayer(str(ICONS / "dsc-arrows.svg"), size)
    icon.setSizeUnit(MM)
    icon.setDataDefinedProperty(QgsSymbolLayer.Property.Angle,
                                QgsProperty.fromExpression("CASE WHEN \"reverse\" = 1 THEN 180 ELSE 0 END"))
    arrows = QgsMarkerLineSymbolLayer(True)
    arrows.setPlacements(Qgis.MarkerLinePlacement.CentralPoint)
    arrows.setSubSymbol(QgsMarkerSymbol([icon]))
    arrows.setRenderingPass(rendering_pass)
    # coalesce: the legend sample has no feature and shows it.
    arrows.setDataDefinedProperty(QgsSymbolLayer.Property.LayerEnabled,
                                  QgsProperty.fromExpression("coalesce(\"arrow\", 1) = 1"))
    return arrows


DSC_LEGEND = ("Double sens cyclable|(flèche grise : sens des voitures,|flèche bleue : vélos à contresens)")


def contraflow_line():
    line = line_layer(CONTRAFLOW, 0.25, rendering_pass=0)
    line.setDataDefinedProperty(QgsSymbolLayer.Property.LayerEnabled,
                                QgsProperty.fromExpression("coalesce(\"line\", 1) = 1"))
    return line


def bike_layers(extent):
    vl_data = prepare_vl(extent)
    vl = save_layer(vl_data, OUT / "vl.fgb")
    band = line_layer(VL_TINTS[0], VL_BAND, cap="round")
    band.setDataDefinedProperty(QgsSymbolLayer.Property.StrokeColor, QgsProperty.fromExpression(VL_TINT_EXPRESSION))
    band.setDataDefinedProperty(QgsSymbolLayer.Property.StrokeWidth,
                                QgsProperty.fromExpression(f"{VL_BAND} / \"n\""))
    band.setDataDefinedProperty(QgsSymbolLayer.Property.Offset,
                                QgsProperty.fromExpression(f"(\"slot\" - (\"n\" - 1) / 2) * {VL_BAND} / \"n\""))
    band.setOffsetUnit(MM)
    # A thin line of the line colour in the middle of the band: hidden by the track where OSM maps one,
    # it keeps the band from looking empty where it does not.
    centre = line_layer(VL_COLORS[0], 0.35)
    centre.setDataDefinedProperty(QgsSymbolLayer.Property.StrokeColor, QgsProperty.fromExpression(VL_COLOR_EXPRESSION))
    centre.setDataDefinedProperty(QgsSymbolLayer.Property.Offset, QgsProperty.fromExpression(
        f"(\"slot\" - (\"n\" - 1) / 2) * {VL_BAND} / \"n\""))
    centre.setOffsetUnit(MM)
    vl.setRenderer(QgsSingleSymbolRenderer(line_symbol(band, centre)))

    cycleways = prepare_cycleways(extent, vl)
    side = "\"offset\""

    def kind_layer(title, kinds):
        layer = QgsVectorLayer(str(OUT / "cycleways.fgb"), title, "ogr")
        layer.setSubsetString(f"\"kind\" IN ({', '.join(repr(k) for k in kinds)})")
        return layer

    # Two layers, so that the legend shows them as two headings; separated infrastructure on top.
    separated = kind_layer("Séparés de la circulation", ["piste2", "piste", "vv", "vv_unpaved"])
    separated.setRenderer(rule_renderer([
        ("Piste cyclable bidirectionnelle", "\"kind\" = 'piste2'",
         line_symbol(line_layer(SEPARATED, 0.85, offset=side, rendering_pass=3))),
        ("Piste cyclable", "\"kind\" = 'piste'",
         line_symbol(line_layer(SEPARATED, 0.5, offset=side, rendering_pass=2))),
        ("Voie verte", "\"kind\" = 'vv'",
         line_symbol(line_layer(GREENWAY, 0.5, rendering_pass=1))),
        ("Voie verte non revêtue", "\"kind\" = 'vv_unpaved'",
         line_symbol(line_layer(GREENWAY, 0.45, dash=[0.9, 0.6], cap="butt", rendering_pass=0))),
    ], symbol_levels=True))

    shared = kind_layer("Partagés ou marqués au sol", ["pieton", "velorue", "bande", "bus", "dsc"])
    shared.setRenderer(rule_renderer([
        ("Zone piétonne ou allée de parc|(piétons prioritaires, vélos à allure réduite)", "\"kind\" = 'pieton'",
         line_symbol(line_layer(GREENWAY, 0.4, dash=[0.05, 0.7], rendering_pass=1))),
        ("Vélorue", "\"kind\" = 'velorue'", line_symbol(
            line_layer(PAINTED, 0.8, cap="butt", rendering_pass=3),
            line_layer("#ffffff", 0.22, dash=[0.8, 0.8], cap="butt", rendering_pass=4))),
        ("Bande cyclable", "\"kind\" = 'bande'",
         line_symbol(line_layer(PAINTED, 0.38, dash=[1.6, 0.6], cap="butt", offset=side, rendering_pass=2))),
        ("Couloir bus ouvert aux vélos", "\"kind\" = 'bus'",
         line_symbol(line_layer(PAINTED, 0.45, dash=[0.01, 0.9], offset=side, rendering_pass=1))),
        (DSC_LEGEND, "\"kind\" = 'dsc'", line_symbol(contraflow_line(), dsc_arrows(rendering_pass=4))),
    ], symbol_levels=True))

    parkings = geojson_layer("parkings.geojson", "Stationnement vélo")
    velostation = QgsSvgMarkerSymbolLayer(str(ICONS / "velostation.svg"), 5.5)
    velostation.setSizeUnit(MM)
    lpa = QgsSvgMarkerSymbolLayer(str(ICONS / "lpa.svg"), 4.0)
    lpa.setSizeUnit(MM)
    # "velostation": vélostations, TCL park-and-ride and railway station bike rooms; "lpa": bike rooms in
    # car parks, whatever their operator (LPA, Indigo, Q-Park, shopping centres…).
    parkings.setRenderer(rule_renderer([
        ("Vélostation, parc vélo en gare ou P+R TCL", "\"type\" = 'velostation'", QgsMarkerSymbol([velostation])),
        ("Espace vélo en parking public (LPA, Indigo…)", "\"type\" = 'lpa'", QgsMarkerSymbol([lpa])),
    ]))
    return vl, separated, shared, parkings, cycleways


SHIELD_SIZE = 5.2  # mm, diameter of a Voie Lyonnaise number
SHIELD_GAP = 0.5  # mm between the coloured band and the shield
SHIELD_STEP = 0.78  # distance between the centres of two shields of a group, in diameters
SHIELD_FONT, SHIELD_FONT_STYLE, SHIELD_DIGITS = FONT_CONDENSED, "Bold", 3.3
LIGHT_VL = {1, 4, 7, 9, 10, 11, 12}  # dark digits on these colours, white on the others


def vl_shield_layer(vl, cycleways, symbols, hidden=(), frame=None, min_length=350, repeat=1000):
    """Numbers of the Voies Lyonnaises, set beside the line rather than on it.

    Built sections of at least `min_length` metres get the numbers of the lines that use them
    (several numbers side by side on shared sections, in a row along the line), unless the same
    number is already shown less than `repeat` metres away. For each section, a few positions along
    it and on both sides are tried; the one crossing the fewest other cycle lines (above the line rather
    than below), and overlapping no other shield or point symbol (`symbols` layers), wins. Only the part of a section inside `frame`
    (the visible map, a little inside its edge) is used.
    """
    u = unit()
    radius = SHIELD_SIZE / 2 * u
    step = SHIELD_SIZE * SHIELD_STEP * u  # shields of a group overlap slightly
    away = (VL_BAND / 2 + SHIELD_GAP) * u + radius  # from the line to the shield centres

    groups = {}
    for f in vl.getFeatures():
        if (f["distance"] or 0) >= min_length:
            groups.setdefault(f.geometry().asWkt(1), (f.geometry(), set()))[1].add(f["vl"])

    # What a shield should not cover: other cycle lines (cost), point symbols (forbidden).
    line_geoms = {f.id(): f.geometry() for f in cycleways.getFeatures()}
    index = QgsSpatialIndex(cycleways.getFeatures())
    blocked = [g.buffer(2.5 * u, 8) for layer in symbols for _, g in to_lambert(layer)] + list(hidden)
    # A number does not go on the band of another line.
    bands = [(f["vl"], f.geometry().buffer(VL_BAND / 2 * u, 4)) for f in vl.getFeatures()]
    band_index = QgsSpatialIndex()
    for i, (_, band) in enumerate(bands):
        feat = QgsFeature(i)
        feat.setGeometry(band)
        band_index.addFeature(feat)

    placed = []  # (footprint, set of lines, centre)
    shields = []

    def candidates(g, numbers):
        length = g.length()
        for t in (0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9):
            a, b = g.interpolate(length * t - 15).asPoint(), g.interpolate(length * t + 15).asPoint()
            mid = g.interpolate(length * t).asPoint()
            dx, dy = b.x() - a.x(), b.y() - a.y()
            norm = (dx * dx + dy * dy) ** 0.5 or 1
            tx, ty = dx / norm, dy / norm
            for side in (1, -1):
                cx, cy = mid.x() - side * ty * away, mid.y() + side * tx * away
                centres = [(cx + (i - (len(numbers) - 1) / 2) * step * tx, cy + (i - (len(numbers) - 1) / 2) * step * ty)
                           for i in range(len(numbers))]
                # Reading order: left to right, or top to bottom along a mostly vertical line.
                centres.sort(key=(lambda c: c[0]) if abs(tx) >= abs(ty) else (lambda c: -c[1]))
                # Above the line reads better (the numbers, then the bands they refer to): a group below
                # a mostly horizontal line costs a little more.
                below = 0.7 * abs(tx) if cy < mid.y() else 0
                yield abs(t - 0.5), below, centres

    visible = QgsGeometry.fromRect(frame) if frame else None
    for g, numbers in sorted(groups.values(), key=lambda item: -item[0].length()):
        if visible:
            g = g.intersection(visible)
            parts = [part for part in g.asGeometryCollection() if part.type() == Qgis.GeometryType.Line]
            if not parts:
                continue
            g = max(parts, key=lambda part: part.length())
            if g.length() < 60:
                continue
        mid = g.interpolate(g.length() / 2)
        numbers = sorted(n for n in numbers if not any(
            n in shown and mid.distance(centre) < repeat for _, shown, centre in placed))
        if not numbers:
            continue
        best = None
        for shift, below, centres in candidates(g, numbers):
            footprint = QgsGeometry.unaryUnion(
                [QgsGeometry.fromPointXY(QgsPointXY(x, y)).buffer(radius + SHIELD_GAP * u, 12) for x, y in centres])
            if any(footprint.intersects(other) for other, _, _ in placed) or any(
                    footprint.intersects(b) for b in blocked) or any(
                    bands[i][0] not in numbers and footprint.intersects(bands[i][1])
                    for i in band_index.intersects(footprint.boundingBox())):
                continue
            crossed = sum(1 for i in index.intersects(footprint.boundingBox()) if footprint.intersects(line_geoms[i]))
            cost = crossed + shift * 4 + below
            if best is None or cost < best[0]:
                best = (cost, centres, footprint)
        if best:
            placed.append((best[2], set(numbers), mid))
            shields.extend((n, slot, QgsPointXY(*centre)) for slot, (n, centre) in enumerate(zip(numbers, best[1])))

    layer = QgsVectorLayer("Point?crs=EPSG:2154", "Numéro de la ligne", "memory")
    layer.dataProvider().addAttributes([QgsField("vl", QMetaType.Type.Int), QgsField("slot", QMetaType.Type.Int)])
    layer.updateFields()
    features = []
    for n, slot, point in shields:
        feat = QgsFeature(layer.fields())
        feat.setGeometry(QgsGeometry.fromPointXY(point))
        feat.setAttributes([n, slot])
        features.append(feat)
    layer.dataProvider().addFeatures(features)

    circle = QgsSimpleMarkerSymbolLayer(Qgis.MarkerShape.Circle, SHIELD_SIZE)
    circle.setSizeUnit(MM)
    circle.setColor(QColor(VL_COLORS[0]))
    circle.setDataDefinedProperty(QgsSymbolLayer.Property.FillColor, QgsProperty.fromExpression(VL_COLOR_EXPRESSION))
    circle.setStrokeColor(QColor("#ffffff"))
    circle.setStrokeWidth(0.5)
    circle.setStrokeWidthUnit(MM)
    digits = QgsFontMarkerSymbolLayer(SHIELD_FONT, "1", SHIELD_DIGITS, QColor("#1f2a33"))
    digits.setFontStyle(SHIELD_FONT_STYLE)
    digits.setSizeUnit(MM)
    digits.setStrokeWidth(0)
    digits.setDataDefinedProperty(QgsSymbolLayer.Property.Character, QgsProperty.fromExpression("to_string(\"vl\")"))
    light = ", ".join(str(n) for n in sorted(LIGHT_VL))
    digits.setDataDefinedProperty(QgsSymbolLayer.Property.FillColor, QgsProperty.fromExpression(
        f"CASE WHEN \"vl\" IN ({light}) THEN '#1f2a33' ELSE '#ffffff' END"))
    # The font marker centres the text on half its ascent, which leaves digits low: lift them.
    lift = -0.146 * SHIELD_DIGITS
    digits.setDataDefinedProperty(QgsSymbolLayer.Property.Offset, QgsProperty.fromExpression(
        f"CASE WHEN \"vl\" = 1 THEN '0.2,{lift:.2f}' ELSE '0,{lift:.2f}' END"))
    digits.setOffset(QPointF(0.2, lift))  # what the legend sample, which has no feature, shows: a "1"
    digits.setOffsetUnit(MM)
    renderer = QgsSingleSymbolRenderer(QgsMarkerSymbol([circle, digits]))
    # In a group, each shield is drawn over the previous one, so the overlaps read left to right.
    renderer.setOrderBy(QgsFeatureRequest.OrderBy([QgsFeatureRequest.OrderByClause("slot", True)]))
    renderer.setOrderByEnabled(True)
    layer.setRenderer(renderer)
    block_labels(layer)
    return save_layer(layer, OUT / "vl-shields.fgb")


def block_labels(layer, factor=2):
    """The layer draws no label but keeps the labels of other layers off its symbols. With a factor
    under 1 it only costs them, they can still go over it when there is no better place."""
    s = QgsPalLayerSettings()
    s.drawLabels = False
    s.fieldName = "1"
    s.isExpression = True
    s.obstacleSettings().setIsObstacle(True)
    s.obstacleSettings().setFactor(factor)
    layer.setLabeling(QgsVectorLayerSimpleLabeling(s))
    layer.setLabelsEnabled(True)


ARRONDISSEMENT_COLOR = "#d8d0c3"  # a little darker than the buildings, still a background texture


def arrondissement_layer():
    """Big pale arrondissement numbers at the visual centre of each arrondissement (the point furthest
    from its edges), drawn under the network like a background texture, with a smaller raised "e"."""
    rows = []
    for f, g in to_lambert(geojson_layer("arrondissements.geojson", "arrondissements")):
        number = int(re.search(r"(\d+)", f["nom"]).group(1))
        centre = g.poleOfInaccessibility(10)[0].asPoint()
        rows.append((centre, [str(number), "er" if number == 1 else "e"]))
    layer = QgsVectorLayer("Point?crs=EPSG:2154", "Arrondissements", "memory")
    layer.dataProvider().addAttributes([QgsField("number", QMetaType.Type.QString),
                                        QgsField("suffix", QMetaType.Type.QString)])
    layer.updateFields()
    features = []
    for point, attributes in rows:
        feat = QgsFeature(layer.fields())
        feat.setGeometry(QgsGeometry.fromPointXY(point))
        feat.setAttributes(attributes)
        features.append(feat)
    layer.dataProvider().addFeatures(features)

    size = 15  # mm
    number = QgsFontMarkerSymbolLayer(FONT, "1", size, QColor(ARRONDISSEMENT_COLOR))
    number.setFontStyle("Bold")
    number.setSizeUnit(MM)
    number.setStrokeWidth(0)
    number.setDataDefinedProperty(QgsSymbolLayer.Property.Character, QgsProperty.fromField("number"))
    number.setOffset(QPointF(-1.5, -0.146 * size))
    number.setOffsetUnit(MM)
    suffix = QgsFontMarkerSymbolLayer(FONT, "e", size * 0.45, QColor(ARRONDISSEMENT_COLOR))
    suffix.setFontStyle("Bold")
    suffix.setSizeUnit(MM)
    suffix.setStrokeWidth(0)
    suffix.setDataDefinedProperty(QgsSymbolLayer.Property.Character, QgsProperty.fromField("suffix"))
    suffix.setDataDefinedProperty(QgsSymbolLayer.Property.Offset, QgsProperty.fromExpression(
        f"CASE WHEN \"suffix\" = 'er' THEN '{0.27 * size:.2f},{-0.3 * size:.2f}' "
        f"ELSE '{0.25 * size:.2f},{-0.3 * size:.2f}' END"))
    suffix.setOffsetUnit(MM)
    layer.setRenderer(QgsSingleSymbolRenderer(QgsMarkerSymbol([number, suffix])))
    return save_layer(layer, OUT / "arrondissements.fgb")


# --- stations and landmarks ----------------------------------------------------------------------
TRANSIT = ROOT / "transit.json"  # from cyclopolis: TCL metro stations and OSM railway stations
LANDMARKS = ROOT / "landmarks.json"
SVG_LIBRARY = _resources / "svg"
# Funicular stations are tagged as railway stations in OSM: their line, and a name where it is missing.
FUNICULARS = {"Saint-Just": ("F1", "Saint-Just"), "Minimes - Théâtres romains": ("F1", "Minimes"),
              "Fourvière": ("F2", "Fourvière")}
EXTRA_LINES = {"Vieux Lyon": ["F1", "F2"]}  # metro stations that are also funicular stations
# Main railway stations, named like on the official plan.
TRAIN_NAMES = {"Lyon Part-Dieu": "Gare Part-Dieu", "Lyon-Perrache": "Gare de Perrache",
               "Lyon-Saint-Paul": "Gare Saint-Paul", "Lyon Jean Macé": "Gare Jean-Macé", "Lyon Vaise": "Gare de Vaise"}
FUNICULAR_COLOR = "#8a8f98"
STATION_SIZE = 3.4  # mm, side of a metro square
STATION_TEXT = "#1f2937"
LANDMARK_COLOR = "#6b5d4f"
LANDMARK_ICONS = {
    "church": ("religion/place_of_worship_christian3.svg", "Édifice religieux"),
    "monument": ("tourist/tourist_monument.svg", "Monument"),
    "museum": ("tourist/tourist_museum.svg", "Musée"),
    "theatre": ("tourist/tourist_theatre.svg", "Salle de spectacle"),
    "shop": ("shopping/shopping_supermarket.svg", "Halles, centre commercial"),
    "zoo": ("tourist/tourist_zoo.svg", "Zoo"),
    "stadium": ("sport/sport_soccer.svg", "Stade, salle de sport"),
    "hospital": (ICONS / "hospital.svg", "Hôpital"),  # an H, not a cross that reads like a church
    "university": ("symbol/education_university.svg", "Université"),
}


def normalise(name):
    """Compares place names: 'La Croix-Rousse', 'Croix Rousse' and 'Gare de la Croix-Rousse' are the same."""
    name = unicodedata.normalize("NFKD", name.lower()).encode("ascii", "ignore").decode()
    name = re.sub(r"[-'’\s]+", " ", name).strip()
    return re.sub(r"^(gare (de |d )?)?(la |le |les |l )?", "", name)


def point_layer(name, geometry_fields, rows):
    """Memory point layer in Lambert-93 from (lon, lat, attributes) rows."""
    layer = QgsVectorLayer("Point?crs=EPSG:2154", name, "memory")
    layer.dataProvider().addAttributes([QgsField(n, t) for n, t in geometry_fields])
    layer.updateFields()
    to_l93 = QgsCoordinateTransform(QgsCoordinateReferenceSystem("EPSG:4326"), CRS, QgsProject.instance())
    features = []
    for lon, lat, attributes in rows:
        feat = QgsFeature(layer.fields())
        feat.setGeometry(QgsGeometry.fromPointXY(to_l93.transform(QgsPointXY(lon, lat))))
        feat.setAttributes(attributes)
        features.append(feat)
    layer.dataProvider().addFeatures(features)
    return layer


def place_labels(s, priority, first="MiddleRight"):
    """Labels next to their symbol (measured from its edge, interchange squares included), at the first
    free position of a fixed order, moved up to 2.5 mm further away when crowded."""
    P = Qgis.LabelPredefinedPointPosition
    order = ["MiddleRight", "MiddleLeft", "TopRight", "BottomRight", "TopLeft", "BottomLeft", "TopMiddle",
             "BottomMiddle"]
    order.remove(first)
    s.placement = Qgis.LabelPlacement.OrderedPositionsAroundPoint
    s.pointSettings().setPredefinedPositionOrder([getattr(P, name) for name in [first, *order]])
    s.pointSettings().setMaximumDistance(2.5)
    s.pointSettings().setMaximumDistanceUnit(MM)
    s.dist = 0.6
    s.distUnits = MM
    s.offsetType = Qgis.LabelOffsetType.FromSymbolBounds
    s.priority = priority
    s.obstacleSettings().setIsObstacle(True)
    s.obstacleSettings().setFactor(2)


def two_lines(name, longer_than=18):
    """The name with a "|" line break at the space closest to its middle, when it is long."""
    spaces = [i for i, c in enumerate(name) if c == " "]
    if len(name) <= longer_than or not spaces:
        return name
    cut = min(spaces, key=lambda i: abs(i - len(name) / 2))
    return name[:cut] + "|" + name[cut + 1:]


TRAM_COLORS = {  # TCL colours, from the tcllignetram dataset
    "T1": "#004f9f", "T2": "#6ba230", "T3": "#00a3a6", "T4": "#662483", "T5": "#ec6608", "T6": "#f191a3",
    "T7": "#992358",
}


def main_tram_stops(stations):
    """Tram stops worth showing on a city plan: line ends, stops served by three lines or more, and
    connections with a metro or railway station. Platforms are grouped by stop name. A stop keeps
    its symbol but not its name when a metro or railway station is close by."""
    to_l93 = QgsCoordinateTransform(QgsCoordinateReferenceSystem("EPSG:4326"), CRS, QgsProject.instance())
    groups = {}
    for f, g in to_lambert(geojson_layer("tram-stops.geojson", "tram")):
        group = groups.setdefault(f["nom"], {"points": [], "lines": set()})
        group["points"].append(g.asPoint())
        group["lines"] |= set(f["lignes"].split(","))
    ends = []
    for _, g in to_lambert(geojson_layer("tram-lines.geojson", "tram lines")):
        for part in g.asGeometryCollection():
            line = part.asPolyline()
            ends += [QgsGeometry.fromPointXY(line[0]), QgsGeometry.fromPointXY(line[-1])]
    for name, group in groups.items():
        points = group["points"]
        centre = QgsPointXY(sum(p.x() for p in points) / len(points), sum(p.y() for p in points) / len(points))
        point = QgsGeometry.fromPointXY(centre)
        near_station = any(point.distance(s) < 250 for s in stations)
        is_end = any(point.distance(e) < 150 for e in ends)
        if not (near_station or is_end or len(group["lines"]) >= 3):
            continue
        label = "" if near_station else name
        lonlat = to_l93.transform(centre, Qgis.TransformDirection.Reverse)
        yield lonlat.x(), lonlat.y(), label, sorted(group["lines"], key=lambda line: int(line[1:]))


def square_symbol(colors, sample_line, sample_color):
    """Up to three squares side by side, each in the colour of a line and with its name (A, T1…).
    `sample_line` and `sample_color` are what the legend shows, as it has no feature."""
    layers = []
    for i in range(3):
        field = f"l{i + 1}"
        x = f"({i} - (\"n\" - 1) / 2) * {STATION_SIZE}"
        size = f"CASE WHEN length(\"{field}\") > 1 THEN 2.1 ELSE 2.6 END"
        square = QgsSimpleMarkerSymbolLayer(Qgis.MarkerShape.RoundedSquare, STATION_SIZE)
        square.setSizeUnit(MM)
        square.setColor(QColor(sample_color))
        square.setStrokeColor(QColor("#ffffff"))
        square.setStrokeWidth(0.35)
        square.setStrokeWidthUnit(MM)
        square.setDataDefinedProperty(QgsSymbolLayer.Property.FillColor, QgsProperty.fromExpression(
            "CASE " + " ".join(f"WHEN \"{field}\" = '{k}' THEN '{v}'" for k, v in colors.items()) + " END"))
        square.setDataDefinedProperty(QgsSymbolLayer.Property.Offset, QgsProperty.fromExpression(f"array({x}, 0)"))
        square.setOffsetUnit(MM)
        sample_size = 2.1 if len(sample_line) > 1 else 2.6
        letter = QgsFontMarkerSymbolLayer(FONT_CONDENSED, sample_line, sample_size, QColor("#ffffff"))
        # Dark letters on the light pink T6.
        letter.setDataDefinedProperty(QgsSymbolLayer.Property.FillColor, QgsProperty.fromExpression(
            f"CASE WHEN \"{field}\" IN ('T6') THEN '#1f2a33' ELSE '#ffffff' END"))
        letter.setFontStyle("Bold")
        letter.setSizeUnit(MM)
        letter.setStrokeWidth(0)
        letter.setDataDefinedProperty(QgsSymbolLayer.Property.Character, QgsProperty.fromExpression(f"\"{field}\""))
        letter.setDataDefinedProperty(QgsSymbolLayer.Property.Size, QgsProperty.fromExpression(size))
        # The font marker centres text on half its ascent, which leaves it low: lift it.
        letter.setDataDefinedProperty(QgsSymbolLayer.Property.Offset,
                                      QgsProperty.fromExpression(f"array({x}, -0.146 * ({size}))"))
        letter.setOffset(QPointF(0, -0.146 * sample_size))
        letter.setOffsetUnit(MM)
        if i > 0:
            for sl in (square, letter):
                sl.setDataDefinedProperty(QgsSymbolLayer.Property.LayerEnabled,
                                          QgsProperty.fromExpression(f"\"n\" > {i}"))
        layers += [square, letter]
    return QgsMarkerSymbol(layers)


def station_layer():
    """Metro stations and main tram stops as squares of their line colour with the line name (side by
    side at interchanges), railway stations with a train pictogram. Stations keep their names, which
    people use more than quarter names: a quarter of the same name is not labelled (see label_layers)."""
    data = json.loads(TRANSIT.read_text())
    colors = {**data["lineColors"], "F1": FUNICULAR_COLOR, "F2": FUNICULAR_COLOR, **TRAM_COLORS}
    to_l93 = QgsCoordinateTransform(QgsCoordinateReferenceSystem("EPSG:4326"), CRS, QgsProject.instance())

    def row(lon, lat, label, kind, lines):
        return lon, lat, [label, kind, *(lines + ["", "", ""])[:3], len(lines)]

    rows, points = [], []
    stations = []
    for s in data["metroStations"]:
        stations.append((s["coordinates"], s["label"], "metro", s["lines"] + EXTRA_LINES.get(s["station"], [])))
    for s in data["trainStations"]:
        if s["station"] in FUNICULARS:
            line, name = FUNICULARS[s["station"]]
            stations.append((s["coordinates"], name, "metro", [line]))
        else:
            stations.append((s["coordinates"], TRAIN_NAMES.get(s["station"], s["label"]), "train", []))
    # A metro station next to a named railway station is not labelled again (Perrache).
    trains = [QgsGeometry.fromPointXY(to_l93.transform(QgsPointXY(*c)))
              for c, name, kind, _ in stations if kind == "train" and name]
    for (lon, lat), name, kind, lines in stations:
        point = QgsGeometry.fromPointXY(to_l93.transform(QgsPointXY(lon, lat)))
        points.append(point)
        if kind == "metro" and any(point.distance(t) < 300 for t in trains):
            name = ""
        rows.append(row(lon, lat, name, kind, lines))
    # A tram stop that would cover a station's squares is moved just below (or above) them.
    u = unit()
    station_rows = [(QgsGeometry.fromPointXY(to_l93.transform(QgsPointXY(r[0], r[1]))), r[2][-1]) for r in rows]
    to_wgs = QgsCoordinateTransform(CRS, QgsCoordinateReferenceSystem("EPSG:4326"), QgsProject.instance())
    for lon, lat, label, lines in main_tram_stops(points):
        p = to_l93.transform(QgsPointXY(lon, lat))
        for g, n in station_rows:
            q = g.asPoint()
            half_widths = (STATION_SIZE * (max(n, 1) + len(lines)) / 2 + 0.8) * u
            if abs(p.x() - q.x()) < half_widths and abs(p.y() - q.y()) < (STATION_SIZE + 0.8) * u:
                side = 1 if p.y() >= q.y() else -1
                p = QgsPointXY(p.x(), q.y() + side * (STATION_SIZE + 0.8) * u)
        moved = to_wgs.transform(p)
        rows.append(row(moved.x(), moved.y(), label, "tram", lines))
    # Navigône stops, the TCL river shuttle on the Saône (bikes allowed on board).
    for f in geojson_layer("navigone-stops.geojson", "Navigône").getFeatures():
        point = f.geometry().asPoint()
        name = f["nom"].replace(" - ", " – ").replace("'", "’").replace("’Î", "’î")
        rows.append(row(point.x(), point.y(), name, "boat", []))
    layer = point_layer("Transports", [
        ("name", QMetaType.Type.QString), ("kind", QMetaType.Type.QString), ("l1", QMetaType.Type.QString),
        ("l2", QMetaType.Type.QString), ("l3", QMetaType.Type.QString), ("n", QMetaType.Type.Int)], rows)

    train = QgsSvgMarkerSymbolLayer(str(ICONS / "train.svg"), 3.8)
    train.setSizeUnit(MM)
    boat = QgsSvgMarkerSymbolLayer(str(ICONS / "navigone.svg"), 3.6)
    boat.setSizeUnit(MM)
    layer.setRenderer(rule_renderer([
        ("Station de métro ou de funiculaire (ligne)", "\"kind\" = 'metro'",
         square_symbol(colors, "A", data["lineColors"]["A"])),
        ("Arrêt de tramway principal (ligne)", "\"kind\" = 'tram'", square_symbol(colors, "T1", TRAM_COLORS["T1"])),
        ("Gare", "\"kind\" = 'train'", QgsMarkerSymbol([train])),
        ("Arrêt de la navette fluviale Navigône (vélos admis)", "\"kind\" = 'boat'", QgsMarkerSymbol([boat])),
    ]))
    def station_labels(s):
        place_labels(s, priority=9)
        props = s.dataDefinedProperties()
        # Never above 9: from priority 10 QGIS lets a label cover the symbols of the other layers.
        props.setProperty(QgsPalLayerSettings.Property.Priority, QgsProperty.fromExpression(
            "CASE WHEN \"kind\" = 'train' THEN 9 WHEN \"kind\" = 'boat' THEN 7 ELSE 8 END"))
        # River shuttle stops: smaller, in the colour of the line.
        props.setProperty(QgsPalLayerSettings.Property.Color, QgsProperty.fromExpression(
            f"CASE WHEN \"kind\" = 'boat' THEN '{NAVIGONE_TEXT}' ELSE '{INK}' END"))
        props.setProperty(QgsPalLayerSettings.Property.Size, QgsProperty.fromExpression(
            "CASE WHEN \"kind\" = 'boat' THEN 7.5 ELSE 8.5 END"))
        # Main railway stations sit in crowded spots: their name may go up to 8 mm from the pictogram.
        props.setProperty(QgsPalLayerSettings.Property.MaximumDistance,
                          QgsProperty.fromExpression("CASE WHEN \"kind\" = 'train' THEN 8 ELSE 2.5 END"))

    # Navy and not condensed, so that station names do not read like street names.
    set_labels(layer, "name", text_format(8.5, INK, style="Demi Bold", buffer=0.4),
               Qgis.LabelPlacement.AroundPoint, extra=station_labels)
    return save_layer(layer, OUT / "stations.fgb")


SERVICE_COLOR = "#166534"
NAVIGONE_COLOR = "#00a3a6"  # TCL colour of the river shuttle (tcllignefluv)
NAVIGONE_TEXT = "#00777a"


def navigone_route_layer():
    """The route of the Navigône shuttle on the Saône, dashed. The dataset has one trace per direction:
    one without a turning loop is drawn (the most detailed of them)."""
    source = geojson_layer("navigone-route.geojson", "navigone")
    best = max(to_lambert(source), key=lambda item: (item[1].isSimple(), item[1].constGet().nCoordinates()))
    layer = QgsVectorLayer("LineString?crs=EPSG:2154", "Navette fluviale Navigône", "memory")
    feat = QgsFeature()
    feat.setGeometry(best[1])
    layer.dataProvider().addFeatures([feat])
    layer.setRenderer(QgsSingleSymbolRenderer(line_symbol(
        line_layer(NAVIGONE_COLOR, 0.45, dash=[2.2, 1.2], cap="butt", opacity=0.85))))
    return layer


def service_layer(merge=70):
    """Self-service pumps (Métropole de Lyon) and repair stands (OpenStreetMap). Two of them closer than
    `merge` metres read as one place (often the same equipment in both sources): only the first is drawn,
    pumps of the Métropole first."""
    pumps = [g for _, g in to_lambert(geojson_layer("pumps.geojson", "pumps"))]
    repairs = [g for _, g in to_lambert(geojson_layer("repair-stations.geojson", "repair"))]
    kept = []
    for g in pumps + repairs:
        if all(g.distance(k) > merge for k in kept):
            kept.append(g)
    layer = QgsVectorLayer("Point?crs=EPSG:2154", "Pompe ou station de réparation en libre-service", "memory")
    features = []
    for g in kept:
        feat = QgsFeature()
        feat.setGeometry(g)
        features.append(feat)
    layer.dataProvider().addFeatures(features)
    icon = QgsSvgMarkerSymbolLayer(str(ICONS / "pump.svg"), 3.6)
    icon.setSizeUnit(MM)
    layer.setRenderer(QgsSingleSymbolRenderer(QgsMarkerSymbol([icon])))
    print(f"services: {len(kept)} drawn of {len(pumps)} pumps and {len(repairs)} repair stands")
    return save_layer(layer, OUT / "services.fgb")


def landmark_layer(stations):
    """Landmarks with a pictogram. A landmark next to a station of the same name (Hôtel de Ville) keeps its
    pictogram but not its name."""
    data = json.loads(LANDMARKS.read_text())
    named = [(normalise(f["name"]), g) for f, g in to_lambert(stations) if f["name"]]
    to_l93 = QgsCoordinateTransform(QgsCoordinateReferenceSystem("EPSG:4326"), CRS, QgsProject.instance())
    rows = []
    for l in data["landmarks"]:
        point = QgsGeometry.fromPointXY(to_l93.transform(QgsPointXY(*l["coordinates"])))
        repeated = any(n == normalise(l["label"]) and point.distance(g) < 300 for n, g in named)
        rows.append((*l["coordinates"], ["" if repeated else two_lines(l["label"].replace("'", "’")), l["type"]]))
    layer = point_layer("Lieux remarquables", [("name", QMetaType.Type.QString), ("type", QMetaType.Type.QString)], rows)
    rules = []
    for kind, (icon, title) in LANDMARK_ICONS.items():
        svg = QgsSvgMarkerSymbolLayer(str(SVG_LIBRARY / icon), 3.6)
        svg.setSizeUnit(MM)
        svg.setFillColor(QColor(LANDMARK_COLOR))
        svg.setStrokeColor(QColor(LANDMARK_COLOR))
        svg.setStrokeWidth(0)
        # A pale disc under the pictogram, so it does not blend into the buildings and lanes.
        halo = QgsSimpleMarkerSymbolLayer(Qgis.MarkerShape.Circle, 4.6)
        halo.setSizeUnit(MM)
        halo.setColor(QColor(255, 255, 255, 217))
        halo.setStrokeStyle(Qt.PenStyle.NoPen)
        rules.append((title, f"\"type\" = '{kind}'", QgsMarkerSymbol([halo, svg])))
    layer.setRenderer(rule_renderer(rules))
    set_labels(layer, "name", text_format(7, LANDMARK_COLOR, family=FONT_CONDENSED, style="Demi Bold Italic",
                                          buffer=0.35),
               Qgis.LabelPlacement.AroundPoint,
               extra=landmark_labels)
    return save_layer(layer, OUT / "landmarks.fgb")


def landmark_labels(s):
    place_labels(s, priority=8, first="TopRight")
    s.wrapChar = "|"
    s.multilineAlign = Qgis.LabelMultiLineAlignment.FollowPlacement


VELOV = ROOT.parent / "src/lib/data/velov-data-grand-lyon.json"  # the static file the web map uses
VELOV_COLOR = "#d6202a"


def velov_layer():
    """Vélo'v stations as small red dots, without names: there are too many to label."""
    layer = QgsVectorLayer(str(VELOV), "Station Vélo’v", "ogr")
    layer.setSubsetString("\"ouverte\" = 1")
    assert layer.isValid(), VELOV
    dot = QgsSimpleMarkerSymbolLayer(Qgis.MarkerShape.Circle, 1.4)
    dot.setSizeUnit(MM)
    dot.setColor(QColor(VELOV_COLOR))
    dot.setStrokeColor(QColor("#ffffff"))
    dot.setStrokeWidth(0.25)
    dot.setStrokeWidthUnit(MM)
    layer.setRenderer(QgsSingleSymbolRenderer(QgsMarkerSymbol([dot])))
    return layer


# --- decluttering ------------------------------------------------------------------------------
def declutter(fixed, movable, cycleways, water, gap=0.8):
    """Moves point symbols that would cover a more important one.

    `fixed`: [(point, radius in mm)] that stay where they are (stations, VL numbers).
    `movable`: [(layer, radius in mm or function of the feature, output file)], most important first.
    A symbol overlapping one already placed is moved next to it, in the direction that frees it and
    crosses the fewest cycle lines, out of the `water` polygons when it can. Returns the new layers
    (geometries moved, so labels follow)."""
    u = unit()
    lines = {f.id(): f.geometry() for f in cycleways.getFeatures()}
    index = QgsSpatialIndex(cycleways.getFeatures())
    placed = [(QgsGeometry(g), r) for g, r in fixed]
    water_geoms = {}
    water_index = QgsSpatialIndex()
    for i, (_, g) in enumerate(to_lambert(water)):
        feat = QgsFeature(i)
        feat.setGeometry(g)
        water_index.addFeature(feat)
        water_geoms[i] = g

    def in_water(point):
        return any(water_geoms[i].contains(point) for i in water_index.intersects(point.boundingBox()))

    def free(point, radius):
        return all(point.distance(g) >= (radius + r + gap) * u for g, r in placed)

    def crossings(point, radius):
        zone = point.buffer(radius * u, 8)
        return sum(1 for i in index.intersects(zone.boundingBox()) if zone.intersects(lines[i]))

    result, moved = [], 0
    for layer, radius_of, path in movable:
        out = QgsVectorLayer("Point?crs=EPSG:2154", layer.name(), "memory")
        out.dataProvider().addAttributes(layer.fields().toList())
        out.updateFields()
        features = []
        for f, g in to_lambert(layer):
            radius = radius_of(f) if callable(radius_of) else radius_of
            if not free(g, radius):
                p = g.asPoint()
                others = [r for h, r in placed if g.distance(h) < (radius + r + gap) * u]
                step = (radius + max(others) + gap) * u
                options = []
                for k in range(8):
                    angle = math.pi / 4 * k
                    candidate = QgsGeometry.fromPointXY(QgsPointXY(p.x() + step * math.cos(angle),
                                                                   p.y() + step * math.sin(angle)))
                    if free(candidate, radius):
                        options.append((crossings(candidate, radius) + 3 * in_water(candidate), k, candidate))
                if options:
                    g = min(options, key=lambda o: o[:2])[2]
                    moved += 1
            placed.append((g, radius))
            feat = QgsFeature(out.fields())
            feat.setGeometry(g)
            feat.setAttributes(f.attributes())
            features.append(feat)
        out.dataProvider().addFeatures(features)
        out.setRenderer(layer.renderer().clone())
        if layer.labeling():
            out.setLabeling(layer.labeling().clone())
            out.setLabelsEnabled(layer.labelsEnabled())
        result.append(save_layer(out, path))
    print(f"declutter: {moved} symbols moved")
    return result


# --- labels ------------------------------------------------------------------------------------
TOWN_POSITIONS = {"Villeurbanne": (846450, 6519850)}
GENERIC_PLACES = "('Gare','Centre','Église','Le bourg','Le Bourg','Le Village')"
STREET_ABBREVIATIONS = [
    ("Boulevard", "Bd"), ("Avenue", "Av."), ("Lieutenant", "Lt"), ("Colonel", "Col."), ("Commandant", "Cdt"),
    ("Capitaine", "Cne"), ("Général", "Gal"), ("Maréchal", "Mal"), ("Président", "Pdt"), ("Docteur", "Dr"),
    ("Professeur", "Pr"),
]


def around_point(s):
    s.dist = 0
    s.distUnits = MM


def clean_name(name):
    """Street and place names as printed: titles shortened (never Saint), first letter capitalised,
    en dash between two names."""
    for word, abbreviation in STREET_ABBREVIATIONS:
        name = re.sub(rf"\b{word}\b", abbreviation, name)
    name = name.replace(" - ", " – ").replace("Berges du Rhone", "Berges du Rhône").replace("'", "’")
    return name[:1].upper() + name[1:]


def share_near(geometry, others, distance, step=8):
    """Approximately the share of `geometry` within `distance` m of `others`, from points every `step` m
    (much faster than covered() on many features)."""
    length = geometry.length()
    n = max(2, int(length / step))
    points = [geometry.interpolate(length * k / n) for k in range(n + 1)]
    return sum(any(o.distance(p) <= distance for o in others) for p in points) / len(points)


def street_name_layer(extent, vl, cycleways):
    """The street names to print, with the distance (`clear`, mm) at which they go from their street so
    as not to cover the cycle network: beside a Voie Lyonnaise band, or a track or lane.

    Left out: motorway junctions, ramps, tunnels (also streets mostly in a tunnel), toll lanes, and
    names that are lists."""
    names = basemap_layer(
        "transportation_name",
        "\"name\" IS NOT NULL AND (\"class\" IN ('primary','secondary','trunk','tertiary','minor','busway') "
        "OR (\"class\" = 'path' AND (\"subclass\" = 'pedestrian' OR \"name\" LIKE 'Berge%'))) "
        "AND (\"subclass\" IS NULL OR \"subclass\" <> 'junction') AND \"name\" NOT LIKE '%;%' "
        "AND \"name\" NOT LIKE 'Bretelle%' AND \"name\" NOT LIKE 'Trémie%' AND \"name\" NOT LIKE 'Tunnel%' "
        "AND \"name\" NOT LIKE 'Voie de Télépéage%'")
    tunnels = basemap_layer("transportation", "\"brunnel\" = 'tunnel'")
    tunnel_geoms = [f.geometry() for f in tunnels.getFeatures() if f.geometry().boundingBox().intersects(extent)]
    tunnel_index = QgsSpatialIndex()
    for i, g in enumerate(tunnel_geoms):
        feat = QgsFeature(i)
        feat.setGeometry(g)
        tunnel_index.addFeature(feat)
    vl_geoms = {f.id(): f.geometry() for f in vl.getFeatures()}
    vl_index = QgsSpatialIndex(vl.getFeatures())
    tracks = {f.id(): f.geometry() for f in cycleways.getFeatures()
              if f["kind"] in ("piste2", "piste", "vv", "vv_unpaved", "bande", "bus")}
    track_index = QgsSpatialIndex()
    for i, g in tracks.items():
        feat = QgsFeature(i)
        feat.setGeometry(g)
        track_index.addFeature(feat)

    out = QgsVectorLayer("MultiLineString?crs=EPSG:2154", "Noms des rues", "memory")
    out.dataProvider().addAttributes([QgsField("name", QMetaType.Type.QString), QgsField("class", QMetaType.Type.QString),
                                      QgsField("subclass", QMetaType.Type.QString), QgsField("clear", QMetaType.Type.Double),
                                      QgsField("length", QMetaType.Type.Double)])
    out.updateFields()
    features = []
    for f in names.getFeatures():
        g = f.geometry()
        if not g.boundingBox().intersects(extent):
            continue
        box = g.boundingBox().buffered(10)
        near_tunnels = [tunnel_geoms[i] for i in tunnel_index.intersects(box)]
        if near_tunnels and share_near(g, near_tunnels, 5) >= 0.6:
            continue
        near_vl = [vl_geoms[i] for i in vl_index.intersects(box)]
        near_tracks = [tracks[i] for i in track_index.intersects(box)]
        if near_vl and share_near(g, near_vl, 10) >= 0.5:
            clear = 1.45
        elif near_tracks and share_near(g, near_tracks, 10) >= 0.5:
            clear = 0.6
        else:
            clear = 0.15
        if g.wkbType() not in (Qgis.WkbType.LineString, Qgis.WkbType.MultiLineString):
            parts = [part for part in g.asGeometryCollection() if part.type() == Qgis.GeometryType.Line]
            if not parts:
                continue
            g = QgsGeometry.collectGeometry(parts)
        feat = QgsFeature(out.fields())
        multi = QgsGeometry(g)
        multi.convertToMultiType()
        feat.setGeometry(multi)
        feat.setAttributes([clean_name(f["name"]), f["class"], f["subclass"], clear, 0.0])
        features.append(feat)
    # Total length of each street in the frame: long pedestrian streets get their name before short ones.
    totals = {}
    for feat in features:
        totals[feat["name"]] = totals.get(feat["name"], 0) + feat.geometry().length()
    for feat in features:
        feat["length"] = totals[feat["name"]]
    ok, _ = out.dataProvider().addFeatures(features)
    print(f"street names: {len(features)} ({'ok' if ok else out.dataProvider().lastError()})")
    return save_layer(out, OUT / "street-names.fgb")


def label_layers(stations, extent, vl, cycleways):
    """Returned top first. `stations`: the station layer, whose names win over quarters of the same name."""
    layers = []

    towns = basemap_layer("place", "\"class\" IN ('town','village')", "Communes")  # no "Lyon": it is the title
    towns.setRenderer(QgsSingleSymbolRenderer(invisible_point()))
    # Long names on two lines, cut at the hyphen closest to their middle (Sainte-Foy-|lès-Lyon).
    wraps = []
    for f in towns.getFeatures():
        name = f["name"]
        hyphens = [i for i, c in enumerate(name) if c == "-"]
        if len(name) > 15 and hyphens:
            cut = min(hyphens, key=lambda i: abs(i - len(name) / 2)) + 1
            wraps.append(f"WHEN \"name\" = '{name.replace(chr(39), chr(39) * 2)}' THEN "
                         f"'{(name[:cut] + '|' + name[cut:]).replace(chr(39), chr(39) * 2)}'")
    town_name = f"CASE {' '.join(wraps)} ELSE \"name\" END" if wraps else "name"

    # Places whose point sits in a dense spot get their name drawn a little further (Lambert-93).
    moves = " ".join(f"WHEN \"name\" = '{name}' THEN {x}" for name, (x, _) in TOWN_POSITIONS.items())
    moves_y = " ".join(f"WHEN \"name\" = '{name}' THEN {y}" for name, (_, y) in TOWN_POSITIONS.items())

    def town_extra(s):
        around_point(s)
        s.wrapChar = "|"
        s.multilineAlign = Qgis.LabelMultiLineAlignment.Center
        props = s.dataDefinedProperties()
        props.setProperty(QgsPalLayerSettings.Property.PositionX, QgsProperty.fromExpression(f"CASE {moves} END"))
        props.setProperty(QgsPalLayerSettings.Property.PositionY, QgsProperty.fromExpression(f"CASE {moves_y} END"))
        props.setProperty(QgsPalLayerSettings.Property.Hali, QgsProperty.fromValue("Center"))
        props.setProperty(QgsPalLayerSettings.Property.Vali, QgsProperty.fromValue("Half"))
        props.setProperty(QgsPalLayerSettings.Property.Priority, QgsProperty.fromExpression(
            f"CASE WHEN \"name\" IN ({', '.join(repr(n) for n in TOWN_POSITIONS)}) THEN 10 ELSE 9 END"))

    set_labels(towns, town_name, text_format(22, "#7a7368", style="Demi Bold", caps=True, spacing=4),
               Qgis.LabelPlacement.AroundPoint, priority=9, extra=town_extra)
    layers.append(towns)

    quarter_filter = (f"\"class\" IN ('suburb','quarter') AND \"name\" NOT LIKE '%Arrondissement' "
                      f"AND \"name\" NOT IN {GENERIC_PLACES}")
    named = [(normalise(f["name"]), f.geometry()) for f in stations.getFeatures()
             if f["name"] and f["kind"] != "boat"]
    def repeats(quarter, station):
        return quarter == station or f" {quarter} " in f" {station} "

    repeated = [str(f.id()) for f, g in to_lambert(basemap_layer("place", quarter_filter))
                if any(n == normalise(f["name"]) and g.distance(sg) < 800 for n, sg in named)
                or any(repeats(normalise(f["name"]), n) and g.distance(sg) < 300 for n, sg in named)]
    if repeated:
        quarter_filter += f" AND FID NOT IN ({', '.join(repeated)})"
    quarters = basemap_layer("place", quarter_filter, "Quartiers")
    quarters.setRenderer(QgsSingleSymbolRenderer(invisible_point()))

    def quarter_extra(s):
        around_point(s)
        # Moved up to 10 mm from its point when crowded, rather than left out.
        s.pointSettings().setMaximumDistance(10)
        s.pointSettings().setMaximumDistanceUnit(MM)
        props = s.dataDefinedProperties()
        props.setProperty(QgsPalLayerSettings.Property.Size,
                          QgsProperty.fromExpression("CASE WHEN \"class\" = 'suburb' THEN 12 ELSE 10 END"))
        props.setProperty(QgsPalLayerSettings.Property.Priority,
                          QgsProperty.fromExpression("CASE WHEN \"class\" = 'suburb' THEN 7 ELSE 5 END"))
        thinning = s.thinningSettings()
        thinning.setAllowDuplicateRemoval(True)
        thinning.setMinimumDistanceToDuplicate(80)
        thinning.setMinimumDistanceToDuplicateUnit(MM)

    # Lighter than the station names: an opaque pale colour rather than transparency, which prints better.
    # A thin, half transparent halo so that it does not cut the network.
    set_labels(quarters, "replace(replace(\"name\", ' - ', ' – '), char(39), char(8217))",
               text_format(12, QUARTER_TEXT, style="Medium", buffer=0.25, buffer_color=LAND, buffer_opacity=0.6),
               Qgis.LabelPlacement.AroundPoint, priority=5, extra=quarter_extra)
    layers.append(quarters)

    water_lines = basemap_layer("waterway", "\"class\" = 'river' AND \"name\" IS NOT NULL", "Noms des cours d'eau")
    water_lines.setRenderer(QgsSingleSymbolRenderer(invisible_line()))
    big_rivers = "('Le Rhône','La Saône','Le Vieux Rhône','Canal de Jonage','Canal de Miribel')"

    def on_river_axis(s):
        # Centred on the river line rather than beside it, so the name stays inside the water.
        s.lineSettings().setPlacementFlags(Qgis.LabelLinePlacementFlag.OnLine)
        # Brooks (L'Yzeron…) get a smaller name than the Rhône and the Saône.
        props = s.dataDefinedProperties()
        props.setProperty(QgsPalLayerSettings.Property.Size, QgsProperty.fromExpression(
            f"CASE WHEN \"name\" IN {big_rivers} THEN 14 ELSE 9 END"))
        props.setProperty(QgsPalLayerSettings.Property.FontLetterSpacing, QgsProperty.fromExpression(
            f"CASE WHEN \"name\" IN {big_rivers} THEN 2 ELSE 1 END"))
        props.setProperty(QgsPalLayerSettings.Property.BufferDraw, QgsProperty.fromExpression(
            f"\"name\" NOT IN {big_rivers}"))
        # The rivers are split in many ways: one name every 220 mm at most.
        thinning = s.thinningSettings()
        thinning.setAllowDuplicateRemoval(True)
        thinning.setMinimumDistanceToDuplicate(220)
        thinning.setMinimumDistanceToDuplicateUnit(MM)

    set_labels(water_lines, "name", text_format(14, WATER_TEXT, style="Italic", spacing=2, buffer=0.3,
                                                buffer_color=LAND),
               Qgis.LabelPlacement.Curved, priority=9, merge=True, repeat=480, extra=on_river_axis)
    layers.append(water_lines)

    # A curated list of parks (landmarks.json): OSM names include many small gardens and protected areas.
    park_rows = [(*park["coordinates"], [park["label"].replace("'", "’")])
                 for park in json.loads(LANDMARKS.read_text())["parks"]]
    parks = point_layer("Noms des parcs", [("name", QMetaType.Type.QString)], park_rows)
    parks.setRenderer(QgsSingleSymbolRenderer(invisible_point()))

    def park_extra(s):
        s.autoWrapLength = 14
        s.multilineAlign = Qgis.LabelMultiLineAlignment.Center
        around_point(s)
        s.pointSettings().setMaximumDistance(6)
        s.pointSettings().setMaximumDistanceUnit(MM)

    set_labels(parks, "name", text_format(10.5, GREEN_TEXT, style="Demi Bold Italic", buffer=0.5,
                                          buffer_color=GREEN),
               Qgis.LabelPlacement.AroundPoint, priority=6, extra=park_extra)
    layers.append(save_layer(parks, OUT / "parks.fgb"))

    # Street names in one layer so lines merge across class changes; bold for the main roads, like the
    # official plan.
    streets = street_name_layer(extent, vl, cycleways)
    streets.setRenderer(QgsSingleSymbolRenderer(invisible_line()))
    bold, regular, italic = STREET_FONT_STYLES
    major, main = "\"class\" IN ('primary','secondary','trunk')", "\"class\" = 'tertiary'"
    bridge = "regexp_match(\"name\", '^(Pont|Passerelle) ')"

    def street_extra(s):
        props = s.dataDefinedProperties()
        props.setProperty(QgsPalLayerSettings.Property.Size, QgsProperty.fromExpression(
            f"CASE WHEN {bridge} THEN 7 WHEN {major} THEN 8 WHEN {main} THEN 7.2 ELSE 6.5 END"))
        props.setProperty(QgsPalLayerSettings.Property.FontStyle, QgsProperty.fromExpression(
            f"CASE WHEN {major} OR {main} OR {bridge} THEN '{bold}' WHEN \"class\" = 'path' THEN '{italic}' "
            f"ELSE '{regular}' END"))
        props.setProperty(QgsPalLayerSettings.Property.Color, QgsProperty.fromExpression(
            f"CASE WHEN {major} OR {main} OR {bridge} THEN '#2b2724' ELSE '#514b45' END"))
        props.setProperty(QgsPalLayerSettings.Property.Priority, QgsProperty.fromExpression(
            f"CASE WHEN {bridge} THEN 8 WHEN {major} THEN 7 WHEN {main} OR \"name\" LIKE 'Berge%' THEN 6 "
            f"WHEN \"class\" = 'path' AND \"length\" >= 250 THEN 5 WHEN \"class\" = 'path' THEN 3 ELSE 4 END"))
        # Off the cycle network: the name goes beside a Voie Lyonnaise band or a track, not over it.
        props.setProperty(QgsPalLayerSettings.Property.LabelDistance, QgsProperty.fromField("clear"))
        s.distUnits = MM
        s.lineSettings().setPlacementFlags(Qgis.LabelLinePlacementFlag.AboveLine
                                           | Qgis.LabelLinePlacementFlag.BelowLine
                                           | Qgis.LabelLinePlacementFlag.MapOrientation)
        # Bridges are shorter than their names.
        props.setProperty(QgsPalLayerSettings.Property.OverrunDistance,
                          QgsProperty.fromExpression(f"CASE WHEN {bridge} THEN 6 ELSE 0 END"))
        s.lineSettings().setOverrunDistanceUnit(MM)
        # One name per street within 45 mm (dual carriageways, ways split by small gaps).
        thinning = s.thinningSettings()
        thinning.setAllowDuplicateRemoval(True)
        thinning.setMinimumDistanceToDuplicate(45)
        thinning.setMinimumDistanceToDuplicateUnit(MM)
        # No names wrapped round tight bends.
        s.maxCurvedCharAngleIn = 15
        s.maxCurvedCharAngleOut = -15

    set_labels(streets, "name", text_format(6.5, "#514b45", family=FONT_CONDENSED, style=regular, buffer=0.3),
               Qgis.LabelPlacement.Curved, merge=True, repeat=180, min_length=12, extra=street_extra)
    layers.append(streets)
    return layers


# --- layout ------------------------------------------------------------------------------------
def mm_point(x, y):
    return QgsLayoutPoint(x, y, Qgis.LayoutUnit.Millimeters)


def mm_size(w, h):
    return QgsLayoutSize(w, h, Qgis.LayoutUnit.Millimeters)


def add_label(layout, text, x, y, w, h, fmt, align=Qt.AlignmentFlag.AlignLeft):
    item = QgsLayoutItemLabel(layout)
    item.setText(text)
    item.setTextFormat(fmt)
    item.setHAlign(align)
    item.setVAlign(Qt.AlignmentFlag.AlignTop)
    item.attemptMove(mm_point(x, y))
    item.attemptResize(mm_size(w, h))
    layout.addLayoutItem(item)
    return item


def panel(layout, x, y, w, h, color="#ffffff", opacity=1.0):
    shape = QgsLayoutItemShape(layout)
    shape.setShapeType(QgsLayoutItemShape.Shape.Rectangle)
    shape.setCornerRadius(QgsLayoutMeasurement(3, Qgis.LayoutUnit.Millimeters))
    sym = fill(color, outline="#d8d2c8", outline_width=0.3)
    sym.setOpacity(opacity)
    shape.setSymbol(sym)
    shape.attemptMove(mm_point(x, y))
    shape.attemptResize(mm_size(w, h))
    layout.addLayoutItem(shape)
    return shape


LEGEND_AREA = (340, 250)  # mm, the legend with a margin (the build prints its actual size)


def panel_areas(center):
    """Map areas under the title, legend and scale panels (approximate, generous), in Lambert-93."""
    extent = map_extent(center)
    u = unit()
    left, top = extent.xMinimum(), extent.yMaximum()
    right, bottom = extent.xMaximum(), extent.yMinimum()
    return [QgsGeometry.fromRect(r) for r in (
        QgsRectangle(left, top - 88 * u, left + 252 * u, top),  # title and QR code
        QgsRectangle(left, bottom, left + LEGEND_AREA[0] * u, bottom + LEGEND_AREA[1] * u),  # legend
        QgsRectangle(right - 203 * u, bottom, right, bottom + 98 * u),  # scale and credits
    )]


def hide_under_panels(layer, hidden, frame=None, margin=2):
    """Leaves out the points of the layer that fall under a panel (or within `margin` mm of it), or
    outside `frame`, where the map edge would cut them."""
    u = unit()
    zones = [h.buffer(margin * u, 2) for h in hidden]
    inside = [str(f.id()) for f, g in to_lambert(layer)
              if any(z.contains(g) for z in zones) or (frame and not frame.contains(g.asPoint()))]
    if inside:
        current = layer.subsetString()
        rule = f"FID NOT IN ({', '.join(inside)})"
        layer.setSubsetString(f"({current}) AND {rule}" if current else rule)
    return layer


def legend_only(project, name, symbol):
    """A layer with no feature, shown in the legend only."""
    geometry = "LineString" if isinstance(symbol, QgsLineSymbol) else "Point"
    layer = QgsVectorLayer(f"{geometry}?crs=EPSG:2154", name, "memory")
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))
    project.addMapLayer(layer, False)
    return layer


def build_layout(project, map_layers, legend_layers, center):
    layout = QgsPrintLayout(project)
    layout.initializeDefaults()
    layout.setName(f"{TITLE} A0")
    layout.pageCollection().page(0).setPageSize(mm_size(PAGE_W, PAGE_H))

    map_w, map_h = PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN
    map_item = QgsLayoutItemMap(layout)
    map_item.attemptMove(mm_point(MARGIN, MARGIN))
    map_item.attemptResize(mm_size(map_w, map_h))
    map_item.setCrs(CRS)
    map_item.setExtent(map_extent(center))
    map_item.setScale(SCALE)
    map_item.setLayers(map_layers)
    map_item.setKeepLayerSet(True)
    map_item.setBackgroundColor(QColor(LAND))
    map_item.setFrameEnabled(True)
    map_item.setFrameStrokeColor(QColor("#9c958b"))
    map_item.setFrameStrokeWidth(QgsLayoutMeasurement(0.35, Qgis.LayoutUnit.Millimeters))
    map_item.setLabelMargin(QgsLayoutMeasurement(4, Qgis.LayoutUnit.Millimeters))
    layout.addLayoutItem(map_item)

    # Title block, top left.
    title_style = "Demi Bold"
    tx, ty, pad = MARGIN + 10, MARGIN + 10, 12
    title_panel = panel(layout, tx, ty, 10, 10)
    map_item.addLabelBlockingItem(title_panel)
    title_size = 64  # pt

    def text_width(text, size, style):
        font = QFont(FONT)
        font.setStyleName(style)
        font.setPixelSize(1000)
        return QFontMetricsF(font).horizontalAdvance(text) / 1000 * size * 25.4 / 72

    months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre",
              "octobre", "novembre", "décembre"]
    today = date.today()
    subtitle = f"Lyon, Villeurbanne et alentours · réseau cyclable en {months[today.month - 1]} {today.year}"
    title_width = text_width(TITLE, title_size, title_style)
    content_w = max(title_width, text_width(subtitle, 15, "Medium") + 2, 110)
    # Title cap height level with the top of the QR code, URL baseline level with its bottom.
    add_label(layout, TITLE, tx + pad, ty + 2.5, title_width + 10, 34, text_format(title_size, INK, style=title_style))
    add_label(layout, subtitle, tx + pad + 1, ty + 34.5, content_w + 5, 10, text_format(15, TEXT_SOFT, style="Medium"))
    add_label(layout, SITE_URL, tx + pad + 1, ty + 46.5, 200, 10, text_format(16, INK, style="Demi Bold"))
    # QR code to the web map, on the right of the title block.
    qr_size = 40
    qr_x = tx + pad + content_w + 10
    qr = QgsLayoutItemPicture(layout)
    qr.setPicturePath(str(ICONS / "qr-carte-lavilleavelo.svg"))
    qr.attemptMove(mm_point(qr_x, ty + pad))
    qr.attemptResize(mm_size(qr_size, qr_size))
    layout.addLayoutItem(qr)
    add_label(layout, "Carte interactive", qr_x, ty + pad + qr_size + 5.5, qr_size, 6,
              text_format(10, INK, style="Demi Bold"), align=Qt.AlignmentFlag.AlignHCenter)
    title_panel.attemptResize(mm_size(content_w + 10 + qr_size + 2 * pad, 72))

    # Legend, bottom left.
    pad = 9
    legend = QgsLayoutItemLegend(layout)
    legend.setLinkedMap(map_item)
    legend.setSyncMode(Qgis.LegendSyncMode.Manual)
    root = legend.model().rootGroup()
    root.removeAllChildren()
    separated, shared, vl, shields, parkings, velov, services, stations, slopes, landmarks = legend_layers
    group = root.addGroup("Aménagements cyclables")
    group.addLayer(separated)
    shared_node = group.addLayer(shared)
    # The contraflow sample gets bigger arrows than on the map, so that they can be read there.
    dsc_index = next(i for i, r in enumerate(shared.renderer().rootRule().children()) if "'dsc'" in r.filterExpression())
    QgsMapLayerLegendUtils.setLegendNodeCustomSymbol(
        shared_node, dsc_index, line_symbol(contraflow_line(), dsc_arrows(rendering_pass=4, size=8)))
    legend.model().refreshLayerLegend(shared_node)
    vl_group = root.addGroup("Voies Lyonnaises")
    vl_group.addLayer(legend_only(project, "Section réalisée (couleur de la ligne)", line_symbol(
        line_layer(VL_TINTS[0], VL_BAND, cap="butt"), line_layer(SEPARATED, 0.85))))
    vl_group.addLayer(shields)
    # The parking layer title would repeat its group name.
    service_group = root.addGroup("Services vélo")
    node = service_group.addLayer(parkings)
    QgsLegendRenderer.setNodeLegendStyle(node, QgsLegendStyle.Style.Hidden)
    service_group.addLayer(velov)
    service_group.addLayer(services)
    transit_group = root.addGroup("Transports en commun")
    node = transit_group.addLayer(stations)
    QgsLegendRenderer.setNodeLegendStyle(node, QgsLegendStyle.Style.Hidden)
    transit_group.addLayer(legend_only(project, "Tramway (rails dangereux pour les vélos)",
                                       line_symbol(line_layer(TRAM, 0.35))))
    transit_group.addLayer(legend_only(project, "Voie ferrée", line_symbol(
        line_layer(RAIL, 0.6), line_layer("#ffffff", 0.3, dash=[2.0, 2.0], cap="butt"))))
    relief_group = root.addGroup("Relief et circulation")
    node = relief_group.addLayer(slopes)
    QgsLegendRenderer.setNodeLegendStyle(node, QgsLegendStyle.Style.Hidden)
    relief_group.addLayer(legend_only(project, "Rue à 50 km/h ou plus", line_symbol(
        line_layer(MAJOR_CASING, 1.75), line_layer(BUSY_FILL, 1.4))))
    legend.setTitle("")
    legend.setWrapString("|")
    # Two columns: the cycling items, then services, transport, places and relief.
    legend.setColumnCount(2)
    service_group.setCustomProperty("legend/column-break", "1")
    legend.setSymbolWidth(22)
    legend.setSymbolHeight(6.5)
    for style, fmt in [
        (QgsLegendStyle.Style.Title, text_format(30, INK, style="Demi Bold")),
        (QgsLegendStyle.Style.Group, text_format(20, INK, style="Demi Bold")),
        (QgsLegendStyle.Style.Subgroup, text_format(16, SEPARATED, style="Demi Bold")),
        (QgsLegendStyle.Style.SymbolLabel, text_format(15, TEXT, style="Regular")),
    ]:
        legend.rstyle(style).setTextFormat(fmt)
    legend.rstyle(QgsLegendStyle.Style.Title).setMargin(QgsLegendStyle.Side.Bottom, 0)
    legend.rstyle(QgsLegendStyle.Style.Group).setMargin(QgsLegendStyle.Side.Top, 8)
    legend.rstyle(QgsLegendStyle.Style.Subgroup).setMargin(QgsLegendStyle.Side.Top, 7)
    legend.rstyle(QgsLegendStyle.Style.Subgroup).setMargin(QgsLegendStyle.Side.Bottom, 1.5)
    legend.rstyle(QgsLegendStyle.Style.Symbol).setMargin(QgsLegendStyle.Side.Top, 2.6)
    legend.rstyle(QgsLegendStyle.Style.SymbolLabel).setMargin(QgsLegendStyle.Side.Left, 4)
    legend.setBackgroundEnabled(True)
    legend.setBackgroundColor(QColor("#ffffff"))
    legend.setFrameEnabled(True)
    legend.setFrameStrokeColor(QColor("#d8d2c8"))
    legend.setFrameStrokeWidth(QgsLayoutMeasurement(0.3, Qgis.LayoutUnit.Millimeters))
    legend.setBoxSpace(pad)
    # Anchored by its lower left corner: it grows upwards when it resizes to its content.
    legend.setReferencePoint(QgsLayoutItem.ReferencePoint.LowerLeft)
    legend.setResizeToContents(True)
    layout.addLayoutItem(legend)
    legend.attemptMove(mm_point(MARGIN + 10, PAGE_H - MARGIN - 10))
    legend.refresh()
    legend.adjustBoxSize()
    # The legend only gets its size when rendered, and labels must avoid it: block a box of its final size.
    size = QgsLegendRenderer(legend.model(), legend.legendSettings()).minimumSize()
    print(f"legend: {size.width():.0f} × {size.height():.0f} mm")
    map_item.addLabelBlockingItem(panel(layout, MARGIN + 10, PAGE_H - MARGIN - 10 - size.height(),
                                        size.width(), size.height(), opacity=0))
    legend.setZValue(legend.zValue() + 1)

    # Scale bar, travel times, north arrow and credits, bottom right.
    bw, bh = 185, 80
    bx, by = PAGE_W - MARGIN - 10 - bw, PAGE_H - MARGIN - 10 - bh
    map_item.addLabelBlockingItem(panel(layout, bx, by, bw, bh))
    scalebar = QgsLayoutItemScaleBar(layout)
    scalebar.setStyle("Single Box")
    scalebar.setLinkedMap(map_item)
    scalebar.setUnits(Qgis.DistanceUnit.Meters)
    scalebar.setUnitLabel("m")
    scalebar.setUnitsPerSegment(250)
    scalebar.setNumberOfSegments(4)
    scalebar.setNumberOfSegmentsLeft(0)
    scalebar.setHeight(1.8)
    scalebar.setTextFormat(text_format(12, TEXT))
    scalebar.fillSymbol().setColor(QColor(TEXT))
    scalebar.alternateFillSymbol().setColor(QColor("#ffffff"))
    scalebar.lineSymbol().setColor(QColor(TEXT))
    scalebar.lineSymbol().setWidth(0.25)
    scalebar.attemptMove(mm_point(bx + 10, by + 9))
    layout.addLayoutItem(scalebar)
    scalebar.update()
    # The same bar in minutes by bike: 250 m a minute at 15 km/h, labels under the bar.
    minutes = QgsLayoutItemScaleBar(layout)
    minutes.setStyle("Single Box")
    minutes.setLinkedMap(map_item)
    minutes.setUnits(Qgis.DistanceUnit.Meters)
    minutes.setMapUnitsPerScaleBarUnit(250)  # labels: metres / 250
    minutes.setUnitLabel("min à vélo")
    minutes.setUnitsPerSegment(250)
    minutes.setNumberOfSegments(4)
    minutes.setNumberOfSegmentsLeft(0)
    minutes.setHeight(1.8)
    minutes.setLabelVerticalPlacement(Qgis.ScaleBarDistanceLabelVerticalPlacement.BelowSegment)
    minutes.setTextFormat(text_format(12, SEPARATED, style="Demi Bold"))
    minutes.fillSymbol().setColor(QColor(SEPARATED))
    minutes.alternateFillSymbol().setColor(QColor("#ffffff"))
    minutes.lineSymbol().setColor(QColor(SEPARATED))
    minutes.lineSymbol().setWidth(0.25)
    minutes.attemptMove(mm_point(bx + 10, by + 17))
    layout.addLayoutItem(minutes)
    minutes.update()

    north = QgsLayoutItemPicture(layout)
    north.setPicturePath(str(ICONS / "north.svg"))
    north.setLinkedMap(map_item)
    north.setNorthMode(QgsLayoutItemPicture.NorthMode.GridNorth)
    north.attemptMove(mm_point(bx + bw - 20, by + 9))
    north.attemptResize(mm_size(10, 15))
    layout.addLayoutItem(north)

    credits = "\n".join([
        f"Échelle 1:{SCALE:,}".replace(",", " ") + f" (1 cm = {SCALE // 100} m) — projection Lambert-93",
        "Aménagements cyclables, gares et lieux : © contributeurs OpenStreetMap (ODbL)",
        "Voies Lyonnaises : La Ville à Vélo (cyclopolis) · Stationnement : Métropole de Lyon",
        "Métro, tram et Navigône : TCL (SYTRAL), data.grandlyon.com",
        "Pompes, Vélo'v : Métropole de Lyon · Stations de réparation : OpenStreetMap",
        "Relief : IGN RGE ALTI · Pentes et vitesses : Métropole de Lyon",
        "Fond de carte : © OpenStreetMap, OpenMapTiles, OpenFreeMap",
    ])
    add_label(layout, credits, bx + 10, by + 37, bw - 20, 36, text_format(11, TEXT_SOFT))
    return layout


# --- main --------------------------------------------------------------------------------------
def main():
    prepare_basemap()

    project = QgsProject.instance()
    project.clear()
    project.setCrs(CRS)
    project.setTitle(f"{TITLE} — impression")
    project.setFilePathStorage(Qgis.FilePathType.Relative)

    to_l93 = QgsCoordinateTransform(QgsCoordinateReferenceSystem("EPSG:4326"), CRS, project)
    center = to_l93.transform(QgsPointXY(*CENTER))
    extent = map_extent(center).buffered(500)

    base = basemap_layers(extent)
    vl, separated, shared, parkings, cycleways = bike_layers(extent)
    hidden = panel_areas(center)
    u = unit()
    frame = map_extent(center).buffered(-3 * u)  # symbols stay 3 mm inside the map edge
    stations = hide_under_panels(station_layer(), hidden, frame)
    landmarks, services = landmark_layer(stations), service_layer()
    block_labels(services)
    shields = vl_shield_layer(vl, cycleways, [parkings, stations, landmarks, services], hidden,
                              map_extent(center).buffered(-6 * u))
    block_labels(parkings)
    # Labels avoid the Vélo'v dots, and keep off the cycle network when they can.
    velov = velov_layer()
    block_labels(velov, 0.8)
    for layer in (vl, separated, shared):
        block_labels(layer, 0.4)
    labels = label_layers(stations, extent, vl, cycleways)

    # Stations and VL numbers stay; the other symbols move aside when they would cover one.
    # Radius of a station: its row of squares, or the train or boat pictogram (3.8 mm).
    fixed = [(g, STATION_SIZE / 2 * f["n"] if f["n"] else 1.9) for f, g in to_lambert(stations)]
    fixed += [(g, SHIELD_SIZE / 2) for _, g in to_lambert(shields)]
    # Vélo'v dots before the pumps: the pumps of the Métropole stand at Vélo'v stations, the red dot
    # stays where the station is and the pump goes beside it.
    parkings, velov, services, landmarks = declutter(fixed, [
        (parkings, lambda f: 2.75 if f["type"] == "velostation" else 2.0, OUT / "parkings.fgb"),
        (velov, 0.7, OUT / "velov.fgb"),
        (services, 1.8, OUT / "services.fgb"),
        (landmarks, 1.8, OUT / "landmarks-placed.fgb"),
    ], cycleways, basemap_layer("water", None, "water"))
    for layer in (parkings, services, landmarks, velov):
        hide_under_panels(layer, hidden, frame)
    slopes = slope_layer(extent, frame, cycleways, hidden, [g for _, g in to_lambert(shields)])
    # The chevrons go above the Voies Lyonnaises bands and below the cycle lines.
    order = [*labels, stations, landmarks, shields, parkings, services, velov, separated, shared, slopes, vl,
             navigone_route_layer(), arrondissement_layer(),
             *base[::-1]]  # top first
    root = project.layerTreeRoot()
    for layer in order:
        project.addMapLayer(layer, False)
        root.addLayer(layer)

    engine = project.labelingEngineSettings()
    engine.setMaximumLineCandidatesPerCm(15)  # more positions tried along streets (bridges, short streets)
    project.setLabelingEngineSettings(engine)

    layout = build_layout(project, order, [separated, shared, vl, shields, parkings, velov, services, stations,
                                           slopes, landmarks], center)
    project.layoutManager().addLayout(layout)
    project.write(str(OUT / "carte-velo-lyon.qgz"))

    exporter = QgsLayoutExporter(layout)
    if "--no-pdf" not in sys.argv:
        pdf = QgsLayoutExporter.PdfExportSettings()
        pdf.dpi = 300
        pdf.rasterizeWholeImage = False
        pdf.forceVectorOutput = True
        pdf.appendGeoreference = True
        pdf.simplifyGeometries = False
        # Outlines: with real text, the PDF doubles the letter spacing of the spaced labels.
        pdf.textRenderFormat = Qgis.TextRenderFormat.AlwaysOutlines
        print("pdf", exporter.exportToPdf(str(OUT / "carte-velo-lyon-A0.pdf"), pdf))

        # A light version to download and read on screen: the page as one JPEG at 200 dpi, ~10 MB rather
        # than ~60 MB (below 200 dpi the small street names blur).
        web_dpi, web_png = 200, OUT / "web.png"
        image = QgsLayoutExporter.ImageExportSettings()
        image.dpi = web_dpi
        print("web image", exporter.exportToImage(str(web_png), image))
        gdal.UseExceptions()
        gdal.Translate(str(OUT / "carte-velo-lyon-A0-web.pdf"), str(web_png), format="PDF", bandList=[1, 2, 3],
                       creationOptions=["COMPRESS=JPEG", "JPEG_QUALITY=75", f"DPI={web_dpi}"])
        web_png.unlink()

    image = QgsLayoutExporter.ImageExportSettings()
    image.dpi = 50
    print("preview", exporter.exportToImage(str(OUT / "preview.png"), image))

    # 300 dpi crops of a few places (layout mm), to check the details.
    # `--crops` renders them all, `--crops=3e,guillotiere` only those.
    wanted = next((a.split("=", 1)[1].split(",") if "=" in a else None for a in sys.argv if a.startswith("--crops")), [])
    if wanted != []:
        px = 300 / 25.4
        w, h = 150, 105
        for name, (x, y) in {
            "3e": (500, 330),
            "part-dieu": (640, 320),
            "tete-d-or": (480, 160),
            "rhone-nord": (420, 110),
            "presquile": (400, 360),
            "vieux-lyon": (330, 330),
            "guillotiere": (480, 420),
            "jean-mace": (500, 470),
            "arr-4": (380, 190),
            "arr-3": (600, 400),
            "croix-rousse": (390, 200),
            "cuire": (420, 120),
            "bonnevay": (920, 340),
            "fourviere": (300, 300),
            "villeurbanne": (700, 260),
            "confluence": (330, 520),
            "confluence-zoom": (380, 560),
            "vaise": (210, 200),
            "valmy": (220, 240),
            "saone-nord": (290, 110),
            "saint-vincent": (360, 280),
            "title": (MARGIN, MARGIN),
            "qr": (MARGIN + 160, MARGIN),
            "legend": (MARGIN, PAGE_H - MARGIN - 200),
            "legend-bottom": (MARGIN, PAGE_H - MARGIN - 105),
            "bottom-right": (PAGE_W - MARGIN - 199, PAGE_H - MARGIN - 105),
        }.items():
            if wanted and name not in wanted:
                continue
            img = exporter.renderRegionToImage(QRectF(x, y, w, h), QSize(int(w * px), int(h * px)), 300)
            img.save(str(OUT / f"crop-{name}.png"))


if __name__ == "__main__":
    # A profile folder of our own, or QGIS creates its style database in the current directory.
    qgs = QgsApplication([], False, str(OUT / "qgis-profile"))
    qgs.initQgis()
    try:
        main()
    finally:
        qgs.exitQgis()

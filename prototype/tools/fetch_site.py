"""Fetch a real facility for the twin: OpenStreetMap footprint + buildings, USGS 3DEP terrain.

Usage (from prototype/):
    .venv/bin/python tools/fetch_site.py --osm-way 380309198 --id hays-state-prison \
        --name "Hays State Prison" --place "Trion, Chattooga County, GA"
    .venv/bin/python tools/fetch_site.py --osm-rel 4131933 --height 4131933=30 --id clemson-memorial-stadium \
        --name "Clemson Memorial Stadium" --place "Clemson, Pickens County, SC"

Writes data/sites/<id>/site.json, terrain_coarse.bin and terrain_fine.bin. No API key needed.
Data: (c) OpenStreetMap contributors (ODbL); USGS 3D Elevation Program (public domain).
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from twin.geo import LocalFrame  # noqa: E402

UA = "tripwire-prototype/0.2 (Stanford AA261 student project)"
OVERPASS = "https://overpass-api.de/api/interpreter"
DEP_URL = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
DEFAULT_BUILDING_H = 7.0  # ASSUMPTION: 1-2 storey prison buildings when OSM has no height


def http_get(url: str, data: bytes | None = None, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception:  # noqa: BLE001 - retry any network error (Overpass returns 429/502/504 when busy)
            if attempt == 4:
                raise
            time.sleep(10 * 2 ** attempt)
    raise RuntimeError("unreachable")


def overpass(query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode()
    return json.loads(http_get(OVERPASS, body))


MAX_PX = 400  # the 3DEP exportImage service rejects larger requests (HTTP 502)


def fetch_3dep(lat_min, lon_min, lat_max, lon_max, w, h) -> np.ndarray:
    """Elevation grid (metres, NAVD88), row 0 = north edge, pixel edges on the bbox.

    Large grids are fetched as tiles of at most MAX_PX pixels and stitched.
    """
    nx, ny = math.ceil(w / MAX_PX), math.ceil(h / MAX_PX)
    tw, th = math.ceil(w / nx), math.ceil(h / ny)
    w, h = tw * nx, th * ny
    out = np.empty((h, w), dtype=np.float32)
    dlon = (lon_max - lon_min) / nx
    dlat = (lat_max - lat_min) / ny
    for r in range(ny):  # r = 0 is the northern row of tiles
        for c in range(nx):
            q = {
                "bbox": f"{lon_min + c * dlon},{lat_max - (r + 1) * dlat},{lon_min + (c + 1) * dlon},{lat_max - r * dlat}",
                "bboxSR": 4326, "imageSR": 4326, "size": f"{tw},{th}", "format": "tiff",
                "pixelType": "F32", "interpolation": "RSP_BilinearInterpolation", "f": "image",
            }
            raw = http_get(DEP_URL + "?" + urllib.parse.urlencode(q))
            tile = np.array(Image.open(io.BytesIO(raw)), dtype=np.float32)
            out[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = tile[:th, :tw]
    return out


def resample_to_enu(z_ll, bbox_ll, frame: LocalFrame, x0, y0, step, n):
    """Bilinear-resample a lat/lon grid onto a regular east/north grid (row 0 = south)."""
    lat_min, lon_min, lat_max, lon_max = bbox_ll
    h, w = z_ll.shape
    xs = x0 + step * np.arange(n)
    ys = y0 + step * np.arange(n)
    X, Y = np.meshgrid(xs, ys)
    lat, lon = frame.to_latlon(X, Y)
    # Pixel centres sit half a pixel inside the bbox edges.
    fy = (lat_max - lat) / (lat_max - lat_min) * h - 0.5  # row (north = 0)
    fx = (lon - lon_min) / (lon_max - lon_min) * w - 0.5
    fy = np.clip(fy, 0, h - 1.001)
    fx = np.clip(fx, 0, w - 1.001)
    i0, j0 = fy.astype(int), fx.astype(int)
    ty, tx = fy - i0, fx - j0
    z = (z_ll[i0, j0] * (1 - ty) * (1 - tx) + z_ll[i0 + 1, j0] * ty * (1 - tx)
         + z_ll[i0, j0 + 1] * (1 - ty) * tx + z_ll[i0 + 1, j0 + 1] * ty * tx)
    return z.astype(np.float32)


def terrain_grid(frame, half_m, step_m, oversample=1.6):
    n = int(round(2 * half_m / step_m)) + 1
    lat_c, lon_c = frame.lat0, frame.lon0
    dlat = (half_m * 1.05) / frame.m_per_deg_lat
    dlon = (half_m * 1.05) / frame.m_per_deg_lon
    bbox = (lat_c - dlat, lon_c - dlon, lat_c + dlat, lon_c + dlon)
    px = min(int(n * oversample), 1600)
    z_ll = fetch_3dep(*bbox, px, px)
    if not np.isfinite(z_ll).all() or z_ll.max() < -1000:
        raise RuntimeError("3DEP returned no data for this area")
    z = resample_to_enu(z_ll, bbox, frame, -half_m, -half_m, step_m, n)
    return z, {"x0": -half_m, "y0": -half_m, "step_m": step_m, "nx": n, "ny": n}


def write_grid(path: Path, z: np.ndarray):
    # Decimetres in int16: covers -3276 m .. +3276 m.
    np.round(z * 10).astype("<i2").tofile(path)


def join_rings(ways):
    """Join open member ways (lists of (lat, lon)) end to end into closed rings (OSM multipolygon rule)."""
    ways = [list(w) for w in ways if len(w) >= 2]
    rings = []
    while ways:
        ring = ways.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for k, w in enumerate(ways):
                if w[0] == ring[-1]:
                    ring += w[1:]
                elif w[-1] == ring[-1]:
                    ring += w[::-1][1:]
                elif w[-1] == ring[0]:
                    ring = w[:-1] + ring
                elif w[0] == ring[0]:
                    ring = w[::-1][:-1] + ring
                else:
                    continue
                ways.pop(k)
                changed = True
                break
        if ring[0] == ring[-1] and len(ring) >= 4:
            rings.append(ring)
    return rings


def relation_rings(rel_id: int | None = None, rel: dict | None = None):
    """(outer rings, inner rings) of a multipolygon relation, as lists of (lat, lon); and its tags."""
    if rel is None:
        rel = overpass(f"[out:json][timeout:60];relation({rel_id});out geom;")["elements"][0]
    geo = {"outer": [], "inner": []}
    for m in rel.get("members", []):
        if m["type"] == "way" and m.get("geometry"):
            geo["inner" if m.get("role") == "inner" else "outer"].append([(g["lat"], g["lon"]) for g in m["geometry"]])
    return join_rings(geo["outer"]), join_rings(geo["inner"]), rel.get("tags", {})


def poly_area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


def building_height(tags):
    for key in ("height", "building:height"):
        if key in tags:
            try:
                return float(str(tags[key]).split()[0].replace("m", "")), "osm height"
            except ValueError:
                pass
    if "building:levels" in tags:
        try:
            return 3.5 * float(tags["building:levels"]), "osm levels x 3.5 m"
        except ValueError:
            pass
    return DEFAULT_BUILDING_H, "default (assumption)"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm-way", type=int, help="facility outline as an OSM way")
    ap.add_argument("--osm-rel", type=int, help="facility outline as an OSM multipolygon relation (largest outer ring)")
    ap.add_argument("--height", action="append", default=[],
                    help="building height override OSM_ID=METRES (e.g. a stadium with no OSM height; ASSUMPTION)")
    ap.add_argument("--id", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--place", default="")
    ap.add_argument("--coarse-half", type=float, default=10000, help="half-size of the terrain area, m")
    ap.add_argument("--coarse-step", type=float, default=50)
    ap.add_argument("--fine-half", type=float, default=1500)
    ap.add_argument("--fine-step", type=float, default=10)
    args = ap.parse_args()
    out = ROOT / "data" / "sites" / args.id
    out.mkdir(parents=True, exist_ok=True)

    if (args.osm_way is None) == (args.osm_rel is None):
        ap.error("give exactly one of --osm-way or --osm-rel")
    overrides = {int(k): float(v) for k, v in (h.split("=", 1) for h in args.height)}
    print("OSM: facility outline ...")
    if args.osm_way is not None:
        d = overpass(f"[out:json][timeout:60];way({args.osm_way});out geom tags;")
        ring = [(g["lat"], g["lon"]) for g in d["elements"][0]["geometry"]]
    else:
        outers, _, _ = relation_rings(args.osm_rel)
        ring = max(outers, key=lambda r: poly_area(np.array([(lo, la) for la, lo in r])))
    lat0 = float(np.mean([p[0] for p in ring[:-1]]))
    lon0 = float(np.mean([p[1] for p in ring[:-1]]))
    frame = LocalFrame(lat0, lon0)
    fence = np.array([frame.to_xy(la, lo) for la, lo in ring])

    print("OSM: buildings ...")
    pad = 600
    la1, lo1 = frame.to_latlon(fence[:, 0].min() - pad, fence[:, 1].min() - pad)
    la2, lo2 = frame.to_latlon(fence[:, 0].max() + pad, fence[:, 1].max() + pad)
    d = overpass(f'[out:json][timeout:60];way["building"]({la1},{lo1},{la2},{lo2});out geom tags;')
    buildings = []

    def add(osm_id, tags, outer, holes=()):
        pts = np.array([frame.to_xy(la, lo) for la, lo in outer])
        if len(pts) < 4:
            return
        h, src = building_height(tags)
        if osm_id in overrides:
            h, src = overrides[osm_id], "override (assumption)"
        holes = [np.round(np.array([frame.to_xy(la, lo) for la, lo in r]), 1).tolist() for r in holes]
        area = float(poly_area(pts)) - sum(float(poly_area(np.array(r))) for r in holes)
        b = {"osm_id": osm_id, "poly": np.round(pts, 1).tolist(), "height_m": round(h, 1),
             "height_source": src, "kind": tags.get("building", "yes"), "area_m2": round(area, 1)}
        if holes:
            b["holes"] = holes
        buildings.append(b)

    for e in d["elements"]:
        add(e["id"], e.get("tags", {}), [(g["lat"], g["lon"]) for g in e.get("geometry", [])])
    # Multipolygon buildings (e.g. a stadium grandstand around an open field): outer rings with holes.
    d = overpass(f'[out:json][timeout:90];relation["building"]({la1},{lo1},{la2},{lo2});out geom;')
    for e in d["elements"]:
        outers, inners, tags = relation_rings(rel=e)
        for o in outers:
            add(e["id"], tags, o, inners)
    print(f"  {len(buildings)} buildings")

    print("USGS 3DEP: coarse terrain ...")
    zc, mc = terrain_grid(frame, args.coarse_half, args.coarse_step)
    write_grid(out / "terrain_coarse.bin", zc)
    print("USGS 3DEP: fine terrain ...")
    zf, mf = terrain_grid(frame, args.fine_half, args.fine_step)
    write_grid(out / "terrain_fine.bin", zf)
    elev0 = float(zf[mf["ny"] // 2, mf["nx"] // 2])

    site = {
        "id": args.id, "name": args.name, "place": args.place,
        "osm_way": args.osm_way, "osm_rel": args.osm_rel,
        "origin": {"lat": lat0, "lon": lon0, "elev_m": round(elev0, 1)},
        "fence": np.round(fence, 1).tolist(),
        "fence_area_m2": round(float(poly_area(fence)), 0),
        "buildings": buildings,
        "terrain": {
            "coarse": {"file": "terrain_coarse.bin", **mc},
            "fine": {"file": "terrain_fine.bin", **mf},
            "dtype": "int16 little-endian, decimetres, row 0 = south edge",
            "datum": "NAVD88 metres",
        },
        "sources": [
            "Facility outline and buildings: (c) OpenStreetMap contributors, ODbL",
            "Terrain: USGS 3D Elevation Program (3DEP), exportImage service",
            f"Default building height {DEFAULT_BUILDING_H} m where OSM has none (ASSUMPTION)",
        ],
        "fetched": dt.date.today().isoformat(),
    }
    (out / "site.json").write_text(json.dumps(site, indent=1))
    print(f"wrote {out}/site.json  origin {lat0:.5f},{lon0:.5f}  elevation {elev0:.0f} m "
          f"terrain {zc.min():.0f}-{zc.max():.0f} m")


if __name__ == "__main__":
    main()

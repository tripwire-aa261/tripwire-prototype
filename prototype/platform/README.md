# Tripwire platform prototype v1.0

A static web app (no build step) for the pivot in Draft Report 6: one receive-only sensor with three receive banks (cell,
digital TV, GPS), five products, seven real sites. The cell-tower twin v0.5 (`../web/`, https://tripwire-cyan.vercel.app)
stays as submitted with Draft Report 5; its 3D signal replays are cell-only and still live there.

Open locally: from `prototype/`, `python -m http.server 8000` and go to http://localhost:8000/platform/.

## Tabs
- **Platform**: the seven sites and how many platform sensors each needs, with cell towers only and with cell + TV.
- **Sites**: coverage map, requirement checks and cost for any site, drone, interference level, build and sensor count.
- **Sensor & parts**: the 16-channel, three-bank board and the whole sensor, every line cited or labeled ASSUMPTION;
  the Seed sensor from off-the-shelf radios.
- **Products & cost**: site, site with heat camera, large perimeter, mobile kit, sensor for integrators, GPS monitoring:
  our cost from parts and the twin's sensor counts, the financial model v2 price, the cheapest comparable system.
- **GPS monitoring**: the jammer locator at the Robins flightline, the Pharr-Reynosa port and Hays.
- **Incident timeline**: the Hays contraband drop from the full signal replay, and real cases at each kind of site.

## Data (rebuild in this order, from `prototype/`)
1. `python -m twin.platform_bom` writes `data/bom.json` (parts lists, product costs).
2. `python -m twin.explore_v1` writes `data/explore.json` (~1-2 h on 4 cores; `--site <key>` for one site).
3. `python -m tools.platform_v1` writes `data/products.json`, `data/gnss.json`, `data/timeline.json`.

New sites (Nov 18): `tools/fetch_site.py` for the outline, buildings and terrain (now with an OSM API fallback when
Overpass is busy, and `--grow-m` for a port of entry where OSM maps only the building), then `tools/fetch_towers.py`
and `python -m tools.fetch_broadcast`:
- `robins`: Robins AFB main flightline apron (OSM way 361065585). The whole base (relation 4841794) is 27.9 km around.
- `poe`: Pharr-Reynosa Port of Entry, 250 m around the port building (OSM relation 19466797; ASSUMPTION: no compound
  outline in OSM). Mexican towers and TV stations are not in FCC data, so the site is under-illuminated on that side.
- `event`: Centennial Olympic Park, Atlanta (OSM relation 9685734), sensors on 4 m tripod masts. Westin Peachtree
  Plaza set to 220 m and State Farm Arena to 40 m (ASSUMPTIONS: no OSM height).

## How TV enters the simulation
`twin/multiband.py`: with `Params.signals = "cell+tv"`, the three licensed digital TV transmitters with the strongest
drone echo over the site become extra illuminators. Each TV transmitter-sensor pair is scored with the TV link budget
(`twin/broadcast.py`: calibrated echo loss, noise floor held 20 dB above thermal, conservative against the published
DVB-T drone trials) and then counts exactly like a cell pair in coverage, accuracy and scored flights. The full signal
replay (`twin/run.py`) stays cell-only. Not modeled: receiver overload next to megawatt TV stations, hovering drones
on TV, ATSC reference rebuild quality: these are the Seed measurements.

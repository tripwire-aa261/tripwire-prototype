"""v1.0 platform parts lists: the multi-band sensor and what each product is built from.

The v0.5 sensor (cost.py) receives cell bands only: its filter cuts off at 850 MHz and its balun covers 698-960 MHz, so
it can use neither digital TV (UHF channels 14-36, 470-608 MHz, horizontally polarised) nor GPS L1 (1575.42 MHz).
The platform sensor has three receive banks on one board:
  cell bank  8 channels, 617-960 MHz (incl. T-Mobile B71), the 8-antenna ring of v0.5
  TV bank    4 channels, 470-600 MHz, horizontally polarised TV antennas
  GPS bank   4 channels on a 4-element L1 patch array (jammer time differences and bearings)
Each LMS7002M's two receive channels share one local oscillator, so each chip is locked to one band: 8 chips for 16
channels. Holdover while GPS is jammed: an oven crystal (OCXO) disciplined by a timing-grade GNSS receiver; a chip-scale
atomic clock is a premium option. Prices checked 2026-11-18 (research subagent, URLs below); every line is CITED (a
distributor or list price at the stated quantity) or ASSUMPTION.

Products are costed from the sensor plus what each needs around it (installation, hub, heat cameras, field kit).
Run `python -m twin.platform_bom` to print the lists and write platform/data/bom.json for the platform viewer.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from .antenna import ANTENNAS
from .cost import CUSTOM, FINANCE, HUB, RADIOS, volume_factor

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "platform" / "data" / "bom.json"
DK = "https://www.digikey.com/en/products/detail/"

BANKS = {"cell": 8, "tv": 4, "gps": 4}  # channels per bank
CHANNELS = sum(BANKS.values())

# per: "board" (fixed), "chip" (x transceiver chips), "<bank>" (x that bank's channels), "all" (x all channels),
# "antenna" (x antenna inputs = all channels, + 1 GNSS input). basis_qty = quantity the price was quoted at.
BOARD = [
    dict(item="RF transceiver (2 receive channels on one oscillator, 100 kHz-3.8 GHz, 12-bit)", part="Lime Microsystems LMS7002M",
         per="chip", n=1, usd=127.82, basis_qty=100, source="CITED: DigiKey, 100-unit tray price, Nov 2026",
         url=DK + "lime-microsystems-ltd/LMS7002M/5012880"),
    dict(item="FPGA (collects 8 transceivers, PCIe to the computer)", part="AMD Artix-7 XC7A100T class", per="board", n=1,
         usd=199.56, basis_qty=1,
         source="ASSUMPTION: XC7A50T $99.56 (DigiKey, 1 unit, Nov 2026) + ~$100 for the larger part 8 transceivers need (not priced)",
         url="https://www.digikey.com/en/products/result?keywords=XC7A50T-1CSG325C"),
    # cell bank
    dict(item="Cell bank: low-noise amplifier", part="Mini-Circuits PSA4-5043+ (50 MHz-4 GHz, NF 0.75 dB)", per="cell", n=1,
         usd=1.72, basis_qty=1000, source="CITED: Mini-Circuits price table, 1,000 units, Nov 2026",
         url="https://www.minicircuits.com/WebStore/dashboard.html?model=PSA4-5043%2B"),
    dict(item="Cell bank: low-pass filter (keeps 617-960 MHz, rejects higher bands)", part="Mini-Circuits LFCN-1000+ (DC-1 GHz)",
         per="cell", n=1, usd=1.90, basis_qty=1000,
         source="CITED: DigiKey, 1,000 units, Nov 2026 (replaces LFCN-900+, which cut off at 850 MHz)", url=DK + "mini-circuits/LFCN-1000/13680584"),
    # TV bank
    dict(item="TV bank: low-noise amplifier", part="Mini-Circuits PSA4-5043+", per="tv", n=1, usd=1.72, basis_qty=1000,
         source="CITED: Mini-Circuits price table, 1,000 units, Nov 2026", url="https://www.minicircuits.com/WebStore/dashboard.html?model=PSA4-5043%2B"),
    dict(item="TV bank: band-pass filter 400-600 MHz (after the amplifier: 5.5 dB loss)", part="Mini-Circuits BFTC-500+", per="tv", n=1,
         usd=8.88, basis_qty=1000,
         source="CITED: DigiKey, 1,000 units, Nov 2026. Upper edge 600 MHz clips TV channels 35-36; 16-week lead time",
         url=DK + "mini-circuits/BFTC-500/21727988"),
    # GPS bank
    dict(item="GPS bank: L1 SAW filter", part="Abracon AFS14A04-1575.42-T3", per="gps", n=1, usd=0.48, basis_qty=1000,
         source="CITED: DigiKey, 1,000 units, Nov 2026", url=DK + "abracon-llc/AFS14A04-1575-42-T3/4036387"),
    dict(item="GPS bank: L1 low-noise amplifier", part="Infineon BGA725L6 (20 dB, NF 0.65 dB)", per="gps", n=1, usd=0.26, basis_qty=1000,
         source="CITED: DigiKey, 1,000 units, Nov 2026", url=DK + "infineon-technologies/BGA725L6E6327FTSA1/3911501"),
    # every channel
    dict(item="Balun, every channel (one part covers TV, cell and GPS L1)", part="TTM/Anaren B0430J50100AHF (400 MHz-2.5 GHz)", per="all",
         n=1, usd=0.69, basis_qty=100, source="CITED: DigiKey, 100 units ($0.47 at 4,000), Nov 2026. Check 100-ohm input match",
         url=DK + "anaren/B0430J50100AHF/1173-1052-1-ND/3069250"),
    dict(item="Calibration switch (antenna or noise source), every channel", part="Infineon BGS12WN6 SPDT, 50 MHz-9 GHz", per="all", n=1,
         usd=0.13943, basis_qty=1000, source="CITED: DigiKey, 1,000 units, Nov 2026", url=DK + "infineon-technologies/BGS12WN6E6327XTSA1/11500249"),
    dict(item="Calibration noise source amplifiers", part="Mini-Circuits PSA4-5043+", per="board", n=2, usd=1.72, basis_qty=1000,
         source="CITED: Mini-Circuits price table, 1,000 units, Nov 2026", url="https://www.minicircuits.com/WebStore/dashboard.html?model=PSA4-5043%2B"),
    dict(item="RF connectors (16 antenna inputs + GNSS)", part="Amphenol RF 132134 SMA jack", per="antenna", n=1, usd=7.30, basis_qty=1,
         source="CITED: DigiKey, 1 unit, Nov 2026", url=DK + "amphenol-rf/132134/1011907"),
    # clocks and timing
    dict(item="Reference oscillator, disciplined", part="Taitien TXEAACSANF-40.000000 VCTCXO, 40 MHz", per="board", n=1, usd=2.10866,
         basis_qty=500, source="CITED: DigiKey, 500 units, Nov 2026", url=DK + "taitien/TXEAACSANF-40-000000/6127601"),
    dict(item="Holdover oscillator (keeps time while GPS is jammed)", part="Connor-Winfield DOCSC012F-010.0M OCXO, +/-10 ppb", per="board", n=1,
         usd=50.00, basis_qty=50, source="CITED: DigiKey, 50 units, Nov 2026", url=DK + "connor-winfield/DOCSC012F-010-0M/13422056"),
    dict(item="Clock fan-out (reference to 8 transceivers + FPGA)", part="TI CDCLVC1104PWR, 1:4 buffer", per="board", n=3, usd=3.10744,
         basis_qty=500, source="CITED: DigiKey, 500 units, Nov 2026", url="https://www.digikey.com/en/products/result?keywords=CDCLVC1104PWR"),
    dict(item="Timing-grade GNSS receiver (disciplines the clocks, time stamps for jammer time differences)", part="u-blox ZED-F9T-20B",
         per="board", n=1, usd=163.60, basis_qty=250, source="CITED: DigiKey, 250 units, Nov 2026 (replaces the $16.22 NEO-F10N)",
         url=DK + "u-blox/ZED-F9T-20B/25651994"),
    # power and board
    dict(item="Power management IC (4 outputs)", part="TI TPS65400RGZR", per="board", n=2, usd=4.65732, basis_qty=250,
         source="CITED: DigiKey, 250 units, Nov 2026", url="https://www.digikey.com/en/products/result?keywords=TPS65400RGZR"),
    dict(item="Low-noise regulators for the RF and clock supplies", part="about 10 low-noise LDOs", per="board", n=1, usd=13.0,
         basis_qty=1000, source="ASSUMPTION (v0.5: 6 for $8)", url=""),
    dict(item="PCIe link to the edge computer", part="M.2 / PCIe cable assembly", per="board", n=1, usd=15.0, basis_qty=1000,
         source="ASSUMPTION", url=""),
    dict(item="Passives, configuration flash, ESD protection, small ICs", part="about 650 parts", per="board", n=1, usd=40.0,
         basis_qty=1000, source="ASSUMPTION (v0.5: 400 parts for $25)", url=""),
    dict(item="RF shield cans", part="one per transceiver + front ends", per="board", n=1, usd=14.0, basis_qty=1000,
         source="ASSUMPTION (v0.5: $8 for 4 transceivers)", url=""),
    dict(item="Bare board: 10-layer, controlled impedance, about 160 x 120 mm", part="PCB fabrication", per="board", n=1, usd=35.0,
         basis_qty=1000, source="ASSUMPTION (needs a quote; v0.5: 8-layer 120 x 100 mm for $20)", url=""),
]
# SMT assembly at JLCPCB's published rates (CITED, Nov 2026, as cost.py). Joints ASSUMPTION: FPGA 324 balls,
# 8 x LMS7002M 261 pads, ~650 passives x 2, other ICs ~450.
ASSEMBLY = dict(usd_per_joint=0.0016, joints=4160, xray_usd_per_part=0.25, xray_parts=11,
                source="CITED: JLCPCB assembly price page (Nov 2026); joint count ASSUMPTION", url="https://jlcpcb.com/help/article/pcb-assembly-price")
TEST_USD = 35.0  # ASSUMPTION: test and phase calibration of 16 channels (v0.5: $25 for 8)
NRE_USD = 600000.0  # ASSUMPTION: one-time design, certification and test of the 3-bank board (v0.5 8-channel board: $400k)

# Around the board, per sensor.
SENSOR = [
    dict(item="Edge computer (per-antenna processing)", part="NVIDIA Jetson Orin Nano Super", n=1, usd=399.0,
         source="CITED: NVIDIA raised the developer kit from $249 to $399 in July 2026 (CNX Software, 22 Jul 2026); "
                "ASSUMPTION: enough for ~170 MS/s across 16 channels (1.4x the 8-channel load); benchmark at Seed, Orin NX 16 GB is $999",
         url="https://www.cnx-software.com/2026/07/22/nvidia-increases-the-price-of-jetson-modules-and-devkits-by-up-to-101/"),
    dict(item="Cell antennas (8-antenna ring)", part=ANTENNAS["omni"].name, n=8, usd=ANTENNAS["omni"].price_usd,
         source="ASSUMPTION (as v0.5). A 617-960 MHz outdoor omni lists at $7.99 (Data Alliance) but gives only ~3 dBi", url=""),
    dict(item="TV antennas (horizontally polarised, 470-608 MHz)", part="Antennas Direct ClearStream 1MAX (6.8 dBi)", n=4, usd=59.99,
         source="CITED: Antennas Direct store, 1 unit, Nov 2026", url="https://store.antennasdirect.com/ClearStream-1MAX-TV-Antenna.html"),
    dict(item="GPS L1 array elements (active patch)", part="Taoglas AP.25E.07.0054A", n=4, usd=9.13,
         source="CITED: DigiKey, 150 units, Nov 2026", url=DK + "taoglas-limited/AP-25E-07-0054A/2709348"),
    dict(item="GPS array radome and ground plate", part="", n=1, usd=30.0, source="ASSUMPTION", url=""),
    dict(item="Enclosure, power supply, pole bracket, surge protector, cables", part="Hammond PJ1086 fiberglass NEMA 4X box + v0.5 items",
         n=1, usd=209.31,
         source="v0.5 $190 (ASSUMPTION) with the ~$70 box replaced by the larger Hammond PJ1086 at $89.31 (CITED: Hawk USA, 1 unit)",
         url="https://www.hawkusa.com/manufacturers/hammond-mfg/enclosures/junctionbox-nonmetal/pj1086"),
    dict(item="Lightning arrestor per antenna", part="N-type coaxial arrestor", n=16, usd=25.0, source="ASSUMPTION (as v0.5)", url=""),
]
CSAC = dict(item="Premium holdover: chip-scale atomic clock", part="Microchip SA65 CSAC", usd=5524.0,
            source="CITED (not fully verified: search snippet, distributor page blocked): Octopart reference price; distributors ~$5,400-10,756",
            url="https://octopart.com/090-02789-001-microchip-112141513")

# Seed sensor: off-the-shelf radios before our own board (2027-2029). bladeRF boards have one receive oscillator for their
# 2 channels, so one board per band pair: 2 boards for 4 cell antennas, 1 for 2 TV antennas, 1 for 2 GPS antennas
# (ASSUMPTION: time differences need 2 channels; bearings with 2 elements are coarse).
SEED = dict(boards=4, clock_dist_usd=45.0, cell_ant=4, tv_ant=2, gps_ant=2)

# Field kit for the mobile kit, per sensor and per kit (CITED retail prices, Nov 2026, research subagent).
KIT_PER_SENSOR = [
    dict(item="Transport case", part="Pelican 1610", usd=217.80, source="CITED: Army Property store sale price ($338.95 list)",
         url="https://store.armyproperty.com/products/pelican-1610-case.html"),
    dict(item="Telescoping tripod mast, 1.3-4 m", part="Chelegance TP13", usd=69.0, source="CITED: Chelegance store",
         url="https://chelegance.com/products/cntou-133-95-meter-antenna-mast-for-mc-599-jpc-7-antenna-pole-telescopic/"),
    dict(item="Battery for 24 h at ~60 W (2,048 Wh)", part="EcoFlow DELTA 2 Max", usd=1049.0, source="CITED: Watt48, Oct 2026",
         url="https://www.watt48.com/products/ecoflow-delta-2-max"),
    dict(item="Wireless link to the command laptop", part="Ubiquiti NanoStation 5AC Loco", usd=49.0, source="CITED: Ubiquiti store",
         url="https://store.ui.com/us/en/products/loco5ac"),
]
KIT_PER_KIT = [
    dict(item="Rugged command laptop (runs the hub software)", part="Dell Pro Rugged 14", usd=2594.0,
         source="CITED: reseller starting price (ToughOutlet); a refurbished Latitude 5430 Rugged is $749",
         url="https://toughoutlet.com/resources/how-much-does-a-toughbook-cost/"),
    dict(item="LTE router for alerts off site", part="Teltonika RUT241", usd=199.0, source="CITED: Walmart listing",
         url="https://www.walmart.com/ip/Teltonika-Networks-RUT241-4G-LTE-Cat-4-Cellular-Router-with-WAN-Failover-Wi-Fi-and-Remote-Management-US-Version/2537099546"),
    dict(item="Battery for the heat camera", part="EcoFlow DELTA 2 Max", usd=1049.0, source="CITED: Watt48, Oct 2026",
         url="https://www.watt48.com/products/ecoflow-delta-2-max"),
]
CAMERA = dict(item="Heat camera (bispectral PTZ)", part="Axis Q8752-E Mk II, 35 mm thermal lens", usd=32138.0,
              source="CITED: dealer price (Silarius), as financial model v2",
              url="https://silarius.com/products/axis-communications-q8752-e-outdoor-ptz-network-bispectral-bullet-camera-35mm-thermal-lens-30-fps")

# What each product is (sensor counts per product: from the twin's recommendations where a site is modeled).
PRODUCTS = {
    "site": dict(name="Tripwire Site", who="Prisons, jails and stadiums", sensors=6, cameras=0, install="pole", hub=1, setups=1),
    "site_cam": dict(name="Tripwire Site with heat camera", who="Prisons, jails and stadiums", sensors=6, cameras=1, install="pole", hub=1, setups=1),
    "large": dict(name="Large-perimeter site", who="Military installations, ports of entry", sensors=16, cameras=2, install="pole", hub=1, setups=4),
    "kit": dict(name="Mobile kit", who="Police and event security", sensors=6, cameras=1, install="tripod", hub=0, setups=0),
    "oem": dict(name="Sensor for integrators", who="Companies holding counter-drone contracts", sensors=1, cameras=0, install="none", hub=0, setups=0),
}
OEM_PACK_USD = 500.0  # ASSUMPTION (financial model v2): packaging and test per sensor sold to integrators


def _count(per: str, n: int) -> int:
    if per == "board":
        return n
    if per == "chip":
        return n * sum(math.ceil(c / 2) for c in BANKS.values())
    if per == "all":
        return n * CHANNELS
    if per == "antenna":
        return n * (CHANNELS + 1)
    if per in BANKS:
        return n * BANKS[per]
    raise ValueError(per)


def board(qty: float = 1000) -> dict:
    lines = []
    for b in BOARD:
        k = _count(b["per"], b["n"])
        unit = b["usd"] * volume_factor(qty, b["basis_qty"], CUSTOM)
        lines.append({**b, "count": k, "unit_at_qty": round(unit, 2), "line_usd": round(k * unit, 2)})
    parts = sum(l["line_usd"] for l in lines)
    asm = ASSEMBLY["usd_per_joint"] * ASSEMBLY["joints"] + ASSEMBLY["xray_usd_per_part"] * ASSEMBLY["xray_parts"]
    by_bank = {k: round(sum(l["line_usd"] for l in lines if l["per"] == k) + sum(l["line_usd"] * BANKS[k] / CHANNELS for l in lines if l["per"] in ("all", "antenna")), 2)
               for k in BANKS}
    return {"qty": qty, "banks": BANKS, "lines": lines, "parts_usd": round(parts, 2), "assembly_usd": round(asm, 2),
            "test_usd": TEST_USD, "total_usd": round(parts + asm + TEST_USD, 2), "nre_usd": NRE_USD, "front_end_by_bank": by_bank}


def sensor(qty: float = 1000) -> dict:
    b = board(qty)
    lines = [dict(item="Receiver board (16 channels, 3 banks)", part="Tripwire board v1", n=1, usd=b["total_usd"], source="parts list below", url="")]
    lines += [dict(l) for l in SENSOR]
    for l in lines:
        l["line_usd"] = round(l["n"] * l["usd"], 2)
    return {"lines": lines, "total_usd": round(sum(l["line_usd"] for l in lines), 2), "board": b}


def seed_sensor() -> dict:
    """Off-the-shelf multi-band sensor for Seed pilots and the first products (before our own board)."""
    s = SEED
    items = [
        ("bladeRF 2.0 micro xA4 boards (2 cell, 1 TV, 1 GPS)", s["boards"], RADIOS["bladerf"]["usd"], RADIOS["bladerf"]["source"]),
        ("Shared clock for 4 boards", 1, s["clock_dist_usd"], "ASSUMPTION (v0.5: $30 for 2 boards)"),
        ("Timing GNSS receiver", 1, 163.60, "CITED: u-blox ZED-F9T-20B, DigiKey, 250 units"),
        ("Holdover oscillator (OCXO)", 1, 50.00, "CITED: Connor-Winfield DOCSC012F, DigiKey, 50 units"),
        ("Edge computer", 1, 399.0, "CITED: Jetson Orin Nano Super, $399 since Jul 2026"),
        ("Cell antennas", s["cell_ant"], ANTENNAS["omni"].price_usd, "ASSUMPTION (as v0.5)"),
        ("TV antennas", s["tv_ant"], 59.99, "CITED: ClearStream 1MAX"),
        ("GPS patch antennas", s["gps_ant"], 12.27, "CITED: Taoglas AP.25E, DigiKey, 1 unit"),
        ("Enclosure, power, bracket, cables", 1, 209.31, "as the platform sensor"),
        ("Lightning arrestors", s["cell_ant"] + s["tv_ant"] + s["gps_ant"], 25.0, "ASSUMPTION"),
    ]
    lines = [dict(item=i, n=n, usd=u, line_usd=round(n * u, 2), source=src) for i, n, u, src in items]
    return {"lines": lines, "total_usd": round(sum(l["line_usd"] for l in lines), 2)}


def product(key: str, sensor_usd: float, sensors: int | None = None) -> dict:
    """Our cost to deliver one unit of a product: hardware and installation upfront, upkeep per year."""
    d = PRODUCTS[key]
    n = d["sensors"] if sensors is None else sensors
    fi, fm = FINANCE["install"], FINANCE["maintenance"]
    lines = [dict(item=f"Platform sensors x {n}", usd=round(n * sensor_usd, 2))]
    if d["cameras"]:
        lines.append(dict(item=f"{CAMERA['part']} x {d['cameras']}", usd=d["cameras"] * CAMERA["usd"], source=CAMERA["source"]))
    if key == "kit":
        lines.append(dict(item="Field kit per sensor (case, mast, battery, radio link) x %d" % n, usd=round(n * sum(x["usd"] for x in KIT_PER_SENSOR), 2)))
        lines.append(dict(item="Kit items (rugged laptop, LTE router, camera battery)", usd=round(sum(x["usd"] for x in KIT_PER_KIT), 2)))
    if key == "oem":
        lines.append(dict(item="Packaging and test for integrators", usd=OEM_PACK_USD, source="ASSUMPTION"))
    if d["hub"]:
        lines.append(dict(item="On-site hub computer", usd=HUB["usd"], source=HUB["source"]))
    install = 0.0
    if d["install"] == "pole":
        per = fi["tech_hours_per_sensor"] * fi["labour_rate_usd_per_h"] + fi["mounting_cabling_usd"]
        install = n * per + d["setups"] * fi["site_setup_usd"] + d["cameras"] * 1500.0  # ASSUMPTION: camera mount and cabling $1,500
        lines.append(dict(item="Installation (sensors, set-up, camera mounts)", usd=round(install, 2), source="v0.5 installation rates; camera mount ASSUMPTION"))
    hw = sum(l["usd"] for l in lines) - install
    yearly = 0.0
    if key != "oem":
        yearly = (n * (fm["visits_per_year"] * fm["hours_per_visit_per_sensor"] * fi["labour_rate_usd_per_h"]
                       + fm["spares_pct_of_hardware"] / 100 * sensor_usd + fm["software_usd_per_year"])
                  + 12 * fm["backhaul_usd_per_month"] + fm["cloud_usd_per_year"] + d["cameras"] * 0.05 * CAMERA["usd"])
    return {"key": key, **d, "sensors": n, "lines": lines, "hardware_usd": round(hw, 2), "install_usd": round(install, 2),
            "upfront_usd": round(hw + install, 2), "yearly_usd": round(yearly, 2)}


def export() -> dict:
    s = sensor(1000)
    doc = {"banks": BANKS, "sensor": s, "sensor_by_qty": {str(q): sensor(q)["total_usd"] for q in (100, 1000, 10000)},
           "board_by_qty": {str(q): board(q)["total_usd"] for q in (100, 1000, 10000)}, "seed_sensor": seed_sensor(),
           "csac": CSAC, "camera": CAMERA, "kit_per_sensor": KIT_PER_SENSOR, "kit_per_kit": KIT_PER_KIT,
           "assembly": ASSEMBLY, "nre_usd": NRE_USD,
           "products": {k: product(k, s["total_usd"]) for k in PRODUCTS},
           "products_seed": {k: product(k, seed_sensor()["total_usd"]) for k in PRODUCTS},
           "v05_sensor_usd": 1601.0, "v05_note": "v0.5 own-receiver sensor (cell only), Tripwire_Assumptions_and_Figures.md"}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=1))
    return doc


if __name__ == "__main__":
    d = export()
    b = d["sensor"]["board"]
    for l in b["lines"]:
        print(f'{l["count"]:>3} x {l["part"][:44]:<44} {l["unit_at_qty"]:>8.2f} {l["line_usd"]:>8.2f}')
    print("board", b["total_usd"], "by qty", d["board_by_qty"], "front ends", b["front_end_by_bank"])
    for l in d["sensor"]["lines"]:
        print(f'{l["n"]:>3} x {l["item"][:50]:<50} {l["line_usd"]:>9.2f}')
    print("sensor", d["sensor"]["total_usd"], d["sensor_by_qty"], "seed", d["seed_sensor"]["total_usd"])
    for k, p in d["products"].items():
        print(k, p["sensors"], "upfront", p["upfront_usd"], "yearly", p["yearly_usd"], "| seed", d["products_seed"][k]["upfront_usd"])

"""Hardware cost of a listener node and the per-zone economics from the Seed Pitch Data Package.

Seed plan: off-the-shelf radios (B210 or bladeRF). Series A option: a custom multichannel receiver,
costed bottom-up with a volume curve. Every input is tagged CITED or ASSUMPTION; the same numbers are
written to web/runs/cost_model.json for the viewer (one source of truth).
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from .antenna import ANTENNAS

ROOT = Path(__file__).resolve().parent.parent

RADIOS = {
    "b210": {"name": "USRP B210", "channels": 2, "bits": 12, "usd": 2387.0, "stage": "Seed",
             "source": "CITED: Ettus board price, data package ref [1]"},
    "bladerf": {"name": "bladeRF 2.0 micro xA4", "channels": 2, "bits": 12, "usd": 540.0, "stage": "Seed",
                "source": "CITED: Nuand shop listing, Nov 2026 (confirm with a quote)"},
    "custom": {"name": "Custom multichannel receiver", "channels": 8, "bits": 12, "usd": None, "stage": "Series A",
               "source": "bottom-up parts list below (CUSTOM_BOM): distributor prices where CITED, else ASSUMPTION"},
}
EXCLUDED_RADIOS = {
    "krakensdr": "KrakenSDR: 5 coherent channels for ~$1,273 (third-party listing), but 8-bit ADCs fail on the "
                 "strong direct signals (risk R6)",
}

# Custom receiver: an 8-channel, receive-only board (Series A). Bill of materials per board, each line priced
# at a real distributor quantity break (CITED, Nov 2026) or labeled ASSUMPTION. Architecture (ASSUMPTION):
# four 2-channel LMS7002M transceivers on one GNSS-disciplined 40 MHz reference, an Artix-7 FPGA that merges
# the channels and streams them over PCIe to the edge computer (8 x 15.36 MS/s x 24 bit = ~3 Gbit/s at
# 10 MHz LTE, too much for USB or gigabit Ethernet), and a noise source switched into every input to
# measure the phase offsets between channels (separate transceiver chips do not share a phase).
# "per": "board" (fixed count), "channel" (x channels), "transceiver" (x ceil(channels/2)),
#        "channel+N" (channels + N). "basis_qty" is the quantity the price was quoted at; volume_factor()
#        moves it to the build quantity.
DK = "https://www.digikey.com/en/products/detail/"
MC = "https://www.minicircuits.com/WebStore/dashboard.html?model="
CUSTOM_BOM = [
    dict(item="RF transceiver (2 receive channels, 100 kHz-3.8 GHz, 12-bit)", part="Lime Microsystems LMS7002M",
         per="transceiver", n=1, usd=127.82, basis_qty=100,
         source="CITED: DigiKey, 100-unit tray price, Nov 2026", url=DK + "lime-microsystems-ltd/LMS7002M/5012880"),
    dict(item="FPGA (collects 4 transceivers, PCIe Gen2 to the computer)", part="AMD Artix-7 XC7A50T-1CSG325C",
         per="board", n=1, usd=99.56, basis_qty=1,
         source="CITED: DigiKey, 1-unit price, Nov 2026 (52-week lead time)",
         url="https://www.digikey.com/en/products/result?keywords=XC7A50T-1CSG325C"),
    dict(item="Low-noise amplifier (one per input, two more for the calibration noise source)",
         part="Mini-Circuits PSA4-5043+ (50 MHz-4 GHz, NF 0.75 dB)", per="channel+2", n=1, usd=1.72, basis_qty=1000,
         source="CITED: Mini-Circuits price table, 1,000 units, Nov 2026", url=MC + "PSA4-5043%2B"),
    dict(item="Band filter (rejects out-of-band strong signals)", part="Mini-Circuits LFCN-900+ low-pass, DC-850 MHz",
         per="channel", n=1, usd=1.52, basis_qty=1000,
         source="CITED: Mini-Circuits price table, 1,000 units, Nov 2026", url=MC + "LFCN-900%2B"),
    dict(item="Balun (single-ended antenna to differential transceiver input)", part="TDK HHM1944A4 (698-960 MHz)",
         per="channel", n=1, usd=0.22, basis_qty=1,
         source="CITED: DigiKey, 1-unit price ($0.094 at 10,000), Nov 2026. Does not cover T-Mobile B71 (617-652 MHz): "
                "a wideband balun such as Mini-Circuits TCM1-83X+ is $8.68 at 1,000",
         url=DK + "tdk/HHM1944A4/15217744"),
    dict(item="Calibration switch (antenna or noise source, per input)", part="Infineon BGS12WN6 SPDT, 50 MHz-9 GHz",
         per="channel", n=1, usd=0.13943, basis_qty=1000,
         source="CITED: DigiKey, 1,000-unit price, Nov 2026", url=DK + "infineon-technologies/BGS12WN6E6327XTSA1/11500249"),
    dict(item="Reference oscillator, GNSS-disciplined", part="Taitien TXEAACSANF-40.000000 VCTCXO, 40 MHz, +/-0.5 ppm",
         per="board", n=1, usd=2.10866, basis_qty=500,
         source="CITED: DigiKey, 500-unit price, Nov 2026", url=DK + "taitien/TXEAACSANF-40-000000/6127601"),
    dict(item="Clock fan-out (reference to 4 transceivers + FPGA)", part="TI CDCLVC1104PWR, 1:4 buffer", per="board", n=2,
         usd=3.10744, basis_qty=500, source="CITED: DigiKey, 500-unit price, Nov 2026",
         url="https://www.digikey.com/en/products/result?keywords=CDCLVC1104PWR"),
    dict(item="GNSS receiver (frequency discipline, frame time stamps)", part="u-blox NEO-F10N-00B", per="board", n=1,
         usd=16.22, basis_qty=1,
         source="CITED: DigiKey, 1-unit price, Nov 2026. ASSUMPTION: navigation grade is enough because each node "
                "measures echo delay against the tower's direct signal; timing grade (u-blox ZED-F9T-00B) is "
                "$163.60 at 250", url=DK + "u-blox/NEO-F10N-00B/21363346"),
    dict(item="Power management IC (4 outputs)", part="TI TPS65400RGZR", per="board", n=1, usd=4.65732, basis_qty=250,
         source="CITED: DigiKey, 250-unit price, Nov 2026", url="https://www.digikey.com/en/products/result?keywords=TPS65400RGZR"),
    dict(item="Low-noise regulators for the RF and clock supplies", part="about 6 low-noise LDOs", per="board", n=1,
         usd=8.0, basis_qty=1000, source="ASSUMPTION", url=""),
    dict(item="RF connectors (antenna inputs + GNSS)", part="Amphenol RF 132134 SMA jack", per="channel+1", n=1,
         usd=7.30, basis_qty=1, source="CITED: DigiKey, 1-unit price, Nov 2026", url=DK + "amphenol-rf/132134/1011907"),
    dict(item="PCIe link to the edge computer (M.2 connector and cable)", part="M.2 / PCIe cable assembly", per="board",
         n=1, usd=15.0, basis_qty=1000, source="ASSUMPTION", url=""),
    dict(item="Passives, configuration flash, ESD protection, small ICs", part="about 400 parts", per="board", n=1,
         usd=25.0, basis_qty=1000, source="ASSUMPTION", url=""),
    dict(item="RF shield cans", part="one per transceiver + front end", per="board", n=1, usd=8.0, basis_qty=1000,
         source="ASSUMPTION", url=""),
    dict(item="Bare board: 8-layer, controlled impedance, about 120 x 100 mm", part="PCB fabrication", per="board", n=1,
         usd=20.0, basis_qty=1000,
         source="ASSUMPTION (needs a quote). Reference: a 6-layer 100 x 80 mm impedance board is about $8.50-9.50 "
                "at JLCPCB (AtlasPCB estimate, 2026)",
         url="https://www.atlaspcb.com/blog/jlcpcb-vs-custom-pcb-manufacturer-production-volume-cost-2026/"),
]
# SMT assembly, from JLCPCB's published rates (CITED, Nov 2026): $0.0016 per solder joint, X-ray $0.25 per
# BGA/QFN part at 501-1,000 pieces. Joint count is an ASSUMPTION (FPGA 325 balls, 4 x LMS7002M 261 pads,
# ~400 passives x 2, other ICs ~250).
ASSEMBLY = dict(usd_per_joint=0.0016, joints=2420, xray_usd_per_part=0.25, xray_parts=6,
                source="CITED: JLCPCB assembly price page (Nov 2026); joint count ASSUMPTION",
                url="https://jlcpcb.com/help/article/pcb-assembly-price")
CUSTOM = {
    "test_calibration_usd": 25.0,  # ASSUMPTION: ~15 min of automated test and phase calibration per board + fixture
    "learning_per_doubling": 0.93,  # ASSUMPTION: price falls 7 % per doubling of quantity from its quoted basis
    "volume_floor": 0.5,  # ASSUMPTION: never below half the quoted price
    "nre_usd": 400000.0,  # ASSUMPTION: one-time design, certification and test
}


NODE = {
    "compute_usd": 400.0,  # ASSUMPTION: edge computer
    "compute_per_extra_4ch_usd": 300.0,  # ASSUMPTION
    "compute_full_signal_factor": 2.0,  # ASSUMPTION: full-signal processing needs ~2x the computer
    "gnss_usd": 150.0,  # ASSUMPTION: GNSS timing (off-the-shelf builds)
    "clock_dist_usd": 350.0,  # ASSUMPTION: 10 MHz/PPS distribution when more than one radio board
    "enclosure_usd": 450.0,  # ASSUMPTION: enclosure, power, mast hardware
    "mic_usd": 100.0,  # ASSUMPTION: MEMS microphone array + digitiser per node
}

# Seed Pitch Data Package, Operating assumptions (planning numbers, not measurements).
# hardware_target_usd and install_margin_target are the data package's pre-prototype planning figures, kept
# only for the archived v0.3 viewer and its test. Hardware cost is an output of this model, not a target.
ZONE = {
    "nodes_per_zone": 3,
    "install_price_usd": 50000.0,
    "subscription_usd_per_year": 18000.0,
    "hardware_target_usd": 24000.0,
    "deployment_usd": 6000.0,
    "maintenance_usd_per_year": 5000.0,
    "install_margin_target": 0.40,
    "years": 5,  # memo: five-year deployment period
    "incumbent_usd": 104000.0,  # memo: ~$104,000 incumbent package
}


# Financial defaults for the viewer's Financials tab (all editable there). Per sensor unless noted.
# Defaults are set so 3 sensors add up to the data package's $6,000 deployment and ~$5,000/yr
# maintenance (ASSUMPTIONS), with pricing per facility by coverage tier.
FINANCE = {
    "install": {
        "tech_hours_per_sensor": 16,  # ASSUMPTION: 2 technicians x 8 h (mount, cable, align, test)
        "labour_rate_usd_per_h": 95.0,  # ASSUMPTION: field technician, loaded rate
        "mounting_cabling_usd": 480.0,  # ASSUMPTION: brackets, cable, surge protection
        "site_works_usd": 0.0,  # pole, power, network to each sensor: customer provides (data package)
        "site_setup_usd": 2500.0,  # ASSUMPTION, per facility: radio survey, calibration, software set-up
    },
    "maintenance": {
        "visits_per_year": 1,  # ASSUMPTION
        "hours_per_visit_per_sensor": 8,  # ASSUMPTION
        "spares_pct_of_hardware": 10.0,  # ASSUMPTION
        "connectivity_usd_per_month": 25.0,  # ASSUMPTION: LTE modem data plan
        "software_usd_per_year": 300.0,  # ASSUMPTION: cloud, updates, monitoring
    },
    "pricing": {  # per facility. v0.4.1: price = our cost + margin (the customer picks an option from the menu);
        # the tier prices below are kept for reference only.
        # ASSUMPTION: margins reproduce the data package's planning numbers: $50,000 installation on $24,000
        # hardware + $6,000 deployment = 40 %; $18,000/yr subscription on $5,000/yr maintenance = 72 %.
        "margin_upfront_pct": 40.0,
        "margin_yearly_pct": 72.0,
        "install_price_usd": 50000.0,  # data package
        "tiers": {"80": 18000.0, "90": 30000.0, "95": 42000.0},  # $/yr: 80 % = data package; 90/95 % ASSUMPTION
        # anchored on the AirSight subscription range ($9,071-42,143/yr, data package ref [4])
        "years": 5,
    },
    "benchmarks": {
        "axon_hardware_install_usd": 57915.0,  # data package ref [3]
        "airsight_subscription_low_usd": 9071.0,  # data package ref [4]
        "airsight_subscription_high_usd": 42143.0,  # data package ref [4]
    },
}


def facility_costs(n: int, node_usd: float, f=FINANCE) -> dict:
    """Our cost for a facility with n sensors (upfront and per year)."""
    i, m = f["install"], f["maintenance"]
    install = n * (i["tech_hours_per_sensor"] * i["labour_rate_usd_per_h"] + i["mounting_cabling_usd"] + i["site_works_usd"]) + i["site_setup_usd"]
    yearly = n * (m["visits_per_year"] * m["hours_per_visit_per_sensor"] * i["labour_rate_usd_per_h"]
                  + m["spares_pct_of_hardware"] / 100 * node_usd + 12 * m["connectivity_usd_per_month"] + m["software_usd_per_year"])
    return {"hardware": n * node_usd, "install": install, "upfront": n * node_usd + install, "yearly": yearly}


def customer_price(upfront: float, yearly: float, f=FINANCE) -> dict:
    """What the customer pays: our cost plus margin (installation price, yearly subscription, total over the contract)."""
    pr = f["pricing"]
    price = upfront / (1 - pr["margin_upfront_pct"] / 100)
    sub = yearly / (1 - pr["margin_yearly_pct"] / 100)
    return {"price": price, "sub": sub, "customer_total": price + pr["years"] * sub}


def volume_factor(qty: float, basis_qty: float = 1.0, c=CUSTOM) -> float:
    """Price multiplier from a price quoted at basis_qty to qty: x0.93 per doubling, never below half."""
    return max(c["volume_floor"], c["learning_per_doubling"] ** math.log2(max(qty, 1.0) / max(basis_qty, 1.0)))


def _count(per: str, n: int, channels: int) -> int:
    if per == "board":
        return n
    if per == "channel":
        return n * channels
    if per == "transceiver":
        return n * math.ceil(channels / 2)
    if per.startswith("channel+"):
        return n * (channels + int(per.split("+")[1]))
    raise ValueError(per)


def custom_board_breakdown(channels: int = 8, qty: float = 1000, c=CUSTOM, bom=CUSTOM_BOM, asm=ASSEMBLY) -> dict:
    """Bill of materials for one custom board at a build quantity: each line's count, unit price at that
    quantity and line cost, then assembly, test and the design cost (NRE) spread over the build."""
    lines = []
    for b in bom:
        k = _count(b["per"], b["n"], channels)
        unit = b["usd"] * volume_factor(qty, b["basis_qty"], c)
        lines.append({**b, "count": k, "unit_at_qty": round(unit, 2), "line_usd": round(k * unit, 2)})
    parts = sum(ln["line_usd"] for ln in lines)
    assembly = asm["usd_per_joint"] * asm["joints"] + asm["xray_usd_per_part"] * asm["xray_parts"]
    nre = c["nre_usd"] / max(qty, 1.0)
    total = parts + assembly + c["test_calibration_usd"] + nre
    return {"channels": channels, "qty": qty, "lines": lines, "parts_usd": round(parts, 2),
            "assembly_usd": round(assembly, 2), "test_usd": c["test_calibration_usd"], "nre_per_board_usd": round(nre, 2),
            "total_usd": round(total, 2)}


def custom_board_usd(channels: int, qty: float = 1000, include_nre=True, c=CUSTOM) -> float:
    b = custom_board_breakdown(channels, qty, c)
    return b["total_usd"] - (0.0 if include_nre else b["nre_per_board_usd"])


def node_cost(elements: int, antenna: str, radio: str = "bladerf", processing: str = "crs_p0",
              mic: bool = False, qty: float = 1000) -> dict:
    """Parts cost of one node. Off-the-shelf radios: ceil(M/2) two-channel boards (CRS processing needs no
    separate reference channel). Custom: one board with M channels (own GNSS and clock)."""
    m = max(int(elements), 1)
    ant = ANTENNAS.get(antenna)
    items = {}
    if radio == "custom":
        items["receiver"] = custom_board_usd(m, qty)
    else:
        r = RADIOS[radio]
        boards = math.ceil(m / r["channels"])
        items["receiver"] = boards * r["usd"]
        items["gnss_timing"] = NODE["gnss_usd"]
        if boards > 1:
            items["clock_distribution"] = NODE["clock_dist_usd"]
    comp = NODE["compute_usd"] + NODE["compute_per_extra_4ch_usd"] * ((m - 1) // 4)
    items["computer"] = comp * (NODE["compute_full_signal_factor"] if processing == "full" else 1.0)
    items["antennas"] = m * (ant.price_usd if ant else 100.0)
    items["enclosure_power_mast"] = NODE["enclosure_usd"]
    if mic:
        items["microphones"] = NODE["mic_usd"]
    return {"items": {k: round(v, 2) for k, v in items.items()}, "total": round(sum(items.values()), 2)}


def facility_economics(n_nodes: int, node_usd: float, z=ZONE) -> dict:
    """A facility needing n nodes is billed as ceil(n/3) zones at data-package prices."""
    zones = math.ceil(n_nodes / z["nodes_per_zone"])
    hw_zone = node_usd * z["nodes_per_zone"]
    install_margin = (z["install_price_usd"] - hw_zone - z["deployment_usd"]) / z["install_price_usd"]
    customer = zones * (z["install_price_usd"] + z["years"] * z["subscription_usd_per_year"])
    return {"zones": zones, "hardware_per_zone": round(hw_zone), "hardware_facility": round(node_usd * n_nodes),
            "hardware_gate_pass": hw_zone <= z["hardware_target_usd"], "install_margin": round(install_margin, 3),
            "customer_5yr": round(customer), "vs_incumbent": round(customer / z["incumbent_usd"], 2)}


def export(path: Path | None = None) -> dict:
    doc = {"radios": RADIOS, "excluded_radios": EXCLUDED_RADIOS, "custom": CUSTOM, "custom_bom": CUSTOM_BOM,
           "custom_assembly": ASSEMBLY, "custom_breakdown": {str(q): custom_board_breakdown(8, q) for q in (100, 1000, 10000)},
           "node": NODE, "zone": ZONE, "finance": FINANCE,
           "antennas": {k: {"name": a.name, "gain_dbi": a.gain_dbi, "az_bw_deg": a.az_bw_deg, "el_bw_deg": a.el_bw_deg,
                            "front_to_back_db": a.front_to_back_db, "price_usd": a.price_usd, "size": a.size}
                        for k, a in ANTENNAS.items()},
           "custom_board_examples": {str(ch): {str(q): round(custom_board_usd(ch, q)) for q in (100, 1000, 10000)}
                                     for ch in (2, 4, 8)}}
    path = path or ROOT / "web" / "runs" / "cost_model.json"
    path.write_text(json.dumps(doc, indent=1))
    return doc


if __name__ == "__main__":
    d = export()
    print(json.dumps(d["custom_board_examples"], indent=1))
    b = custom_board_breakdown(8, 1000)
    for ln in b["lines"]:
        print(f'{ln["count"]:>3} x {ln["part"][:48]:<48} {ln["unit_at_qty"]:>8.2f} {ln["line_usd"]:>8.2f}')
    print(f'parts {b["parts_usd"]}, assembly {b["assembly_usd"]}, test {b["test_usd"]}, NRE/board {b["nre_per_board_usd"]}, '
          f'total {b["total_usd"]} at 1,000 boards')
    for m, a, r in [(1, "patch", "bladerf"), (4, "patch", "bladerf"), (4, "patch", "b210"), (8, "omni", "custom")]:
        print(m, a, r, node_cost(m, a, r))

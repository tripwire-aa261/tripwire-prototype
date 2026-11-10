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
               "source": "bottom-up estimate below (ASSUMPTIONS)"},
}
EXCLUDED_RADIOS = {
    "krakensdr": "KrakenSDR: 5 coherent channels for ~$1,273 (third-party listing), but 8-bit ADCs fail on the "
                 "strong direct signals (risk R6)",
}

# Custom receiver bill of materials for one board with `channels` coherent channels (ASSUMPTIONS except
# the transceiver price). Unit prices fall with volume: x0.93 per doubling of quantity, floor 50 %.
CUSTOM = {
    "transceiver_2ch_usd": 452.88,  # CITED: AD9361BBCZ, Digi-Key, quantity 1 (Nov 2026)
    "fpga_soc_usd": 150.0,  # ASSUMPTION: Zynq-class SoC, small
    "clock_gnss_usd": 120.0,  # ASSUMPTION: shared LO/clock distribution + GNSS-disciplined oscillator
    "frontend_per_channel_usd": 15.0,  # ASSUMPTION: filter + LNA per channel
    "pcb_assembly_usd": 150.0,  # ASSUMPTION
    "learning_per_doubling": 0.93,  # ASSUMPTION
    "volume_floor": 0.5,  # ASSUMPTION
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
    "pricing": {  # per facility; the tier is the coverage the customer buys
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


def volume_factor(qty: float, c=CUSTOM) -> float:
    return max(c["volume_floor"], c["learning_per_doubling"] ** math.log2(max(qty, 1.0)))


def custom_board_usd(channels: int, qty: float = 1000, include_nre=True, c=CUSTOM) -> float:
    parts = (math.ceil(channels / 2) * c["transceiver_2ch_usd"] + c["fpga_soc_usd"] + c["clock_gnss_usd"]
             + channels * c["frontend_per_channel_usd"] + c["pcb_assembly_usd"])
    return parts * volume_factor(qty, c) + (c["nre_usd"] / qty if include_nre else 0.0)


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
    doc = {"radios": RADIOS, "excluded_radios": EXCLUDED_RADIOS, "custom": CUSTOM, "node": NODE, "zone": ZONE, "finance": FINANCE,
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
    for m, a, r in [(1, "patch", "bladerf"), (4, "patch", "bladerf"), (4, "patch", "b210"), (8, "omni", "custom")]:
        print(m, a, r, node_cost(m, a, r))

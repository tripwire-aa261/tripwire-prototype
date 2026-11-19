"""Feed the platform prototype v1.0 into financial model v2: sensor costs from the parts list (twin/platform_bom.py) and
sensors per product from the twin (twin/explore_v1.py), then rebuild web/financial-model-v2.html.

    python -m tools.model_from_platform            (prints old -> new for every changed constant)
Sensor counts are for a 0.9 kg drone at today's 20 dB of interference removal: Hays State Prison for a site, the larger
of the Robins flightline and the Pharr-Reynosa port for a large-perimeter site, Centennial Olympic Park for a kit.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from twin.cost import FINANCE  # noqa: E402
from twin.platform_bom import KIT_PER_KIT, KIT_PER_SENSOR, NRE_USD, seed_sensor, sensor  # noqa: E402

SRC = ROOT / "web" / "model-v2-src"


def per_sensor_yearly(u):
    fi, fm = FINANCE["install"], FINANCE["maintenance"]
    return round(fm["visits_per_year"] * fm["hours_per_visit_per_sensor"] * fi["labour_rate_usd_per_h"]
                 + fm["spares_pct_of_hardware"] / 100 * u + fm["software_usd_per_year"], 2)


def counts():
    ex = json.loads((ROOT / "platform" / "data" / "explore.json").read_text())
    r = lambda s, b: ex["recommended"][f"{s}|mavic|20"][b]["n"]  # noqa: E731
    return {"site_seed": r("hays", "seed"), "site_own": r("hays", "platform"),
            "large_seed": max(r("robins", "seed"), r("poe", "seed")), "large_own": max(r("robins", "platform"), r("poe", "platform")),
            "kit": r("event", "platform")}


def main():
    s, sd, c = sensor(1000)["total_usd"], seed_sensor()["total_usd"], counts()
    kit = round(c["kit"] * sum(x["usd"] for x in KIT_PER_SENSOR) + sum(x["usd"] for x in KIT_PER_KIT))
    new = {"bladeCost": sd, "customCost": s, "runPerSensor": per_sensor_yearly(sd), "runPerSensorCustom": per_sensor_yearly(s),
           "siteSensorsBlade": c["site_seed"], "siteSensorsCustom": c["site_own"], "largeSensorsBlade": c["large_seed"],
           "largeSensorsCustom": c["large_own"], "kitSensors": c["kit"], "kitCaseCost": kit, "oscCost": 0, "nre": int(NRE_USD)}
    p = SRC / "model2.js"
    js = p.read_text(encoding="utf-8")
    for k, v in new.items():
        m = re.search(rf"\b{k}: ([0-9.]+)", js)
        print(f"{k}: {m.group(1)} -> {v}")
        js = js[:m.start(1)] + str(v) + js[m.end(1):]
    js = js.replace("// sensor and site costs: prototype figures (sections 2-5, 8)",
                    "// sensor and site costs: platform prototype v1.0 (twin/platform_bom.py: Seed sensor = bladeCost, own 3-bank board = customCost;\n"
                    "  // sensors per product from twin/explore_v1.py, 0.9 kg drone at 20 dB; tools/model_from_platform.py writes these)")
    js = re.sub(r"kitCaseCost: ([0-9.]+),( +)// .*", r"kitCaseCost: \1,\2// field kit per sensor (case, mast, battery, radio link) + rugged laptop, LTE router, camera battery (platform_bom.py)", js)
    js = re.sub(r"oscCost: 0,( +)// .*", r"oscCost: 0,\1// holdover oscillator now in every platform sensor (OCXO on the board)", js)
    js = re.sub(r"(largeCams: 2,)( *)// .*", r"\1\2// sensors: twin, larger of Robins AFB flightline (48 ha, ~4x Hays) and Pharr-Reynosa port, cell + TV", js)
    js = re.sub(r"(nre: [0-9]+, nreQ: 6,)( *)// .*", r"\1\2// three-bank board design and certification (ASSUMPTION, platform_bom.py), 6 quarters before it ships", js)
    p.write_text(js, encoding="utf-8")
    u = SRC / "ui2.js"
    ui = u.read_text(encoding="utf-8")
    ui = re.sub(r"'Sensor \$[0-9,]+ instead of \$[0-9,]+ and \d+ per site instead of \d+ \(prototype[^']*\)\. Design \$[0-9]+k\.'",
                f"'Sensor ${s:,.0f} instead of ${sd:,.0f} and {c['site_own']} per site instead of {c['site_seed']} (platform prototype v1.0). Design ${NRE_USD / 1e3:.0f}k.'", ui)
    ui = re.sub(r"'ASSUMPTION\. Our cost is ~\$[0-9,]+-[0-9,]+\.'", f"'ASSUMPTION. Our cost is ~${s:,.0f}-{sd:,.0f} per sensor.'", ui)
    ui = ui.replace("'Costs per sensor, installation and upkeep: Tripwire digital twin v0.5.1 (Tripwire_Assumptions_and_Figures.md, sections 2-5 and 8).'",
                    "'Costs per sensor and sensors per product: Tripwire platform prototype v1.0 (parts list twin/platform_bom.py, sensor counts twin/explore_v1.py); installation and upkeep rates: digital twin v0.5.1.'")
    u.write_text(ui, encoding="utf-8")
    out = ROOT / "web" / "financial-model-v2.html"
    head = (ROOT / "web" / "financial-model.html").read_text(encoding="utf-8").splitlines(keepends=True)[:181]
    html = "".join(head).replace("<title>Tripwire Financial Model</title>", "<title>Tripwire Model v2</title>")
    html += "".join((SRC / f).read_text(encoding="utf-8") for f in ("style_extra.css", "body2.html", "model2.js", "ui2.js"))
    out.write_text(html, encoding="utf-8")
    print("rebuilt", out, len(html))


if __name__ == "__main__":
    main()

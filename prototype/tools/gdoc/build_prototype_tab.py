import base64, html, re, sys
from PIL import Image

D = sys.argv[1]  # folder with the _s.jpg images
OUT = sys.argv[2]

ARIAL = "font-family:Arial;font-size:11pt;color:#000000;font-weight:400;font-style:normal"
LATO = "font-family:Lato;font-size:9.5pt;color:#000000;font-weight:400;font-style:normal"
PZERO = "margin-left:0pt;text-indent:0pt"


def inl(s, base=ARIAL):
    """**bold**, *italic*, [text](url), `code`, [[PLACEHOLDER]] -> styled spans."""
    out, i = [], 0
    pat = re.compile(r"\*\*(.+?)\*\*|\[\[(.+?)\]\]|\[(.+?)\]\((.+?)\)|\*(.+?)\*|`(.+?)`")
    for m in pat.finditer(s):
        if m.start() > i:
            out.append(f'<span style="{base}">{html.escape(s[i:m.start()])}</span>')
        if m.group(1):
            out.append(f'<span style="{base.replace("font-weight:400", "font-weight:700")}">{html.escape(m.group(1))}</span>')
        elif m.group(2):
            out.append(f'<span style="{base.replace("font-weight:400", "font-weight:700")};background-color:#fff2cc">[{html.escape(m.group(2))}]</span>')
        elif m.group(3):
            out.append(f'<a href="{html.escape(m.group(4))}"><span style="{base.replace("color:#000000", "color:#1155cc")};text-decoration:underline">{html.escape(m.group(3))}</span></a>')
        elif m.group(5):
            out.append(f'<span style="{base.replace("font-style:normal", "font-style:italic")}">{html.escape(m.group(5))}</span>')
        else:
            out.append(f'<span style="{base.replace("font-family:Arial", "font-family:Courier New")}">{html.escape(m.group(6))}</span>')
        i = m.end()
    if i < len(s):
        out.append(f'<span style="{base}">{html.escape(s[i:])}</span>')
    return ''.join(out)


def H(level, text):
    size, fam, top, bot = {1: ('20pt', 'Arial', '20pt', '6pt'), 2: ('16pt', 'Arial', '18pt', '6pt'), 3: ('13pt', 'Lato', '14pt', '4pt')}[level]
    return f'<h{level} style="margin-top:{top};margin-bottom:{bot};{PZERO};padding-left:0pt"><span style="font-family:{fam};font-size:{size};font-weight:700;color:#000000">{html.escape(text)}</span></h{level}>'


def P(text):
    return f'<p style="margin-top:0pt;margin-bottom:8pt;line-height:1.15;{PZERO}">{inl(text)}</p>'


def UL(items, ordered=False):
    tag = 'ol' if ordered else 'ul'
    return f'<{tag} style="margin-top:0pt;margin-bottom:8pt">' + ''.join(f'<li style="{ARIAL}"><p style="margin-top:0pt;margin-bottom:2pt">{inl(x)}</p></li>' for x in items) + f'</{tag}>'


def TABLE(rows, widths):
    td = 'border:1pt solid #d9d9d9;padding:4pt 5pt;vertical-align:top'
    hd = LATO.replace('color:#000000;font-weight:400', 'color:#ffffff;font-weight:700')
    out = ['<table style="border:none;border-collapse:collapse;margin-left:0pt"><colgroup>' + ''.join(f'<col width="{w}">' for w in widths) + '</colgroup><tbody>']
    for i, r in enumerate(rows):
        out.append('<tr>' + ''.join(
            f'<td style="{td};background-color:{"#23445b" if i == 0 else "#ffffff"}"><p style="margin-top:0pt;margin-bottom:0pt;line-height:1.15">{inl(c, hd if i == 0 else LATO)}</p></td>' for c in r) + '</tr>')
    out.append('</tbody></table><p style="margin-top:0pt;margin-bottom:8pt"></p>')
    return ''.join(out)


def IMG(name, caption):
    path = f'{D}/{name}'
    w, h = Image.open(path).size
    b = base64.b64encode(open(path, 'rb').read()).decode()
    small = ARIAL.replace('font-size:11pt', 'font-size:9pt').replace('color:#000000', 'color:#666666')
    return (f'<p style="margin-top:4pt;margin-bottom:0pt;{PZERO}"><img src="data:image/jpeg;base64,{b}" width="624" height="{round(624 * h / w)}" alt="{html.escape(caption[:60])}"></p>'
            f'<p style="margin-top:2pt;margin-bottom:10pt;{PZERO}">{inl(caption, small)}</p>')


REPO = 'https://github.com/tripwire-aa261/tripwire-prototype'
MODEL = 'https://claude.ai/artifact/1AEzgXgBakzE4U8wNmUqwb'

parts = [
    H(1, 'Tripwire prototype: a walkthrough'),
    P('Tripwire detects drones at prisons and stadiums with sensors that only listen: they pick up drone echoes of the signals cell towers already send. Our prototype has three parts. Each answers a question we could not answer by argument alone, and together they shaped the business plan in the other tabs. Reading this page and trying the two links takes about 15 minutes.'),
    TABLE([
        ['Part', 'What it is', 'Where', 'The question it answers'],
        ['1. Digital twin', 'Signal simulator of four real sites: two Georgia prisons, Fulton County Jail in Atlanta and Clemson Memorial Stadium', '[[PROTOTYPE LINK]] · [[RECORDING]] · [code](' + REPO + ')', 'Does it work at a real site, with how many sensors, and at what cost?'],
        ['2. Financial model', 'Quarterly model of the company, 2027-2042', f'[Financial model]({MODEL}) (also `prototype/web/financial-model.html` in the repo)', 'How much money does the company need, and can it reach $100M a year?'],
        ['3. Hardware tests', 'GPS signal shadowing with phones at Lake Lagunita (an ESP32 Wi-Fi motion test follows next week)', 'Figures below', 'Can a receive-only node really see a drone\'s effect on a signal already in the air?'],
    ], [96, 168, 168, 192]),

    H(2, 'Why the prototype looks the way it does'),
    P('We could not test the real product as students. We cannot fly drones next to a prison, campus has poor cell coverage, and a sensor built on bladeRF radios costs about $1,825 before we know how many a site needs. So we built the product in software first, at real sites, from public data: building outlines from OpenStreetMap, terrain from USGS, and cell towers from the FCC tower register. The signal simulation is calibrated against a published passive-radar trial that used cell signals (Demissie and Steffes, 2025).'),
    P('That answered the engineering and cost questions. It left one physical claim to show with hardware: that a receive-only node can notice a drone in a signal it did not send. The phone test at Lake Lagunita shows that with GPS satellites instead of cell towers.'),

    H(2, '1. Software prototype: the digital twin'),
    P('Open [[PROTOTYPE LINK]] or watch [[RECORDING]]. To run it locally, clone the [repo](' + REPO + '), then run `python serve.py` in `prototype/` and open http://localhost:8000. It has four tabs.'),
    H(3, 'Overview: what we can promise a customer'),
    IMG('tab_overview_s.jpg', 'Overview tab at Hays State Prison: we enter what a customer asks for (five requirements, top), and the twin recommends the radio and number of sensors and shows the coverage, performance and price we can promise.'),
    UL([
        '**Try:** pick a site (Hancock, Hays, Fulton County Jail, Clemson), then move the sliders for area covered, time tracked, accuracy and detection range.',
        '**Look for:** the recommended radio and number of sensors, the coverage map with the cell towers used, and the suggested price next to today\'s alternatives.',
        '**What it showed us:** Hays works with today\'s processing (4 of our own sensors or 6 bladeRF sensors); the other three sites do not.',
    ]),
    H(3, 'Trade space simulator: how many sensors, which radio'),
    IMG('tab_sim_s.jpg', 'Trade space simulator: protection and the customer\'s 5-year cost against the number of sensors, for each radio.'),
    UL([
        '**Try:** switch interference removal from 20 dB (today\'s assumption) to 30 and 40 dB, and switch radios.',
        '**Look for:** coverage flattens after a few sensors, while cost keeps rising; the B210 radio costs far more than bladeRF or our own receiver for the same protection.',
    ]),
    H(3, '3D signal simulation: watch an intrusion'),
    IMG('tab_signal_s.jpg', '3D signal simulation: a full replay of every tower signal and drone echo, the track estimate against the real flight path, and a bird for comparison.'),
    UL([
        '**Try:** play a replay, turn the bird on and off, and compare the track error chart below the scene.',
        '**Look for:** the drone is picked up hundreds of meters out, and the tracker follows the bird too. Telling them apart needs a classifier, which reads the rotor signal and the flight path over a whole track. This prototype does not simulate it yet; we build it and measure it on real recordings of drones and birds at Seed.',
    ]),
    H(3, 'Financials explorer: one facility, from parts to price'),
    IMG('tab_fin_s.jpg', 'Financials explorer tab: the bill of materials, installation and upkeep for the recommended setup, three pricing models, and the customer\'s 5-year cost against today\'s options.'),
    UL([
        '**Try:** change our margins, the pricing model and the number of sensors, and watch what the customer pays, our revenue over 5 years and our gross profit per facility change.',
        '**Look for:** our cost to equip Hays is $11,444 with our own receiver, or $17,011 with bladeRF radios. These are the costs the business plan prices from. At the plan price of $25,000 to install plus $25,000 a year, set in the value-based pricing model, a Hays facility brings in $150,000 over 5 years and about $25,471 a year of gross profit, so 40 facilities cover $1M a year of company cost.',
    ]),

    H(2, '2. Financial model'),
    P(f'The [financial model]({MODEL}) takes the twin\'s cost per facility and works out the company: sales, hiring, cash and funding rounds, every quarter from 2027 to 2042.'),
    IMG('model_s.jpg', 'Financial model: one facility bottom up (our cost with bladeRF radios and with our own receiver) and top down (what the customer pays today for other systems).'),
    UL([
        '**Try:** the scenario buttons ("40 dB never comes", "Slower sales", "Price war"), then any slider.',
        '**Look for:** the plan needs about $20.4M, pays its own way from 2034 Q2 and reaches $100M a year in 2040 Q2. Sales speed changes the answer most: with slower sales it needs $100M.',
    ]),

    H(2, '3. Hardware tests'),
    H(3, 'GPS shadowing at Lake Lagunita'),
    P('Tripwire\'s idea is a receive-only node that notices a drone in a signal someone else sends. Campus has poor cell coverage, so we tested the idea with GPS satellites, which are always overhead. An Android phone running Google\'s GnssLogger app reports the signal strength (C/N0) of every satellite it sees, once a second. When something passes between the phone and a satellite, that one satellite\'s signal dips.'),
    P('On 7 November 2026 we put a Pixel 10 on the ground at Lake Lagunita and held a board over it at about 0.35, 1 and 1.6 m. The blocked satellites dropped by up to 10 dB, while a satellite in another direction stayed flat. A detector replaying the log flags the shadowed satellites as they dip.'),
    IMG('real_dip_detection_s.jpg', 'Measured at Lake Lagunita: three blocked satellite signals dip by 9-10 dB while the board is held over the phone (shaded); G30, in another part of the sky, stays flat as a control.'),
    IMG('dashboard_frame_s.jpg', 'Our live detector replaying the same log: shadowed satellites turn red on the sky view, and the alarm fires.'),
    P('With several phones around the lake, each phone that sees a dip knows the drone lies on the line to that satellite. Where the lines from four phones cross is the drone. The picture below shows this with real satellite positions and simulated dips.'),
    IMG('scene_lake_overlay_s.jpg', 'Concept, partly simulated: four phones (N1-N4) at Lake Lagunita each flag a satellite they see dip; the lines cross at the drone. The photo, drone and satellite positions are real; the dips and the drone placement are simulated.'),
    P('**Limitation.** GPS signals are very weak at the ground, and a phone reports signal strength only once a second with about 0.5-1 dB of noise. So a phone sees a drone only within about a meter in one reading, or a few meters when the drone hovers for a minute, and the position is rough. That is why the product uses cell towers instead: their signals are much stronger and the sensors listen for echoes, not shadows. The twin first tracks the typical drone about 500 m out at Hays.'),
    H(3, 'Next week: ESP32 Wi-Fi motion test'),
    P('Three ESP32 boards: one transmits Wi-Fi, two receive. Someone walking into the space changes the received signal, and the two receivers detect and roughly locate them. It is the same receive-only idea at room scale. The code is written; the test is waiting on hardware that was delayed, and we will run it next week.'),

    H(2, 'From prototype to product: what is left'),
    P('The twin shows the product can work at Hays with parts we can buy. Turning it into something a prison runs every night takes the work below. The phases, risks and vendors are in the Technical development plan (Draft Report 5).'),
    H(3, 'Engineering challenges'),
    UL([
        '**Interference removal.** We assume 20 dB today. Clemson and most other sites need 30-40 dB, which is unproven. The Seed recordings at Hays and Clemson measure it first ([prototype figures](https://github.com/tripwire-aa261/tripwire-prototype/blob/main/Tripwire_Assumptions_and_Figures.md), sections 8 and 11).',
        '**Real-time processing.** The twin\'s processing has to run live on each sensor\'s NVIDIA Jetson computer; its capacity on 4 and 8 channels is not yet measured ([prototype figures](https://github.com/tripwire-aa261/tripwire-prototype/blob/main/Tripwire_Assumptions_and_Figures.md), section 13).',
        '**Two radios as one.** Running two bladeRF boards as one 4-channel radio is not a documented feature ([Nuand forum](https://nuand.com/forums/viewtopic.php?t=5004)); the fallback is a 4-channel radio.',
        '**Hover hold.** Keeping a hovering drone needs the quiet background steady to about -30 dB ([prototype figures](https://github.com/tripwire-aa261/tripwire-prototype/blob/main/Tripwire_Assumptions_and_Figures.md), sections 12 and 13).',
        '**Drone or bird.** A classifier that uses rotor evidence over a whole track and flight behavior, measured on Seed recordings of both ([prototype figures](https://github.com/tripwire-aa261/tripwire-prototype/blob/main/Tripwire_Assumptions_and_Figures.md), section 13).',
        '**Our own receiver.** An 8-channel board (four LMS7002M transceivers and one FPGA), designed with Series A money and shipping from 2031 Q2 ([prototype figures](https://github.com/tripwire-aa261/tripwire-prototype/blob/main/Tripwire_Assumptions_and_Figures.md), section 3; [financial model](https://github.com/tripwire-aa261/tripwire-prototype/blob/main/prototype/web/financial-model.html)).',
    ]),
    H(3, 'Testing'),
    UL([
        'Recordings at Hays and Clemson, including a game day, before Seed closes.',
        'Scored flights in the pilots: 20 scripted runs per condition (day, night, wind, a bird nearby), scored against the drone\'s GPS log, with pass marks the customer signs beforehand (our test design).',
        'FCC Supplier\'s Declaration of Conformity and an outdoor safety listing for the bladeRF sensor kit before the first paid facility (2028 Q3); FCC certification of our own receiver before it ships (2031 Q2) (regulatory milestones, Draft Report 5).',
    ]),
    H(3, 'Manufacturing'),
    UL([
        'Until Series A we buy finished radios, so manufacturing starts with our own receiver.',
        'The board costs $805 at 100 boards, $642 at 1,000 and $531 at 10,000 ([prototype figures](https://github.com/tripwire-aa261/tripwire-prototype/blob/main/Tripwire_Assumptions_and_Figures.md), section 3).',
        'The FPGA has a 52-week lead time ([DigiKey](https://www.digikey.com/en/products/result?keywords=XC7A50T-1CSG325C)), so we order it when the design starts; the transceivers come from a single maker ([DigiKey](https://www.digikey.com/en/products/detail/lime-microsystems-ltd/LMS7002M/5012880)).',
        'Assembly by a contract manufacturer, with test and phase calibration at $25 a board (assumption, [prototype figures](https://github.com/tripwire-aa261/tripwire-prototype/blob/main/Tripwire_Assumptions_and_Figures.md) section 3).',
    ]),
    H(3, 'Estimated development cost'),
    TABLE([
        ['Stage', 'What it pays for', 'Cost (financial model)'],
        ['Pre-seed, 2027 Q1-Q2', 'Demo kits, travel and recordings; a 3-sensor kit is $5,976 of hardware', 'About $0.02M'],
        ['Seed, 2027 Q3 to 2029 Q3', 'Engineering team; pilots, test drones and scored flights', '$1.0M team + $0.15M development'],
        ['Series A, 2029 Q4 to 2031 Q3', 'Engineering team; our own receiver design, including FCC testing', '$2.5M team + $0.4M design'],
        ['Total to a shipping receiver', '', 'About $4.1M'],
    ], [160, 304, 160]),
    P('Costs: [financial model](https://github.com/tripwire-aa261/tripwire-prototype/blob/main/prototype/web/financial-model.html), plan settings (engineering salaries and development spend by period); the $400,000 receiver design cost is an assumption ([prototype figures](https://github.com/tripwire-aa261/tripwire-prototype/blob/main/Tripwire_Assumptions_and_Figures.md), section 3).'),

    H(2, 'What we learned, and how it shaped the business'),
    TABLE([
        ['What we found', 'How we found it', 'What it changed in the business'],
        ['The number of cell towers decides whether it works. Too few (Hancock, 2 within 5 km) gives weak echoes; too many (Fulton, 52) drowns them; Hays (6) works.', 'Twin, three Georgia facilities', 'Hays is our first customer. We survey the towers before quoting a site. The model assumes only a third of facilities can buy until processing removes 40 dB of interference.'],
        ['At a stadium the stands are the hard part, not the towers. Clemson needs 30 dB of interference removal; at today\'s 20 dB no sensor layout works.', 'Twin, Clemson Memorial Stadium', 'The pre-seed live demo is at Hays; Clemson gets recordings first. Stadiums are a later segment, sold as the layer for the bowl next to an RF detector.'],
        ['Antennas pointed at the facility left only about half the zone covered; a ring of antennas covered 97%.', 'Twin', 'A sensor is a ring of antennas combined in software. The number of antennas sets the receiver channels we need.'],
        ['Off-the-shelf radios get expensive per sensor (B210 about $5,500, bladeRF $1,825); our own 8-channel board would be $1,601.', 'Twin bill of materials', 'Bought radios until Series A, our own receiver after. The price ($25,000 + $25,000 a year per facility) is set against the own-receiver cost.'],
        ['A hovering drone has no Doppler shift, so a plain radar loses it at the drop. Comparing against a learned quiet background holds it as well as a microphone.', 'Twin', 'No microphone in the sensor. How steady the background is becomes a test at Seed.'],
        ['Low poles (about 6 m) beat tall ones, which see more distant towers.', 'Twin pole-height study', 'Sensors go on 6 m poles the customer provides.'],
        ['Coverage fills up after a few sensors; more sensors mainly buy early warning. Drones from some directions are seen late.', 'Twin, Hays', 'Detection range is the upgrade customers pay for. Each site gets a placement plan that shows its weak directions.'],
        ['The tracker cannot yet tell a drone from a bird.', '3D replays', 'We make no classification claim; it is a Seed measurement.'],
        ['A receive-only phone sees a satellite signal dip when something blocks it, but only at close range.', 'GPS test at Lake Lagunita', 'The principle holds; range needs strong signals, so the product uses cell towers and the Seed kit is tested at a real site.'],
    ], [216, 120, 288]),

    H(2, 'What is real and what is simulated'),
    UL([
        '**Real data:** site outlines, terrain and cell towers for all four sites; part prices; the Lake Lagunita photos, satellite positions and the measured signal dips.',
        '**Simulated:** every drone echo and track in the twin, the phone dips in the four-phone concept picture, and all business figures beyond today (the financial model).',
        '**Assumed:** 20 dB of interference removal today (30-40 dB is unproven), and the other values labeled ASSUMPTION in `Tripwire_Assumptions_and_Figures.md` in the repo.',
    ]),
]

body = '<b style="font-weight:normal" id="docs-internal-guid-proto">' + ''.join(parts) + '</b>'
open(OUT, 'w', encoding='utf-8').write(body)
print(len(body), body.count('<img'), body.count('<table'))

# Content of the "Product Prototype v2" Google Doc tab (pivot-v1 branch): prototype v0.6 Platform tab and financial model v2.
# Built by build_prototype_tab_v2.py, which supplies H, P, UL, TABLE and IMG.
# Images: the four Platform-tab sections (pl_0..3_s.jpg) and the top of the model v2 page (m2_top_s.jpg).
# Numbers come from web/runs/platform_v06.json (see prototype/V06_PLATFORM.md) and the model v2 plan settings.
GH = 'https://raw.githack.com/tripwire-aa261/tripwire-prototype/pivot-v1/prototype/web'
VIEW = GH + '/index.html#platform'
MODEL2 = 'https://tripwire-aa261.github.io/tripwire-prototype/prototype/web/financial-model-v2.html'
BRANCH = 'https://github.com/tripwire-aa261/tripwire-prototype/tree/pivot-v1'


def build(H, P, UL, TABLE, IMG):
    return [
        H(1, 'Tripwire prototype v2: one sensor, more signals, more jobs'),
        P('The first prototype (Product Prototype tab) showed that receive-only sensors can track a drone at Hays State Prison with cell-tower signals. Version 2 tests the pivot in Draft Report 6: the same sensors also use digital TV and FM signals, find GPS jammers and point a heat camera at the drone, and the company sells to government buyers. Reading this page and trying the two links takes about 15 minutes.'),
        TABLE([
            ['Part', 'What it is', 'Where', 'The question it answers'],
            ['1. Digital twin v0.6', 'The four-site signal simulator plus a new Platform tab: TV and FM signals, the GPS jammer locator, heat-camera ranges and a contraband drop timeline', f'[Platform tab]({VIEW}) · [code]({BRANCH})', 'Which signal works at which site, and what else can the same sensors do?'],
            ['2. Financial model v2', 'Quarterly model of the company, 2027-2034, with six product lines and government buyers', f'[Financial model v2]({MODEL2})', 'Can Tripwire raise $10-30M and reach $100M of sales a year by year 5?'],
            ['3. Hardware tests', 'GPS signal shadowing with phones at Lake Lagunita', 'Product Prototype tab', 'Unchanged from the first prototype.'],
        ], [96, 168, 168, 192]),
        P('The Platform tab link opens the `pivot-v1` branch of our repo through raw.githack.com, which shows a notice the first time: click **Open the page**. To run the twin locally instead, check out `pivot-v1`, run `python -m http.server 8000` in `prototype/` and open http://localhost:8000/web/index.html#platform.'),

        H(2, 'What is new in v0.6'),
        UL([
            '**Digital TV and FM signals** next to cell towers, from the transmitters the FCC licenses around each site (FCC TV and FM Query, fetched 18 Nov 2026: 6 to 13 TV and 18 to 30 FM transmitters per site).',
            '**GPS jammer locator:** the sensors also listen on the GPS band and place a jammer from arrival-time differences and bearings.',
            '**Heat-camera cueing:** how far a thermal camera can see the drone our track points it at.',
            "**A contraband drop at Hays, second by second**, from the twin's full signal replay, next to two real cases.",
            '**Financial model v2:** the pivot business plan behind Draft Report 6.',
        ]),

        H(2, '1. Which signal works where'),
        IMG('pl_0_s.jpg', "Platform tab, 0.9 kg drone, 6 sensors with our own receiver: share of the protected zone (fence + 150 m, drone at 60 m) where the drone is located. Digital TV and FM are a link-budget estimate; cell towers use the twin's full model."),
        UL([
            '**Try:** switch between the 0.9 kg and 5 kg drone and between 6 and 12 sensors.',
            "**Look for:** with a 0.9 kg drone, cell towers at today's 20 dB of interference removal locate it over 79% of the zone at Hays, 51% at Clemson and 0% at Fulton County Jail and Hancock. The digital TV estimate covers 99-100% at Hays, Fulton and Clemson. Hancock, 62-79 km from its TV transmitters, stays uncovered for the small drone.",
            '**What it showed us:** TV could cover the sites where cell towers fail, which is why it is the upgrade we measure at Seed. Cell towers stay the base of the product.',
        ]),
        P('**How much to trust the TV numbers.** No drone has yet been detected with US digital TV (ATSC) in published work. The evidence is European and Chinese DVB-T, DVB-T2 and DTMB trials, which detected small DJI-class drones at 0.2-5 km (for example Martelli, Colone and Cardinali, IET RSN 2020). Our estimate is deliberately conservative: in the geometry of that trial it detects a Mavic-class drone only to about 0.5 km, against 5 km measured. It holds the noise floor 20 dB above thermal, the top of the 6-20 dB left after cancellation in a measured ATSC passive radar (Garry, Baker and Smith, IEEE TGRS 2017). Not modeled yet: receiver overload next to megawatt transmitters (Fulton is 6 km from an 869 kW station), drones that hover and so show no Doppler shift, and how well we can rebuild the TV reference signal. These are the Seed measurements in Draft Report 6. FM radio resolves range only to about 1.5 km, so it can warn but not place a drone.'),

        H(2, '2. GPS jammer locator'),
        IMG('pl_1_s.jpg', 'Platform tab, Hays, 6 sensors, chip-scale atomic clock. Map: error placing a 10 mW car jammer at each point around the site (dark green under 25 m, light green under 100 m, sand under 300 m, orange worse, grey not heard by enough sensors). Table: median error for three jammer positions.'),
        UL([
            '**Try:** switch Hays and Fulton, 6 and 12 sensors, and the two clocks.',
            '**Look for:** time differences alone place a 10 mW car jammer 300 m from the fence only to about 395 m; adding bearings from the 8-antenna rings brings it to 8 m (19 m with the cheaper oven crystal clock). A 1 W jammer 1 km away is placed to 44 m. At 2 km too few perimeter sensors hear it.',
            '**What it showed us:** GPS monitoring works as an add-on at a site we already protect, near the perimeter. Watching a wider area means sensors spread wider, as the Baltic monitoring network does (GPS Solutions 2026).',
        ]),
        P('Assumptions: while jammed, a sensor keeps time on its own clock, about 50 ns for an oven crystal and 5 ns for a chip-scale atomic clock; bearings are good to 2 degrees after calibration (a DTU trial reached 0.5-1 degree, NAVIGATION 2026).'),

        H(2, '3. Heat-camera confirmation'),
        IMG('pl_2_s.jpg', 'Platform tab: ranges at which a 640-pixel uncooled thermal camera can detect, recognize and identify each drone, by the Johnson criteria (upper bounds).'),
        P('With a 35 mm lens, a 5 kg drone is recognizable at about 428 m and a 0.9 kg drone at about 185 m; a 100 mm lens more than doubles this. Our track tells the camera where to look, so staff see the drone before they move. Weather and contrast lower these ranges; the camera is an option, not part of detection.'),

        H(2, '4. A contraband drop at Hays, second by second'),
        IMG('pl_3_s.jpg', "Platform tab: the twin's full signal replay at Hays (5 kg drone at 12 m/s, 4 sensors with our own receiver, today's 20 dB) turned into a timeline, with two real cases."),
        P('The first track comes 596 m from the drop point, 40.5 s before the drone crosses the fence and about 50 s before it drops the package. The heat camera turns to the track within about 2 s and the drone is recognizable at 416 m. The two real cases show why the timing matters: at Lieber Correctional in South Carolina, inmates reached the package before staff (WRDW, Nov 2026); at Calhoun State Prison in Georgia, staff called the sheriff and K-9 team, who caught three people that evening (Georgia DOC).'),

        H(2, '5. Financial model v2'),
        IMG('m2_top_s.jpg', 'Financial model v2 at its plan settings: the five-year target, the six product lines with their prices, the scenario buttons and the headline results.'),
        UL([
            '**Try:** the scenario buttons, then any slider (prices, win rates, hiring, when digital TV and 40 dB arrive).',
            '**Look for:** at the plan settings Tripwire raises $17.25M in three rounds (pre-seed $0.25M, Seed $5M, Series A $12M), needs at most $5.8M of it, pays its own way from 2030 Q3 and sells $105M in 2031, year 5. Most sales come from military bases and ports of entry, mobile kits for police and sensors sold to integrators.',
            '**What it showed us:** the limit on the five-year target is how fast we can sell, not the technology. Without digital TV and with interference removal stuck at 20 dB, 2031 sales are still $100.8M; without contract vehicles and references they fall to $69.2M.',
        ]),
        TABLE([
            ['Scenario', 'Sales in 2031', '$100M a year from', 'Cash needed'],
            ['Plan', '$105.3M', '2031 Q4', '$5.8M'],
            ['Stuck at 20 dB, no TV', '$100.8M', '2031 Q4', '$5.7M'],
            ['No integrator sales', '$96.0M', '2032 Q1', '$5.7M'],
            ['Government buys slowly', '$66.4M', '2032 Q4', '$5.8M'],
            ['Every price 30% lower', '$68.9M', '2032 Q3', '$9.3M'],
            ['No contract vehicles or references', '$69.2M', '2032 Q3', '$8.4M'],
            ['FAA GPS-monitoring program won', '$115.3M', '2031 Q4', '$5.8M'],
        ], [240, 128, 128, 128]),
        P('In every case the company keeps cash in the bank; the slower cases reach $100M a year in 2032 instead of 2031.'),

        H(2, 'What v2 does not show yet'),
        TABLE([
            ['Open question', 'Why it matters', 'How we answer it at Seed'],
            ['Does US digital TV detect a drone?', 'It is the upgrade that covers Fulton and Clemson', 'Record 8 TV channels at a Georgia or South Carolina site; measure cancellation and the noise floor against cell signals'],
            ['Does the receiver overload near a megawatt TV station?', 'Fulton is 6 km from one', 'Same recordings, at full power'],
            ['Can we see a hovering drone?', 'A hovering drone shows no Doppler shift, and one trial missed it (Poullin, NATO 2016)', 'Cooperative flights with GPS truth: hover, 5 and 15 m/s; look for the rotor signal'],
            ['How accurate are joint cell and TV tracks?', "The twin's 5 m error floor for TV is an assumption", 'Fuse both on the same flights and compare with GPS'],
            ['Does the jammer locator work on real jammers?', 'The table above is simulated', 'Test at a licensed jamming range'],
        ], [168, 208, 248]),

        H(2, 'What is real and what is simulated'),
        UL([
            "**Real data:** site outlines, terrain, cell towers and the FCC's licensed TV and FM transmitters for all four sites; the two contraband cases; the prices and benchmarks in the model.",
            '**Simulated:** every drone echo, track and jammer position in the twin, and all business figures from 2027 on.',
            '**Assumed:** 20 dB of interference removal today, the TV noise floor and error floor, clock and bearing accuracy, and the other values labeled ASSUMPTION in the model and in `prototype/V06_PLATFORM.md` on the `pivot-v1` branch.',
        ]),
    ]

// Generator for Iterations.docx (project folder): a SHORT record per build of what did not work and what
// changed. Run from a folder that has the npm package docx@9.5.1:
//   node build_iterations_doc.js ../../Iterations.docx
// Regenerate only if nobody has edited Iterations.docx in Word since the last generation; otherwise edit
// the .docx directly so their changes are kept. Keep it short: detail belongs in prototype/README.md.
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  HeadingLevel, LevelFormat, AlignmentType, BorderStyle,
} = require("docx");

const FONT = "Calibri";
const W = 9026; // A4 with 1" margins (matches the original file)

function runs(text, base = {}) {
  return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((s) =>
    s.startsWith("**") ? new TextRun({ text: s.slice(2, -2), bold: true, ...base }) : new TextRun({ text: s, ...base }));
}
const P = (t, run = {}) => new Paragraph({ children: runs(t, run), spacing: { after: 100 } });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const B = (t) => new Paragraph({ numbering: { reference: "bul", level: 0 }, children: runs(t), spacing: { after: 50 } });

function table(widths, header, rows) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "C9D2DC" };
  const cell = (text, i, head) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: "1F3A5F", color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    children: [new Paragraph({ children: runs(text, head ? { bold: true, color: "FFFFFF", size: 18 } : { size: 18 }) })],
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: widths,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))],
  });
}

const c = [];
c.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Tripwire Prototype: Iterations")] }));
c.push(P("What did not work in each build and what we changed. Last updated November 10, 2026. Details: prototype/README.md; every assumption is listed in the viewer under Sources & assumptions.", { italics: true }));

c.push(H1("Iterations"));
c.push(H2("1. v0.1: link-budget demo (Nov 5)"));
c.push(B("**Did not work:** calibrated to the wrong drone (the Fraunhofer trial used a 5 kg Matrice 210, not a Mavic), so small drones looked far too easy; the site and towers were made up."));
c.push(B("**Changed:** moved to a real prison with real towers, calibrated to the paper's actual results."));

c.push(H2("2. v0.2: signal-level twin at Hays State Prison (Nov 8)"));
c.push(B("**Did not work:** Mavic never tracked; 8 nodes with B210 radios cost ~$61k; a hovering drone is invisible to radar; 8-bit radios fail."));
c.push(B("**Changed:** next build to model real antennas and costs, and to show coverage against number of nodes."));

c.push(H2("3. v0.3: antennas, coverage vs cost (Nov 10)"));
c.push(B("**Did not work:** the v0.2 antenna assumption was optimistic (coverage fell from 97% to ~50% with real antennas); reference-signal-only processing cannot cover even the 5 kg drone, at any node count."));
c.push(B("**Changed:** full-signal processing (+12 dB, software only): 95% coverage with 4 nodes, 93% track availability with 8 nodes plus microphones. Cheaper radio (bladeRF, $540): $9,300 per 3-node zone vs the $24,000 target."));
c.push(B("**Still open:** the full-signal gain is assumed, not measured; per-zone pricing makes Hays ~4× the incumbent; the Mavic needs 12+ nodes; birds start getting tracked."));

c.push(H2("4. v0.4: three sites, customer requirements, financials (Nov 10)"));
c.push(B("**Did not work:** the site was too technical for outsiders; economics assumed 3 sensors per zone; one site could not show which design suits which kind of facility."));
c.push(B("**Changed:** three tabs (Overview, Simulation, Financials); customer requirements as inputs with the cheapest design that meets them; costs scale with the real sensor count, with editable installation, labour and maintenance; added Hancock (remote) and Fulton County Jail (city)."));
c.push(B("**Found:** under today's interference assumption only Hays can be covered; at the remote and city sites, neighboring cells on the same carrier swamp the echoes. If processing removes 40 dB of that interference instead of 20, all three work."));

c.push(H2("5. Next (proposed)"));
c.push(B("Record real LTE signals and measure interference removal and enhanced-processing gain; model network busyness by hour; check which carriers a radio can capture at once."));

c.push(H1("Risks"));
c.push(table([2900, 1300, 4826], ["Risk", "Status", "Where it stands"], [
  ["Can LTE detect a drone at all?", "Reduced", "Fraunhofer trial reproduced (1,608 m vs ~1,600 m); our own recordings still needed."],
  ["Full-signal processing gain", "Open (new)", "Everything good above depends on it; measure it on Seed recordings."],
  ["Hardware cost per zone", "Reduced", "$9,300 per zone with off-the-shelf parts (target $24,000)."],
  ["Hovering drone at the drop", "Reduced", "Radar alone tops out just under 90%; microphones lift it to 93%."],
  ["Mavic-class drones", "Open", "Best design needs 12 nodes for 88%; a Series A goal."],
  ["Pricing per 3-node zone", "Reduced", "Now priced per facility by coverage tier; costs scale with sensors."],
  ["Neighbor-cell interference", "Open (new)", "Decides the remote and city sites: 20 dB removal fails there, 40 dB works. Must be measured."],
]));

c.push(H1("Key assumptions"));
c.push(B("Drone radar size: Mavic 0.01 m², Matrice 210 0.1 m² (only the ratio matters after calibration)."));
c.push(B("Model calibrated to the Fraunhofer trial only; no independent check yet."));
c.push(B("Tower positions are real (FCC); their sector directions, power and channels are guesses."));
c.push(B("Cell network 30% busy."));
c.push(B("Antenna specs and prices are typical values, not supplier quotes."));
c.push(B("Full-signal processing delivers its ideal ~12 dB gain."));
c.push(B("Microphones hear a drone within 100 m."));
c.push(B("Processing removes 20 dB of interference from neighboring cells on the same carrier (40 dB shown as the optimistic case)."));
c.push(B("Price per facility: $50,000 install + $18,000/yr (80% tier, data package); $30,000 and $42,000/yr for 90% and 95% tiers (editable)."));
c.push(B("Installation and maintenance per sensor sized to the data package's $6,000 and $5,000/yr per 3 sensors (editable)."));

c.push(H1("Advantages our solution offers (pitch points)"));
c.push(P("Passive multistatic radar can do things active radar and RF detectors can't:"));
c.push(B("**It emits nothing.** It's covert, needs no spectrum license, causes no interference with airport or prison radios, and can go where emissions are restricted (hospitals, airports, nuclear plants, fuel depots)."));
c.push(B("**Easier to place in communities.** There's no \"radiation\" for neighbors to object to, a fair answer to the instructor's NIMBY point. It also can't be detected or jammed the way an active radar's transmitter can."));
c.push(B("**It sees drones that emit nothing.** Autonomous, pre-programmed and fiber-optic-controlled drones defeat RF detectors. The GTM section cites FEMA's FY2027 notice on this."));
c.push(B("**Many viewing angles.** Several cheap nodes see the drone from different directions, so a drone that's hard to see from one angle is rarely hard to see from all of them, and buildings cast fewer blind spots. One expensive radar panel sees from one point."));
c.push(B("**Fine Doppler resolution.** Long integration gives ~1 Hz resolution, good for classification. Combined with microphones, it's a strong drone-versus-bird story."));
c.push(B("**Coverage that grows with the site.** You add nodes along a perimeter instead of buying another $40k panel, and coverage tiers become a pricing menu."));
c.push(B("**A network effect.** Many sites together form a low-altitude airspace data feed, the memo's later-stage opportunity."));

const h = (size, before, after, lvl) => ({ run: { font: FONT, size, bold: true, color: "1F3A5F" },
  paragraph: { spacing: { before, after }, keepNext: true, ...(lvl === undefined ? {} : { outlineLevel: lvl }) } });
const doc = new Document({
  creator: "Nimalan S/O Anbhuarasan",
  title: "Tripwire Prototype: Iterations",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", ...h(36, 0, 80) },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, ...h(26, 260, 100, 0) },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, ...h(22, 160, 60, 1) },
    ],
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
    alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 },
    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: c }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(process.argv[2] || "Iterations.docx", buf); console.log("written"); });

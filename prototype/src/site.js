// Demo site. FICTIONAL: a generic state-prison layout for illustration only.
// Next iteration: load a real facility's footprint and buildings from OpenStreetMap.

export const SITE = {
  name: 'Example State Prison (fictional)',
  // Fence as an axis-aligned rectangle: centre and half-width/half-height, metres.
  fence: { cx: 0, cy: 0, hw: 250, hh: 175 },
  // Protected zone = fence + this buffer. 150 m matches the memo's release gate distance.
  bufferM: 150,
  // Buildings: centre x/y, width (E-W), depth (N-S), height, metres.
  buildings: [
    { x: -150, y: 100, w: 120, d: 30, h: 12, kind: 'housing' },
    { x: -150, y: 40, w: 120, d: 30, h: 12, kind: 'housing' },
    { x: -150, y: -20, w: 120, d: 30, h: 12, kind: 'housing' },
    { x: 140, y: 110, w: 90, d: 45, h: 9, kind: 'admin' },
    { x: 160, y: -100, w: 70, d: 70, h: 15, kind: 'services' },
    { x: -40, y: -120, w: 60, d: 40, h: 8, kind: 'services' },
    { x: 230, y: 0, w: 14, d: 14, h: 25, kind: 'tower' },
    { x: -230, y: -160, w: 14, d: 14, h: 25, kind: 'tower' },
  ],
  // Exercise yard (flat, drawn on the ground).
  yard: { x: 40, y: 10, w: 140, d: 110 },
};

// Demo intrusion flight: approaches from the north-west, drops over the yard, exits east.
export const FLIGHT_WAYPOINTS = [
  [-760, 560], [-500, 400], [-230, 180], [10, 60], [80, 0], [40, -50],
  [-20, 0], [60, 60], [230, 170], [600, 420], [1050, 650],
];

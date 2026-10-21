import type { Team } from './types';

export interface MapBox {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
  tex: string;
  top?: string;
  noShadow?: boolean;
  thin?: boolean; // visual only ground marking (no collision)
}

export interface NavNode { id: number; x: number; y: number; z: number; tag?: string }
export interface NavEdge { a: number; b: number; oneWay?: boolean }

export interface BombSite { name: string; x1: number; z1: number; x2: number; z2: number; cx: number; cz: number }

export const MAP_BOUNDS = { x1: -44, x2: 54, z1: -54, z2: 34 };

const boxes: MapBox[] = [];
function box(x1: number, z1: number, x2: number, z2: number, y1: number, y2: number, tex: string, top?: string, extra?: Partial<MapBox>) {
  boxes.push({ x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2), y1, y2, tex, top, ...extra });
}
function stairs(x1: number, x2: number, zStart: number, dir: 1 | -1, steps: number, stepH: number, stepD: number, tex: string, yBase = 0) {
  for (let i = 0; i < steps; i++) {
    const za = zStart + dir * stepD * i;
    const zb = zStart + dir * stepD * (i + 1);
    box(x1, za, x2, zb, yBase, yBase + stepH * (i + 1), tex, tex);
  }
}

// ---------------- Ground -----------------
// Main asphalt ground is a plane in engine; add grass patches & markings as thin boxes
box(-44, 30, 54, 34, 0, 0.02, 'grass', 'grass', { thin: true, noShadow: true });
box(-44, -54, -40, 34, 0, 0.02, 'grass', 'grass', { thin: true, noShadow: true });
box(50, -54, 54, 34, 0, 0.02, 'grass', 'grass', { thin: true, noShadow: true });
box(-44, -54, 54, -50, 0, 0.02, 'dirt', 'dirt', { thin: true, noShadow: true });
// sidewalk before warehouse
box(-26, -4, 26, -1, 0, 0.15, 'concrete', 'concrete');
// warehouse floor (concrete, inside)
box(-23, -40, 23, -5, 0, 0.03, 'concreteDark', 'concreteDark', { thin: true, noShadow: true });
// east yard cobble
box(26, -50, 50, -2, 0, 0.02, 'cobble', 'cobble', { thin: true, noShadow: true });
// west alley sand
box(-40, -50, -25, 2, 0, 0.02, 'sand', 'sand', { thin: true, noShadow: true });

// ---------------- Boundary walls -----------------
const B = MAP_BOUNDS;
box(B.x1 - 1, B.z1 - 1, B.x2 + 1, B.z1, 0, 7, 'brick');
box(B.x1 - 1, B.z2, B.x2 + 1, B.z2 + 1, 0, 7, 'brick');
box(B.x1 - 1, B.z1, B.x1, B.z2, 0, 7, 'brick');
box(B.x2, B.z1, B.x2 + 1, B.z2, 0, 7, 'brick');
// invisible-ish tall walls (so nothing escapes): extra brick height already 7 (jump can't exceed)

// ---------------- Warehouse -----------------
const WH = 12; // wall height
// Front wall (south) z -5..-4
box(-24, -5, -6, -4, 0, WH, 'metalWall');
box(-6, -5, 6, -4, 5, WH, 'metalWall'); // lintel above main garage door
box(-6.5, -5.2, -6, -3.8, 0, 5.2, 'hazard'); // door frame
box(6, -5.2, 6.5, -3.8, 0, 5.2, 'hazard');
box(6, -5, 14, -4, 0, WH, 'metalWall');
box(14, -5, 16, -4, 3, WH, 'metalWall'); // side door lintel
box(16, -5, 24, -4, 0, WH, 'metalWall');
// West wall x -24..-23
box(-24, -40, -23, -30, 0, WH, 'metalWall');
box(-24, -30, -23, -27, 3, WH, 'metalWall'); // rear door lintel
box(-24, -27, -23, -4, 0, WH, 'metalWall');
// East wall x 23..24
box(23, -40, 24, -16, 0, WH, 'metalWall');
box(23, -16, 24, -14, 2.5, WH, 'metalWall'); // east door lintel
box(23, -14, 24, -4, 0, WH, 'metalWall');
// North wall
box(-24, -41, 24, -40, 0, WH, 'metalWall');
// Windows (decor) on front wall upper
for (const wx of [-20, -14, 10, 19]) box(wx, -4.01, wx + 2, -3.99, 7, 9, 'window', undefined, { noShadow: true });
// Roof with skylights: hole1 x -14..-8 z -39..-36 ; hole2 x 2..8 z -24..-18
box(-24, -41, -14, -4, WH, WH + 1, 'roof');
box(-14, -41, -8, -39, WH, WH + 1, 'roof');
box(-14, -36, -8, -4, WH, WH + 1, 'roof');
box(-8, -41, 2, -4, WH, WH + 1, 'roof');
box(2, -41, 8, -24, WH, WH + 1, 'roof');
box(2, -18, 8, -4, WH, WH + 1, 'roof');
box(8, -41, 24, -4, WH, WH + 1, 'roof');
// skylight frames
box(-14.3, -39.3, -7.7, -39, WH + 1, WH + 1.6, 'hazard');
box(-14.3, -36, -7.7, -35.7, WH + 1, WH + 1.6, 'hazard');
box(1.7, -24.3, 8.3, -24, WH + 1, WH + 1.6, 'hazard');
box(1.7, -18, 8.3, -17.7, WH + 1, WH + 1.6, 'hazard');
// parapet
box(-24, -41, 24, -40, WH + 1, WH + 2.2, 'metalWall');
box(-24, -5, 24, -4, WH + 1, WH + 2.2, 'metalWall');
box(-24, -41, -23, -4, WH + 1, WH + 2.2, 'metalWall');
box(23, -41, 24, -36, WH + 1, WH + 2.2, 'metalWall');
box(23, -32, 24, -4, WH + 1, WH + 2.2, 'metalWall');
// roof clutter: AC units, vent
box(-20, -30, -17, -27, WH + 1, WH + 2.4, 'vent');
box(14, -20, 17, -17, WH + 1, WH + 2.4, 'vent');
box(-4, -12, -1, -9, WH + 1, WH + 2.2, 'metal');
box(12, -34, 15, -31, WH + 1, WH + 2.6, 'vent');

// External stairs to roof (east side), climbing north from z=-8 to z=-32
stairs(25, 29, -8, -1, 24, 0.5, 1, 'metal');
box(25, -36, 29, -32, 0, WH + 1, 'metal', 'roof'); // landing tower
box(29, -36, 29.5, -8, 0, WH + 2.2, 'metalWall'); // outer railing wall of stairs
box(25, -36.5, 29.5, -36, 0, WH + 2.2, 'metalWall');
// support under stairs so no hiding glitch
box(24, -36, 25, -8, 0, 0.1, 'metal');

// ---------------- Warehouse interior -----------------
// Hostage room: x 10..23, z -40..-28
box(10, -40, 11, -34, 0, 5, 'brick');
box(10, -31, 11, -28, 0, 5, 'brick');
box(10, -34, 11, -31, 3, 5, 'brick'); // door lintel
box(10, -29, 14, -28, 0, 5, 'brick');
box(17, -29, 23, -28, 0, 5, 'brick');
box(14, -29, 17, -28, 3, 5, 'brick');
box(10, -40, 23, -28, 5, 5.3, 'planks', 'planks'); // hostage room ceiling (walkable from catwalk? no access - decorative)
// hostages
for (const [hx, hz] of [[21.3, -38.7], [21.3, -30.7], [13.3, -38.7]]) {
  box(hx - 0.3, hz - 0.2, hx + 0.3, hz + 0.2, 0, 0.9, 'containerOrange', 'containerOrange'); // body (sitting)
  box(hx - 0.25, hz - 0.25, hx + 0.25, hz + 0.25, 0.9, 1.4, 'hostage', 'log'); // head
}
box(12, -33, 14, -31, 0, 0.8, 'crate', 'crate');
box(19, -36, 21, -34, 0, 1, 'crate', 'crate');

// Catwalk along north wall: y 4..4.5, x -23..10, z -40..-35
box(-23, -40, 10, -35, 4, 4.5, 'metal', 'metal');
// railing
box(-20, -35, 10, -34.8, 4.5, 5.5, 'metal');
box(10, -40, 10.2, -35, 4.5, 5.5, 'metal');
// pillars under catwalk
for (const px of [-16, -8, 0, 8]) box(px - 0.3, -35.3, px + 0.3, -34.7, 0, 4, 'concreteDark');
// stairs up to catwalk at west end: x -23..-20, going north from z -29 to -35, 8 steps 0.5h 0.75d
stairs(-23, -20, -29, -1, 8, 0.5, 0.75, 'metal');
box(-20, -35, -19.8, -29, 0, 5.5, 'metal'); // stair railing wall
// catwalk crates & office
box(-6, -40, -2, -37, 4.5, 5.5, 'crate', 'crate');
box(4, -40, 6, -38, 4.5, 6.5, 'crate', 'crate');
box(-19, -40, -17, -38, 4.5, 5.5, 'crate', 'crate');

// Main hall crates
box(2, -24, 8, -18, 0, 3, 'crate', 'crate'); // big stack under skylight 2
box(8, -24, 10, -21, 0, 1, 'crate', 'crate'); // step crate
box(10, -24, 12, -22, 0, 1, 'crate', 'crate');
box(-20, -12, -17, -9, 0, 1, 'crate', 'crate');
box(-18, -22, -15, -19, 0, 3, 'crate', 'crate');
box(-15, -22, -13, -20, 0, 1, 'crate', 'crate');
box(-14, -8, -12, -6, 0, 1, 'crate', 'crate');
box(14, -14, 18, -10, 0, 1, 'crate', 'crate');
box(16, -22, 19, -19, 0, 2.5, 'container', 'container');
box(18, -8, 22, -6, 0, 1, 'crate', 'crate');
box(-12, -26, -10, -24, 0, 1, 'crate', 'crate');
box(-4, -14, -2, -12, 0, 1, 'crate', 'crate');
box(4, -10, 6, -8, 0, 1, 'crate', 'crate');
box(-22, -22, -20, -18, 0, 2.5, 'containerOrange', 'containerOrange');
// pillars
for (const pz of [-32, -20, -10]) box(-0.5, pz - 0.5, 0.5, pz + 0.5, 0, WH, 'concreteDark');
// Bomb site A marking (inside, west hall)
box(-11, -31, -2, -22, 0, 0.06, 'bombsite', 'bombsite', { thin: true, noShadow: true });

// ---------------- Outside: CT spawn / parking -----------------
// Trucks
box(-16, 8, -13, 16, 0.6, 3.6, 'truck', 'truck');
box(-16, 6, -13, 8, 0.6, 2.8, 'metalBlue', 'metalBlue');
box(-15.8, 8.2, -13.2, 9.2, 0, 0.6, 'tire');
box(-15.8, 14.6, -13.2, 15.6, 0, 0.6, 'tire');
box(-15.8, 6.3, -13.2, 7.3, 0, 0.6, 'tire');
box(10, 10, 13, 18, 0.6, 3.6, 'truck', 'truck');
box(10, 18, 13, 20, 0.6, 2.8, 'metalRed', 'metalRed');
box(10.2, 10.4, 12.8, 11.4, 0, 0.6, 'tire');
box(10.2, 16.6, 12.8, 17.6, 0, 0.6, 'tire');
box(10.2, 18.5, 12.8, 19.5, 0, 0.6, 'tire');
// cars
box(-4, 20, -1.5, 24.5, 0.4, 1.4, 'metalBlue', 'metalBlue');
box(-3.5, 21, -2, 23.5, 1.4, 2, 'window', 'metalBlue');
box(3, 19, 5.5, 23.5, 0.4, 1.4, 'metalRed', 'metalRed');
box(3.5, 20, 5, 22.5, 1.4, 2, 'window', 'metalRed');
// barriers
box(-8, 4, -2, 5, 0, 1, 'concrete', 'concrete');
box(2, 6, 8, 7, 0, 1, 'concrete', 'concrete');
box(-20, 0, -16, 1, 0, 1, 'concrete', 'concrete');
box(16, 1, 20, 2, 0, 1, 'concrete', 'concrete');
// dumpsters
box(-23, -2, -20, 0, 0, 1.5, 'container', 'container');
box(19, 2, 22, 4, 0, 1.5, 'containerOrange', 'containerOrange');
// sandbags in front of main door
box(-4, -1, -1, 0, 0, 0.8, 'sand', 'sand');
box(1, 1, 4, 2, 0, 0.8, 'sand', 'sand');
// guard house (east of CT spawn)
box(22, 12, 30, 13, 0, 3.5, 'brick');
box(22, 19, 30, 20, 0, 3.5, 'brick');
box(22, 13, 23, 19, 0, 3.5, 'brick');
box(29, 13, 30, 15, 0, 3.5, 'brick');
box(29, 17, 30, 19, 0, 3.5, 'brick');
box(29, 15, 30, 17, 2.5, 3.5, 'brick');
box(22, 12, 30, 20, 3.5, 4, 'roof', 'roof');
box(24, 14, 26, 15.5, 0, 0.9, 'planks', 'planks');
// west building (CT side, decorative with cover)
box(-36, 14, -26, 15, 0, 5, 'brick');
box(-36, 14, -35, 26, 0, 5, 'brick');
box(-36, 25, -26, 26, 0, 5, 'brick');
box(-27, 15, -26, 26, 0, 5, 'brick');
box(-36, 14, -26, 26, 5, 5.5, 'roof', 'roof');
// lamp posts
for (const [lx, lz] of [[-18, 18], [18, 24], [-30, -8], [34, 0], [-10, -46], [26, -46]]) {
  box(lx - 0.2, lz - 0.2, lx + 0.2, lz + 0.2, 0, 6, 'metal');
  box(lx - 0.6, lz - 0.6, lx + 0.6, lz + 0.6, 6, 6.5, 'hazard', 'hazard');
}
// trees (south edge)
for (const [tx, tz] of [[-40, 30], [40, 30], [48, 10], [-40, -46], [48, -46], [-40, 4]]) {
  box(tx - 0.5, tz - 0.5, tx + 0.5, tz + 0.5, 0, 4, 'log');
  box(tx - 2.5, tz - 2.5, tx + 2.5, tz + 2.5, 3, 7, 'leaves', 'leaves');
}

// ---------------- West alley -----------------
box(-40, -30, -37, -20, 0, 2.6, 'container', 'container');
box(-40, -12, -37, -4, 0, 2.6, 'containerOrange', 'containerOrange');
box(-31, -34, -28, -32, 0, 1, 'crate', 'crate');
box(-33, -16, -31, -14, 0, 1, 'crate', 'crate');
box(-28, -44, -26, -42, 0, 1, 'crate', 'crate');
box(-36, -40, -34, -38, 0, 2.2, 'crate', 'crate');
// rear door sandbags
box(-28, -27, -26, -26, 0, 0.8, 'sand', 'sand');

// ---------------- East yard (Bomb site B) -----------------
box(34, -40, 37, -28, 0, 2.6, 'containerOrange', 'containerOrange');
box(42, -14, 45, -4, 0, 2.6, 'container', 'container');
box(46, -46, 50, -30, 0, 2.6, 'container', 'container');
box(46, -46, 50, -38, 2.6, 5.2, 'containerOrange', 'containerOrange');
box(31, -22, 33, -20, 0, 1, 'crate', 'crate');
box(44, -26, 46, -24, 0, 1, 'crate', 'crate');
box(36, -16, 39, -13, 0, 1, 'crate', 'crate');
box(28, -2, 32, -1, 0, 1, 'concrete', 'concrete');
box(40, -2, 44, -1, 0, 1, 'concrete', 'concrete');
box(36, -26, 44, -17, 0, 0.06, 'bombsite', 'bombsite', { thin: true, noShadow: true });
// fuel tanks
box(31, -46, 35, -42, 0, 3, 'metal', 'metal');
box(37, -46, 41, -42, 0, 3, 'metalRed', 'metalRed');

// ---------------- North alley -----------------
box(-10, -49, -7, -46, 0, 1, 'crate', 'crate');
box(10, -48, 13, -46, 0, 2.2, 'crate', 'crate');
box(-2, -50, 2, -47, 0, 1.5, 'container', 'container');

export const MAP_BOXES = boxes;

export const BOMB_SITES: BombSite[] = [
  { name: 'A', x1: -11, z1: -31, x2: -2, z2: -22, cx: -6.5, cz: -26.5 },
  { name: 'B', x1: 36, z1: -26, x2: 44, z2: -17, cx: 40, cz: -21.5 },
];

export const SPAWNS: Record<Team, [number, number, number][]> = {
  CT: [[-12, 0, 24], [-8, 0, 27], [-6, 0, 22], [0, 0, 26], [4, 0, 24], [8, 0, 27], [12, 0, 25], [-2, 0, 29], [2, 0, 29], [-10, 0, 20], [10, 0, 22], [16, 0, 26]],
  T: [[16, 0, -34], [18, 0, -38], [15, 0, -32], [-2, 0, -32], [-6, 0, -34], [4, 0, -33], [-14, 0, -30], [-18, 0, -26], [0, 0, -26], [8, 0, -30], [14, 0, -38], [-10, 0, -34]],
};

export const FFA_SPAWNS: [number, number, number][] = [
  [0, 0, 24], [-12, 0, 24], [12, 0, 24], [-30, 0, 8], [30, 0, 4], [-30, 0, -15], [-30, 0, -40], [0, 0, -46], [30, 0, -46], [40, 0, -21], [30, 0, -8],
  [0, 0, -8], [-8, 0, -12], [12, 0, -18], [-6, 0, -26], [16, 0, -34], [-21, 4, -37], [2, 4, -37.5], [0, 12, -20], [-18, 12, -12], [26, 0, 16], [-8, 0, 2],
];

// ---------------- Navigation graph -----------------
const N: NavNode[] = [];
const node = (x: number, y: number, z: number, tag?: string) => { N.push({ id: N.length, x, y, z, tag }); return N.length - 1; };

// Outside south / CT
const n_ctc = node(0, 0, 26, 'ct');
const n_ctw = node(-12, 0, 24, 'ct');
const n_cte = node(12, 0, 24, 'ct');
const n_s3 = node(-6, 0, 14);
const n_s4 = node(6, 0, 14);
const n_s5 = node(0, 0, 10);
const n_s6 = node(-10, 0, 7);
const n_s7 = node(10, 0, 4);
const n_door = node(0, 0, -1, 'maindoor');
const n_s9 = node(-20, 0, 10);
const n_s10 = node(20, 0, 8);
const n_side = node(15, 0, -1, 'sidedoor');
const n_wsouth = node(-30, 0, 8);
const n_esouth = node(30, 0, 4);
const n_s14 = node(-24, 0, 20);
const n_s15 = node(26, 0, 24);
const n_s16 = node(-6, 0, 2);
const n_s17 = node(8, 0, -1);
// Warehouse interior
const n_in1 = node(0, 0, -8);
const n_in2 = node(-8, 0, -12);
const n_in3 = node(8, 0, -12);
const n_in4 = node(-6, 0, -18);
const n_in5 = node(12, 0, -18);
const n_in6 = node(0, 0, -29);
const n_a1 = node(-14, 0, -26, 'siteA');
const n_a2 = node(-6, 0, -26, 'siteA');
const n_in9 = node(6, 0, -28);
const n_in10 = node(15.5, 0, -26);
const n_in11 = node(13, 0, -32.5);
const n_hdw = node(8.5, 0, -32.5);
const n_h1 = node(16, 0, -34, 't');
const n_h2 = node(20, 0, -37, 't');

const n_h3 = node(15.5, 0, -30.5);
const n_in15 = node(-16, 0, -32);
const n_stb = node(-21.5, 0, -27.5);
const n_stm = node(-21.5, 2.5, -31.5);
const n_cw0 = node(-21.5, 4, -37);
const n_cw1 = node(-14, 4, -37.5);
const n_cw2 = node(-8, 4, -37.5);
const n_cw3 = node(0, 4, -37.5);
const n_cw4 = node(8, 4, -37.5);
const n_uc1 = node(-4, 0, -37.5, 't');
const n_uc2 = node(6, 0, -37.5, 't');
const n_sidein = node(15, 0, -7);
const n_sidemid = node(15, 0, -4.5);
const n_in24 = node(-20, 0, -15);
const n_in25 = node(20, 0, -15, 'eastdoorin');
const n_in26 = node(20, 0, -10);
const n_in27 = node(-12, 0, -6);
const n_in28 = node(-20, 0, -30);
const n_in29 = node(-10, 0, -20);
const n_in30 = node(-16, 0, -10);
const n_cr1 = node(5, 3, -21, 'cratetop');
const n_cr2 = node(9, 1, -22.5);
const n_cr3 = node(11, 1, -23);
// West alley
const n_w1 = node(-30, 0, -2);
const n_w2 = node(-32, 0, -15);
const n_rear = node(-29, 0, -28.5, 'reardoor');
const n_rearin = node(-21, 0, -28.5);
const n_rearmid = node(-23.5, 0, -28.5);
const n_w4 = node(-32, 0, -42);
const n_w5 = node(-34, 0, -30);
// North alley
const n_n1 = node(-20, 0, -46);
const n_n2 = node(-4, 0, -45);
const n_n3 = node(6, 0, -44);
const n_n4 = node(20, 0, -46);
const n_n5 = node(34, 0, -48);
// East yard
const n_e1 = node(30, 0, -38);
const n_b1 = node(40, 0, -21, 'siteB');
const n_e3 = node(31, 0, -24);
const n_e4 = node(40, 0, -31);
const n_e5 = node(31, 0, -6);
const n_edoor = node(26.5, 0, -15, 'eastdoor');
const n_emid = node(23.5, 0, -15);
const n_e7 = node(40, 0, -10);
const n_e8 = node(44, 0, -40);
const n_e9 = node(36, 0, -3);
// Roof stairs & roof
const n_r0 = node(27, 0, -6, 'roofstairs');
const n_r1 = node(27, 3, -14);
const n_r2 = node(27, 6, -20);
const n_r3 = node(27, 9, -26);
const n_r4 = node(27, 12, -34);
const n_r5 = node(20, 12, -34, 'roof');
const n_r6 = node(10, 12, -30, 'roof');
const n_sky1 = node(-11, 12, -33, 'roof');
const n_sky1d = node(-11, 12, -37.5, 'drop');
const n_r9 = node(-18, 12, -12, 'roof');
const n_r10 = node(0, 12, -36, 'roof');
const n_r11 = node(-4, 12, -22, 'roof');
const n_sky2 = node(12, 12, -21, 'roof');
const n_sky2d = node(5, 12, -21, 'drop');
const n_r14 = node(8, 12, -8, 'roof');
const n_r15 = node(-14, 12, -30, 'roof');

export const NAV_NODES = N;

// explicit edges (auto-linking happens in engine for nodes in same height range)
export const NAV_EXPLICIT: NavEdge[] = [
  { a: n_stb, b: n_stm }, { a: n_stm, b: n_cw0 }, { a: n_cw0, b: n_cw1 }, { a: n_cw1, b: n_cw2 }, { a: n_cw2, b: n_cw3 }, { a: n_cw3, b: n_cw4 },
  { a: n_r0, b: n_r1 }, { a: n_r1, b: n_r2 }, { a: n_r2, b: n_r3 }, { a: n_r3, b: n_r4 }, { a: n_r4, b: n_r5 },
  { a: n_r5, b: n_r6 }, { a: n_r6, b: n_sky1 }, { a: n_sky1, b: n_r15 }, { a: n_r15, b: n_r9 }, { a: n_r6, b: n_r10 }, { a: n_r10, b: n_sky1 }, { a: n_r6, b: n_r11 }, { a: n_r11, b: n_r9 }, { a: n_r11, b: n_sky2 }, { a: n_r5, b: n_sky2 }, { a: n_sky2, b: n_r14 }, { a: n_r14, b: n_r11 },
  // drops
  { a: n_sky1, b: n_sky1d }, { a: n_sky1d, b: n_cw1, oneWay: true }, { a: n_sky1d, b: n_cw2, oneWay: true },
  { a: n_sky2, b: n_sky2d }, { a: n_r11, b: n_sky2d }, { a: n_sky2d, b: n_cr1, oneWay: true }, { a: n_cr1, b: n_cr2, oneWay: true }, { a: n_cr2, b: n_cr3 }, { a: n_cr3, b: n_in5, oneWay: true }, { a: n_cr2, b: n_in9, oneWay: true },
  // doors
  { a: n_door, b: n_in1 }, { a: n_side, b: n_sidemid }, { a: n_sidemid, b: n_sidein }, { a: n_rear, b: n_rearmid }, { a: n_rearmid, b: n_rearin }, { a: n_rearin, b: n_stb }, { a: n_rearin, b: n_in28 }, { a: n_edoor, b: n_emid }, { a: n_emid, b: n_in25 },
  { a: n_h3, b: n_h1 }, { a: n_h1, b: n_h2 }, { a: n_in11, b: n_h1 }, { a: n_in10, b: n_h3 },
  { a: n_ctc, b: n_ctw }, { a: n_ctc, b: n_cte }, { a: n_s3, b: n_s5 }, { a: n_s4, b: n_s5 },
  { a: n_s9, b: n_wsouth }, { a: n_s10, b: n_esouth }, { a: n_s14, b: n_ctw }, { a: n_s15, b: n_cte }, { a: n_s14, b: n_wsouth }, { a: n_s15, b: n_esouth },
  { a: n_wsouth, b: n_w1 }, { a: n_w1, b: n_w2 }, { a: n_w2, b: n_rear }, { a: n_rear, b: n_w5 }, { a: n_w5, b: n_w4 }, { a: n_w4, b: n_n1 }, { a: n_n1, b: n_n2 }, { a: n_n2, b: n_n3 }, { a: n_n3, b: n_n4 }, { a: n_n4, b: n_n5 }, { a: n_n5, b: n_e1 }, { a: n_n5, b: n_e8 },
  { a: n_esouth, b: n_e5 }, { a: n_e5, b: n_edoor }, { a: n_e5, b: n_e9 }, { a: n_e9, b: n_e7 }, { a: n_e7, b: n_b1 }, { a: n_edoor, b: n_e3 }, { a: n_e3, b: n_b1 }, { a: n_e3, b: n_e1 }, { a: n_e1, b: n_e4 }, { a: n_e4, b: n_b1 }, { a: n_e8, b: n_e4 }, { a: n_esouth, b: n_r0 }, { a: n_e5, b: n_r0 },
  { a: n_s6, b: n_s16 }, { a: n_s16, b: n_door }, { a: n_s7, b: n_s17 }, { a: n_s17, b: n_door }, { a: n_s17, b: n_side }, { a: n_s3, b: n_s6 }, { a: n_s4, b: n_s7 }, { a: n_s6, b: n_s9 }, { a: n_s7, b: n_s10 },
  { a: n_in1, b: n_in2 }, { a: n_in1, b: n_in3 }, { a: n_in2, b: n_in4 }, { a: n_in3, b: n_in5 }, { a: n_in4, b: n_a2 }, { a: n_a2, b: n_in6 }, { a: n_in6, b: n_in9 }, { a: n_in9, b: n_in10 }, { a: n_in10, b: n_in11 }, { a: n_in5, b: n_in10 }, { a: n_a1, b: n_a2 }, { a: n_a1, b: n_in15 }, { a: n_in15, b: n_in28 }, { a: n_in28, b: n_stb }, { a: n_in15, b: n_uc1 }, { a: n_uc1, b: n_in6 }, { a: n_uc1, b: n_uc2 }, { a: n_uc2, b: n_hdw }, { a: n_hdw, b: n_in11 }, { a: n_uc1, b: n_hdw }, { a: n_uc2, b: n_in9 },
  { a: n_sidein, b: n_in3 }, { a: n_sidein, b: n_in26 }, { a: n_in26, b: n_in25 }, { a: n_in25, b: n_in5 }, { a: n_in2, b: n_in27 }, { a: n_in27, b: n_in30 }, { a: n_in30, b: n_in24 }, { a: n_in24, b: n_in29 }, { a: n_in29, b: n_a1 }, { a: n_in29, b: n_in4 }, { a: n_in24, b: n_in28 },
];

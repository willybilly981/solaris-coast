// Tuning data for Bahia Solaris: map layout, districts, vehicles, weapons, wanted tiers, missions.
// World units are metres. Heading h faces (sin h, cos h) on the (x, z) plane; y is up.

export const STEP = 1 / 60;

export const WORLD = { half: 280, minX: -276, maxX: 206, minZ: -276, maxZ: 210 };

/** Avenues (x) run north-south, streets (z) run east-west. Cells between them are city blocks. */
export const ROADS = { x: [-200, -110, -20, 60, 130], z: [-200, -110, -20, 60, 150], half: 7, walk: 9.5 };

export const DISTRICTS = [
  { id: 'mirador', name: 'Mirador Beachfront', color: '#ff9f6e', cx: 170, cz: 0 },
  { id: 'crown', name: 'Crown Financial District', color: '#5fd8ff', cx: -30, cz: -130 },
  { id: 'harbor', name: 'Harbor Caldera', color: '#ffc24a', cx: 10, cz: 140 },
  { id: 'palma', name: 'Palma Heights', color: '#c58bff', cx: -200, cz: 0 },
];

export function districtAt(x, z) {
  if (x < -110) return 'palma';
  if (x > 130 || (x > 60 && z > -110 && z < 60)) return 'mirador';
  if (z > 60) return 'harbor';
  return 'crown';
}

export const LANDMARKS = {
  start: { x: 141, z: 22 },
  garage: { x: -160, z: -38 },
  garageBuilding: { x: -160, z: -75 },
  safehouse: { x: -240, z: -45 },
  safehouseBuilding: { x: -240, z: -75 },
  depot: { x: 95, z: 105 },
  crownPlaza: { x: 20, z: -65 },
  raceStart: { x: 130, z: 100 },
  beach: { x: 195, z: 40 },
};

/** Ramps: centre, width, length, height; dir is the heading a car drives up the slope. */
export const RAMPS = [
  { x: 95, z: 22, w: 9, l: 16, h: 4.2, dir: Math.PI / 2 },
  { x: -80, z: 175, w: 9, l: 16, h: 4.2, dir: Math.PI / 2 },
  { x: 197, z: -60, w: 9, l: 16, h: 3.6, dir: 0 },
];

export const VEHICLES = {
  solara: { name: 'Solara GT', kind: 'car', len: 4.6, wid: 1.9, color: '#ff4a1c', maxSpeed: 38, accel: 19, turn: 1.9, grip: 6.5, hp: 100, mass: 1.2, nitro: true },
  vipera: { name: 'Vipera V8', kind: 'car', len: 4.8, wid: 1.95, color: '#6a2cff', maxSpeed: 41, accel: 22, turn: 1.75, grip: 5.5, hp: 110, mass: 1.4, nitro: true },
  aurelia: { name: 'Aurelia Apex', kind: 'car', len: 4.5, wid: 1.95, color: '#f7c22a', maxSpeed: 48, accel: 26, turn: 1.8, grip: 6, hp: 90, mass: 1.1, nitro: true },
  cargo: { name: 'Cargo Mule', kind: 'truck', len: 7.2, wid: 2.5, color: '#e8e2d0', maxSpeed: 24, accel: 9, turn: 1.15, grip: 8, hp: 220, mass: 4, nitro: false },
  interceptor: { name: 'SCMPD Interceptor', kind: 'police', len: 4.9, wid: 1.95, color: '#2a4796', maxSpeed: 40, accel: 21, turn: 1.85, grip: 6.5, hp: 140, mass: 1.5, nitro: false },
  bastion: { name: 'Bastion APC', kind: 'apc', len: 6.4, wid: 2.8, color: '#3a4636', maxSpeed: 24, accel: 11, turn: 1.0, grip: 8, hp: 520, mass: 6, nitro: false },
};

export const TRAFFIC_SPECS = ['solara', 'vipera', 'aurelia', 'cargo'];
export const CAR_COLORS = ['#1f8fff', '#e8eef5', '#2b2f3a', '#ff6fa8', '#38d6a0', '#ffb347', '#a63cff', '#d93a3a', '#f2e24b'];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', mag: 0, reserve: 0, dmg: 20, rate: 0.45, range: 2.1, spread: 0, pellets: 1, auto: false, color: '#ffffff' },
  { id: 'pistol', name: '9mm Pistol', mag: 12, reserve: 96, dmg: 24, rate: 0.26, range: 60, spread: 0.02, pellets: 1, auto: false, color: '#ffe9a0' },
  { id: 'smg', name: 'Tactical SMG', mag: 30, reserve: 240, dmg: 13, rate: 0.075, range: 55, spread: 0.05, pellets: 1, auto: true, color: '#ffd36a' },
  { id: 'shotgun', name: 'Pump Shotgun', mag: 6, reserve: 36, dmg: 11, rate: 0.85, range: 28, spread: 0.13, pellets: 8, auto: false, color: '#ffb066' },
  { id: 'pulse', name: 'Pulse Rifle', mag: 40, reserve: 200, dmg: 22, rate: 0.11, range: 80, spread: 0.015, pellets: 1, auto: true, color: '#52f0ff' },
];

/** Heat needed for each star, and what each tier sends. */
export const WANTED_TIERS = [
  { stars: 0, heat: 0, cars: 0, foot: 0, blocks: 0, heli: false, apc: false, speed: 0.7, label: 'Clear' },
  { stars: 1, heat: 8, cars: 2, foot: 0, blocks: 0, heli: false, apc: false, speed: 0.72, label: 'Patrol pursuit' },
  { stars: 2, heat: 28, cars: 3, foot: 0, blocks: 0, heli: false, apc: false, speed: 1, label: 'Interceptors' },
  { stars: 3, heat: 60, cars: 3, foot: 2, blocks: 1, heli: false, apc: false, speed: 1, label: 'Roadblocks and tactical' },
  { stars: 4, heat: 110, cars: 4, foot: 2, blocks: 1, heli: true, apc: false, speed: 1, label: 'CONDOR-1 airborne' },
  { stars: 5, heat: 180, cars: 4, foot: 3, blocks: 2, heli: true, apc: true, speed: 1.05, label: 'Bastion blockade' },
];

export const RESPECT_LEVELS = [0, 100, 300, 600, 1000, 1600];

/**
 * Mission steps: goto {x,z,r}, getcar {spec,x,z}, kill {n,x,z}, evade, destroy {x,z}.
 * Lines are [speaker, text] and play when the step begins (intro on mission start).
 */
export const MISSIONS = [
  {
    id: 'm1', title: 'Sunrise Boulevard', district: 'mirador', cash: 800, respect: 60,
    start: { x: 141, z: 22 },
    intro: [['Elena', 'Mateo, the Syndicate moved our shipment. Meet my contact on the beach.'], ['Mateo', 'On my way, sis. Keep the line open.']],
    steps: [
      { type: 'goto', text: 'Meet the contact on the beach', x: 195, z: 40, r: 5, line: ['Elena', 'Contact is by the lifeguard tower. Walk, do not run.'] },
      { type: 'getcar', text: 'Take the Solara GT', spec: 'solara', x: 136, z: 52, line: ['Elena', 'Keys are in that Solara GT. Take it.'] },
      { type: 'goto', text: 'Drive to the crew garage, Palma Heights', x: -160, z: -38, r: 6, line: ['Elena', 'Garage is on the west side. Tune it up.'] },
    ],
    outro: [['Elena', 'Clean run. The crew garage is ours now.']],
  },
  {
    id: 'm2', title: 'Glass Ceiling', district: 'crown', cash: 1200, respect: 80,
    start: { x: 20, z: -45 },
    intro: [['Elena', 'Obsidian runners are meeting in the Crown plaza. Thin them out.']],
    steps: [
      { type: 'goto', text: 'Reach Crown Financial plaza', x: 60, z: -65, r: 6, line: ['Elena', 'I have eyes on four of them.'] },
      { type: 'kill', text: 'Eliminate Obsidian runners', n: 4, x: 60, z: -90, line: ['Mateo', 'Contact. Engaging.'] },
    ],
    outro: [['Elena', 'Runners down. Their ledger just lit up my screen.']],
  },
  {
    id: 'm3', title: 'Fresh Paint', district: 'crown', cash: 1000, respect: 70,
    start: { x: -20, z: -120 },
    intro: [['Elena', 'Obsidian owns a Vipera V8 parked on Avenue 3. Borrow it.']],
    steps: [
      { type: 'getcar', text: 'Steal the Vipera V8', spec: 'vipera', x: -20, z: -150, line: ['Mateo', 'Nice ride for a criminal.'] },
      { type: 'goto', text: 'Deliver it to the crew garage', x: -160, z: -38, r: 6, line: ['Elena', 'Garage, quick, before the plates ping.'] },
    ],
    outro: [['Elena', 'The garage crew will repaint it before sundown.']],
  },
  {
    id: 'm4', title: 'Hot Cargo', district: 'harbor', cash: 1800, respect: 90,
    start: { x: 60, z: 78 },
    intro: [['Elena', 'Syndicate armour left a Cargo Mule at the depot. Take it to the hotel bay.']],
    steps: [
      { type: 'getcar', text: 'Take the Cargo Mule', spec: 'cargo', x: 60, z: 105, heat: 30, line: ['Elena', 'Police scanner just chirped. You are hot.'] },
      { type: 'goto', text: 'Deliver the cargo to the hotel bay', x: 130, z: -150, r: 8, line: ['Elena', 'Straight up the boulevard, Mateo.'] },
    ],
    outro: [['Elena', 'Cargo delivered. Lose the heat, then rest.']],
  },
  {
    id: 'm5', title: 'Dead Drop', district: 'crown', cash: 1500, respect: 80,
    start: { x: -20, z: -45 },
    intro: [['Elena', 'Three drop points across Crown. Pick the data up in order.']],
    steps: [
      { type: 'goto', text: 'Drop 1: Avenue 3 junction', x: -20, z: -110, r: 6, line: ['Elena', 'First drop is live.'] },
      { type: 'goto', text: 'Drop 2: Overpass underpass', x: 60, z: -110, r: 6, line: ['Elena', 'Under the highway now.'] },
      { type: 'goto', text: 'Drop 3: Crown plaza', x: 60, z: -20, r: 6, line: ['Elena', 'Last one. I am uploading.'] },
    ],
    outro: [['Elena', 'Got it all. Obsidian routes are naked now.']],
  },
  {
    id: 'm6', title: 'Heat Wave', district: 'palma', cash: 2000, respect: 100,
    start: { x: -110, z: 20 },
    intro: [['Elena', 'Obsidian tipped the SCMPD. Disappear.']],
    steps: [
      { type: 'evade', text: 'Lose the SCMPD', line: ['Mateo', 'Three stars. They really want me.'] },
      { type: 'goto', text: 'Hide out at the safehouse', x: -240, z: -45, r: 6, line: ['Elena', 'Safehouse is clear. Come home.'] },
    ],
    outro: [['Elena', 'You vanished like a magician. Rest up.']],
  },
  {
    id: 'm7', title: 'Iron Dock', district: 'harbor', cash: 3000, respect: 120,
    start: { x: -20, z: 120 },
    intro: [['Elena', 'Obsidian wheeled a Bastion APC onto the quay. Break it.']],
    steps: [
      { type: 'goto', text: 'Reach Harbor Caldera quay', x: -20, z: 150, r: 7, line: ['Elena', 'It is armoured. Use the pulse rifle.'] },
      { type: 'destroy', text: 'Destroy the Obsidian Bastion APC', x: -20, z: 175, line: ['Mateo', 'Big truck. Bigger bang.'] },
    ],
    outro: [['Elena', 'APC is slag. Their last asset in the port.']],
  },
  {
    id: 'm8', title: 'Solaris Coast', district: 'mirador', cash: 5000, respect: 200,
    start: { x: 141, z: -30 },
    intro: [['Elena', 'Their boss is on Mirador sands. This ends tonight.']],
    steps: [
      { type: 'goto', text: 'Reach the beach showdown', x: 180, z: -30, r: 6, line: ['Elena', 'I see eight guns. Stay sharp.'] },
      { type: 'kill', text: 'Defeat the Obsidian Syndicate', n: 8, x: 185, z: -20, line: ['Mateo', 'Here we go.'] },
    ],
    outro: [['Elena', 'Bahia Solaris is ours. Watch the sunset, brother.']],
  },
];

export const RADIO = [
  { name: 'Mirador FM', bpm: 104 },
  { name: 'Crown 98.3', bpm: 124 },
  { name: 'Caldera Dub', bpm: 78 },
];

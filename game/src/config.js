export const CITY = { half: 250, roads: [-200, -100, 0, 100, 200], roadWidth: 24 };
export const COLORS = { sky: 0xe5a267, road: 0x4b5150, sand: 0xd7b985, water: 0x278f91, orange: 0xec8b3e, turquoise: 0x21b8b2, police: 0x243f68 };
export const MISSION = {
  title: 'Borrowed Wheels', start: [-178, 0, 137], target: [-195, 0, -135], garage: [-180, 0, 127], mara: [-184, 0, 137],
  port: [155, 0, 180], plaza: [155, 0, -153], ledger: [151, 0, 185], transmitter: [155, 0, -153],
  roadblock: [100, 0, -100], contractCars: [[-211, 0, 121], [-210, 0, 134], [-210, 0, 147]]
};
export const SAVE_KEY = 'sunset-county-save-v2';
export const STEP = 1 / 60;
export const EXTENSION_KEYS = { dispatch: 'J', rally: 'N', camera: 'V', shutter: 'X', crouch: 'Control', workshop: 'U' };
export const COUNTY = {
  cycleSeconds: 720, startHour: 17.5, cacheReward: 90,
  courierSeconds: 150, courierReward: 650,
  courierRoute: [[-200, 0, 200], [0, 0, 200], [200, 0, 100], [200, 0, -100]],
  caches: [[-218, 0, 152], [-116, 0, -182], [116, 0, 75], [216, 0, 216], [178, 0, -181], [-25, 0, 116]]
};
export const SHOTS = ['chase', 'street', 'docks', 'safehouse'];
export const STORY = [
  { title: 'Paper Trail', line: 'Mara: Port Sol kept a copy of every sale. Take the sedan there and find the ledger.', next: 'Touch the marker to reach the docks.' },
  { title: 'Last Delivery', line: 'Alex: The ledger names the collector. Mara: Broadcast it from Civic Plaza, then bring the car home.', next: 'Three patrol units are already on the way.' }
];

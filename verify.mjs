import { chromium } from '/home/hatch/workspace/makefun/threejs-fps-02-ops/playwright/node_modules/playwright/index.mjs';
import { readFile } from 'node:fs/promises';
const origin = process.env.SUNSET_ORIGIN || 'http://127.0.0.1:8080';
const browser = await chromium.launch({ headless: true, executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let passed = 0;
const errors = [], external = [];
function check(name, result) {
  if (!result) throw new Error(`FAIL ${name}`);
  console.log(`PASS ${++passed}: ${name}`);
}
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => { if (!r.url().startsWith(origin)) external.push(r.url()); });
try {
  await page.goto(origin + '/?verify=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.sunset);
  check('start menu', await page.locator('#menu').isVisible());
  await page.click('#newGame');
  check('new game health', await page.evaluate(() => sunset.player.health === 100));
  check('city geometry', await page.evaluate(() => sunset.world.obstacles.length > 10));
  check('traffic fleet', await page.evaluate(() => sunset.vehicles.length === 13));
  check('pedestrian population', await page.evaluate(() => sunset.pedestrians.length >= 18));
  await page.keyboard.press('e');
  await page.waitForFunction(() => sunset.mission.phase === 'find');
  check('Mara mission accepted', true);
  await page.evaluate(() => sunset.player.root.position.copy(sunset.vehicles.find(v => v.userData.target).position));
  await page.keyboard.press('e');
  await page.waitForFunction(() => !!sunset.vehicle);
  check('vehicle stolen', await page.evaluate(() => sunset.vehicle.userData.stolen));
  check('wanted response', await page.evaluate(() => sunset.police.level > 0));
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  check('driving acceleration', await page.evaluate(() => sunset.vehicle.userData.speed > 0));
  await page.evaluate(async () => { const p = await import('/src/police.js'); p.clearWanted(sunset.police); });
  await page.waitForFunction(() => sunset.mission.phase === 'deliver');
  check('escape transition', true);
  await page.evaluate(() => { sunset.vehicle.position.set(-180, 0, 127); sunset.vehicle.userData.speed = 0; });
  await page.waitForFunction(() => sunset.mission.phase === 'complete');
  check('first mission reward', await page.evaluate(() => sunset.mission.money === 1090));
  await page.evaluate(() => sunset.player.root.position.set(-184, 0, 137));
  await page.keyboard.press('e');
  await page.waitForFunction(() => sunset.mission.phase === 'm2-drive');
  check('second mission accepted', true);
  await page.evaluate(() => { sunset.mission.dockArrived = true; sunset.player.root.position.set(155, 0, 180); });
  await page.waitForFunction(() => sunset.mission.phase === 'm2-combat');
  check('dock guards spawned', await page.evaluate(() => sunset.guards.length === 3));
  const unitResults = await page.evaluate(async () => {
    const THREE = await import('three');
    const missions = await import('/src/missions.js');
    const county = await import('/src/county.js');
    const config = await import('/src/config.js');
    const vehicles = await import('/src/vehicles.js');
    const activities = await import('/src/activities.js');
    const combatModule = await import('/src/combat.js');
    const policeModule = await import('/src/police.js');
    const atmosphereModule = await import('/src/atmosphere.js');
    const util = await import('/src/util.js');
    const scene = new THREE.Scene();
    const state = county.createCounty(scene);
    const mission = missions.createMission({ phase: 'free-roam' });
    const player = { root: new THREE.Group(), health: 20 };
    const car = vehicles.createVehicle(scene, new THREE.Vector3());
    const combat = combatModule.createCombat();
    const police = policeModule.createPolice(scene);
    const results = [];
    const test = (name, value) => results.push([name, !!value]);
    test('courier starts', county.startCourier(mission, police));
    for (const position of [...config.COUNTY.courierRoute, config.MISSION.garage]) {
      car.position.set(...position);
      county.updateCounty(state, mission, player, car, police, .1);
    }
    test('all courier gates finish', !mission.courier.active && mission.courier.completed === 1);
    test('courier condition bonus', mission.money === 1090);
    test('courier best time', mission.courier.best > 0);
    county.startCourier(mission, police);
    county.updateCounty(state, mission, player, null, police, 151);
    test('courier expiry', !mission.courier.active && mission.toast.includes('Time expired'));
    police.level = 1;
    test('wanted courier denied', !county.startCourier(mission, police));
    police.level = 0;
    for (const point of config.COUNTY.caches) {
      player.root.position.set(...point);
      county.updateCounty(state, mission, player, null, police, .01);
      county.collectCountyCache(state, mission);
    }
    test('six caches recovered', mission.caches.length === 6);
    test('cache collection reward', mission.money === 2130);
    test('duplicate cache rejected', !county.collectCountyCache(state, mission));
    missions.saveMission(mission);
    const restored = missions.createMission(missions.loadSave());
    test('cache persistence', restored.caches.length === 6);
    test('courier best persistence', restored.courier.best === mission.courier.best);
    car.userData.health = 10;
    vehicles.updateVehicleCondition(car, .1);
    test('damaged vehicle smoke', car.userData.smoke.visible);
    player.root.position.set(...config.MISSION.garage);
    test('garage payment accepted', activities.garageService(mission, player, car, combat));
    test('garage repair and heal', car.userData.health === 100 && player.health === 100 && !car.userData.smoke.visible);
    test('cover segment obstruction', util.segmentBlocked({ x: 0, z: 0 }, { x: 10, z: 0 }, [{ x: 5, z: 0, hx: 1, hz: 1 }]));
    test('clear segment unobstructed', !util.segmentBlocked({ x: 0, z: 5 }, { x: 10, z: 5 }, [{ x: 5, z: 0, hx: 1, hz: 1 }]));
    const sky = atmosphereModule.createAtmosphere(sunset.scene, sunset.world);
    atmosphereModule.updateAtmosphere(sky, 0, [car]);
    test('night stars and headlights', sky.stars.visible && car.userData.lights[0].material.emissiveIntensity > 1);
    atmosphereModule.updateAtmosphere(sky, 12, [car]);
    test('day stars hidden', !sky.stars.visible);
    return results;
  });
  for (const [name, value] of unitResults) check(name, value);
  check('radio station cycles', await page.evaluate(async () => {
    const module = await import('/src/radio.js');
    const radio = module.createRadio();
    const names = [module.tuneRadio(radio), module.tuneRadio(radio), module.tuneRadio(radio)];
    radio.element.remove();
    return names[0].includes('SOL') && names[1].includes('PIER') && names[2] === 'OFF';
  }));
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => !document.querySelector('#countyJournal').classList.contains('hidden'));
  check('map opens', await page.locator('#countyJournal').isVisible());
  await page.locator('#countyJournal canvas').click({ position: { x: 100, y: 100 } });
  await page.waitForFunction(() => document.querySelector('.journalDetails').textContent.includes('Personal waypoint'));
  check('map waypoint', true);
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.querySelector('#countyJournal').classList.contains('hidden'));
  check('map closes', !(await page.locator('#countyJournal').isVisible()));
  check('zero console errors', errors.length === 0);
  check('zero external requests', external.length === 0);
  console.log(`BASE GAME: ${passed}/37 passed, ${errors.length} console errors, ${external.length} external requests`);
  if (passed !== 37) throw new Error(`Expected 37 assertions, got ${passed}`);
  if (process.argv.includes('--capture')) {
    const shots = JSON.parse(await readFile(new URL('./shots.json', import.meta.url), 'utf8'));
    for (const shot of shots) {
      const response = await fetch(origin + '/src/shots.js');
      const body = await response.text();
      await page.addInitScript(({ url, body }) => sessionStorage.setItem(`makefun:v1:${url}`, JSON.stringify({ body, etag: null, at: Date.now() })), { url: origin + '/src/shots.js', body });
      await page.goto(origin + '/' + shot.query, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.shotReady === true, { timeout: 60000 });
      await page.screenshot({ path: new URL('./screenshots/' + shot.name, import.meta.url).pathname, type: 'jpeg', quality: 85 });
      console.log(`Captured ${shot.name}`);
    }
    if (errors.length || external.length) throw new Error(JSON.stringify({ errors, external }));
  }
} finally { await browser.close(); }

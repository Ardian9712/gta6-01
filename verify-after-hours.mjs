import { chromium } from '/home/hatch/workspace/makefun/threejs-fps-02-ops/playwright/node_modules/playwright/index.mjs';

const origin = process.env.SUNSET_ORIGIN || 'http://127.0.0.1:8080';
const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const errors = [];
const external = [];
let count = 0;
function check(name, passed) {
  if (!passed) throw new Error(`FAIL: ${name}`);
  console.log(`PASS ${++count}: ${name}`);
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(origin)) external.push(request.url()); });
  await page.goto(`${origin}/?verify=1`);
  await page.waitForFunction(() => !!window.sunset);
  await page.click('#newGame');
  const results = await page.evaluate(async () => {
    const THREE = await import('three');
    const missions = await import('/src/missions.js');
    const dispatch = await import('/src/dispatch.js');
    const rally = await import('/src/rally.js');
    const photo = await import('/src/photography.js');
    const garage = await import('/src/garage.js');
    const vehicles = await import('/src/vehicles.js');
    const combatModule = await import('/src/combat.js');
    const policeModule = await import('/src/police.js');
    const results = [];
    const test = (name, result) => results.push([name, !!result]);
    const mission = missions.createMission({ phase: 'free-roam', money: 5000 });
    const scene = new THREE.Scene();
    const combat = combatModule.createCombat();
    const police = policeModule.createPolice(scene);
    const player = { root: new THREE.Group(), speed: 0, health: 100 };
    player.root.position.set(-180, 0, 127);
    const car = vehicles.createVehicle(scene, player.root.position.clone());
    car.userData.target = true;
    const view = dispatch.createDispatch(scene);
    test('job requires garage proximity', !dispatch.startDispatch(mission, new THREE.Vector3(), police, combat));
    test('mission four accepted', dispatch.startDispatch(mission, player.root.position, police, combat));
    car.position.set(...dispatch.DISPATCH_JOBS[0].contact);
    car.userData.speed = 10;
    test('moving pickup rejected', !dispatch.interactDispatch(mission, player, car, police, scene, combat));
    car.userData.speed = 0;
    test('witness boards stopped car', dispatch.interactDispatch(mission, player, car, police, scene, combat));
    test('witness pickup starts pursuit', police.level === 2 && mission.dispatch.boarded);
    car.userData.health = 80;
    dispatch.updateDispatch(view, mission, player, car, police, combat, scene, .1);
    test('collision harms passenger', mission.dispatch.passengerHealth === 72);
    policeModule.clearWanted(police);
    car.position.set(...dispatch.DISPATCH_JOBS[0].destination);
    dispatch.updateDispatch(view, mission, player, car, police, combat, scene, 2.1);
    test('mission four handoff pays once', mission.dispatch.completed === 1 && mission.money === 6316);
    dispatch.updateDispatch(view, mission, player, car, police, combat, scene, 3);
    test('completed job cannot pay twice', mission.money === 6316);
    test('mission five accepted', dispatch.startDispatch(mission, player.root.position, police, combat));
    player.root.position.set(...dispatch.DISPATCH_JOBS[1].contact);
    dispatch.updateDispatch(view, mission, player, null, police, combat, scene, .1);
    test('mission five guards spawned', combat.enemies.length === 3 && mission.dispatch.stage === 'guards');
    test('guarded backup cannot be taken', !dispatch.interactDispatch(mission, player, null, police, scene, combat));
    combat.enemies.forEach(enemy => { enemy.alive = false; });
    dispatch.updateDispatch(view, mission, player, null, police, combat, scene, .1);
    test('backup collection starts three stars', dispatch.interactDispatch(mission, player, null, police, scene, combat) && police.level === 3);
    player.root.position.set(-180, 0, 127);
    dispatch.updateDispatch(view, mission, player, null, police, combat, scene, 3);
    test('wanted handoff denied', mission.dispatch.completed === 1);
    policeModule.clearWanted(police);
    dispatch.updateDispatch(view, mission, player, null, police, combat, scene, 2.1);
    test('mission five completed', mission.dispatch.completed === 2 && !mission.dispatch.active);
    const restored = missions.createMission(missions.loadSave());
    test('story extension persists', restored.dispatch.completed === 2);
    test('completed extension cannot restart', !dispatch.startDispatch(mission, player.root.position, police, combat));
    const failed = missions.createMission({ phase: 'free-roam' });
    dispatch.startDispatch(failed, player.root.position, police, combat);
    dispatch.updateDispatch(view, failed, player, null, police, combat, scene, 181);
    test('timed job failure and retry', failed.dispatch.failures === 1 && dispatch.startDispatch(failed, player.root.position, police, combat));
    dispatch.failDispatch(failed, scene, combat, 'test reset');
    const raceView = rally.createRally(scene);
    car.position.copy(player.root.position);
    test('rally requires vehicle', !rally.startRally(mission, player.root.position, null, police));
    test('rally starts at garage', rally.startRally(mission, car.position, car, police));
    rally.updateRally(raceView, mission, car, 3.1);
    test('countdown releases car', mission.rally.countdown === 0);
    car.position.set(...rally.RALLY_ROUTE[4]);
    rally.updateRally(raceView, mission, car, .1);
    test('out-of-order gate rejected', mission.rally.gate === 0);
    car.userData.health -= 10;
    rally.updateRally(raceView, mission, car, .1);
    test('collision time penalty', mission.rally.penalty === 3.5);
    for (const point of rally.RALLY_ROUTE) {
      car.position.set(...point);
      rally.updateRally(raceView, mission, car, 1);
    }
    test('all ten gates complete rally', !mission.rally.active && mission.rally.wins === 1);
    test('rally medal and saved best', mission.rally.medal === 'GOLD' && missions.createMission(missions.loadSave()).rally.best === mission.rally.best);
    rally.startRally(mission, car.position, car, police);
    rally.updateRally(raceView, mission, null, .1);
    test('leaving rally car cancels', !mission.rally.active);
    const camera = new THREE.PerspectiveCamera(58, 16 / 9, .1, 900);
    const subject = photo.PHOTO_SUBJECTS[1];
    camera.position.set(155, 2, -200);
    camera.lookAt(...subject.point);
    camera.updateMatrixWorld(true);
    const framed = photo.evaluatePhoto(camera, subject, []);
    test('centered landmark accepted', framed.valid && framed.score >= 85);
    test('foreground building blocks photograph', !photo.evaluatePhoto(camera, subject, [{ x: 155, z: -180, hx: 10, hz: 5 }]).valid);
    camera.lookAt(155, 2, -230);
    camera.updateMatrixWorld(true);
    test('behind-camera subject rejected', !photo.evaluatePhoto(camera, subject, []).valid);
    const photoView = photo.createPhotography();
    const initialCash = mission.money;
    for (const [index, item] of photo.PHOTO_SUBJECTS.entries()) {
      photoView.candidate = { index, subject: item, score: 90 };
      photo.takePhoto(photoView, mission);
    }
    test('portfolio completion reward', mission.money === initialCash + 1360);
    photo.takePhoto(photoView, mission);
    test('repeat photograph has no cash exploit', mission.money === initialCash + 1360);
    test('portfolio saved', missions.createMission(missions.loadSave()).photos.taken.length === 4);
    photoView.panel.remove();
    test('workshop buys engine', garage.buyPart(mission, 'engine'));
    test('duplicate part rejected', !garage.buyPart(mission, 'engine'));
    test('paint purchase accepted', garage.buyPaint(mission, 2));
    garage.applyGarage(mission, car);
    test('parts alter vehicle performance', car.userData.accelerationMultiplier === 1.18 && car.userData.speedMultiplier === 1.1);
    test('paint applied to body', car.userData.body.material.color.getHex() === garage.PAINTS[2].color);
    test('garage persistence', missions.createMission(missions.loadSave()).garage.parts.includes('engine'));
    return results;
  });
  for (const [name, result] of results) check(name, result);
  await page.evaluate(async () => {
    sunset.mission.phase = 'free-roam';
    sunset.mission.money = 5000;
    sunset.player.root.position.set(-180, 0, 127);
    (await import('/src/police.js')).clearWanted(sunset.police);
  });
  await page.keyboard.press('t');
  await page.waitForFunction(() => sunset.workshop.active);
  check('workshop UI opens with T', await page.locator('#workshop').isVisible());
  await page.locator('[data-part="armor"]').click();
  check('workshop button installs armor', await page.evaluate(() => sunset.mission.garage.parts.includes('armor')));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !sunset.workshop.active);
  await page.keyboard.press('v');
  await page.waitForFunction(() => sunset.photography.active);
  check('viewfinder opens with V', await page.locator('#viewfinder').isVisible());
  const clock = await page.evaluate(() => sunset.mission.clock);
  await page.waitForTimeout(250);
  check('photography pauses simulation', await page.evaluate(value => sunset.mission.clock === value, clock));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !sunset.photography.active);
  check('viewfinder restores game', !(await page.locator('#viewfinder').isVisible()));
  check('zero new-feature console errors', errors.length === 0);
  check('zero new-feature external requests', external.length === 0);
  console.log(`${count}/${count} After Hours checks passed`);
} finally {
  await browser.close();
}

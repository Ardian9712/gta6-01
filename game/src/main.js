import * as THREE from 'three';
import { MISSION, STORY } from './config.js';
import { createInput } from './input.js';
import { createWorld } from './world.js';
import { createPlayer, updatePlayer, updateCamera } from './player.js';
import { createFleet, createVehicle, updateTraffic, updateVehicleDrive, findNearbyVehicle } from './vehicles.js';
import { createPedestrians, updatePedestrians, nearbyWitness } from './pedestrians.js';
import { createPolice, raiseWanted, updatePolice, clearWanted } from './police.js';
import { createMission, loadSave, saveMission, objectiveFor, markStolen, advanceStory } from './missions.js';
import { createCombat, updateCombat, spawnGuards, clearGuards, aliveGuards } from './combat.js';
import { createHud, updateHud } from './hud.js';
import { createAudio } from './audio.js';
import { readShot } from './shots.js';
import { repairVehicle } from './vehicles.js';
import { STEP } from './config.js';
import { createPresentation, updatePresentation } from './presentation.js';
import { createActivities, updateActivities, garageService as serviceAtGarage, resetCheckpoint, districtAt } from './activities.js';
import { createCounty, updateCounty, startCourier, collectCountyCache, countyStatus, countyObjective, cancelCourier } from './county.js';
import { createAtmosphere, updateAtmosphere } from './atmosphere.js';
import { speakToPedestrian } from './pedestrians.js';
import { createJournal, toggleJournal, updateJournal } from './journal.js';
import { createRadio, tuneRadio, updateRadio } from './radio.js';
import { createDispatch, startDispatch, interactDispatch, updateDispatch, dispatchTarget, dispatchObjective, dispatchJob, failDispatch } from './dispatch.js';
import { createRally, startRally, updateRally, rallyTarget, rallySummary, cancelRally } from './rally.js';
import { createPhotography, togglePhotography, updatePhotography } from './photography.js';
import { createGarage, openGarage, closeGarage, applyGarage } from './garage.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !new URLSearchParams(location.search).has('verify');
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .1, 900);
const input = createInput(renderer.domElement);
const hud = createHud();
const audio = createAudio();
const journal = createJournal();
const radioStation = createRadio();
const world = createWorld(scene);
const atmosphere = createAtmosphere(scene, world);
const activities = createActivities(scene);
const county = createCounty(scene);
const vehicles = createFleet(scene);
const pedestrians = createPedestrians(scene);
const police = createPolice(scene);
const mara = createHuman(...MISSION.mara, 0x53a697);
const player = createPlayer(scene, new THREE.Vector3(...MISSION.start));
const presentation = createPresentation(scene);
const dispatch = createDispatch(scene);
const rally = createRally(scene);
const photography = createPhotography();
const workshop = createGarage();
let mission = createMission();
const combat = createCombat();
let activeVehicle = null;
let running = false;
let paused = false;
let yaw = Math.PI;
let frameMouse = [0, 0];
let accumulator = 0;
const fixedStep = STEP;
const menu = document.querySelector('#menu');
const initialShot = readShot();
let arrestTime = 0;
let snapshotReady = false;
let shotTicks = 0;
const checkpointButton = document.createElement('button');
checkpointButton.textContent = 'Restart checkpoint'; checkpointButton.id = 'checkpoint'; checkpointButton.className = 'hidden';
const returnButton = document.createElement('button'); returnButton.textContent = 'Main menu'; returnButton.className = 'hidden';
document.querySelector('#panel').append(checkpointButton, returnButton);
const garageService = document.createElement('button'); garageService.textContent = 'Repair & heal  $120'; garageService.className = 'hidden';
document.querySelector('#panel').append(garageService);
checkpointButton.onclick = () => { paused = false; resetCheckpoint(mission, combat); saveMission(mission); startGame(true); };
returnButton.onclick = () => { paused = false; running = false; menu.classList.remove('hidden'); hud.root.classList.add('hidden'); resetMenu(); };
function resetMenu() {
  document.querySelector('h1').innerHTML = 'Sunset County:<br>One Last Job';
  document.querySelector('#newGame').textContent = 'New Game'; document.querySelector('#continue').classList.remove('hidden');
  document.querySelector('#continue').disabled = !loadSave(); checkpointButton.classList.add('hidden'); returnButton.classList.add('hidden');
}
document.querySelector('#continue').disabled = !loadSave();
if (initialShot) startGame(false);

function startGame(continueGame = false) {
  closeGarage(workshop);
  togglePhotography(photography, camera, player, false);
  toggleJournal(journal, false);
  if (paused) { paused = false; menu.classList.add('hidden'); resetMenu(); input.release(); return; }
  resetMenu();
  clearWanted(police);
  mission = createMission(continueGame ? loadSave() : null);
  clearGuards(scene, combat); combat.ammo = 12; combat.reserve = 48; combat.reload = 0;
  if (!continueGame && !readShot()) saveMission(mission);
  activeVehicle = null;
  player.root.position.set(...MISSION.start);
  player.health = 100;
  player.root.visible = true;
  player.yaw = Math.PI;
  const target = vehicles.find(car => car.userData.target);
  target.position.set(...MISSION.target); target.userData.health = 100; target.userData.speed = 0;
  target.userData.stolen = false; target.userData.occupied = true;
  applyGarage(mission, target);
  if (mission.phase === 'complete') {
    target.position.set(-180, 0, 117);
    mission.toast = 'MISSION COMPLETE / Impound receipt recovered / Saved';
    mission.toastTime = 12;
  }
  if (mission.phase === 'm2-drive' || mission.phase === 'm3-drive' || mission.phase === 'm3-return') {
    target.position.set(...MISSION.garage); target.userData.stolen = false; target.userData.occupied = false;
  }
  if (mission.phase === 'm3-escape') {
    target.position.set(...MISSION.plaza); target.userData.stolen = true; target.userData.occupied = false;
    player.root.position.set(...MISSION.plaza);
    raiseWanted(police, 3);
  }
  garageService.classList.toggle('hidden', mission.phase !== 'free-roam');
  if (mission.phase === 'm2-combat') {
    player.root.position.set(...MISSION.port); spawnGuards(scene, combat, new THREE.Vector3(...MISSION.port));
  }
  if (mission.phase === 'm2-ledger') player.root.position.set(...MISSION.ledger);
  if (mission.phase === 'm2-return') player.root.position.set(...MISSION.garage);
  if (mission.phase === 'm3-transmit') player.root.position.set(...MISSION.plaza);
  if (mission.phase === 'm3-return') target.position.set(...MISSION.garage);
  if (['escape', 'deliver'].includes(mission.phase)) {
    target.position.set(...MISSION.target); target.userData.stolen = true; target.userData.occupied = true;
    activeVehicle = target; player.root.visible = false;
    if (mission.phase === 'escape') raiseWanted(police, 1);
  }
  yaw = Math.PI;
  menu.classList.add('hidden'); hud.root.classList.remove('hidden');
  running = true; paused = false;
  const shot = readShot();
  if (shot) setupShot(shot);
  if (!shot) { audio.start(); audio.click(); }
  if (mission.phase === 'meet') { mission.toast = 'E — speak with Mara'; mission.toastTime = 3; }
}

document.querySelector('#newGame').addEventListener('click', () => startGame(false));
document.querySelector('#continue').addEventListener('click', () => startGame(true));
garageService.onclick = () => {
  if (serviceAtGarage(mission, player, vehicles.find(car => car.userData.target), combat)) saveMission(mission);
};
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});

function createHuman(x, y, z, color) {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.42, .9, 3, 7), new THREE.MeshStandardMaterial({ color }));
  torso.position.y = 1.15; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.31, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd6a17c }));
  head.position.y = 2.05; group.add(head); group.position.set(x, y, z); scene.add(group); return group;
}

function setupShot(shot) {
  mission.phase = shot.phase;
  mission.complete = shot.phase === 'complete';
  player.root.position.set(...shot.position);
  yaw = shot.yaw; player.yaw = shot.yaw;
  if (shot.wanted) raiseWanted(police, shot.wanted);
  if (shot.stolen) {
    const target = vehicles.find(car => car.userData.target);
    target.userData.stolen = true; target.userData.occupied = false;
    target.position.set(...MISSION.target); spawnDriver(target.position);
    mission.toast = 'Vehicle stolen — witness reporting'; mission.toastTime = 8;
  }
  if (shot.driving) {
    activeVehicle = vehicles.find(car => car.userData.target); activeVehicle.position.set(...shot.position); activeVehicle.userData.yaw = shot.yaw; activeVehicle.userData.speed = 18; activeVehicle.rotation.y = shot.yaw;
    player.root.visible = false;
    police.cars.forEach(car => { scene.remove(car); }); police.cars.length = 0;
    for (let i = 0; i < 2; i++) {
      const patrol = makePoliceCar(new THREE.Vector3(-9 + i * 9, 0, 18 - i * 4));
      police.cars.push(patrol);
    }
    police.lastSeen.copy(activeVehicle.position);
    police.state = 'PURSUIT';
    vehicles[0].position.set(18, 0, 68); vehicles[0].userData.yaw = 0; vehicles[0].rotation.y = 0;
    vehicles[1].position.set(-18, 0, 91); vehicles[1].rotation.y = Math.PI;
  }
  if (shot.phase === 'complete') {
    mission.money = 1090; mission.toast = 'MISSION COMPLETE  /  +$850  /  Impound receipt recovered  /  Saved'; mission.toastTime = 30;
    mara.position.set(...MISSION.mara);
    const target = vehicles.find(car => car.userData.target); target.position.set(-180, 0, 117);
  }
  if (shot.phase === 'complete') { mission.phase = 'complete'; mission.complete = true; }
  if (shot.caches) mission.caches = [...shot.caches];
  if (Number.isFinite(shot.clock)) mission.clock = shot.clock;
  if (shot.phase === 'm2-combat') {
    mission.money = 1090; mission.ledger = false; spawnGuards(scene, combat, new THREE.Vector3(...MISSION.port));
    mission.toast = 'PAPER TRAIL / Dock guards are closing in'; mission.toastTime = 30;
  }
  if (shot.phase === 'm2-combat') {
    const target = vehicles.find(car => car.userData.target);
    target.position.set(...MISSION.port); target.userData.stolen = true;
    combat.enemies.forEach((guard, index) => {
      guard.actor.root.position.set(145 + index * 12, 0, 187 + index * 2);
    });
  }
  if (shot.phase === 'm3-escape') {
    mission.broadcast = true; mission.money = 1940; mission.toast = 'LAST DELIVERY / Broadcast live / ★★★'; mission.toastTime = 30;
    raiseWanted(police, 3);
  }
  if (shot.driving) {
    camera.position.set(activeVehicle.position.x, 9, activeVehicle.position.z - 23);
    camera.lookAt(activeVehicle.position.x, 1, activeVehicle.position.z + 30);
  } else {
    camera.position.set(player.root.position.x - Math.sin(yaw) * 11, 6, player.root.position.z - Math.cos(yaw) * 11);
    camera.lookAt(player.root.position.x, 1.5, player.root.position.z);
  }
  if (shot.name === 'docks') {
    camera.position.set(134, 5, 160);
    camera.lookAt(153, 1.5, 188);
  }
}

function makePoliceCar(position) {
  return createVehicle(scene, position, 0x203d6b, true);
}

function spawnDriver(position) {
  const driver = createHuman(position.x + 3.2, 0, position.z - 1, 0x4d6570);
  driver.userData.flee = true;
  driver.userData.life = 5;
  driver.userData.root = driver;
  pedestrians.push({ root: driver, legs: [], phase: 0, walkYaw: Math.PI / 2, walkSpeed: 4, flee: true });
}

function interact() {
  if (mission.phase === 'm2-ledger' && !activeVehicle && Math.hypot(player.root.position.x - MISSION.ledger[0], player.root.position.z - MISSION.ledger[2]) < 10 && aliveGuards(combat) === 0) {
    mission.ledger = true; advanceStory(mission, 'm2-return', 'Ledger secured — Mara needs the original.'); saveMission(mission); return;
  }
  if (mission.phase === 'm3-transmit' && !activeVehicle && Math.hypot(player.root.position.x - MISSION.transmitter[0], player.root.position.z - MISSION.transmitter[2]) < 11) {
    mission.broadcast = true; advanceStory(mission, 'm3-escape', 'Broadcast live. Three patrol units responding.'); raiseWanted(police, 3); saveMission(mission); return;
  }
  if (mission.phase === 'free-roam' && !activeVehicle && Math.hypot(player.root.position.x - mara.position.x, player.root.position.z - mara.position.z) < 8) {
    if (mission.dispatch.active || mission.rally.active || mission.courier.active) {
      mission.toast = 'Mara: Finish your current route before taking a delivery contract.';
      mission.toastTime = 3;
      return;
    }
    mission.contractStep = mission.contractStep ? 0 : 1;
    mission.toast = mission.contractStep ? 'Contract accepted — take a vehicle to Civic Quarter' : 'Contract cancelled'; mission.toastTime = 5; saveMission(mission); return;
  }
  if (mission.phase === 'complete' && Math.hypot(player.root.position.x - mara.position.x, player.root.position.z - mara.position.z) < 8) {
    const target = vehicles.find(car => car.userData.target);
    target.position.set(...MISSION.garage); target.userData.occupied = false; target.userData.stolen = false; target.userData.health = 100;
    advanceStory(mission, 'm2-drive', 'Mara: Port Sol kept a copy of every sale. Take the sedan there and find the ledger.');
    mission.complete = false; saveMission(mission); return;
  }
  if (activeVehicle) {
    if (input.pressed('KeyJ')) return;
    player.root.visible = true;
    player.root.position.set(activeVehicle.position.x + 3.2, 0, activeVehicle.position.z);
    player.root.rotation.y = activeVehicle.userData.yaw;
    activeVehicle.userData.occupied = false;
    activeVehicle = null;
    return;
  }
  if (Math.hypot(player.root.position.x - mara.position.x, player.root.position.z - mara.position.z) < 7 && mission.phase === 'meet') {
    mission.phase = 'find'; mission.checkpoint = 'find'; mission.toast = 'Mara: The turquoise sedan is on the Strip. Bring it home clean.'; saveMission(mission); return;
  }
  const car = findNearbyVehicle(player.root, vehicles, 7);
  if (!car) return;
  if (Math.abs(car.userData.speed) > 5) { mission.toast = 'Wait until the vehicle slows down'; mission.toastTime = 2; return; }
  if (!car.userData.stolen) {
    const witnessed = nearbyWitness(car.position, pedestrians, vehicles);
    const occupied = car.userData.occupied;
    car.userData.occupied = false; car.userData.stolen = true;
    mission.toast = 'Vehicle stolen — witness reporting'; mission.toastTime = 5;
    if (occupied) spawnDriver(car.position);
    if ((witnessed || car.userData.target) && !(car.userData.target && !['meet', 'find', 'escape'].includes(mission.phase))) raiseWanted(police, 1);
    if (car.userData.target) markStolen(mission);
  }
  activeVehicle = car;
  player.root.visible = false;
  car.userData.occupied = true;
}

function update(dt) {
  if (workshop.active) {
    if (input.pressed('KeyU') || input.pressed('Escape')) closeGarage(workshop);
    input.release();
    return;
  }
  if (photography.active) {
    if (input.pressed('KeyV') || input.pressed('Escape')) {
      togglePhotography(photography, camera, player, false);
      input.release();
    } else updatePhotography(photography, camera, input, mission, world, dt, audio);
    input.endFrame();
    return;
  }
  if (running && !paused && !journal.open && !activeVehicle && input.pressed('KeyT')) {
    if (openGarage(workshop, mission, vehicles.find(car => car.userData.target), activeVehicle?.position || player.root.position, police)) {
      input.release();
      return;
    }
  }
  if (running && !paused && !journal.open && !activeVehicle && input.pressed('KeyU')) {
    if (openGarage(workshop, mission, vehicles.find(car => car.userData.target), activeVehicle?.position || player.root.position, police)) {
      input.release();
      return;
    }
  }
  if (running && !paused && !journal.open && input.pressed('KeyV') && !activeVehicle) {
    if (police.level || mission.dispatch.active || mission.rally.active || mission.courier.active || aliveGuards(combat)) {
      mission.toast = 'Camera unavailable during a pursuit, fight, or timed job.';
      mission.toastTime = 3;
    } else {
      togglePhotography(photography, camera, player);
      input.release();
      return;
    }
  }
  if (running && !paused && input.pressed('Tab')) toggleJournal(journal);
  if (journal.open) {
    if (input.pressed('Escape')) toggleJournal(journal, false);
    updateJournal(journal, mission, activeVehicle?.position || player.root.position);
    input.endFrame();
    return;
  }
  if (running && input.pressed('Escape') && photography.active) {
    togglePhotography(photography, camera, player, false);
    input.release();
    return;
  }
  frameMouse = input.consumeMouse();
  input.mouse = frameMouse;
  const interactPressed = input.pressed('KeyE') || input.pressed('KeyF');
  if (input.pressed('Escape') && running) {
    paused = !paused;
    if (paused) { menu.classList.remove('hidden'); document.exitPointerLock?.(); document.querySelector('h1').innerHTML = 'Paused'; document.querySelector('#story').textContent = 'Take a breath. The city is still waiting.'; document.querySelector('#newGame').textContent = 'Resume'; document.querySelector('#continue').classList.add('hidden'); checkpointButton.classList.remove('hidden'); returnButton.classList.remove('hidden'); }
    else { menu.classList.add('hidden'); resetMenu(); }
  }
  if (!running || paused) { input.endFrame(); return; }
  if (interactPressed) interact();
  if (input.pressed('KeyJ')) {
    if (mission.dispatch.active && ['pickup', 'collect'].includes(mission.dispatch.stage)) interactDispatch(mission, player, activeVehicle, police, scene, combat, audio);
    else startDispatch(mission, activeVehicle?.position || player.root.position, police, combat);
  }
  if (input.pressed('KeyN')) startRally(mission, activeVehicle?.position || player.root.position, activeVehicle, police);
  if (input.pressed('KeyC') && Math.hypot(player.root.position.x - MISSION.garage[0], player.root.position.z - MISSION.garage[2]) < 24) startCourier(mission, police);
  if (input.pressed('KeyQ') && !activeVehicle) collectCountyCache(county, mission, audio);
  if (input.pressed('KeyP') && !activeVehicle) speakToPedestrian(pedestrians, player.root.position, mission, police);
  if (input.pressed('KeyM')) audio.toggleMute();
  if (input.pressed('KeyB')) { tuneRadio(radioStation); audio.start(); }
  updateRadio(radioStation, audio, !!activeVehicle, dt);
  if (input.pressed('KeyH')) audio.horn();
  if (input.pressed('KeyT') && mission.phase !== 'free-roam' && serviceAtGarage(mission, player, vehicles.find(car => car.userData.target), combat)) saveMission(mission);
  const focused = activeVehicle || player.root;
  if (activeVehicle) {
    const barriers = police.level === 3 && police.roadblock?.visible ? [...world.obstacles, { x: 100, z: -100, hx: 5.5, hz: .6 }] : world.obstacles;
    updateVehicleDrive(activeVehicle, input, dt, barriers, vehicles);
    player.root.position.copy(activeVehicle.position);
    player.root.position.y = 0;
    yaw = activeVehicle.userData.yaw;
    audio.engine(activeVehicle.userData.speed);
  } else {
    updatePlayer(player, { ...input, mouse: frameMouse }, dt, world);
    yaw = player.yaw;
  }
  updateTraffic(vehicles, dt, activeVehicle);
  updatePedestrians(pedestrians, dt, focused, police.level > 0);
  updatePolice(scene, police, focused.position, yaw, dt, world.obstacles);
  updateCombat(combat, input, police, player, camera, scene, dt, audio, world.obstacles, !!activeVehicle);
  updateActivities(activities, mission, player, activeVehicle, dt);
  updateCounty(county, mission, player, activeVehicle, police, dt, audio);
  updateDispatch(dispatch, mission, player, activeVehicle, police, combat, scene, dt, audio);
  updateRally(rally, mission, activeVehicle, dt, audio);
  updateAtmosphere(atmosphere, mission.clock, vehicles, dt);
  const nearPolice = police.cars.some(car => car.visible && car.position.distanceTo(focused.position) < 4.5);
  arrestTime = police.level && nearPolice && Math.abs(activeVehicle?.userData.speed || 0) < 2 ? arrestTime + dt : Math.max(0, arrestTime - dt);
  if (activeVehicle?.userData.health <= 0 || player.health <= 0 || arrestTime > 4) {
    failDispatch(mission, scene, combat, 'Driver disabled or arrested');
    cancelRally(mission, 'Driver disabled or arrested');
    cancelCourier(mission, 'Driver or vehicle disabled');
    mission.money = Math.max(0, mission.money - 80); mission.toast = 'BUSTED / $80 fine — Restart checkpoint from pause'; mission.toastTime = 8;
    resetCheckpoint(mission, combat);
    clearGuards(scene, combat); combat.ammo = 12; combat.reserve = 48;
    if (mission.phase === 'm2-combat' || mission.phase === 'm2-ledger') { mission.phase = 'm2-drive'; mission.checkpoint = 'm2-drive'; }
    saveMission(mission);
    activeVehicle = null; player.root.visible = true; player.health = 100; player.root.position.set(...MISSION.start);
    clearWanted(police); arrestTime = 0;
    const recoverCar = vehicles.find(car => car.userData.target); recoverCar.position.set(...MISSION.target); recoverCar.userData.health = 100; recoverCar.userData.stolen = false; recoverCar.userData.speed = 0; recoverCar.userData.occupied = true;
  }
  mission.toastTime = Math.max(0, mission.toastTime - dt);
  const targetCar = vehicles.find(car => car.userData.target);
  if (mission.phase === 'escape' && police.level === 0 && activeVehicle?.userData.target) { mission.phase = 'deliver'; mission.checkpoint = 'deliver'; mission.toast = 'Clear. Deliver the sedan to Mara.'; mission.toastTime = 4; saveMission(mission); }
  if (mission.phase === 'deliver' && activeVehicle?.userData.target && Math.hypot(activeVehicle.position.x - MISSION.garage[0], activeVehicle.position.z - MISSION.garage[2]) < 22) {
    mission.phase = 'complete'; mission.complete = true; mission.checkpoint = 'complete'; mission.money += 850; mission.toast = 'MISSION COMPLETE / +$850 / Impound receipt recovered / Saved'; mission.toastTime = 12; activeVehicle = null; player.root.visible = true; player.root.position.set(...MISSION.garage); saveMission(mission);
  }
  updateCampaign(dt, focused, targetCar);
  if (mission.phase === 'meet' && Math.hypot(player.root.position.x - mara.position.x, player.root.position.z - mara.position.z) < 7 && !mission.toastTime) { mission.toast = 'E — Speak with Mara'; mission.toastTime = .1; }
  const objective = campaignObjective(focused, targetCar);
  const nearby = !activeVehicle ? findNearbyVehicle(player.root, vehicles, 7) : null;
  const maraNear = Math.hypot(player.root.position.x - mara.position.x, player.root.position.z - mara.position.z) < 8;
  const prompt = county.prompt || (activeVehicle ? 'E — Exit vehicle' : ['m2-ledger', 'm3-transmit', 'free-roam'].includes(mission.phase) && Math.hypot(player.root.position.x - objectivePoint().x, player.root.position.z - objectivePoint().z) < 12 ? 'E — Interact' : (mission.phase === 'meet' || mission.phase === 'complete') && maraNear ? 'E — Speak with Mara' : nearby ? `${nearby.userData.occupied ? 'F' : 'E'} — ${nearby.userData.occupied ? 'Take' : 'Enter'} vehicle` : 'P — Talk to nearby locals');
  const status = countyStatus(mission);
  if (mission.dispatch.active) status.courier = `JOB ${Math.ceil(mission.dispatch.remaining)}s${mission.dispatch.boarded ? ` · INEZ ${Math.round(mission.dispatch.passengerHealth)}%` : ''}`;
  if (mission.rally.active) status.courier = rallySummary(mission);
  updateHud(hud, { objective, missionTitle: campaignTitle(), wanted: police.level, pursuit: police.state, searchTime: police.searchTime, money: mission.money, driving: !!activeVehicle, speed: activeVehicle?.userData.speed || 0, condition: activeVehicle?.userData.health || 100, health: player.health, ammo: combat.ammo, reserve: combat.reserve, aiming: combat.aim, damage: player.damageFlash > 0, prompt, toast: mission.toastTime > 0 ? mission.toast : '', position: focused.position, yaw, garage: new THREE.Vector3(...MISSION.garage), objectivePosition: mission.courier.active ? county.gate.position : objectivePoint(), policePositions: police.cars.filter(car => car.visible).map(car => car.position), clock: status.clock, caches: status.caches, courier: status.courier });
  document.querySelector('#ending').style.display = mission.phase === 'ending' ? 'block' : 'none';
  document.querySelector('#mapContext').textContent = districtAt(focused.position);
  if (journal.waypoint) hud.context.textContent += ` / WAYPOINT ${Math.round(Math.hypot(focused.position.x - journal.waypoint.x, focused.position.z - journal.waypoint.z))}m`;
  if (mission.phase === 'free-roam' && Math.hypot(focused.position.x + 180, focused.position.z - 127) < 20) hud.prompt.textContent = 'J — Jobs / N in car — Rally / T — Workshop / C — Courier';
  if (dispatch.prompt || rally.prompt) hud.prompt.textContent = dispatch.prompt || rally.prompt;
  const cameraYaw = activeVehicle ? yaw : player.yaw;
  if (!initialShot?.driving && initialShot?.name !== 'docks') updateCamera(camera, focused.position, cameraYaw, dt, !!activeVehicle, Math.abs(activeVehicle?.userData.speed || 0), world.obstacles, player.pitch);
  if (initialShot?.name === 'docks') { combat.aim = true; player.aim.visible = true; combat.flash = .05; }
  updatePresentation(presentation, { mission, combat, player, camera, objective: objectivePoint(), driving: !!activeVehicle }, dt);
  audio.engine(activeVehicle?.userData.speed || 0, !!activeVehicle);
  if (initialShot) {
    shotTicks++;
    if (shotTicks >= 40) { snapshotReady = true; window.shotReady = true; }
  }
  input.endFrame();
}

function updateCampaign(dt, focused, targetCar) {
  const at = (position, radius = 16) => Math.hypot(focused.position.x - position[0], focused.position.z - position[2]) < radius;
  if (mission.phase === 'm2-drive' && activeVehicle?.userData.target && at(MISSION.port, 24)) {
    mission.dockArrived = true;
    mission.toast = 'Port Sol / stop and press E to exit. Three guards protect the ledger.'; mission.toastTime = 2;
  }
  if (mission.phase === 'm2-drive' && mission.dockArrived && !activeVehicle && at(MISSION.port, 30)) {
    advanceStory(mission, 'm2-combat', 'Mara: Three guards. Get the ledger from the container yard.');
    spawnGuards(scene, combat, new THREE.Vector3(...MISSION.port)); saveMission(mission);
  }
  if (mission.phase === 'm2-combat' && aliveGuards(combat) === 0) {
    advanceStory(mission, 'm2-ledger', 'Dock clear. The ledger is beside the blue container.'); saveMission(mission);
  }
  if (mission.phase === 'm2-return' && at(MISSION.garage, 24)) {
    mission.money += 500; clearGuards(scene, combat);
    advanceStory(mission, 'm3-drive', `${STORY[1].title} / ${STORY[1].line}`);
    targetCar.position.set(...MISSION.garage); targetCar.userData.stolen = false;
    if (activeVehicle === targetCar) {
      activeVehicle.userData.speed = 0;
      activeVehicle = null;
      player.root.visible = true;
      player.root.position.set(-177, 0, 127);
    }
    saveMission(mission);
  }
  if (mission.phase === 'm3-drive' && activeVehicle?.userData.target && at(MISSION.plaza, 24)) {
    mission.plazaArrived = true;
    mission.toast = 'Civic Plaza / press E to exit, then activate the transmitter.'; mission.toastTime = 2;
  }
  if (mission.phase === 'm3-drive' && mission.plazaArrived && !activeVehicle && at(MISSION.plaza, 30)) {
    advanceStory(mission, 'm3-transmit', 'Alex: The public transmitter is at the mast. Make the ledger impossible to bury.'); saveMission(mission);
  }
  if (mission.phase === 'm3-escape' && police.level === 0) {
    advanceStory(mission, 'm3-return', 'Signal is out. Mara: Bring the car back to the garage.'); saveMission(mission);
  }
  if (mission.phase === 'm3-return' && activeVehicle?.userData.target && at(MISSION.garage, 24)) {
    activeVehicle = null; player.root.visible = true; player.root.position.set(...MISSION.start);
    mission.money += 1800; mission.complete = true;
    advanceStory(mission, 'ending', 'MISSION COMPLETE / DEBT PAID / Story complete — free roam unlocked');
    saveMission(mission);
  }
  if (mission.phase === 'ending' && !mission.toastTime) {
    mission.phase = 'free-roam'; mission.checkpoint = 'free-roam'; mission.complete = true;
    mission.toast = 'Story complete — free roam unlocked'; mission.toastTime = 10; saveMission(mission);
  }
  if (mission.phase === 'free-roam' && mission.contractStep === 2 && activeVehicle && at(MISSION.plaza, 26) && !mission.dispatch.active && !mission.rally.active) {
    mission.contractStep = 0; mission.contracts++; mission.money += 350;
    mission.toast = `Delivery contract complete / +$350 / ${mission.contracts} completed`; mission.toastTime = 6; saveMission(mission);
  }
  if (mission.phase === 'free-roam' && mission.contractStep === 1 && activeVehicle && !mission.dispatch.active && !mission.rally.active) mission.contractStep = 2;
  if (targetCar.userData.health <= 0 && activeVehicle === targetCar) mission.toast = 'Sedan disabled — restart at checkpoint';
}

function objectivePoint() {
  const extensionTarget = dispatchTarget(mission) || rallyTarget(mission);
  if (extensionTarget) return extensionTarget;
  const courierTarget = countyObjective(mission);
  if (courierTarget) return courierTarget;
  const targets = {
    'm2-drive': MISSION.port, 'm2-combat': MISSION.ledger, 'm2-ledger': MISSION.ledger,
    'm2-return': MISSION.garage, 'm3-drive': MISSION.plaza, 'm3-transmit': MISSION.transmitter,
    'm3-escape': MISSION.garage, 'm3-return': MISSION.garage, 'free-roam': MISSION.garage
  };
  if (mission.phase === 'free-roam' && mission.contractStep) return new THREE.Vector3(...MISSION.plaza);
  return new THREE.Vector3(...(targets[mission.phase] || MISSION.garage));
}


function campaignObjective(focused, targetCar) {
  if (mission.dispatch.active || mission.rally.active) {
    return { text: mission.dispatch.active ? dispatchObjective(mission, combat) : `Sunset Circuit — gate ${mission.rally.gate + 1}/10`, distance: Math.round(focused.position.distanceTo(objectivePoint())) };
  }
  if (mission.courier.active) return { text: mission.courier.gate < 4 ? `Coastal Courier — checkpoint ${mission.courier.gate + 1}/4` : 'Coastal Courier — return to Mara', distance: Math.round(focused.position.distanceTo(objectivePoint())) };
  const point = mission.phase === 'find' ? targetCar.position : objectivePoint();
  const labels = {
    meet: 'Speak with Mara at the garage', find: 'Find the turquoise sedan on Sunset Strip', escape: 'Lose the police pursuit', deliver: 'Deliver the sedan to Mara',
    'm2-drive': 'Drive to Port Sol', 'm2-combat': `Defeat dock guards (${aliveGuards(combat)} remaining)`, 'm2-ledger': 'Collect the ledger from the container yard', 'm2-return': 'Bring the ledger to Mara',
    'm3-drive': 'Drive to Civic Quarter plaza', 'm3-transmit': 'Activate the outdoor transmitter', 'm3-escape': 'Lose the ★★★ pursuit', 'm3-return': 'Return to the garage',
    ending: 'Mission complete — story ending', 'free-roam': mission.contractStep ? 'Deliver a vehicle to Civic Quarter' : 'Free roam — take a delivery contract'
  };
  return { text: labels[mission.phase] || 'Explore Sunset County', distance: Math.round(Math.hypot(focused.position.x - point.x, focused.position.z - point.z)) };
}

function campaignTitle() {
  if (mission.dispatch.active) return dispatchJob(mission).title.toUpperCase();
  if (mission.rally.active) return 'SUNSET CIRCUIT';
  return mission.phase.startsWith('m2') ? STORY[0].title.toUpperCase() : mission.phase.startsWith('m3') || mission.phase === 'ending' ? STORY[1].title.toUpperCase() : mission.phase === 'free-roam' ? 'FREE ROAM' : MISSION.title.toUpperCase();
}

// A read-only inspection surface for local browser verification.
window.sunset = { scene, camera, player, vehicles, pedestrians, police, world, combat, get mission() { return mission; }, get vehicle() { return activeVehicle; }, get guards() { return combat.enemies; } };
Object.assign(window.sunset, { dispatch, rally, photography, workshop });
let lastTime = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const delta = Math.min(.2, (now - lastTime) / 1000); lastTime = now;
  accumulator += delta;
  while (accumulator >= fixedStep) { if (!snapshotReady) update(fixedStep); accumulator -= fixedStep; }
  if (!running) {
    camera.position.set(-207, 28, 112); camera.lookAt(-180, 2, 165);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

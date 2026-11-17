import * as THREE from 'three';
import { MISSION } from './config.js';
import { distanceXZ } from './util.js';
import { saveMission } from './missions.js';

export const RALLY_ROUTE = [
  [-200, 0, 100],
  [-200, 0, 0],
  [-200, 0, -200],
  [0, 0, -200],
  [200, 0, -200],
  [200, 0, 0],
  [200, 0, 200],
  [0, 0, 200],
  [-200, 0, 200],
  [-180, 0, 127]
];
export const RALLY_SECONDS = 145;

export function restoreRally(saved) {
  return {
    active: false,
    countdown: 0,
    gate: 0,
    remaining: RALLY_SECONDS,
    penalty: 0,
    condition: 100,
    vehicleId: null,
    best: Math.max(0, Number(saved?.best) || 0),
    wins: Math.max(0, Math.floor(Number(saved?.wins) || 0)),
    medal: ['GOLD', 'SILVER', 'BRONZE'].includes(saved?.medal) ? saved.medal : 'NONE'
  };
}

export function createRally(scene) {
  const gate = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xfb7eb6, transparent: true, opacity: .85 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.4, 5, .4), material);
    post.position.set(side * 7, 2.5, 0);
    gate.add(post);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.4, .2), material);
    flag.position.set(side * 6, 5, 0);
    gate.add(flag);
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7, 7.35, 40),
    new THREE.MeshBasicMaterial({ color: 0xffacd3, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .25;
  gate.add(ring);
  gate.visible = false;
  scene.add(gate);
  const trail = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({ color: 0xf79ac2, dashSize: 3, gapSize: 3 })
  );
  trail.visible = false;
  scene.add(trail);
  return { gate, trail, pulse: 0, prompt: '' };
}

export function rallyTarget(mission) {
  return mission.rally.active ? new THREE.Vector3(...RALLY_ROUTE[mission.rally.gate]) : null;
}

export function startRally(mission, position, vehicle, police) {
  if (mission.phase !== 'free-roam' || distanceXZ(position, MISSION.garage) > 24) return false;
  if (mission.rally.active) return false;
  if (!vehicle || police.level || mission.dispatch.active || mission.courier.active || mission.contractStep) {
    mission.toast = 'RALLY: Bring a car to Mara, finish other jobs, and clear your wanted level.';
    mission.toastTime = 5;
    return false;
  }
  Object.assign(mission.rally, {
    active: true,
    countdown: 3,
    gate: 0,
    remaining: RALLY_SECONDS,
    penalty: 0,
    condition: vehicle.userData.health,
    vehicleId: vehicle.uuid
  });
  vehicle.userData.speed = 0;
  mission.toast = 'SUNSET CIRCUIT / Ten gates / collisions add time / 3…';
  mission.toastTime = 4;
  return true;
}

export function cancelRally(mission, reason) {
  if (!mission.rally.active) return false;
  mission.rally.active = false;
  mission.toast = `RALLY ENDED / ${reason} / N at Mara to retry`;
  mission.toastTime = 6;
  saveMission(mission);
  return true;
}

export function rallyMedal(seconds) {
  if (seconds <= 95) return 'GOLD';
  if (seconds <= 120) return 'SILVER';
  return 'BRONZE';
}

export function updateRally(view, mission, vehicle, dt, audio) {
  const race = mission.rally;
  view.prompt = '';
  view.pulse += dt;
  view.gate.visible = race.active && race.countdown === 0;
  if (!race.active) return;
  const point = rallyTarget(mission);
  view.gate.position.copy(point);
  const routeRing = view.gate.children.find(child => child.geometry.type === 'RingGeometry');
  if (routeRing) routeRing.rotation.z = view.pulse;
  if (!vehicle || vehicle.uuid !== race.vehicleId) {
    cancelRally(mission, 'You left the rally car');
    return;
  }
  if (vehicle.userData.health <= 0) {
    cancelRally(mission, 'Vehicle disabled');
    return;
  }
  if (race.countdown > 0) {
    race.countdown = Math.max(0, race.countdown - dt);
    vehicle.userData.speed = 0;
    view.prompt = race.countdown ? `RALLY START / ${Math.ceil(race.countdown)}` : 'GO!';
    if (!race.countdown) audio?.horn();
    return;
  }
  race.remaining -= dt;
  const damage = Math.max(0, race.condition - vehicle.userData.health);
  if (damage > 0) {
    race.penalty += damage * .35;
    race.remaining -= damage * .35;
  }
  race.condition = vehicle.userData.health;
  if (race.remaining <= 0) { cancelRally(mission, 'Time expired'); return; }
  if (distanceXZ(vehicle.position, point) > 11) return;
  race.gate++;
  audio?.checkpoint?.();
  if (race.gate < RALLY_ROUTE.length) {
    mission.toast = `GATE ${race.gate}/${RALLY_ROUTE.length} / ${Math.ceil(race.remaining)} seconds left`;
    mission.toastTime = 2;
    return;
  }
  const elapsed = RALLY_SECONDS - race.remaining;
  const medal = rallyMedal(elapsed);
  const reward = { GOLD: 1400, SILVER: 1000, BRONZE: 650 }[medal];
  race.active = false;
  race.wins++;
  if (!race.best || elapsed < race.best) {
    race.best = elapsed;
    race.medal = medal;
  }
  mission.money += reward;
  mission.toast = `${medal} / SUNSET CIRCUIT / ${elapsed.toFixed(1)}s / +$${reward} / Saved`;
  mission.toastTime = 9;
  audio?.reward();
  saveMission(mission);
}

export function rallySummary(mission) {
  const race = mission.rally;
  if (race.active) return `RALLY ${race.gate + 1}/10 · ${Math.ceil(race.remaining)}s · penalty ${race.penalty.toFixed(1)}s`;
  return race.best ? `${race.medal} · best ${race.best.toFixed(1)}s` : 'N at Mara in a car to race';
}

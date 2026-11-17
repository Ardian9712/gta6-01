import * as THREE from 'three';
import { MISSION } from './config.js';
import { distanceXZ } from './util.js';
import { repairVehicle } from './vehicles.js';

export function createActivities(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const locations = {
    ledger: makeBeacon(group, MISSION.ledger, 0xf6ce72),
    transmitter: makeBeacon(group, MISSION.transmitter, 0x56cdb9),
    garage: makeBeacon(group, MISSION.garage, 0x66d6bb)
  };
  const ledger = new THREE.Mesh(new THREE.BoxGeometry(.8, .13, 1.1), new THREE.MeshStandardMaterial({ color: 0xf4d79c }));
  ledger.position.set(MISSION.ledger[0], .8, MISSION.ledger[2]);
  group.add(ledger);
  const console = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, .7), new THREE.MeshStandardMaterial({ color: 0x345959 }));
  stand.position.y = .65;
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.15, .5, .08), new THREE.MeshStandardMaterial({ color: 0x56deb9, emissive: 0x226e59 }));
  screen.position.set(0, 1.2, -.4);
  console.add(stand, screen);
  console.position.set(MISSION.transmitter[0] - 3, 0, MISSION.transmitter[2]);
  group.add(console);
  return { group, locations, ledger, console, time: 0, messages: [], saved: 0 };
}

function makeBeacon(group, position, color) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.45, 40), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .8 }));
  ring.position.set(position[0], .16, position[2]);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(.65, 1.2, 4), new THREE.MeshBasicMaterial({ color }));
  arrow.rotation.z = Math.PI;
  arrow.position.set(position[0], 4.3, position[2]);
  group.add(arrow);
  return { ring, arrow, baseHeight: 4.3 };
}

export function updateActivities(activities, mission, player, vehicle, dt) {
  activities.time += dt;
  const t = activities.time;
  const visibility = {
    ledger: ['m2-combat', 'm2-ledger'].includes(mission.phase),
    transmitter: ['m3-drive', 'm3-transmit', 'm3-escape'].includes(mission.phase) || mission.dispatch?.active,
    garage: ['deliver', 'm2-return', 'm3-return', 'complete', 'free-roam'].includes(mission.phase)
  };
  for (const [name, beacon] of Object.entries(activities.locations)) {
    beacon.ring.visible = visibility[name];
    beacon.arrow.visible = visibility[name];
    beacon.arrow.position.y = beacon.baseHeight + Math.sin(t * 2) * .3;
    beacon.arrow.rotation.y = t * .6;
    const scale = 1 + Math.sin(t * 2) * .06;
    beacon.ring.scale.setScalar(scale);
  }
  activities.ledger.visible = visibility.ledger && !mission.ledger;
  activities.ledger.rotation.y = Math.sin(t) * .15;
  activities.console.children[1].material.emissiveIntensity = mission.broadcast ? 2 : .7;
  const nearGarage = distanceXZ(player.root.position, MISSION.garage) < 20;
  return { nearGarage, canService: nearGarage && mission.phase === 'free-roam', servicePrice: 120 };
}

export function garageService(mission, player, vehicle, combat) {
  if (mission.dispatch?.active || mission.rally?.active) {
    mission.toast = 'Service bay closed during timed jobs'; mission.toastTime = 3;
    return false;
  }
  if (distanceXZ(player.root.position, MISSION.garage) > 20 || mission.phase !== 'free-roam') return false;
  if (mission.money < 120) {
    mission.toast = 'Garage: service costs $120'; mission.toastTime = 3;
    return false;
  }
  mission.money -= 120;
  player.health = 100;
  combat.ammo = combat.magazine;
  combat.reserve = 48;
  if (vehicle) repairVehicle(vehicle);
  mission.toast = 'Garage service / health, pistol ammo and vehicle restored / Saved';
  mission.toastTime = 5;
  return true;
}

export function resetCheckpoint(mission, combat) {
  let phase = mission.checkpoint;
  if (phase === 'm2-combat' || phase === 'm2-ledger') phase = 'm2-drive';
  if (phase === 'm3-escape') phase = 'm3-transmit';
  if (phase === 'ending') phase = 'free-roam';
  mission.phase = phase;
  mission.checkpoint = phase;
  mission.dockArrived = false;
  mission.plazaArrived = false;
  combat.ammo = combat.magazine;
  combat.reserve = 48;
  combat.reload = 0;
  combat.cooldown = 0;
  return phase;
}

export function districtAt(position) {
  if (position.x < 0 && position.z < 0) return 'SUNSET STRIP';
  if (position.x > 0 && position.z > 100) return 'PORT SOL';
  if (position.x > 0 && position.z < 0) return 'CIVIC QUARTER';
  return 'PALM HEIGHTS';
}

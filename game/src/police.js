import * as THREE from 'three';
import { createVehicle } from './vehicles.js';
import { createPerson } from './player.js';
import { moveWithCollision } from './player.js';
import { roadWaypoint, nearestRoad } from './traffic.js';
import { segmentBlocked } from './util.js';

export function createPolice(scene) {
  return { level: 0, state: 'CLEAR', lostTime: 0, searchTime: 0, lastSeen: new THREE.Vector3(), cars: [], officers: [], roadblock: null };
}

export function raiseWanted(police, level = 1) {
  police.level = Math.min(3, Math.max(police.level, level));
  police.state = 'PURSUIT';
  police.lostTime = 0;
  police.searchTime = 0;
  police.roadblockReady = police.level >= 3;
}

function spawnPatrol(scene, police, count, player) {
  while (police.cars.length < count) {
    const i = police.cars.length;
    const car = createVehicle(scene, new THREE.Vector3(nearestRoad(player.position.x) + 5, 0, nearestRoad(player.position.z) + (i ? -28 : 30)), 0x203d6b, true);
    police.cars.push(car);
  }
  for (let i = 0; i < police.cars.length; i++) police.cars[i].visible = i < count;
  if (count >= 2) {
    while (police.officers.length < count - 1) police.officers.push(createPerson(scene, 0x253e6a, .9));
  }
  if (count >= 3 && !police.roadblock) {
    police.roadblock = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(11, .55, .55), new THREE.MeshStandardMaterial({ color: 0xd84e3e, emissive: 0x63231e }));
    bar.position.y = 1; police.roadblock.add(bar); police.roadblock.position.set(100, 0, -100); scene.add(police.roadblock);
  }
}

export function updatePolice(scene, police, playerPosition, playerYaw, dt, obstacles) {
  if (!police.level) return;
  const count = police.level;
  spawnPatrol(scene, police, count, { position: playerPosition });
  const seesPlayer = police.cars.some((car, index) => {
    if (index >= count) return false;
    const dx = playerPosition.x - car.position.x, dz = playerPosition.z - car.position.z;
    const distance = Math.hypot(dx, dz);
    const facing = Math.cos(car.userData.yaw) * dz + Math.sin(car.userData.yaw) * dx;
    return distance < 62 && facing > -8 && !segmentBlocked(car.position, playerPosition, obstacles);
  });
  if (seesPlayer) {
    police.state = 'PURSUIT';
    police.lastSeen.copy(playerPosition);
    police.lostTime = 0;
  } else {
    police.lostTime += dt;
    if (police.state !== 'SEARCHING' && police.lostTime > 1.8) {
      police.state = 'SEARCHING';
      police.searchTime = 0;
    }
  }
  if (police.state === 'PURSUIT') {
    for (let i = 0; i < count; i++) {
      const car = police.cars[i];
      const point = Math.hypot(playerPosition.x - car.position.x, playerPosition.z - car.position.z) < 28 ? playerPosition : roadWaypoint(car.position, playerPosition);
      const dx = point.x - car.position.x;
      const dz = point.z - car.position.z;
      const desired = Math.atan2(dx, dz);
      car.userData.yaw += wrap(desired - car.userData.yaw) * Math.min(1, dt * 2.8);
      moveWithCollision(car.position, Math.sin(car.userData.yaw) * (13 + i) * dt, Math.cos(car.userData.yaw) * (13 + i) * dt, obstacles, 2);
      car.rotation.y = car.userData.yaw;
    }
    if (police.level >= 3 && police.roadblock) {
      police.roadblock.visible = true;
      police.roadblock.userData.flash = (police.roadblock.userData.flash || 0) + dt;
      police.roadblock.children[0].material.emissiveIntensity = 1 + Math.sin(police.roadblock.userData.flash * 9) * .35;
    }
  } else {
    police.searchTime += dt;
    for (let i = 0; i < count; i++) {
      const car = police.cars[i];
      const dx = police.lastSeen.x - car.position.x;
      const dz = police.lastSeen.z - car.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2) { car.position.x += dx / dist * 7 * dt; car.position.z += dz / dist * 7 * dt; car.userData.yaw = Math.atan2(dx, dz); car.rotation.y = car.userData.yaw; }
    }
    if (police.searchTime > 4 + Math.max(0, count - 1)) {
      police.level = 0; police.state = 'CLEAR';
      police.cars.forEach(car => { car.visible = false; });
      police.officers.forEach(officer => { officer.root.visible = false; });
      if (police.roadblock) police.roadblock.visible = false;
    }
  }
  for (let i = 0; i < police.officers.length; i++) {
    const officer = police.officers[i], patrol = police.cars[Math.min(i + 1, count - 1)];
    officer.root.visible = count >= 2 && police.state === 'PURSUIT';
    if (!officer.deployed || officer.root.position.distanceTo(playerPosition) > 90) {
      officer.root.position.set(patrol.position.x + 3 + i, 0, patrol.position.z);
      officer.deployed = true;
    }
    const dx = playerPosition.x - officer.root.position.x;
    const dz = playerPosition.z - officer.root.position.z;
    const range = Math.hypot(dx, dz);
    officer.root.rotation.y = Math.atan2(dx, dz);
    if (officer.root.visible && range > 3 && range < 55) {
      moveWithCollision(officer.root.position, dx / range * 3.5 * dt, dz / range * 3.5 * dt, obstacles, .65);
    }
    officer.phase += dt * 6;
    officer.legs[0].rotation.x = Math.sin(officer.phase) * .32;
    officer.legs[1].rotation.x = -officer.legs[0].rotation.x;
  }
}

function blocked(from, to, obstacles) {
  for (const box of obstacles) {
    const minX = box.x - box.hx, maxX = box.x + box.hx;
    const minZ = box.z - box.hz, maxZ = box.z + box.hz;
    for (let i = 1; i < 8; i++) {
      const t = i / 8, x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
      if (x > minX && x < maxX && z > minZ && z < maxZ) return true;
    }
  }
  return false;
}

function wrap(angle) { return Math.atan2(Math.sin(angle), Math.cos(angle)); }

export function clearWanted(police) {
  police.level = 0; police.state = 'CLEAR'; police.searchTime = 0; police.lostTime = 0;
  police.cars.forEach(car => { car.visible = false; });
  police.officers.forEach(officer => { officer.root.visible = false; });
  police.officers.forEach(officer => { officer.deployed = false; });
  if (police.roadblock) police.roadblock.visible = false;
  police.roadblockReady = false;
  police.lastSeen.set(0, 0, 0);
}

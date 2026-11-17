import * as THREE from 'three';
import { COLORS } from './config.js';
import { clamp } from './util.js';
import { moveWithCollision } from './player.js';
import { laneSignal, junctionFor } from './traffic.js';

const bodyGeometry = new THREE.BoxGeometry(1, 1, 1);

export function createVehicle(scene, position, color = COLORS.turquoise, police = false) {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: .42, metalness: .16 });
  const body = new THREE.Mesh(bodyGeometry, paint);
  body.position.y = .85; body.scale.set(2.1, .85, 4.3); body.castShadow = true; root.add(body);
  const cabin = new THREE.Mesh(bodyGeometry, new THREE.MeshStandardMaterial({ color: 0x344b51, roughness: .25, metalness: .1 }));
  cabin.position.set(0, 1.45, -.25); cabin.scale.set(1.55, .62, 2.15); root.add(cabin);
  const wheels = [];
  for (const x of [-1, 1]) for (const z of [-1.35, 1.35]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .28, 12), new THREE.MeshStandardMaterial({ color: 0x20292b, roughness: .9 }));
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, .45, z); root.add(wheel); wheels.push(wheel);
  }
  if (police) {
    const bar = new THREE.Mesh(bodyGeometry, new THREE.MeshStandardMaterial({ color: 0x528cdb, emissive: 0x1b416f, emissiveIntensity: .55 }));
    bar.position.set(0, 1.88, -.2); bar.scale.set(1.05, .18, .35); root.add(bar);
  }
  root.position.copy(position);
  const lights = [];
  for (const x of [-.72, .72]) {
    for (const front of [true, false]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(.42, .2, .08), new THREE.MeshStandardMaterial({ color: front ? 0xffe5a6 : 0xd54c35, emissive: front ? 0xffd88b : 0xbd2010 }));
      lamp.position.set(x, .95, front ? 2.17 : -2.17);
      root.add(lamp);
      lights.push(lamp);
    }
  }
  const smoke = new THREE.Mesh(new THREE.IcosahedronGeometry(.7, 1), new THREE.MeshBasicMaterial({ color: 0x42494b, transparent: true, opacity: .5, depthWrite: false }));
  smoke.position.set(0, 2.4, 1.4);
  smoke.visible = false;
  root.add(smoke);
  root.userData = { wheels, lights, smoke, body, police, health: 100, speed: 0, yaw: 0, occupied: false, stolen: false, target: false, color };
  root.name = police ? 'County patrol' : 'County road sedan';
  scene.add(root);
  return root;
}

export function createFleet(scene) {
  const vehicles = [];
  const colors = [0xe6b85f, 0x6b8991, 0xd27655, 0xa9b4a5, 0x47756f, 0xc6c0ad];
  for (let i = 0; i < 12; i++) {
    const row = Math.floor(i / 3);
    const position = new THREE.Vector3(-190 + (i % 3) * 185, 0, -195 + row * 126);
    const car = createVehicle(scene, position, colors[i % colors.length]);
    car.userData.yaw = i % 2 ? Math.PI / 2 : 0;
    car.rotation.y = car.userData.yaw;
    car.userData.traffic = true;
    car.userData.lane = i % 2 ? 'x' : 'z';
    car.userData.occupied = true;
    if (i < 6) car.position.set(-220 + i * 72, 0, -8);
    else car.position.set(8, 0, -220 + (i - 6) * 78);
    vehicles.push(car);
  }
  const target = createVehicle(scene, new THREE.Vector3(-195, 0, -135), COLORS.turquoise);
  target.userData.target = true;
  target.userData.occupied = true;
  target.userData.yaw = 0;
  target.rotation.y = 0;
  vehicles.push(target);
  return vehicles;
}

export function repairVehicle(vehicle, cost = 120) {
  if (!vehicle) return false;
  vehicle.userData.health = 100;
  vehicle.userData.speed = 0;
  updateVehicleCondition(vehicle, 0);
  return cost;
}

export function updateVehicleDrive(vehicle, input, dt, obstacles, traffic = []) {
  const data = vehicle.userData;
  const throttle = Number(input.down('KeyW')) - Number(input.down('KeyS'));
  data.speed += throttle * 45 * dt * (data.accelerationMultiplier || 1);
  data.speed *= input.down('Space') ? Math.exp(-4 * dt * (data.brakeMultiplier || 1)) : Math.exp(-.6 * dt);
  data.speed = clamp(data.speed, -12, (data.health < 30 ? 28 : 48) * (data.speedMultiplier || 1));
  const steer = Number(input.down('KeyD')) - Number(input.down('KeyA'));
  data.yaw += steer * Math.sign(data.speed || 1) * Math.min(1.7, Math.abs(data.speed) * .065) * dt;
  const oldX = vehicle.position.x, oldZ = vehicle.position.z;
  moveWithCollision(vehicle.position, Math.sin(data.yaw) * data.speed * dt, Math.cos(data.yaw) * data.speed * dt, obstacles, 2.2);
  for (const other of traffic) {
    if (other === vehicle || other.userData.health <= 0) continue;
    if (Math.hypot(vehicle.position.x - other.position.x, vehicle.position.z - other.position.z) < 3.4) {
      vehicle.position.x = oldX; vehicle.position.z = oldZ; data.speed *= -.22; data.health = Math.max(0, data.health - 4 * (data.damageMultiplier || 1)); break;
    }
  }
  if (vehicle.position.x === oldX && vehicle.position.z === oldZ && Math.abs(data.speed) > 3) { data.speed *= -.2; data.health = Math.max(0, data.health - 8 * (data.damageMultiplier || 1)); }
  vehicle.rotation.y = data.yaw;
  for (const wheel of data.wheels) wheel.rotation.x -= data.speed * dt;
  updateVehicleCondition(vehicle, dt);
}

export function updateVehicleCondition(vehicle, dt) {
  const data = vehicle.userData;
  const damage = 1 - clamp(data.health / 100, 0, 1);
  data.body.scale.y = .85 - damage * .12;
  data.smoke.visible = data.health < 35;
  data.smoke.rotation.y += dt;
  data.smoke.position.y = 2.4 + Math.sin(data.smoke.rotation.y * 3) * .5;
  data.smoke.scale.setScalar(1 + damage * .6);
}

export function updateTraffic(vehicles, dt, playerVehicle) {
  updateTraffic.time = (updateTraffic.time || 0) + dt;
  for (const car of vehicles) {
    const data = car.userData;
    if (!data.traffic || data.stolen || car === playerVehicle || data.health <= 0) continue;
    const sign = Math.sign(data.speed || 1);
    data.speed += dt * sign * (Math.abs(data.speed) < 8 ? 3 : 0);
    data.speed = clamp(data.speed, 5, 11);
    let blockedAhead = false;
    const junction = junctionFor(car.position);
    const gap = data.lane === 'x' ? junction.x - car.position.x : car.position.z - junction.z;
    const red = laneSignal(car.position, updateTraffic.time) !== (data.lane === 'x' ? 'east-west' : 'north-south');
    if (red && gap > 8 && gap < 18) blockedAhead = true;
    if (playerVehicle && car.position.distanceTo(playerVehicle.position) < 9) blockedAhead = true;
    for (const other of vehicles) {
      if (other === car || other === playerVehicle) continue;
      if (data.lane === other.userData.lane && Math.abs((data.lane === 'x' ? car.position.z - other.position.z : car.position.x - other.position.x)) < 3 && Math.abs((data.lane === 'x' ? car.position.x - other.position.x : car.position.z - other.position.z)) < 10) blockedAhead = true;
    }
    data.speed = blockedAhead ? Math.max(0, data.speed - dt * 15) : clamp(data.speed + dt * 2, 5, 11);
    const move = data.speed * dt;
    if (data.lane === 'x') car.position.x += move;
    else car.position.z -= move;
    const value = data.lane === 'x' ? car.position.x : car.position.z;
    if (value > 220 || value < -220) { if (data.lane === 'x') car.position.x = value > 220 ? -220 : 220; else car.position.z = value > 220 ? -220 : 220; }
    for (const other of vehicles) {
      if (other === car || !other.userData.traffic) continue;
      if (Math.hypot(car.position.x - other.position.x, car.position.z - other.position.z) < 7) { data.speed = 5; break; }
    }
  }
}

export function findNearbyVehicle(player, vehicles, max = 6) {
  let found = null, best = max;
  for (const car of vehicles) {
    if (car.userData.health <= 0) continue;
    const d = Math.hypot(car.position.x - player.position.x, car.position.z - player.position.z);
    if (d < best) { found = car; best = d; }
  }
  return found;
}

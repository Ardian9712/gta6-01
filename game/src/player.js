import * as THREE from 'three';
import { clamp } from './util.js';

export function createPerson(scene, color, scale = 1) {
  const root = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.42 * scale, .9 * scale, 3, 6), new THREE.MeshStandardMaterial({ color, roughness: .8 }));
  torso.position.y = 1.15 * scale;
  torso.castShadow = true;
  root.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.32 * scale, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd59a70 }));
  head.position.y = 2.05 * scale;
  root.add(head);
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.24 * scale, .85 * scale, .3 * scale), new THREE.MeshStandardMaterial({ color: 0x30434a }));
    leg.position.set(side * .19 * scale, .45 * scale, 0);
    leg.castShadow = true;
    root.add(leg);
    legs.push(leg);
  }
  scene.add(root);
  return { root, legs, phase: 0, torso };
}

export function createPlayer(scene, position) {
  const actor = createPerson(scene, 0xe9823c, 1);
  actor.root.position.copy(position);
  const aim = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .8), new THREE.MeshStandardMaterial({ color: 0x252b2c, metalness: .7 }));
  aim.position.set(.38, 1.4, .35); aim.visible = false; actor.root.add(aim);
  return { ...actor, aim, health: 100, yaw: Math.PI, pitch: 0, speed: 0, walking: true, damageFlash: 0 };
}

export function updatePlayer(player, input, dt, world) {
  const [mx, my] = input.mouse;
  player.yaw -= mx * .0022;
  player.pitch = clamp(player.pitch - my * .0018, -.55, .55);
  player.damageFlash = Math.max(0, player.damageFlash - dt);
  const forward = Number(input.down('KeyW')) - Number(input.down('KeyS'));
  const strafe = Number(input.down('KeyD')) - Number(input.down('KeyA'));
  player.crouching = input.down('ControlLeft') || input.down('ControlRight');
  player.root.scale.y = player.crouching ? .7 : 1;
  const pace = player.crouching ? 2.8 : input.aiming ? 3.8 : input.down('ShiftLeft') ? 13 : 8;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const normalization = Math.max(1, Math.hypot(forward, strafe));
  const dx = (sin * forward + cos * strafe) * pace * dt / normalization;
  const dz = (cos * forward - sin * strafe) * pace * dt / normalization;
  moveWithCollision(player.root.position, dx, dz, world.obstacles, 1.1);
  const onCurb = world.roads.some(road => {
    const vertical = road[1] - road[0] < road[3] - road[2];
    const delta = Math.abs((vertical ? player.root.position.x : player.root.position.z) - (vertical ? (road[0] + road[1]) / 2 : (road[2] + road[3]) / 2));
    return delta > 12 && delta < 17;
  });
  player.root.position.y += ((onCurb ? .15 : 0) - player.root.position.y) * Math.min(1, dt * 14);
  player.root.rotation.y = player.yaw;
  player.speed = Math.hypot(dx, dz) / Math.max(dt, .001);
  player.phase += dt * player.speed * .65;
  player.legs[0].rotation.x = Math.sin(player.phase) * Math.min(.55, player.speed * .055);
  player.legs[1].rotation.x = -player.legs[0].rotation.x;
}

export function moveWithCollision(position, dx, dz, obstacles, radius = 1.2) {
  const nextX = position.x + dx;
  if (!obstacles.some(box => Math.abs(nextX - box.x) < box.hx + radius && Math.abs(position.z - box.z) < box.hz + radius)) position.x = clamp(nextX, -235, 235);
  const nextZ = position.z + dz;
  if (!obstacles.some(box => Math.abs(position.x - box.x) < box.hx + radius && Math.abs(nextZ - box.z) < box.hz + radius)) position.z = clamp(nextZ, -235, 235);
}

export function updateCamera(camera, target, yaw, dt, driving = false, speed = 0, obstacles = [], pitch = 0) {
  const distance = driving ? 10 + Math.min(5, speed * .16) : 8;
  const height = driving ? 5.8 : 4.5;
  const desired = new THREE.Vector3(target.x - Math.sin(yaw) * distance, target.y + height, target.z - Math.cos(yaw) * distance);
  const origin = new THREE.Vector3(target.x, target.y + 1.5, target.z);
  const direction = desired.clone().sub(origin);
  const length = direction.length();
  direction.normalize();
  const ray = new THREE.Raycaster(origin, direction, 0, length);
  const blockers = obstacles.map(box => ({ min: new THREE.Vector3(box.x - box.hx, 0, box.z - box.hz), max: new THREE.Vector3(box.x + box.hx, 60, box.z + box.hz) }));
  for (const box of blockers) {
    const hit = ray.ray.intersectBox(new THREE.Box3(box.min, box.max), new THREE.Vector3());
    if (hit) { desired.copy(hit).addScaledVector(direction, -.7); break; }
  }
  camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
  camera.lookAt(origin.clone().add(new THREE.Vector3(Math.sin(yaw) * 8, driving ? 0 : Math.tan(pitch) * 16, Math.cos(yaw) * 8)));
}

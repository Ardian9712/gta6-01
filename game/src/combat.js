import * as THREE from 'three';
import { createPerson } from './player.js';
import { distanceXZ, clamp, segmentBlocked } from './util.js';

export function createCombat() {
  return { ammo: 12, magazine: 12, reserve: 48, cooldown: 0, reload: 0, shots: 0, hit: 0, flash: 0, enemies: [], tracer: null, aim: false, combatTime: 0 };
}

export function spawnGuards(scene, combat, origin = new THREE.Vector3(155, 0, 190)) {
  clearGuards(scene, combat);
  const offsets = [[-15, -5], [0, -19], [16, -2]];
  for (let i = 0; i < offsets.length; i++) {
    const guard = createPerson(scene, [0x725346, 0x3f5961, 0x675a43][i], .92);
    guard.root.position.set(origin.x + offsets[i][0], 0, origin.z + offsets[i][1]);
    guard.root.userData.health = 100;
    guard.root.userData.index = i;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.25, .13), new THREE.MeshBasicMaterial({ color: 0x202a2b, side: THREE.DoubleSide }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.15, .075), new THREE.MeshBasicMaterial({ color: 0x73d681, side: THREE.DoubleSide }));
    back.position.set(0, 2.65, 0); fill.position.set(0, 2.65, .02); guard.root.add(back, fill);
    combat.enemies.push({ actor: guard, health: 100, healthFill: fill, mode: 'guard', cooldown: 1 + i * .7, alert: false, alive: true });
  }
}

export function clearGuards(scene, combat) {
  for (const enemy of combat.enemies) scene.remove(enemy.actor.root);
  combat.enemies.length = 0;
}

export function updateCombat(combat, input, police, player, camera, scene, dt, audio, obstacles = [], driving = false) {
  combat.combatTime += dt;
  combat.aim = !!input.aiming && !driving;
  if (player.aim) player.aim.visible = combat.aim;
  combat.cooldown = Math.max(0, combat.cooldown - dt);
  combat.hit = Math.max(0, combat.hit - dt);
  combat.flash = Math.max(0, combat.flash - dt);
  if (combat.reload > 0) {
    combat.reload -= dt;
    if (combat.reload <= 0) {
      const loaded = Math.min(combat.magazine - combat.ammo, combat.reserve);
      combat.ammo += loaded; combat.reserve -= loaded;
    }
  }
  if (input.pressed('KeyR') && combat.reload <= 0 && combat.ammo < combat.magazine && combat.reserve > 0) combat.reload = 1.25;
  if (!driving && (input.pressed('KeyG') || input.firing) && combat.ammo > 0 && combat.cooldown <= 0 && combat.reload <= 0) {
    combat.ammo--; combat.shots++; combat.cooldown = .28; combat.flash = .08;
    police.level = Math.min(3, Math.max(2, police.level)); police.state = 'PURSUIT'; police.searchTime = 0;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const meshes = [];
    for (const enemy of combat.enemies) if (enemy.alive) enemy.actor.root.traverse(node => { if (node.isMesh) meshes.push(node); });
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hit && !segmentBlocked(player.root.position, hit.point, obstacles)) {
      let node = hit.object, owner = null;
      while (node && !owner) {
        owner = combat.enemies.find(item => item.alive && item.actor.root === node);
        node = node.parent;
      }
      if (owner) {
        owner.health = Math.max(0, owner.health - 55); owner.alert = true; owner.actor.root.userData.health = owner.health;
        owner.healthFill.scale.x = Math.max(.01, owner.health / 100);
        owner.healthFill.position.x = -(1 - owner.health / 100) * .56;
        combat.hit = .18;
        if (owner.health <= 0) {
          owner.alive = false; owner.mode = 'down'; owner.actor.root.userData.health = 0;
          owner.actor.root.rotation.x = Math.PI / 2; owner.actor.root.position.y = -.45;
        }
      }
    }
    addTracer(scene, combat, ray.ray.origin, ray.ray.direction);
    audio?.shot();
  }
  updateEnemies(combat, player, dt, obstacles);
}

function updateEnemies(combat, player, dt, obstacles) {
  for (const enemy of combat.enemies) {
    if (!enemy.alive) continue;
    const root = enemy.actor.root;
    const distance = distanceXZ(root.position, player.root.position);
    enemy.cooldown -= dt;
    if (distance < (player.crouching ? 22 : 46) && !segmentBlocked(root.position, player.root.position, obstacles)) enemy.alert = true;
    enemy.actor.root.userData.behavior = enemy.mode;
    if (!enemy.alert) { enemy.mode = 'guard'; continue; }
    const dx = player.root.position.x - root.position.x, dz = player.root.position.z - root.position.z;
    root.rotation.y = Math.atan2(dx, dz);
    if (enemy.health < 50 && distance < 17) {
      enemy.mode = 'retreat';
      root.position.x -= dx / Math.max(distance, .001) * 2.8 * dt;
      root.position.z -= dz / Math.max(distance, .001) * 2.8 * dt;
    } else if (distance > 12) {
      enemy.mode = 'approach';
      root.position.x += dx / Math.max(distance, .001) * 2.5 * dt;
      root.position.z += dz / Math.max(distance, .001) * 2.5 * dt;
    } else {
      enemy.mode = 'shoot';
      const covered = segmentBlocked(root.position, player.root.position, obstacles);
      if (enemy.cooldown <= 0 && !covered) { player.health = Math.max(0, player.health - 7); player.damageFlash = .28; enemy.cooldown = 1.2; }
    }
    enemy.actor.phase += dt * 8;
    enemy.actor.legs[0].rotation.x = Math.sin(enemy.actor.phase) * (enemy.mode === 'approach' || enemy.mode === 'retreat' ? .45 : .08);
    enemy.actor.legs[1].rotation.x = -enemy.actor.legs[0].rotation.x;
  }
}

export function ammoRatio(combat) { return clamp(combat.ammo / combat.magazine, 0, 1); }

function addTracer(scene, combat, origin, direction) {
  if (combat.tracer) { scene.remove(combat.tracer); combat.tracer.geometry.dispose(); combat.tracer.material.dispose(); }
  const end = origin.clone().addScaledVector(direction, 45);
  combat.tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin, end]), new THREE.LineBasicMaterial({ color: 0xffd68a, transparent: true, opacity: .8 }));
  scene.add(combat.tracer);
  setTimeout(() => { if (combat.tracer) { scene.remove(combat.tracer); combat.tracer = null; } }, 100);
}

export function aliveGuards(combat) { return combat.enemies.filter(enemy => enemy.alive).length; }

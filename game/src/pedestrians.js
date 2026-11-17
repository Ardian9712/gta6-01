import * as THREE from 'three';
import { createPerson } from './player.js';

export function createPedestrians(scene) {
  const people = [];
  const colors = [0x4c7172, 0xdbb26d, 0x825b57, 0x5d7560, 0x444e66];
  for (let i = 0; i < 18; i++) {
    const person = createPerson(scene, colors[i % colors.length], .78);
    const lane = i % 2 ? 1 : -1;
    person.root.position.set(-187 + (i * 31) % 360, 0, -100 + lane * 16 + Math.floor(i / 10) * 200);
    person.walkYaw = i % 2 ? Math.PI / 2 : -Math.PI / 2;
    person.walkSpeed = 1.2 + (i % 4) * .16;
    person.roam = true;
    person.dialogue = i % 4;
    person.talkTime = 0;
    people.push(person);
  }
  return people;
}

export function updatePedestrians(people, dt, player, violence = false) {
  for (const person of people) {
    person.talkTime = Math.max(0, (person.talkTime || 0) - dt);
    const dx = player.position.x - person.root.position.x;
    const dz = player.position.z - person.root.position.z;
    const distance = Math.hypot(dx, dz);
    if (violence && distance < 42) {
      person.walkYaw = Math.atan2(-dx, -dz);
      person.walkSpeed = 5;
      person.flee = true;
    }
    if (!violence && person.flee && distance > 55) { person.flee = false; person.walkSpeed = 1.5; }
    if ((person.roam || person.flee) && (!person.talkTime || person.flee)) {
      person.root.position.x += Math.sin(person.walkYaw) * person.walkSpeed * dt;
      person.root.position.z += Math.cos(person.walkYaw) * person.walkSpeed * dt;
      if (Math.abs(person.root.position.x) > 215 || Math.abs(person.root.position.z) > 215) person.walkYaw += Math.PI;
    }
    person.root.rotation.y = person.walkYaw;
    person.phase += dt * person.walkSpeed * 2;
    if (person.legs.length) {
      person.legs[0].rotation.x = Math.sin(person.phase) * .28;
      person.legs[1].rotation.x = -person.legs[0].rotation.x;
    }
  }
}

export function speakToPedestrian(people, position, mission, police) {
  const person = people.find(person => !person.flee && Math.hypot(person.root.position.x - position.x, person.root.position.z - position.z) < 5);
  if (!person) return false;
  const tips = [
    'LOCAL: There is a glowing case behind the Palm Motel. Walk up and press Q.',
    'LOCAL: Mara has a coastal courier route once your debt is paid. Press C at her garage.',
    'LOCAL: The patrols lose you behind buildings. Keep out of their sight while they search.',
    'LOCAL: Six county caches are scattered around town. The last one pays a collection bonus.'
  ];
  person.talkTime = 5;
  if (mission.dispatch?.completed === 2) tips[person.dialogue || 0] = 'LOCAL: I heard Inez on Civic Radio. You gave the county its voice back.';
  person.root.rotation.y = Math.atan2(position.x - person.root.position.x, position.z - person.root.position.z);
  mission.toast = police.level ? 'LOCAL: Please keep those patrols away from me!' : tips[person.dialogue || 0];
  mission.toastTime = 6;
  return true;
}

export function nearbyWitness(position, people, vehicles) {
  return people.some(person => Math.hypot(person.root.position.x - position.x, person.root.position.z - position.z) < 42)
    || vehicles.some(car => car.userData.occupied && !car.userData.police && Math.hypot(car.position.x - position.x, car.position.z - position.z) < 35);
}

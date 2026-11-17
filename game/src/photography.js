import * as THREE from 'three';
import { distanceXZ, segmentBlocked } from './util.js';
import { saveMission } from './missions.js';

export const PHOTO_SUBJECTS = [
  { name: 'Palm Motel', point: [-180, 12, 180], hint: 'Stand south of the motel and face north.', reward: 180 },
  { name: 'Civic Radio', point: [155, 35, -153], hint: 'Look up at the mast from the plaza.', reward: 220 },
  { name: 'Port Sol Crane', point: [196, 35, 213], hint: 'Find the crane at the east end of the pier.', reward: 200 },
  { name: 'Sunset Palms', point: [-191, 9, -149], hint: 'Frame the palm trees beside Sunset Strip.', reward: 160 }
];

export function restorePhotos(saved) {
  const taken = (saved?.taken || []).filter(index => Number.isInteger(index) && index >= 0 && index < PHOTO_SUBJECTS.length);
  return { taken: [...new Set(taken)], scores: PHOTO_SUBJECTS.map((_, i) => Math.min(100, Math.max(0, Number(saved?.scores?.[i]) || 0))) };
}

export function createPhotography() {
  const panel = document.createElement('section');
  panel.id = 'viewfinder';
  panel.className = 'hidden';
  panel.setAttribute('aria-label', 'Photography viewfinder');
  const frame = document.createElement('div');
  frame.className = 'photoFrame';
  const title = document.createElement('strong');
  title.textContent = 'COUNTY PRESS / CAMERA';
  const details = document.createElement('p');
  const instructions = document.createElement('p');
  instructions.textContent = 'Mouse aim · W/S zoom · X shutter · V or Escape return';
  panel.append(title, frame, details, instructions);
  document.body.append(panel);
  return {
    panel,
    details,
    active: false,
    yaw: 0,
    pitch: 0,
    fov: 58,
    origin: new THREE.Vector3(),
    savedPosition: new THREE.Vector3(),
    savedQuaternion: new THREE.Quaternion(),
    savedFov: 58,
    candidate: null,
    messageTime: 0,
    flash: 0
  };
}

export function togglePhotography(view, camera, player, open = !view.active) {
  if (open === view.active) return;
  view.active = open;
  view.panel.classList.toggle('hidden', !open);
  if (open) {
    view.savedPosition.copy(camera.position);
    view.savedQuaternion.copy(camera.quaternion);
    view.savedFov = camera.fov;
    view.origin.copy(player.root.position);
    view.origin.y += 1.8;
    view.yaw = player.yaw;
    view.pitch = player.pitch;
    view.fov = 58;
    view.messageTime = 0;
    camera.position.copy(view.origin);
  } else {
    camera.position.copy(view.savedPosition);
    camera.quaternion.copy(view.savedQuaternion);
    camera.fov = view.savedFov;
    camera.updateProjectionMatrix();
  }
}

export function evaluatePhoto(camera, subject, obstacles) {
  const target = new THREE.Vector3(...subject.point);
  const distance = camera.position.distanceTo(target);
  if (distance < 12 || distance > 110) return { valid: false, reason: 'Find a viewpoint 12–110m from a landmark' };
  const projected = target.clone().project(camera);
  if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > .7 || Math.abs(projected.y) > .65) {
    return { valid: false, reason: 'Keep the landmark inside the viewfinder' };
  }
  // Buildings enclosing a landmark are its subject, not foreground occluders.
  const foreground = obstacles.filter(box => Math.abs(target.x - box.x) > box.hx + 2 || Math.abs(target.z - box.z) > box.hz + 2);
  if (segmentBlocked(camera.position, target, foreground)) return { valid: false, reason: 'A building blocks the subject' };
  const centering = 1 - Math.min(1, Math.hypot(projected.x, projected.y));
  const proximity = 1 - Math.min(1, Math.abs(distance - 45) / 90);
  return { valid: true, score: Math.round(centering * 70 + proximity * 30), distance };
}

export function updatePhotography(view, camera, input, mission, world, dt, audio) {
  const [mx, my] = input.consumeMouse();
  view.yaw -= mx * .002;
  view.pitch = THREE.MathUtils.clamp(view.pitch - my * .002, -.9, .9);
  const zoom = Number(input.down('KeyS')) - Number(input.down('KeyW'));
  view.fov = THREE.MathUtils.clamp(view.fov + zoom * dt * 25, 25, 80);
  camera.fov = view.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(
    view.origin.x + Math.sin(view.yaw) * Math.cos(view.pitch) * 30,
    view.origin.y + Math.sin(view.pitch) * 30,
    view.origin.z + Math.cos(view.yaw) * Math.cos(view.pitch) * 30
  );
  camera.updateMatrixWorld(true);
  view.candidate = null;
  let nearest = null;
  PHOTO_SUBJECTS.forEach((subject, index) => {
    const result = evaluatePhoto(camera, subject, world.obstacles);
    const distance = camera.position.distanceTo(new THREE.Vector3(...subject.point));
    if (!nearest || distance < nearest.distance) nearest = { subject, distance, result };
    if (result.valid && (!view.candidate || result.score > view.candidate.score)) {
      view.candidate = { index, subject, ...result };
    }
  });
  view.messageTime = Math.max(0, view.messageTime - dt);
  view.flash = Math.max(0, view.flash - dt);
  view.panel.style.backgroundColor = view.flash ? '#ffffff88' : 'transparent';
  if (!view.messageTime) {
    const candidate = view.candidate;
    view.details.textContent = candidate
      ? `${candidate.subject.name} · composition ${candidate.score}/100 · ${mission.photos.taken.includes(candidate.index) ? 'Filed — improve your score' : `Fee $${candidate.subject.reward}`} · X capture`
      : `${nearest.subject.name}: ${nearest.result.reason} · ${nearest.subject.hint}`;
  }
  if (input.pressed('KeyX')) takePhoto(view, mission, audio);
}

export function takePhoto(view, mission, audio) {
  const candidate = view.candidate;
  if (!candidate) {
    view.details.textContent = 'No landmark in frame. Find a clear view and try again.';
    view.messageTime = 2;
    return false;
  }
  const { index, subject, score } = candidate;
  const first = !mission.photos.taken.includes(index);
  const improved = score > mission.photos.scores[index];
  if (first) {
    mission.photos.taken.push(index);
    mission.money += subject.reward;
    if (mission.photos.taken.length === PHOTO_SUBJECTS.length) mission.money += 600;
  }
  if (improved) mission.photos.scores[index] = score;
  view.details.textContent = `${subject.name} filed · ${score}/100${first ? ` · +$${subject.reward}` : improved ? ' · New personal best' : ' · Already in your portfolio'}${first && mission.photos.taken.length === 4 ? ' · Portfolio complete +$600' : ''}`;
  view.messageTime = 4;
  view.flash = .12;
  audio?.shutter?.();
  saveMission(mission);
  return true;
}

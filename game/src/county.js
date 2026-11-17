import * as THREE from 'three';
import { COUNTY, MISSION } from './config.js';
import { distanceXZ, formatClock } from './util.js';
import { saveMission } from './missions.js';

export function createCounty(scene) {
  const root = new THREE.Group();
  root.name = 'County exploration and coastal courier';
  scene.add(root);
  const caches = COUNTY.caches.map((point, index) => {
    const mesh = new THREE.Group();
    const caseMaterial = new THREE.MeshStandardMaterial({ color: 0x49d5bd, emissive: 0x154e43 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(.9, .55, .65), caseMaterial);
    box.position.y = .65;
    mesh.add(box);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.1, .045, 6, 24), new THREE.MeshBasicMaterial({ color: 0x86ffe0 }));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = .12;
    mesh.add(halo);
    mesh.position.set(...point);
    mesh.userData.index = index;
    root.add(mesh);
    return mesh;
  });
  const gate = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xffbf62, transparent: true, opacity: .8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(5, 5.45, 48), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .18;
  gate.add(ring);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 5, 8), material);
    post.position.set(side * 5.4, 2.5, 0);
    gate.add(post);
  }
  root.add(gate);
  gate.visible = false;
  return { root, caches, gate, elapsed: 0, prompt: '', nearest: null, radio: 0, announcement: '', announcementTime: 0 };
}

export function countyObjective(mission) {
  if (!mission.courier.active) return null;
  return new THREE.Vector3(...(COUNTY.courierRoute[mission.courier.gate] || MISSION.garage));
}

export function startCourier(mission, police) {
  if (mission.dispatch?.active || mission.rally?.active) return false;
  if (mission.phase !== 'free-roam' || mission.courier.active || mission.dispatch?.active || mission.rally?.active || mission.contractStep) return false;
  if (police.level) {
    mission.toast = 'Mara: Lose the patrols before taking a courier job.';
    mission.toastTime = 4;
    return false;
  }
  mission.courier = { active: true, gate: 0, remaining: COUNTY.courierSeconds, best: mission.courier.best || 0, completed: mission.courier.completed || 0 };
  mission.toast = 'COASTAL COURIER / Four checkpoints, then return to Mara. Any vehicle. 150 seconds.';
  mission.toastTime = 7;
  saveMission(mission);
  return true;
}

export function cancelCourier(mission, reason) {
  if (!mission.courier.active) return;
  mission.courier.active = false;
  mission.toast = `Courier failed / ${reason} / Press C at Mara's garage to retry`;
  mission.toastTime = 6;
  saveMission(mission);
}

export function updateCounty(county, mission, player, vehicle, police, dt, audio) {
  county.elapsed += dt;
  mission.clock = (mission.clock + dt * 24 / COUNTY.cycleSeconds) % 24;
  county.prompt = '';
  county.nearest = null;
  const position = vehicle?.position || player.root.position;
  for (let i = 0; i < county.caches.length; i++) {
    const mesh = county.caches[i];
    mesh.visible = !mission.caches.includes(i);
    mesh.children[0].rotation.y = county.elapsed;
    mesh.children[0].position.y = .8 + Math.sin(county.elapsed * 2 + i) * .15;
    if (mesh.visible && !vehicle && distanceXZ(position, mesh.position) < 3.5) {
      county.nearest = i;
      county.prompt = 'Q — Recover county cache / $90';
    }
  }
  const target = countyObjective(mission);
  county.gate.visible = !!target;
  if (target) {
    county.gate.position.copy(target);
    county.gate.children[0].rotation.z += dt * .5;
    mission.courier.remaining = Math.max(0, mission.courier.remaining - dt);
    if (!mission.courier.remaining) cancelCourier(mission, 'Time expired');
    else if (vehicle && distanceXZ(position, target) < 12) {
      mission.courier.gate++;
      audio?.reward();
      if (mission.courier.gate > COUNTY.courierRoute.length) finishCourier(mission, vehicle);
      else {
        mission.toast = mission.courier.gate === COUNTY.courierRoute.length ? 'Coastal route clear / Return to Mara for payment' : `Courier checkpoint ${mission.courier.gate} / ${COUNTY.courierRoute.length}`;
        mission.toastTime = 3;
        saveMission(mission);
      }
    }
  }
  if (mission.phase === 'free-roam' && !mission.courier.active && distanceXZ(position, MISSION.garage) < 24) {
    county.prompt ||= 'C — Coastal Courier / timed route / $650 + condition bonus';
  }
  county.announcementTime = Math.max(0, county.announcementTime - dt);
}

function finishCourier(mission, vehicle) {
  const elapsed = COUNTY.courierSeconds - mission.courier.remaining;
  const bonus = Math.round(vehicle.userData.health * 2);
  mission.courier.active = false;
  mission.courier.completed++;
  mission.courier.best = mission.courier.best ? Math.min(mission.courier.best, elapsed) : elapsed;
  mission.money += COUNTY.courierReward + bonus;
  mission.toast = `COASTAL COURIER COMPLETE / +$${COUNTY.courierReward + bonus} / ${elapsed.toFixed(1)}s / Saved`;
  mission.toastTime = 9;
  saveMission(mission);
}

export function collectCountyCache(county, mission, audio) {
  const index = county.nearest;
  if (index === null || mission.caches.includes(index)) return false;
  mission.caches.push(index);
  mission.money += COUNTY.cacheReward;
  const complete = mission.caches.length === COUNTY.caches.length;
  if (complete) mission.money += 500;
  mission.toast = `County cache ${mission.caches.length}/${COUNTY.caches.length} / +$${COUNTY.cacheReward}${complete ? ' / Collection complete +$500' : ''} / Saved`;
  mission.toastTime = 5;
  county.caches[index].visible = false;
  county.nearest = null;
  audio?.reward();
  saveMission(mission);
  return true;
}

export function countyStatus(mission) {
  const route = mission.courier;
  return {
    clock: formatClock(mission.clock), caches: `${mission.caches.length}/${COUNTY.caches.length}`,
    courier: route.active ? `${Math.ceil(route.remaining)}s · ${Math.min(route.gate, 4)}/4` : '',
    best: route.best ? `${route.best.toFixed(1)}s` : '—'
  };
}

export function countyProgressText(mission) {
  if (mission.courier.active) {
    const next = Math.min(4, mission.courier.gate + 1);
    return `COASTAL COURIER / checkpoint ${next} of 4 / ${Math.ceil(mission.courier.remaining)} seconds`;
  }
  if (mission.caches.length === COUNTY.caches.length) return 'COUNTY ARCHIVE / collection complete';
  return `COUNTY ARCHIVE / ${mission.caches.length} of ${COUNTY.caches.length} caches recovered`;
}

export function cacheHint(mission, player) {
  const remaining = COUNTY.caches
    .map((point, index) => ({ index, distance: distanceXZ(player.root.position, point) }))
    .filter(item => !mission.caches.includes(item.index))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!remaining) return 'Every cache is accounted for.';
  const district = remaining.index % 3 === 0 ? 'Palm Heights' : remaining.index % 3 === 1 ? 'Sunset Strip' : 'Civic Quarter';
  return `Nearest cache: ${district}, ${Math.round(remaining.distance)} m`;
}

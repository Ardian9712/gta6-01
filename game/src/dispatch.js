import * as THREE from 'three';
import { MISSION, COUNTY } from './config.js';
import { distanceXZ, clamp } from './util.js';
import { createPerson } from './player.js';
import { spawnGuards, clearGuards, aliveGuards } from './combat.js';
import { raiseWanted } from './police.js';
import { saveMission } from './missions.js';

export const DISPATCH_JOBS = [
  {
    title: 'Fourth Shift',
    contact: [-214, 0, -84],
    destination: [110, 0, -180],
    seconds: 180,
    reward: 1100,
    briefing: 'A dock witness needs a ride to Civic Radio. Pick up Inez on the Strip.',
    pickup: 'Inez: They saw me leave. Keep the car intact and lose them before the drop.',
    ending: 'Inez is safe. Her testimony opens the last evidence locker.'
  },
  {
    title: 'The Last Copy',
    contact: [210, 0, 170],
    destination: [-180, 0, 127],
    seconds: 210,
    reward: 1600,
    briefing: 'The collector has one backup at the pier. Clear the guards, recover it, and bring it home.',
    pickup: 'Backup recovered. The collector called every patrol in the county.',
    ending: 'The last copy is safe. Mara can close the case for good.'
  }
];

export function restoreDispatch(saved) {
  const completed = clamp(Math.floor(Number(saved?.completed) || 0), 0, 2);
  return {
    completed,
    active: false,
    stage: 'idle',
    remaining: 0,
    passengerHealth: 100,
    lastCondition: 100,
    boarded: false,
    hold: 0,
    ambush: false,
    vehicleId: null,
    failures: Math.max(0, Math.floor(Number(saved?.failures) || 0))
  };
}

export function createDispatch(scene) {
  const contact = createPerson(scene, 0xac75b3, .9);
  contact.root.visible = false;
  const caseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, .7, .7),
    new THREE.MeshStandardMaterial({ color: 0xaecbd1, emissive: 0x143c49 })
  );
  caseMesh.visible = false;
  scene.add(caseMesh);
  const marker = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4, 4.35, 40),
    new THREE.MeshBasicMaterial({ color: 0xc69aff, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .22;
  marker.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(.8),
    new THREE.MeshBasicMaterial({ color: 0xe8c1ff })
  );
  diamond.position.y = 4;
  marker.add(diamond);
  marker.visible = false;
  scene.add(marker);
  return { contact, caseMesh, marker, diamond, time: 0, prompt: '' };
}

export function dispatchJob(mission) {
  return DISPATCH_JOBS[Math.min(1, mission.dispatch.completed)];
}

export function dispatchTarget(mission) {
  const job = mission.dispatch;
  if (!job.active) return null;
  const definition = dispatchJob(mission);
  const point = ['pickup', 'guards', 'collect'].includes(job.stage)
    ? definition.contact : definition.destination;
  return new THREE.Vector3(...point);
}

export function startDispatch(mission, position, police, combat) {
  const job = mission.dispatch;
  if (mission.phase !== 'free-roam' || distanceXZ(position, MISSION.garage) > 24) return false;
  if (job.active || job.completed >= DISPATCH_JOBS.length) return false;
  if (police.level || mission.courier.active || mission.rally.active || mission.contractStep) {
    mission.toast = 'Mara: Finish your route and lose the patrols before taking this job.';
    mission.toastTime = 4;
    return false;
  }
  const definition = dispatchJob(mission);
  Object.assign(job, {
    active: true,
    stage: 'pickup',
    remaining: definition.seconds,
    passengerHealth: 100,
    lastCondition: 100,
    boarded: false,
    hold: 0,
    ambush: false,
    vehicleId: null
  });
  combat.ammo = combat.magazine;
  combat.reserve = Math.max(48, combat.reserve);
  mission.toast = `${definition.title.toUpperCase()} / ${definition.briefing}`;
  mission.toastTime = 9;
  saveMission(mission);
  return true;
}

export function failDispatch(mission, scene, combat, reason) {
  if (!mission.dispatch.active) return false;
  mission.dispatch.active = false;
  mission.dispatch.stage = 'idle';
  mission.dispatch.failures++;
  clearGuards(scene, combat);
  mission.toast = `JOB FAILED / ${reason} / J at Mara to retry`;
  mission.toastTime = 7;
  saveMission(mission);
  return true;
}

export function interactDispatch(mission, player, vehicle, police, scene, combat, audio) {
  const job = mission.dispatch;
  if (!job.active) return false;
  const definition = dispatchJob(mission);
  const position = vehicle?.position || player.root.position;
  if (distanceXZ(position, definition.contact) > 9) return false;
  if (job.completed === 0 && job.stage === 'pickup') {
    if (!vehicle || Math.abs(vehicle.userData.speed) > 1.5) {
      mission.toast = 'Inez: Bring a car and stop beside me. Press J when you are ready.';
      mission.toastTime = 4;
      return false;
    }
    job.vehicleId = vehicle.uuid;
    job.lastCondition = vehicle.userData.health;
    job.boarded = true;
    job.stage = 'escape';
    raiseWanted(police, 2);
  } else if (job.completed === 1 && job.stage === 'collect' && !vehicle && aliveGuards(combat) === 0) {
    job.stage = 'escape';
    raiseWanted(police, 3);
  } else return false;
  mission.toast = definition.pickup;
  mission.toastTime = 7;
  audio?.reward();
  saveMission(mission);
  return true;
}

export function updateDispatch(view, mission, player, vehicle, police, combat, scene, dt, audio) {
  view.time += dt;
  view.prompt = '';
  const job = mission.dispatch;
  const definition = dispatchJob(mission);
  const position = vehicle?.position || player.root.position;
  view.contact.root.visible = job.active && job.completed === 0 && job.stage === 'pickup';
  view.contact.root.position.set(...definition.contact);
  view.contact.root.rotation.y = Math.atan2(position.x - definition.contact[0], position.z - definition.contact[2]);
  view.caseMesh.visible = job.active && job.completed === 1 && ['guards', 'collect'].includes(job.stage);
  view.caseMesh.position.set(definition.contact[0], .7, definition.contact[2]);
  view.caseMesh.rotation.y = view.time * .4;
  const target = dispatchTarget(mission);
  view.marker.visible = !!target;
  if (target) view.marker.position.copy(target);
  view.diamond.rotation.y += dt;
  view.diamond.position.y = 4 + Math.sin(view.time * 2) * .3;
  if (!job.active) {
    if (mission.phase === 'free-roam' && job.completed < 2 && !mission.rally.active && !mission.courier.active && !mission.contractStep && distanceXZ(position, MISSION.garage) < 24) {
      view.prompt = `J — Mission ${job.completed + 4}: ${definition.title}`;
    }
    return;
  }
  job.remaining = Math.max(0, job.remaining - dt);
  if (!job.remaining) { failDispatch(mission, scene, combat, 'Time expired'); return; }
  if (job.completed === 1 && job.stage === 'pickup' && distanceXZ(position, definition.contact) < 38) {
    spawnGuards(scene, combat, new THREE.Vector3(...definition.contact));
    job.stage = 'guards';
    mission.toast = 'THE LAST COPY / Three guards at the locker. Exit the car and clear the pier.';
    mission.toastTime = 6;
  }
  if (job.completed === 1 && job.stage === 'pickup' && distanceXZ(position, definition.contact) >= 38 && !job.ambush) {
    job.ambush = true;
    mission.toast = 'THE LAST COPY / Reach the East Pier locker. Mara expects a guarded site.';
    mission.toastTime = 6;
  }
  if (job.stage === 'guards' && aliveGuards(combat) === 0) {
    job.stage = 'collect';
    mission.toast = 'Pier clear / Walk to the silver case and press J';
    mission.toastTime = 5;
  }
  if (job.boarded && vehicle?.uuid === job.vehicleId) {
    const damage = Math.max(0, job.lastCondition - vehicle.userData.health);
    job.passengerHealth = Math.max(0, job.passengerHealth - damage * 1.4);
    job.lastCondition = vehicle.userData.health;
    if (!job.passengerHealth) { failDispatch(mission, scene, combat, 'The witness was injured'); return; }
  }
  if (job.stage === 'escape' && police.level === 0) job.stage = 'deliver';
  if (job.stage === 'deliver' && police.level > 0) job.stage = 'escape';
  if (['pickup', 'collect'].includes(job.stage) && distanceXZ(position, definition.contact) < 10) {
    view.prompt = job.completed === 0 ? 'J — Board Inez / stop your car' : 'J — Recover the backup / on foot';
  }
  if (job.boarded && (!vehicle || vehicle.uuid !== job.vehicleId)) {
    view.prompt = 'Inez is waiting in the pickup car. Return to that vehicle.';
  }
  if (job.completed === 0 && job.stage === 'escape' && police.level === 0 && distanceXZ(position, COUNTY.courierRoute[2]) < 46 && !job.ambush) {
    job.ambush = true;
    raiseWanted(police, 2);
    mission.toast = 'DISPATCH: Unmarked units spotted your pickup. Break their line of sight before Civic Radio.';
    mission.toastTime = 6;
    job.stage = 'escape';
  }
  const correctVehicle = job.completed === 1 ? !vehicle : vehicle?.uuid === job.vehicleId;
  const parked = vehicle ? Math.abs(vehicle.userData.speed) < 2 : player.speed < .5;
  const canDeliver = job.stage === 'deliver' && correctVehicle && parked && distanceXZ(position, definition.destination) < 12;
  job.hold = canDeliver ? job.hold + dt : 0;
  if (canDeliver) view.prompt = `Hold position / handoff ${Math.min(100, Math.round(job.hold / 2 * 100))}%`;
  if (job.hold >= 2) {
    const bonus = job.completed === 0 ? Math.round(job.passengerHealth * 3) : Math.round(job.remaining * 2);
    mission.money += definition.reward + bonus;
    job.completed++;
    job.active = false;
    job.stage = 'idle';
    clearGuards(scene, combat);
    mission.toast = `${definition.title.toUpperCase()} COMPLETE / +$${definition.reward + bonus} / ${definition.ending}`;
    mission.toastTime = 10;
    audio?.reward();
    saveMission(mission);
  }
}

export function dispatchObjective(mission, combat) {
  const job = mission.dispatch;
  if (!job.active) return '';
  const stage = {
    pickup: job.completed === 0 ? 'Pick up Inez on Sunset Strip' : 'Reach the pier evidence locker',
    guards: `Clear the pier guards (${aliveGuards(combat)} remaining)`,
    collect: 'Recover the silver backup case — J',
    escape: 'Lose the patrols before the handoff',
    deliver: job.completed === 0 ? 'Park Inez’s car at Civic Radio' : 'Return the backup to Mara'
  };
  if (job.stage === 'guards') return `${stage.guards} · ${Math.ceil(job.remaining)}s`;
  return `${stage[job.stage]} · ${Math.ceil(job.remaining)}s`;
}

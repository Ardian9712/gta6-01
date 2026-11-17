import * as THREE from 'three';
import { MISSION, SAVE_KEY, STORY, COUNTY } from './config.js';
import { distanceXZ } from './util.js';
import { restoreDispatch } from './dispatch.js';
import { restoreRally } from './rally.js';
import { restorePhotos } from './photography.js';
import { restoreGarage } from './garage.js';

export function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}

export function createMission(saved = null) {
  return {
    dispatch: restoreDispatch(saved?.dispatch),
    rally: restoreRally(saved?.rally),
    photos: restorePhotos(saved?.photos),
    garage: restoreGarage(saved?.garage),
    phase: saved?.phase || 'meet', money: saved?.money ?? 240,
    checkpoint: saved?.checkpoint || saved?.phase || 'meet', complete: !!saved?.complete || saved?.phase === 'free-roam',
    ledger: !!saved?.ledger, broadcast: !!saved?.broadcast, contracts: saved?.contracts || 0,
    contractStep: saved?.contractStep || 0, toast: '', toastTime: 0,
    caches: [...new Set((saved?.caches || []).filter(index => Number.isInteger(index) && index >= 0 && index < COUNTY.caches.length))],
    clock: Number.isFinite(saved?.clock) ? saved.clock : COUNTY.startHour,
    courier: { active: false, gate: 0, remaining: COUNTY.courierSeconds, best: Math.max(0, saved?.courier?.best || 0), completed: Math.max(0, saved?.courier?.completed || 0) }
  };
}

export function advanceStory(mission, phase, text) {
  if (mission.phase === phase) return false;
  mission.phase = phase;
  mission.checkpoint = phase;
  mission.toast = text;
  mission.toastTime = 5;
  return true;
}

export function storyPrompt(mission, target) {
  const labels = {
    'm2-drive': 'Drive to Port Sol', 'm2-combat': 'Defeat the dock guards', 'm2-ledger': 'Collect the ledger',
    'm2-return': 'Bring the ledger to Mara', 'm3-drive': 'Drive to Civic Quarter plaza',
    'm3-transmit': 'Activate the outdoor transmitter', 'm3-escape': 'Lose the ★★★ pursuit',
    'm3-return': 'Return to the garage', 'free-roam': 'Free roam — take a delivery contract'
  };
  if (mission.phase === 'meet') return { text: 'Speak with Mara at the garage', distance: distanceXZ(target, MISSION.garage) };
  return { text: labels[mission.phase] || 'Explore Sunset County', distance: target ? distanceXZ(target, mission.objectivePosition || target) : 0 };
}

export function currentStoryMessage(mission) {
  return mission.phase.startsWith('m3') ? STORY[1].line : STORY[0].line;
}

export function updateMission(mission, player, vehicle, police, input, maraPosition, targetPosition, garagePosition, onSave) {
  if (mission.phase === 'meet' && distanceXZ(player.position, maraPosition) < 7 && input.interact) {
    mission.phase = 'find'; mission.checkpoint = 'find';
    notify(mission, 'Mara: The turquoise sedan is on the Strip. Bring it home clean.');
    onSave();
  } else if (mission.phase === 'find' && vehicle?.userData.target && vehicle.userData.stolen) {
    mission.phase = 'escape'; mission.checkpoint = 'escape';
  } else if (mission.phase === 'escape' && police.level === 0 && vehicle?.userData.target) {
    mission.phase = 'deliver'; mission.checkpoint = 'deliver';
    notify(mission, 'The street is quiet. Get the sedan back to Mara.');
  } else if (mission.phase === 'deliver' && vehicle?.userData.target && distanceXZ(vehicle.position, garagePosition) < 18) {
    mission.phase = 'complete'; mission.complete = true; mission.money += 850;
    notify(mission, 'MISSION COMPLETE  /  +$850  /  Impound receipt recovered');
    onSave();
  }
  if (mission.toastTime > 0) mission.toastTime -= .016;
}

export function objectiveFor(mission, player, targetPosition, garagePosition) {
  if (mission.phase === 'meet') return { text: 'Speak with Mara at the garage', distance: distanceXZ(player.position, MISSION.garage) };
  if (mission.phase === 'find') return { text: 'Find the turquoise sedan on Sunset Strip', distance: distanceXZ(player.position, targetPosition) };
  if (mission.phase === 'escape') return { text: 'Lose the police pursuit', distance: 80 };
  if (mission.phase === 'deliver') return { text: 'Deliver the sedan to Mara', distance: distanceXZ(player.position, garagePosition) };
  return { text: 'Mission complete — Saved', distance: 0 };
}

export function saveMission(mission) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    dispatch: { completed: mission.dispatch.completed, failures: mission.dispatch.failures },
    rally: { wins: mission.rally.wins, best: mission.rally.best, medal: mission.rally.medal },
    photos: mission.photos,
    garage: mission.garage,
    phase: mission.phase, money: mission.money, checkpoint: mission.checkpoint,
    ledger: mission.ledger, broadcast: mission.broadcast, contracts: mission.contracts,
    contractStep: mission.contractStep, complete: mission.complete,
    caches: mission.caches, clock: mission.clock,
    courier: { best: mission.courier.best, completed: mission.courier.completed }
  }));
}

export function markStolen(mission) {
  if (mission.phase === 'find') { mission.phase = 'escape'; mission.checkpoint = 'escape'; saveMission(mission); }
}

function notify(mission, text) { mission.toast = text; mission.toastTime = 4; }

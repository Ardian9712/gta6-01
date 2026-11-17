import { MISSION } from './config.js';
import { distanceXZ } from './util.js';
import { saveMission } from './missions.js';

export const GARAGE_PARTS = [
  {
    id: 'engine',
    name: 'Street engine',
    price: 600,
    description: 'Faster acceleration and a higher top speed for the turquoise sedan.',
    effect: 'Acceleration +18% · top speed +10%'
  },
  {
    id: 'brakes',
    name: 'Rally brakes',
    price: 420,
    description: 'A stronger handbrake helps you stop for pickups and tight corners.',
    effect: 'Handbrake force +40%'
  },
  {
    id: 'armor',
    name: 'Reinforced panels',
    price: 750,
    description: 'Protect the car and its passengers from collision damage.',
    effect: 'Collision damage −35%'
  }
];

export const PAINTS = [
  { name: 'County turquoise', color: 0x21b8b2 },
  { name: 'Sunset coral', color: 0xe97859 },
  { name: 'Midnight violet', color: 0x7861ad },
  { name: 'Motel gold', color: 0xe2bb66 }
];

export function restoreGarage(saved) {
  return {
    parts: [...new Set((saved?.parts || []).filter(part => GARAGE_PARTS.some(item => item.id === part)))],
    paint: Number.isInteger(saved?.paint) && saved.paint >= 0 && saved.paint < PAINTS.length ? saved.paint : 0,
    spent: Math.max(0, Number(saved?.spent) || 0)
  };
}

export function createGarage() {
  const panel = document.createElement('section');
  panel.id = 'workshop';
  panel.className = 'hidden';
  panel.setAttribute('aria-label', 'Mara vehicle workshop');
  const heading = document.createElement('h2');
  heading.textContent = 'MARA / AFTER HOURS WORKSHOP';
  const description = document.createElement('p');
  description.textContent = 'Parts stay fitted to your turquoise sedan. The city pauses while you choose.';
  const balance = document.createElement('strong');
  const offers = document.createElement('div');
  offers.className = 'workshopOffers';
  const paintTitle = document.createElement('h3');
  paintTitle.textContent = 'Paint booth / $90 per color change';
  const paints = document.createElement('div');
  paints.className = 'workshopPaints';
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  const close = document.createElement('button');
  close.textContent = 'Return to the street / U or T';
  panel.append(heading, description, balance, offers, paintTitle, paints, message, close);
  document.body.append(panel);
  const workshop = { panel, balance, offers, paints, message, close, active: false, mission: null, vehicle: null };
  close.onclick = () => closeGarage(workshop);
  return workshop;
}

export function canOpenGarage(mission, position, police) {
  return mission.phase === 'free-roam'
    && distanceXZ(position, MISSION.garage) < 24
    && !police.level
    && !mission.dispatch.active
    && !mission.rally.active
    && !mission.courier.active;
}

export function openGarage(workshop, mission, vehicle, position, police) {
  if (!canOpenGarage(mission, position, police)) {
    mission.toast = 'Mara: Workshop opens at the garage after the story. Finish timed jobs and clear the patrols first.';
    mission.toastTime = 4;
    return false;
  }
  workshop.active = true;
  workshop.mission = mission;
  workshop.vehicle = vehicle;
  workshop.panel.classList.remove('hidden');
  workshop.message.textContent = 'Choose parts for the sedan or a new paint finish.';
  document.exitPointerLock?.();
  renderGarage(workshop);
  return true;
}

export function closeGarage(workshop) {
  workshop.active = false;
  workshop.panel.classList.add('hidden');
  workshop.mission = null;
  workshop.vehicle = null;
}

export function buyPart(mission, id) {
  const part = GARAGE_PARTS.find(item => item.id === id);
  if (!part || mission.garage.parts.includes(id) || mission.money < part.price) return false;
  mission.money -= part.price;
  mission.garage.parts.push(id);
  mission.garage.spent += part.price;
  saveMission(mission);
  return true;
}

export function buyPaint(mission, index) {
  if (!Number.isInteger(index) || !PAINTS[index] || mission.garage.paint === index || mission.money < 90) return false;
  mission.money -= 90;
  mission.garage.spent += 90;
  mission.garage.paint = index;
  saveMission(mission);
  return true;
}

export function applyGarage(mission, vehicle) {
  if (!vehicle?.userData.target) return;
  const parts = mission.garage.parts;
  vehicle.userData.accelerationMultiplier = parts.includes('engine') ? 1.18 : 1;
  vehicle.userData.speedMultiplier = parts.includes('engine') ? 1.1 : 1;
  vehicle.userData.brakeMultiplier = parts.includes('brakes') ? 1.4 : 1;
  vehicle.userData.damageMultiplier = parts.includes('armor') ? .65 : 1;
  const color = PAINTS[mission.garage.paint].color;
  vehicle.userData.body.material.color.setHex(color);
  vehicle.userData.color = color;
}

function renderGarage(workshop) {
  const mission = workshop.mission;
  workshop.balance.textContent = `Cash $${mission.money} · workshop investment $${mission.garage.spent}`;
  workshop.offers.replaceChildren();
  for (const part of GARAGE_PARTS) {
    const card = document.createElement('article');
    const title = document.createElement('h3');
    title.textContent = part.name;
    const description = document.createElement('p');
    description.textContent = part.description;
    const effect = document.createElement('p');
    effect.textContent = part.effect;
    const button = document.createElement('button');
    const owned = mission.garage.parts.includes(part.id);
    button.textContent = owned ? 'Installed' : `Install / $${part.price}`;
    button.disabled = owned || mission.money < part.price;
    button.dataset.part = part.id;
    button.onclick = () => {
      if (!buyPart(mission, part.id)) return;
      applyGarage(mission, workshop.vehicle);
      workshop.message.textContent = `${part.name} installed and saved.`;
      renderGarage(workshop);
    };
    card.append(title, description, effect, button);
    workshop.offers.append(card);
  }
  workshop.paints.replaceChildren();
  PAINTS.forEach((paint, index) => {
    const button = document.createElement('button');
    button.textContent = `${paint.name}${mission.garage.paint === index ? ' / fitted' : ''}`;
    button.style.borderBottom = `6px solid #${paint.color.toString(16).padStart(6, '0')}`;
    button.disabled = mission.garage.paint === index || mission.money < 90;
    button.dataset.paint = String(index);
    button.onclick = () => {
      if (!buyPaint(mission, index)) return;
      applyGarage(mission, workshop.vehicle);
      workshop.message.textContent = `${paint.name} applied and saved.`;
      renderGarage(workshop);
    };
    workshop.paints.append(button);
  });
}

import { COUNTY, MISSION } from './config.js';
import { formatClock } from './util.js';
import { DISPATCH_JOBS, dispatchTarget } from './dispatch.js';
import { RALLY_ROUTE, rallySummary } from './rally.js';
import { PHOTO_SUBJECTS } from './photography.js';

const districts = [
  { name: 'SUNSET STRIP', x: -150, z: -150 },
  { name: 'PALM HEIGHTS', x: -150, z: 150 },
  { name: 'CIVIC QUARTER', x: 150, z: -150 },
  { name: 'PORT SOL', x: 150, z: 150 }
];

export function createJournal() {
  const panel = document.createElement('section');
  panel.id = 'countyJournal';
  panel.className = 'hidden';
  panel.setAttribute('aria-label', 'County map and progress');
  const heading = document.createElement('h2');
  heading.textContent = 'SUNSET COUNTY / FIELD GUIDE';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Tab to close · The city pauses while you plan your route.';
  const map = document.createElement('canvas');
  map.width = 540;
  map.height = 540;
  map.setAttribute('aria-label', 'County map with cache locations and courier route');
  const details = document.createElement('div');
  details.className = 'journalDetails';
  const close = document.createElement('button');
  close.textContent = 'Return to the street';
  panel.append(heading, subtitle, map, details, close);
  document.body.append(panel);
  const journal = { panel, map, details, open: false, waypoint: null };
  close.onclick = () => toggleJournal(journal, false);
  map.addEventListener('click', event => {
    const rect = map.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 540;
    const y = (event.clientY - rect.top) / rect.height * 540;
    journal.waypoint = { x: (x - 270) / .95, z: (270 - y) / .95 };
  });
  map.addEventListener('mousemove', event => {
    const rect = map.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 540;
    const y = (event.clientY - rect.top) / rect.height * 540;
    const worldX = (x - 270) / .95;
    const worldZ = (270 - y) / .95;
    const district = districts.find(item => Math.hypot(item.x - worldX, item.z - worldZ) < 36);
    map.title = district ? `${district.name} / click to place a waypoint` : 'Sunset County / click to place a waypoint';
  });
  return journal;
}

export function toggleJournal(journal, open = !journal.open) {
  journal.open = open;
  journal.panel.classList.toggle('hidden', !open);
  if (open) document.exitPointerLock?.();
}

export function updateJournal(journal, mission, position) {
  if (!journal.open) return;
  const ctx = journal.map.getContext('2d');
  ctx.fillStyle = '#173c43';
  ctx.fillRect(0, 0, 540, 540);
  ctx.fillStyle = '#38524c';
  ctx.fillRect(35, 48, 470, 457);
  ctx.strokeStyle = '#8a9380';
  ctx.lineWidth = 12;
  for (let road = -200; road <= 200; road += 100) {
    const a = project({ x: road, z: -235 });
    const b = project({ x: road, z: 235 });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const c = project({ x: -235, z: road });
    const d = project({ x: 235, z: road });
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f3e5be';
  for (const district of districts) {
    const point = project(district);
    ctx.fillText(district.name, point.x, point.y);
  }
  for (let index = 0; index < COUNTY.caches.length; index++) {
    const point = COUNTY.caches[index];
    const found = mission.caches.includes(index);
    drawMarker(ctx, { x: point[0], z: point[2] }, found ? '#69877f' : '#6ef0c3', found ? '✓' : `${index + 1}`);
  }
  if (mission.courier.active) {
    const route = [...COUNTY.courierRoute, MISSION.garage];
    ctx.strokeStyle = '#ffc06a';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    route.forEach((point, index) => {
      const p = project({ x: point[0], z: point[2] });
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    route.forEach((point, index) => drawMarker(ctx, { x: point[0], z: point[2] }, index < mission.courier.gate ? '#69877f' : '#ffc06a', index === 4 ? 'G' : String(index + 1)));
  }
  drawMarker(ctx, { x: MISSION.garage[0], z: MISSION.garage[2] }, '#fff0cb', 'G');
  drawMarker(ctx, position, '#ffffff', 'A');
  if (journal.waypoint) drawMarker(ctx, journal.waypoint, '#ff95bc', 'W');
  drawAfterHours(ctx, mission);
  ctx.fillStyle = '#e6ce9f';
  ctx.textAlign = 'left';
  ctx.fillText('N ↑    A: Alex    G: garage    Green: caches', 24, 28);
  ctx.fillText('Click map to place a personal waypoint', 24, 524);
  renderDetails(journal, mission, position);
}

function renderDetails(journal, mission, position) {
  const rows = [
    ['County time', formatClock(mission.clock)],
    ['Cash', `$${mission.money}`],
    ['Caches recovered', `${mission.caches.length} / ${COUNTY.caches.length}`],
    ['Delivery contracts', String(mission.contracts)],
    ['Coastal courier wins', String(mission.courier.completed)],
    ['Best coastal route', mission.courier.best ? `${mission.courier.best.toFixed(1)} seconds` : 'No completed route yet']
  ];
  journal.details.replaceChildren();
  for (const [label, value] of rows) {
    const row = document.createElement('p');
    const title = document.createElement('strong');
    title.textContent = `${label}: `;
    row.append(title, document.createTextNode(value));
    journal.details.append(row);
  }
  const help = document.createElement('p');
  help.textContent = 'Find turquoise cases on foot and press Q. Recover all six for a $500 bonus. After the story, press C at Mara’s garage to start the coastal courier route.';
  journal.details.append(help);
  renderAfterHours(journal, mission);
  if (journal.waypoint) {
    const distance = Math.round(Math.hypot(position.x - journal.waypoint.x, position.z - journal.waypoint.z));
    const waypoint = document.createElement('p');
    waypoint.textContent = `Personal waypoint: ${distance} m away`;
    const clear = document.createElement('button');
    clear.textContent = 'Clear waypoint';
    clear.onclick = () => { journal.waypoint = null; };
    journal.details.append(waypoint, clear);
  }
}

function project(position) {
  return { x: 270 + position.x * .95, y: 270 - position.z * .95 };
}

function drawMarker(ctx, position, color, label) {
  const point = project(position);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#173139';
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px Arial';
  ctx.fillText(label, point.x, point.y + 4);
}

function drawAfterHours(ctx, mission) {
  PHOTO_SUBJECTS.forEach((subject, index) => {
    const taken = mission.photos.taken.includes(index);
    drawMarker(ctx, { x: subject.point[0], z: subject.point[2] }, taken ? '#667d75' : '#9bd6ff', `P${index + 1}`);
  });
  const jobTarget = dispatchTarget(mission);
  if (jobTarget) drawMarker(ctx, jobTarget, '#d2a2ff', 'J');
  if (!mission.rally.active) return;
  ctx.strokeStyle = '#f79ac2';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  RALLY_ROUTE.forEach((point, index) => {
    const pixel = project({ x: point[0], z: point[2] });
    if (!index) ctx.moveTo(pixel.x, pixel.y);
    else ctx.lineTo(pixel.x, pixel.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  RALLY_ROUTE.forEach((point, index) => {
    if (index < mission.rally.gate) return;
    drawMarker(ctx, { x: point[0], z: point[2] }, index === mission.rally.gate ? '#fff0d1' : '#e982b1', String(index + 1));
  });
}

function renderAfterHours(journal, mission) {
  const heading = document.createElement('h3');
  heading.textContent = 'AFTER HOURS';
  journal.details.append(heading);
  const garage = document.createElement('p');
  garage.textContent = `U at Mara: vehicle workshop. Installed parts: ${mission.garage.parts.join(', ') || 'stock sedan'}. Engine, brakes, armor, and paint are saved.`;
  journal.details.append(garage);
  DISPATCH_JOBS.forEach((job, index) => {
    const row = document.createElement('p');
    const state = index < mission.dispatch.completed ? 'COMPLETE' : index === mission.dispatch.completed ? 'J at Mara' : 'Finish Fourth Shift first';
    row.textContent = `Mission ${index + 4} / ${job.title} / ${state}`;
    journal.details.append(row);
  });
  const rally = document.createElement('p');
  rally.textContent = `Sunset Circuit: ${rallySummary(mission)}. Ten gates; collisions add time. Gold ≤95s, silver ≤120s.`;
  journal.details.append(rally);
  const cameraHelp = document.createElement('p');
  cameraHelp.textContent = 'County Press: V on foot opens the camera. Mouse aim, W/S zoom, X shutter. The city pauses while you compose. Capture all four landmarks for a $600 portfolio bonus.';
  journal.details.append(cameraHelp);
  PHOTO_SUBJECTS.forEach((subject, index) => {
    const row = document.createElement('p');
    row.textContent = `P${index + 1}: ${subject.name} — ${mission.photos.taken.includes(index) ? `filed ${mission.photos.scores[index]}/100` : subject.hint}`;
    const button = document.createElement('button');
    button.textContent = 'Mark viewpoint';
    button.onclick = () => {
      journal.waypoint = { x: subject.point[0], z: subject.point[2] - 40 };
    };
    row.append(document.createTextNode(' '), button);
    journal.details.append(row);
  });
}

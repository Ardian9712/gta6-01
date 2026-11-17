export function createHud() {
  return {
    root: document.querySelector('#hud'), objective: document.querySelector('#objective'), wanted: document.querySelector('#wanted'),
    pursuit: document.querySelector('#pursuit'), status: document.querySelector('#status'), prompt: document.querySelector('#prompt'),
    toast: document.querySelector('#toast'), map: document.querySelector('#minimap'), context: document.querySelector('#mapContext'),
    title: document.querySelector('#mission b')
  };
}

export function updateHud(hud, state) {
  hud.objective.textContent = `${state.objective.text}  ·  ${Math.round(state.objective.distance)} m`;
  if (hud.title) hud.title.textContent = `SUNSET COUNTY / ${state.missionTitle || 'BORROWED WHEELS'}`;
  hud.wanted.textContent = '★'.repeat(state.wanted) + '☆'.repeat(3 - state.wanted);
  hud.pursuit.textContent = state.pursuit === 'PURSUIT' ? 'PURSUIT  /  BREAK LINE OF SIGHT' : state.pursuit === 'SEARCHING' ? `SEARCHING  ${Math.max(0, Math.ceil(12 - (state.searchTime || 0)))}s / STAY HIDDEN` : `CASH  $${state.money}`;
  const extra = `<small>${state.clock || '17:30'}  ·  CACHE ${state.caches || '0/6'}${state.courier ? `  ·  COURIER ${state.courier}` : ''}${state.weather ? `  ·  ${state.weather}` : ''}</small>`;
  hud.status.innerHTML = state.driving ? `${Math.round(Math.abs(state.speed) * 3.6)} KM/H<small>SEDAN CONDITION  ${Math.round(state.condition)}%</small>${extra}` : `HEALTH  ${Math.round(state.health)}<small>PISTOL  ${state.ammo} / ${state.reserve ?? 48}${state.aiming ? ' / AIM' : ''}</small>${extra}`;
  hud.status.style.color = state.health < 30 ? '#ff856c' : '#f7f2df';
  if (state.prompt) { hud.prompt.textContent = state.prompt; hud.prompt.classList.remove('hidden'); } else hud.prompt.classList.add('hidden');
  hud.toast.textContent = state.toast || '';
  hud.toast.classList.toggle('damage', !!state.damage);
  hud.root.dataset.aiming = state.aiming ? 'true' : 'false';
  hud.status.setAttribute('aria-label', state.driving ? 'Vehicle condition and activity timer' : 'Health, ammunition and activity timer');
  document.querySelector('#ending').style.display = state.ending ? 'block' : 'none';
  hud.toast.style.opacity = state.toast ? '1' : '0';
  drawMinimap(hud.map, state);
}

function drawMinimap(canvas, state) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#287e80'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#b6aa8b'; ctx.fillRect(0, 32, size, 208);
  ctx.fillStyle = '#515958';
  for (let i = -200; i <= 200; i += 100) {
    const x = size / 2 + (i - state.position.x) * .32;
    const y = size / 2 - (i - state.position.z) * .32;
    ctx.fillRect(x - 4, 0, 8, size); ctx.fillRect(0, y - 4, size, 8);
  }
  ctx.fillStyle = '#d6caa5';
  for (let x = -150; x <= 150; x += 100) for (let z = -150; z <= 150; z += 100) {
    const px = size / 2 + (x - state.position.x) * .32;
    const py = size / 2 - (z - state.position.z) * .32;
    ctx.fillRect(px - 8, py - 8, 16, 16);
  }
  marker(ctx, state.garage, state.position, '#58d0bd', '⌂');
  if (state.objectivePosition) marker(ctx, state.objectivePosition, state.position, '#ffd264', '◆');
  for (const point of state.policePositions) marker(ctx, point, state.position, '#f25f52', '•');
  ctx.translate(size / 2, size / 2); ctx.rotate(-state.yaw);
  ctx.fillStyle = '#f4f1d9'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 9); ctx.lineTo(0, 6); ctx.lineTo(-7, 9); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function marker(ctx, point, origin, color, glyph) {
  const x = 120 + (point.x - origin.x) * .32;
  const y = 120 - (point.z - origin.z) * .32;
  if (x < 0 || y < 0 || x > 240 || y > 240) return;
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
}

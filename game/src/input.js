export function createInput(canvas) {
  const keys = new Set();
  const edges = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let aimHeld = false;
  const setMouseButton = (button, held) => { if (button === 0) { if (held) keys.add('Mouse0'); else keys.delete('Mouse0'); } };
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('mousedown', event => { if (event.button === 2) aimHeld = true; });
  canvas.addEventListener('mousedown', event => setMouseButton(event.button, true));
  window.addEventListener('mouseup', event => { if (event.button === 2) aimHeld = false; });
  window.addEventListener('mouseup', event => setMouseButton(event.button, false));
  window.addEventListener('keydown', event => {
    if (event.code === 'ControlLeft' || event.code === 'ControlRight') event.preventDefault();
    if (!keys.has(event.code)) edges.add(event.code);
    keys.add(event.code);
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  const clearHeld = () => { keys.clear(); edges.clear(); aimHeld = false; mouseX = mouseY = 0; };
  window.addEventListener('blur', clearHeld);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearHeld(); });
  canvas.addEventListener('click', () => { if (!document.pointerLockElement) canvas.requestPointerLock?.(); });
  document.addEventListener('mousemove', event => {
    if (document.pointerLockElement === canvas) { mouseX += event.movementX; mouseY += event.movementY; }
  });
  return {
    down: code => keys.has(code),
    get aiming() { return aimHeld; },
    get firing() { return aimHeld && keys.has('Mouse0'); },
    setMouseButton,
    pressed: code => edges.has(code),
    consumeMouse: () => { const motion = [mouseX, mouseY]; mouseX = mouseY = 0; return motion; },
    endFrame: () => edges.clear(),
    release: clearHeld
  };
}

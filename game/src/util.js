export function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function distanceXZ(a, b) {
  const point = Array.isArray(b) ? { x: b[0], z: b[2] } : b;
  return Math.hypot(a.x - point.x, a.z - point.z);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function angleDelta(to, from) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function within(point, target, radius) {
  return distanceXZ(point, target) <= radius;
}

export function approach(value, target, amount) {
  return value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
}

export function formatClock(hour) {
  if (!Number.isFinite(hour)) return '--:--';
  const minutes = Math.floor(((hour % 24 + 24) % 24) * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function segmentBlocked(from, to, boxes, padding = 0) {
  return boxes.some(box => {
    let entry = 0, exit = 1;
    for (const [axis, half] of [['x', 'hx'], ['z', 'hz']]) {
      const delta = to[axis] - from[axis];
      const low = box[axis] - box[half] - padding;
      const high = box[axis] + box[half] + padding;
      if (Math.abs(delta) < .00001) {
        if (from[axis] < low || from[axis] > high) return false;
      } else {
        const a = (low - from[axis]) / delta, b = (high - from[axis]) / delta;
        entry = Math.max(entry, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
        if (entry > exit) return false;
      }
    }
    return exit > .01 && entry < .99;
  });
}

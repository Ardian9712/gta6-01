import { CITY } from './config.js';

// Connected lane graph shared by traffic and patrol route selection.
export function nearestRoad(value) {
  let best = CITY.roads[0];
  for (const road of CITY.roads) if (Math.abs(road - value) < Math.abs(best - value)) best = road;
  return best;
}

export function roadWaypoint(from, destination) {
  const xRoad = nearestRoad(from.x), zRoad = nearestRoad(from.z);
  if (Math.abs(from.x - xRoad) > 8 && Math.abs(from.z - zRoad) > 8) return { x: xRoad + 5, z: from.z };
  if (Math.abs(from.x - xRoad) < Math.abs(from.z - zRoad)) {
    const junction = nearestRoad(destination.z);
    if (Math.abs(from.z - junction) > 7) return { x: xRoad + 5, z: junction };
    return { x: nearestRoad(destination.x) + 5, z: junction + 5 };
  }
  const junction = nearestRoad(destination.x);
  if (Math.abs(from.x - junction) > 7) return { x: junction, z: zRoad + 5 };
  return { x: junction + 5, z: nearestRoad(destination.z) + 5 };
}

export function junctionFor(position) {
  const x = nearestRoad(position.x), z = nearestRoad(position.z);
  return { x, z };
}

export function laneSignal(position, time) {
  const junction = junctionFor(position);
  const phase = (Math.floor(time / 5) + Math.round(junction.x / 100) + Math.round(junction.z / 100) + 8) % 2;
  return phase < 1 ? 'east-west' : 'north-south';
}

export function signalCountdown(time) {
  return Math.max(1, 5 - Math.floor(((time % 5) + 5) % 5));
}

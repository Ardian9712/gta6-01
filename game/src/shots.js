export const SHOT_STATES = {
  // After Hours keeps the four commissioned frames independent of saved progress.
  chase: { driving: true, position: [-4, 0, 28], yaw: 0, wanted: 2, phase: 'escape' },
  street: { driving: false, position: [-191, 0, -131], yaw: Math.PI, wanted: 1, phase: 'escape', stolen: true },
  docks: { driving: false, position: [142, 0, 176], yaw: .35, wanted: 0, phase: 'm2-combat' },
  theft: { driving: false, position: [-191, 0, -131], yaw: Math.PI, wanted: 1, phase: 'escape', stolen: true },
  safehouse: { driving: false, position: [-180, 0, 127], yaw: 0, wanted: 0, phase: 'free-roam', caches: [0, 1], clock: 18.75 }
};

export function readShot() {
  const params = new URLSearchParams(location.search);
  const name = params.get('shot');
  return SHOT_STATES[name] ? { ...SHOT_STATES[name], name } : null;
}

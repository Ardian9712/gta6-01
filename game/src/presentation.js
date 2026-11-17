import * as THREE from 'three';
import { MISSION } from './config.js';

export function createPresentation(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const ledger = new THREE.Group();
  const book = new THREE.Mesh(new THREE.BoxGeometry(.8, .14, 1.05), new THREE.MeshStandardMaterial({ color: 0xe7c477, emissive: 0x705328 }));
  book.position.y = 1.3;
  ledger.add(book);
  ledger.position.set(...MISSION.ledger);
  root.add(ledger);
  const table = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.5), new THREE.MeshStandardMaterial({ color: 0x846344 }));
  table.position.set(MISSION.ledger[0], .5, MISSION.ledger[2]);
  root.add(table);
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, .7), new THREE.MeshStandardMaterial({ color: 0x355b61, emissive: 0x16393c }));
  terminal.position.set(MISSION.transmitter[0] + 3, .9, MISSION.transmitter[2]);
  root.add(terminal);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.8, .6), new THREE.MeshBasicMaterial({ color: 0x7de4cf, side: THREE.DoubleSide }));
  screen.position.set(terminal.position.x, 1.3, terminal.position.z + .36);
  root.add(screen);
  const objective = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2, .09, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffcb6d }));
  ring.rotation.x = Math.PI / 2;
  objective.add(ring);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.55), new THREE.MeshBasicMaterial({ color: 0xffce78 }));
  diamond.position.y = 3.2;
  objective.add(diamond);
  root.add(objective);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.3, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe5a0 }));
  root.add(muzzle);
  muzzle.visible = false;
  const guardFlashes = [];
  for (let i = 0; i < 3; i++) {
    const flash = new THREE.Mesh(new THREE.SphereGeometry(.23, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffbd66 }));
    root.add(flash);
    guardFlashes.push(flash);
  }
  const bars = document.createElement('div');
  bars.id = 'guardLabels';
  document.querySelector('#hud').append(bars);
  const labels = Array.from({ length: 3 }, () => {
    const label = document.createElement('div');
    label.className = 'guardLabel';
    label.innerHTML = '<span></span><i></i>';
    bars.append(label);
    return label;
  });
  const radio = document.createElement('div');
  radio.id = 'radio';
  document.querySelector('#hud').append(radio);
  return { root, ledger, book, terminal, screen, objective, diamond, muzzle, guardFlashes, labels, radio, clock: 0, lastPhase: '', elapsed: 0 };
}

export function updatePresentation(view, state, dt) {
  const { mission, combat, player, camera, objective, driving } = state;
  view.clock += dt;
  if (view.lastPhase !== mission.phase) {
    view.lastPhase = mission.phase;
    view.elapsed = 0;
    view.radio.style.borderLeftColor = mission.phase.startsWith('m3') ? '#efb765' : '#68c7b4';
  }
  view.elapsed += dt;
  view.objective.position.copy(objective);
  view.objective.position.y = .25;
  view.objective.visible = !['escape', 'm3-escape', 'ending'].includes(mission.phase);
  view.diamond.rotation.y += dt;
  view.diamond.position.y = 3.2 + Math.sin(view.clock * 2) * .25;
  view.ledger.visible = ['m2-combat', 'm2-ledger'].includes(mission.phase) && !mission.ledger;
  view.book.rotation.y = Math.sin(view.clock) * .12;
  view.screen.material.color.setHex(mission.broadcast ? 0xf7c36c : 0x7de4cf);
  view.muzzle.visible = !driving && combat.flash > 0;
  view.muzzle.position.copy(player.root.position).add(new THREE.Vector3(Math.sin(player.yaw) * .8, 1.5, Math.cos(player.yaw) * .8));
  for (let i = 0; i < 3; i++) {
    const enemy = combat.enemies[i], label = view.labels[i], flash = view.guardFlashes[i];
    if (!enemy || !enemy.alive) {
      label.style.display = 'none'; flash.visible = false; continue;
    }
    const point = enemy.actor.root.position.clone().add(new THREE.Vector3(0, 3.1, 0));
    const projected = point.project(camera);
    const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < .95 && Math.abs(projected.y) < .85;
    label.style.display = visible ? 'block' : 'none';
    label.style.left = `${(projected.x * .5 + .5) * innerWidth}px`;
    label.style.top = `${(-projected.y * .5 + .5) * innerHeight}px`;
    label.querySelector('span').textContent = `GUARD / ${enemy.mode.toUpperCase()}`;
    label.querySelector('i').style.width = `${Math.max(0, enemy.health)}%`;
    flash.visible = enemy.mode === 'shoot' && enemy.cooldown > 1.05;
    flash.position.copy(enemy.actor.root.position).add(new THREE.Vector3(Math.sin(enemy.actor.root.rotation.y) * .65, 1.45, Math.cos(enemy.actor.root.rotation.y) * .65));
  }
  const radioLines = {
    'm2-drive': ['ALEX: A ledger? For a car?', 'MARA: For every car. Port Sol keeps receipts.'],
    'm2-combat': ['ALEX: They hired company.', 'MARA: Keep moving. Aim, fire, reload.'],
    'm2-return': ['ALEX: Every stolen plate is in here.', 'MARA: Bring it home. We can end this.'],
    'm3-drive': ['MARA: Civic Radio still has a public uplink.', 'ALEX: One last delivery. This time, the truth.'],
    'm3-escape': ['DISPATCH: Three units, Civic Quarter!', 'MARA: Break their sight. The alleys are your way out.'],
    'm3-return': ['ALEX: The whole county heard it.', 'MARA: Come home. Your debt is gone.'],
    'free-roam': ['MARA: Honest deliveries still pay.', 'ALEX: Then let us keep the wheels turning.']
  };
  const lines = radioLines[mission.phase];
  view.radio.textContent = lines && view.elapsed < 10 ? lines[view.elapsed < 5 ? 0 : 1] : '';
  if (mission.courier.active) view.radio.textContent = `COURIER CONTROL: ${Math.max(0, Math.ceil(mission.courier.remaining))} seconds remaining. Follow the amber gates.`;
  if (mission.caches.length === 6 && !mission.courier.active && view.elapsed % 24 > 18) {
    view.radio.textContent = 'COUNTY ARCHIVE: Every cache recovered. Mara added a collection bonus.';
  }
  if (mission.courier.completed && !mission.courier.active && view.elapsed % 24 > 12 && view.elapsed % 24 < 18) {
    view.radio.textContent = `TRAFFIC DESK: ${mission.courier.completed} coastal routes completed. Best time ${mission.courier.best.toFixed(1)}s.`;
  }
  view.radio.style.opacity = view.radio.textContent ? '1' : '0';
  if (mission.dispatch?.active) {
    view.radio.textContent = mission.dispatch.stage === 'guards' ? 'INEZ: That is the locker. Clear the pier and recover the silver case.' : mission.dispatch.boarded ? 'INEZ: I am in the pickup car. Keep it steady. We cannot go to the station while they are watching.' : 'MARA: Follow the violet marker. J handles the pickup and the evidence locker.';
    view.radio.style.opacity = '1';
  }
}

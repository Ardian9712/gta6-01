import * as THREE from 'three';
import { CITY, COLORS } from './config.js';
import { seededRandom } from './util.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);

export function createWorld(scene) {
  scene.background = new THREE.Color(0xd9a06c);
  scene.fog = new THREE.Fog(0xd9a06c, 230, 610);
  const hemi = new THREE.HemisphereLight(0xffe5bd, 0x66786e, 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd09a, 3.1);
  sun.position.set(-140, 250, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.16;
  ground.receiveShadow = true;
  scene.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 140), new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.32, metalness: 0.08 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.12, 290);
  scene.add(water);

  const roads = [];
  for (const line of CITY.roads) {
    roads.push([line - 12, line + 12, -220, 220]);
    roads.push([-220, 220, line - 12, line + 12]);
    addRect(scene, line, 0, 24, 0.08, 440, COLORS.road);
    addRect(scene, 0, line, 440, 0.08, 24, COLORS.road);
    for (let mark = -210; mark <= 210; mark += 26) {
      addRect(scene, line, mark, 0.32, 0.1, 7, 0xe7d5a9);
      addRect(scene, mark, line, 7, 0.1, 0.32, 0xe7d5a9);
    }
  }
  addRect(scene, 0, -230, 500, 0.1, 18, 0x596460);
  addRect(scene, 0, 229, 500, 0.1, 18, 0x596460);
  addRect(scene, -230, 0, 18, .1, 460, 0x596460);
  addRect(scene, 230, 0, 18, .1, 460, 0x596460);
  for (const line of CITY.roads) {
    for (const side of [-1, 1]) {
      addRect(scene, line + side * 15, 0, 4, .18, 440, 0xc9bfa5);
      addRect(scene, 0, line + side * 15, 440, .18, 4, 0xc9bfa5);
    }
  }
  const obstacles = [];
  const palette = [0xd77f5b, 0xe1ad73, 0xb9c7b1, 0xc47b53, 0x90a89d, 0xe4c68e];
  const random = seededRandom(31);
  for (let x = -150; x <= 150; x += 100) for (let z = -150; z <= 150; z += 100) {
    if ((x === -150 && z === 150) || (x === 150 && z === -150)) continue;
    const width = 54 + random() * 13;
    const depth = 52 + random() * 13;
    const height = 12 + random() * 16;
    const color = palette[(Math.floor((x + 150) / 100) + (z < 0 ? 1 : 0)) % palette.length];
    const building = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.92 }));
    building.position.set(x + (random() - .5) * 8, height / 2, z + (random() - .5) * 8);
    building.scale.set(width, height, depth);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    obstacles.push({ x: building.position.x, z: building.position.z, hx: width / 2 + 2, hz: depth / 2 + 2 });
    for (let floor = 1; floor < Math.floor(height / 5); floor++) {
      for (let col = -1; col <= 1; col++) {
        const window = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xf2cf8d, emissive: 0x46351f, roughness: .45 }));
        window.position.set(building.position.x + col * 13, floor * 5, building.position.z + depth / 2 + .08);
        window.scale.set(5, 2.1, .16);
        scene.add(window);
      }
    }
    addSign(scene, building.position.x, height + 1, building.position.z, x < 0 && z < 0 ? 'SUNSET' : z < 0 && x > 0 ? 'PORT SOL' : 'COUNTY');
  }
  makeMotel(scene, obstacles);
  makePlaza(scene);
  makePort(scene);
  makeDocks(scene);
  addSign(scene, -180, 7, 114, 'MARA / AUTO SERVICE');
  addSign(scene, -214, 5, -112, 'INEZ / PICKUP');
  addSign(scene, 210, 6, 142, 'EVIDENCE / PIER EAST');
  addSign(scene, 112, 7, -140, 'CIVIC QUARTER');
  makeStrip(scene);
  makePalms(scene);
  const lamps = makeStreetLights(scene);
  return { obstacles, roads, sun, hemi, lamps };
}

function makeStreetLights(scene) {
  const lamps = [];
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x3f5558, roughness: .65 });
  for (const x of [-216, -84, 16, 116, 216]) {
    for (const z of [-175, -75, 25, 125, 205]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.13, .18, 8, 6), poleMaterial);
      pole.position.set(x, 4, z);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(1.4, .25, .8), new THREE.MeshStandardMaterial({ color: 0xffda99, emissive: 0xffc778 }));
      bulb.position.set(x + .5, 8, z);
      scene.add(bulb);
      lamps.push(bulb);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(5.5, 20), new THREE.MeshBasicMaterial({ color: 0xf6ca7b, transparent: true, opacity: .12, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x + .5, .2, z);
      scene.add(pool);
      bulb.userData.pool = pool;
    }
  }
  return lamps;
}

function addRect(scene, x, z, w, y, d, color) {
  const mesh = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color, roughness: .95 }));
  mesh.position.set(x, y - .05, z);
  mesh.scale.set(w, .15, d);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addSign(scene, x, y, z, label) {
  const board = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x274b4a, emissive: 0x102523 }));
  board.position.set(x, y, z + 28);
  board.scale.set(18, 2.6, .45);
  scene.add(board);
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5c47c'; ctx.font = 'bold 32px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, 128, 43);
  const texture = new THREE.CanvasTexture(canvas);
  const text = new THREE.Mesh(new THREE.PlaneGeometry(17, 2.5), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  text.position.set(x, y, z + 28.25);
  scene.add(text);
}

function makeMotel(scene, obstacles) {
  const base = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xefd1a0 }));
  base.position.set(-180, 5, 180); base.scale.set(44, 10, 26); base.castShadow = true; scene.add(base);
  obstacles.push({ x: -180, z: 180, hx: 23, hz: 14 });
  const garage = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x28b2a8 }));
  garage.position.set(-180, 3, 151); garage.scale.set(18, 6, 10); scene.add(garage);
  addSign(scene, -180, 10, 180, 'PALM MOTEL');
  addRect(scene, -180, 130, 70, .01, 40, 0xb89c72);
  for (let i = 0; i < 4; i++) addPalm(scene, -211 + i * 20, 0, -149);
}

function makePlaza(scene) {
  addRect(scene, 150, -150, 64, .01, 60, 0xd9cba9);
  const mast = new THREE.Mesh(cylinderGeo, new THREE.MeshStandardMaterial({ color: 0x5a6260, metalness: .55, roughness: .45 }));
  mast.position.set(155, 30, -153); mast.scale.set(1.2, 60, 1.2); scene.add(mast);
  for (let y = 20; y < 58; y += 12) {
    const ring = new THREE.Mesh(cylinderGeo, new THREE.MeshStandardMaterial({ color: 0xec994d }));
    ring.position.set(155, y, -153); ring.scale.set(3.5, .65, 3.5); scene.add(ring);
  }
  addSign(scene, 150, 8, -180, 'CIVIC RADIO');
}

function makePort(scene) {
  const port = new THREE.Group();
  scene.add(port);
  scene = port;
  port.position.z = 420;
  for (let i = 0; i < 5; i++) {
    const crate = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd16f48 : 0x3e7678, roughness: .8 }));
    crate.position.set(125 + (i % 3) * 21, 3, -210 + Math.floor(i / 3) * 18);
    crate.scale.set(18, 6, 12); crate.castShadow = true; scene.add(crate);
  }
  const beam = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xe59a47 }));
  beam.position.set(196, 24, -207); beam.scale.set(3, 48, 3); scene.add(beam);
  const arm = new THREE.Mesh(boxGeo, beam.material);
  arm.position.set(180, 47, -207); arm.scale.set(38, 2, 2); arm.rotation.z = -.12; scene.add(arm);
  addSign(scene, 155, 12, -220, 'PORT SOL');
}

function makeDocks(scene) {
  for (let i = 0; i < 4; i++) {
    const container = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: [0x386e70, 0xc76c49, 0xd49b56, 0x527c85][i], roughness: .82 }));
    container.position.set(135 + (i % 2) * 24, 5, 195 + Math.floor(i / 2) * 15);
    container.scale.set(21, 10, 12); container.castShadow = true; scene.add(container);
    for (let stripe = -8; stripe <= 8; stripe += 2) {
      const rib = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x233e3f, roughness: .9 }));
      rib.position.set(container.position.x + stripe, 5, container.position.z - 6.05); rib.scale.set(.12, 9.6, .15); scene.add(rib);
    }
  }
  for (let i = 0; i < 6; i++) {
    const bollard = new THREE.Mesh(cylinderGeo, new THREE.MeshStandardMaterial({ color: 0xe5c77c }));
    bollard.position.set(115 + i * 15, 1, 222); bollard.scale.set(.45, 2, .45); scene.add(bollard);
  }
  addSign(scene, 153, 16, 211, 'PORT SOL / PIER 4');
}

function makeStrip(scene) {
  for (let i = 0; i < 5; i++) {
    const awning = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: i % 2 ? 0xefad69 : 0x268f91 }));
    awning.position.set(-198 + i * 20, 4, -132); awning.scale.set(14, 1.3, 5); scene.add(awning);
  }
  addSign(scene, -150, 13, -180, 'SUNSET STRIP');
}

function makePalms(scene) {
  for (let i = 0; i < 34; i++) {
    const x = -225 + (i * 67) % 450;
    const z = -215 + (i * 113) % 425;
    if (Math.abs(x % 100) < 16 || Math.abs(z % 100) < 16) continue;
    addPalm(scene, x, 0, z);
  }
}

function addPalm(scene, x, y, z) {
  const trunk = new THREE.Mesh(cylinderGeo, new THREE.MeshStandardMaterial({ color: 0x79583b }));
  trunk.position.set(x, 5, z); trunk.scale.set(.65, 10, .65); trunk.rotation.z = -.08; scene.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 4), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x557e55 : 0x739253 }));
    leaf.position.set(x + Math.cos(i) * 3, 10.5, z + Math.sin(i) * 3);
    leaf.rotation.z = -.82; leaf.rotation.y = i; scene.add(leaf);
  }
}

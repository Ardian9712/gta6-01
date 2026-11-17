import * as THREE from 'three';

export function createAtmosphere(scene, world) {
  const stars = new THREE.Group();
  const points = [];
  for (let i = 0; i < 140; i++) {
    const azimuth = i * 2.399963;
    const height = .18 + (i % 37) / 45;
    const radius = Math.sqrt(1 - height * height) * 430;
    points.push(Math.cos(azimuth) * radius, height * 430, Math.sin(azimuth) * radius);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  stars.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xd5e7ff, size: 1.2, transparent: true, opacity: .8 })));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe2eafa }));
  scene.add(moon);
  const cloudLayer = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(9 + (i % 3) * 4, 8, 5), new THREE.MeshBasicMaterial({ color: 0xffd3a0, transparent: true, opacity: .12, depthWrite: false }));
    cloud.scale.y = .2;
    cloud.position.set(-240 + i * 41, 60 + (i % 4) * 8, -160 + (i * 73) % 360);
    cloudLayer.add(cloud);
  }
  scene.add(cloudLayer);
  return { scene, world, stars, moon, cloudLayer, sky: new THREE.Color(), night: 0, weather: 'clear', weatherTime: 0 };
}

export function updateAtmosphere(atmosphere, hour, vehicles, dt = 0) {
  const { scene, world, stars, moon } = atmosphere;
  const solar = Math.sin((hour - 6) / 24 * Math.PI * 2);
  const daylight = THREE.MathUtils.smoothstep(solar, -.2, .32);
  const twilight = 1 - Math.min(1, Math.abs(solar) * 3.2);
  atmosphere.night = 1 - daylight;
  atmosphere.moon.material.color.setHex(hour < 5 ? 0xbad3f5 : 0xe2eafa);
  atmosphere.sky.setHex(0x142d4c).lerp(new THREE.Color(0x9ec9cf), daylight);
  atmosphere.sky.lerp(new THREE.Color(0xe4a06c), twilight * .65);
  scene.background.copy(atmosphere.sky);
  scene.fog.color.copy(atmosphere.sky);
  world.sun.intensity = .2 + daylight * 2.9;
  world.hemi.intensity = .65 + daylight * 1.45;
  world.sun.position.set(Math.cos(hour / 24 * Math.PI * 2) * 200, 30 + Math.max(0, solar) * 240, 120);
  stars.visible = daylight < .35;
  stars.children[0].material.opacity = (1 - daylight) * .8;
  moon.visible = daylight < .6;
  moon.position.set(-180, 180, -290);
  atmosphere.cloudLayer.rotation.y += dt * .01;
  atmosphere.weatherTime += dt;
  if (atmosphere.weatherTime > 90) {
    atmosphere.weatherTime = 0;
    atmosphere.weather = atmosphere.weather === 'clear' ? 'salt haze' : 'clear';
  }
  scene.fog.far = atmosphere.weather === 'salt haze' ? 390 : 610;
  scene.fog.near = atmosphere.weather === 'salt haze' ? 150 : 230;
  for (const lamp of world.lamps) {
    lamp.material.emissiveIntensity = .2 + (1 - daylight) * 3;
    lamp.userData.pool.material.opacity = (1 - daylight) * .17;
  }
  for (const car of vehicles) {
    for (const light of car.userData.lights || []) light.material.emissiveIntensity = .3 + (1 - daylight) * 2;
  }
}

export function atmosphereLabel(atmosphere) {
  return atmosphere.weather === 'salt haze' ? 'SALT HAZE / COASTAL WIND' : atmosphere.night > .65 ? 'NIGHT DRIVE / LIGHTS ON' : 'GOLDEN HOUR / CLEAR';
}

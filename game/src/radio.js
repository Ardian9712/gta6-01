const stations = [
  { name: 'OFF', notes: [], interval: .3, headlines: [] },
  {
    name: 'SOL 88.4 / COASTAL KEYS',
    notes: [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66],
    interval: .32,
    headlines: [
      'Civic Radio: clear skies along the coast. Keep your eyes on the road.',
      'Sol 88.4: an original sunset melody, made for a long drive.',
      'County bulletin: after the broadcast, Mara has two more jobs. Press J at her garage.',
      'County Press is buying landmark photos. V opens your camera; X takes the shot.'
    ]
  },
  {
    name: 'PIER FM / NIGHT SHIFT',
    notes: [164.81, 196, 246.94, 220, 196, 146.83, 164.81, 0],
    interval: .42,
    headlines: [
      'Pier FM: late shift at Port Sol. Watch for trucks at the junctions.',
      'Night Shift: six lost cases, one county. The locals might know something.',
      'Pier FM: keep your sedan in shape. Mara repairs vehicles at the garage.'
    ]
  }
];

export function createRadio() {
  const element = document.createElement('div');
  element.id = 'station';
  document.querySelector('#hud').append(element);
  return { station: 0, note: 0, elapsed: 0, headlineTime: 0, headline: 0, element };
}

export function tuneRadio(radio) {
  radio.station = (radio.station + 1) % stations.length;
  radio.note = 0;
  radio.elapsed = 0;
  radio.headlineTime = 0;
  radio.headline = 0;
  return stations[radio.station].name;
}

export function updateRadio(radio, audio, driving, dt) {
  const station = stations[radio.station];
  radio.element.hidden = !driving;
  if (!driving) return;
  if (!radio.station) {
    radio.element.textContent = 'B — Tune radio / OFF';
    return;
  }
  radio.elapsed += dt;
  radio.headlineTime += dt;
  if (radio.elapsed >= station.interval) {
    radio.elapsed %= station.interval;
    const frequency = station.notes[radio.note % station.notes.length];
    radio.note++;
    if (frequency) audio.radioNote(frequency, station.interval * .8);
  }
  if (radio.headlineTime > 12) {
    radio.headline = (radio.headline + 1) % station.headlines.length;
    radio.headlineTime = 0;
  }
  radio.element.replaceChildren();
  const name = document.createElement('strong');
  name.textContent = `${station.name} / B to tune`;
  const headline = document.createElement('span');
  headline.textContent = station.headlines[radio.headline];
  radio.element.append(name, headline);
}

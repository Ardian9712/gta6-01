export function createAudio() {
  let context = null;
  let oscillator = null;
  let gain = null;
  let muted = false;
  return {
    start() {
      if (context) { context.resume(); return; }
      context = new AudioContext();
      oscillator = context.createOscillator();
      gain = context.createGain();
      oscillator.type = 'sawtooth'; oscillator.frequency.value = 48;
      gain.gain.value = .018;
      oscillator.connect(gain).connect(context.destination); oscillator.start();
    },
    engine(speed, driving = true) {
      if (!oscillator || !context) return;
      oscillator.frequency.setTargetAtTime(42 + Math.abs(speed) * 4.2, context.currentTime, .08);
      gain.gain.setTargetAtTime(driving && !muted ? .018 : 0, context.currentTime, .1);
    },
    click() {
      if (!context) return;
      const osc = context.createOscillator(), level = context.createGain();
      osc.frequency.value = 660; level.gain.setValueAtTime(.07, context.currentTime); level.gain.exponentialRampToValueAtTime(.001, context.currentTime + .09);
      osc.connect(level).connect(context.destination); osc.start(); osc.stop(context.currentTime + .1);
    },
    horn() {
      if (!context) return;
      const osc = context.createOscillator(), level = context.createGain();
      osc.type = 'square'; osc.frequency.value = 185; level.gain.value = .035;
      osc.connect(level).connect(context.destination); osc.start(); osc.stop(context.currentTime + .22);
    },
    shot() {
      if (!context) return;
      const noise = context.createBufferSource(), buffer = context.createBuffer(1, context.sampleRate * .12, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      noise.buffer = buffer;
      const filter = context.createBiquadFilter(), level = context.createGain();
      filter.type = 'lowpass'; filter.frequency.value = 1400;
      level.gain.setValueAtTime(.16, context.currentTime); level.gain.exponentialRampToValueAtTime(.001, context.currentTime + .12);
      noise.connect(filter).connect(level).connect(context.destination); noise.start();
    },
    reward() {
      if (!context || muted) return;
      for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
        const note = context.createOscillator(), envelope = context.createGain();
        const at = context.currentTime + index * .085;
        note.type = 'sine'; note.frequency.value = frequency;
        envelope.gain.setValueAtTime(.001, at);
        envelope.gain.exponentialRampToValueAtTime(.045, at + .015);
        envelope.gain.exponentialRampToValueAtTime(.001, at + .22);
        note.connect(envelope).connect(context.destination);
        note.start(at); note.stop(at + .24);
      }
    },
    toggleMute() {
      muted = !muted;
      if (context) muted ? context.suspend() : context.resume();
      return muted;
    },
    radioNote(frequency, duration = .18) {
      if (!context || muted) return;
      const note = context.createOscillator(), envelope = context.createGain();
      note.type = 'triangle'; note.frequency.value = frequency;
      envelope.gain.setValueAtTime(.016, context.currentTime);
      envelope.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
      note.connect(envelope).connect(context.destination);
      note.start(); note.stop(context.currentTime + duration);
    },
    mission() { this.reward(); },
    checkpoint() {
      this.radioNote(880, .12);
      this.radioNote(1320, .22);
    },
    shutter() {
      if (!context || muted) return;
      const pulse = context.createOscillator();
      const envelope = context.createGain();
      pulse.type = 'square';
      pulse.frequency.setValueAtTime(1200, context.currentTime);
      pulse.frequency.exponentialRampToValueAtTime(180, context.currentTime + .06);
      envelope.gain.setValueAtTime(.025, context.currentTime);
      envelope.gain.exponentialRampToValueAtTime(.001, context.currentTime + .08);
      pulse.connect(envelope).connect(context.destination);
      pulse.start();
      pulse.stop(context.currentTime + .09);
    }
  };
}

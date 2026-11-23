// Web Audio synthesis: engine, siren, rotor, gunfire, explosions and three radio stations.
// Everything is a no-op until a user gesture unlocks the AudioContext, and in headless runs.
import { RADIO, RADIO_OFF } from './config.js';

const STEPS_PER_TRACK = 256;

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let engine = null;
  let siren = null;
  let heli = null;
  let radioOn = true;
  let station = 0;
  let step = 0;
  let nextTime = 0;
  let timer = null;
  const A = { station: 0 };

  /** Curated track for the current station, rotating every STEPS_PER_TRACK sequencer steps. */
  A.track = () => (radioOn ? RADIO[station].tracks[Math.floor(step / STEPS_PER_TRACK) % RADIO[station].tracks.length] : '');
  A.nowPlaying = () => (radioOn ? `${RADIO[station].name} - ${A.track()}` : RADIO_OFF);

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
      engine = ctx.createOscillator();
      engine.type = 'sawtooth';
      const ef = ctx.createBiquadFilter();
      ef.type = 'lowpass';
      ef.frequency.value = 420;
      const eg = ctx.createGain();
      eg.gain.value = 0;
      engine.connect(ef).connect(eg).connect(master);
      engine.start();
      engine.gain = eg;
      siren = ctx.createOscillator();
      siren.type = 'square';
      const sg = ctx.createGain();
      sg.gain.value = 0;
      siren.connect(sg).connect(master);
      siren.start();
      siren.gain = sg;
      timer = setInterval(schedule, 120);
    } catch {
      ctx = null;
    }
  }

  function burst(dur, freq, gain, type = 'bandpass', q = 1, time = null) {
    if (!ctx) return;
    const t0 = time ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function tone(freq, time, dur, type, gain, dest = master) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g).connect(dest);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  const midi = (n) => 440 * 2 ** ((n - 69) / 12);
  const PATTERNS = [
    (i, t, s) => {
      const arp = [57, 60, 64, 67, 69, 67, 64, 60];
      tone(midi(arp[i % 8] + (Math.floor(i / 16) % 2 ? 5 : 0)), t, s * 0.9, 'sawtooth', 0.06);
      if (i % 4 === 0) tone(midi(33), t, s * 3, 'triangle', 0.16);
      if (i % 4 === 2) burst(0.06, 6000, 0.06, 'highpass', 1, t);
    },
    (i, t, s) => {
      if (i % 4 === 0) tone(60, t, 0.18, 'sine', 0.35);
      if (i % 2 === 1) burst(0.05, 8000, 0.05, 'highpass', 1, t);
      if (i % 8 === 4) burst(0.14, 1800, 0.09, 'bandpass', 1, t);
      tone(midi([45, 45, 48, 43][Math.floor(i / 4) % 4] + 12), t, s * 0.7, 'square', 0.035);
    },
    (i, t, s) => {
      if (i % 8 === 0) tone(midi(31), t, s * 5, 'sine', 0.3);
      if (i % 8 === 4) burst(0.18, 900, 0.1, 'bandpass', 1, t);
      if (i % 4 === 2) tone(midi(55 + (i % 16 > 8 ? 3 : 0)), t, s * 1.4, 'triangle', 0.05);
    },
  ];

  function schedule() {
    if (!ctx || !radioOn || ctx.state !== 'running') return;
    const spb = 60 / RADIO[station].bpm / 4;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.35) {
      PATTERNS[station](step, nextTime, spb);
      step += 1;
      nextTime += spb;
    }
  }

  A.unlock = unlock;
  A.toggleRadio = () => {
    unlock();
    station = (station + 1) % (RADIO.length + 1);
    radioOn = station < RADIO.length;
    A.station = station;
    step = 0;
    return A.nowPlaying();
  };
  A.engine = (speed, nitro, driving) => {
    if (!ctx || !engine) return;
    const t = ctx.currentTime;
    engine.frequency.setTargetAtTime(48 + Math.abs(speed) * 3.2 + (nitro ? 30 : 0), t, 0.08);
    engine.gain.gain.setTargetAtTime(driving ? 0.09 : 0, t, 0.1);
  };
  A.siren = (level) => {
    if (!ctx || !siren) return;
    const t = ctx.currentTime;
    siren.frequency.setTargetAtTime(700 + Math.sin(t * 5) * 280, t, 0.02);
    siren.gain.gain.setTargetAtTime(Math.min(0.035, level * 0.035), t, 0.1);
  };
  A.heli = (on) => {
    if (!ctx) return;
    if (on && !heli) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 220;
      const g = ctx.createGain();
      g.gain.value = 0.2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 12;
      const lg = ctx.createGain();
      lg.gain.value = 0.15;
      lfo.connect(lg).connect(g.gain);
      src.connect(f).connect(g).connect(master);
      src.start();
      lfo.start();
      heli = { src, lfo };
    } else if (!on && heli) {
      heli.src.stop();
      heli.lfo.stop();
      heli = null;
    }
  };
  A.shot = (id) => burst(id === 'shotgun' ? 0.22 : 0.09, id === 'pulse' ? 2600 : 1400, id === 'enemy' ? 0.1 : 0.22);
  A.explosion = () => burst(1.2, 120, 0.8, 'lowpass');
  A.crash = (k) => burst(0.25, 500, 0.2 + k * 0.4);
  A.pickup = () => ctx && tone(880, ctx.currentTime, 0.12, 'sine', 0.12);
  A.click = () => ctx && tone(520, ctx.currentTime, 0.05, 'square', 0.05);
  A.alert = () => ctx && tone(330, ctx.currentTime, 0.4, 'sawtooth', 0.07);
  return A;
}

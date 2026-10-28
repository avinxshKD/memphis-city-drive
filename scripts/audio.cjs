'use strict';
// 48 kHz stereo 16-bit, 24 s, -14 LUFS integrated (BS.1770-4). Cue times come from src/events.js.
const fs = require('node:fs');
const path = require('node:path');
const schedule = require('../src/events.js');

const SR = 48000;
const SPF = SR / schedule.fps;                 // 1600 samples per video frame
const BEAT = SR * 60 / schedule.bpm;            // 32000 samples per beat (20 frames)
const N = schedule.frames * SPF;                // 1,152,000 samples = 24.000 s
const TARGET_LUFS = -14;
const CEILING = Math.pow(10, -1.5 / 20);        // sample-peak ceiling, leaves headroom for AAC/true peak
const EV = Object.fromEntries(schedule.events.map(e => [e.name, e.frame]));
const at = name => EV[name] * SPF;
const TAU = Math.PI * 2;

function mulberry32(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Independent stream per component, so editing one part never shifts another's noise.
function rngFor(tag) {
  let h = 2166136261;
  for (const ch of tag) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return mulberry32((schedule.seed ^ h) >>> 0);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const panGains = p => { const a = (clamp(p, -1, 1) + 1) * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; };
const makeBus = () => ({ L: new Float64Array(N), R: new Float64Array(N), sL: new Float64Array(N), sR: new Float64Array(N) });
function clearBus(b) { b.L.fill(0); b.R.fill(0); b.sL.fill(0); b.sR.fill(0); }

function voice(bus, start, len, pan, send, gen) {
  start = Math.round(start);
  const [gl, gr] = panGains(pan);
  const end = Math.min(N, start + len);
  for (let i = Math.max(0, start); i < end; i++) {
    const n = i - start, s = gen(n, n / SR);
    bus.L[i] += s * gl; bus.R[i] += s * gr;
    if (send) { bus.sL[i] += s * gl * send; bus.sR[i] += s * gr * send; }
  }
}

// Chamberlin SVF. Cutoff is clamped to SR/7 to keep it stable.
function svf() {
  let low = 0, band = 0;
  return (x, fc, q = 0.7) => {
    const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 7) / SR);
    low += f * band;
    const high = x - low - band / q;
    band += f * high;
    return { low, band, high };
  };
}

// FM body plus a short 5.4x tine partial.
function kalimba(bus, start, midi, vel = 1, pan = 0, send = 0.35) {
  const f = mtof(midi), decay = 0.5 + 0.25 * (72 / midi);
  voice(bus, start, Math.round(SR * 2.2), pan, send, (n, t) => {
    const env = (1 - Math.exp(-t / 0.0025)) * Math.exp(-t / decay);
    const index = 2.0 * Math.exp(-t / 0.07) + 0.35;
    const body = Math.sin(TAU * f * t + index * Math.sin(TAU * 2 * f * t));
    const tine = 0.22 * Math.sin(TAU * 5.4 * f * t) * Math.exp(-t / 0.045);
    const fourth = 0.12 * Math.sin(TAU * 4 * f * t) * Math.exp(-t / 0.18);
    return 0.2 * vel * env * (body + tine + fourth);
  });
}

// Karplus-Strong with fractional delay for tuning.
function pluck(bus, start, midi, { amp = 0.3, g = 0.996, dur = 2, bright = 0.5, pan = 0, send = 0.2, tag, sub = 0 }) {
  const f = mtof(midi), rng = rngFor(tag), P = SR / f - 0.5;
  const size = Math.ceil(P) + 4, buf = new Float64Array(size);
  const excLen = Math.round(SR / f);
  const exc = new Float64Array(excLen);
  let lp = 0;
  for (let k = 0; k < excLen; k++) { lp += (rng() * 2 - 1 - lp) * bright; exc[k] = lp; }
  let w = 0;
  const read = pos => {
    const i0 = Math.floor(pos), fr = pos - i0;
    const a = buf[((i0 % size) + size) % size], b = buf[(((i0 + 1) % size) + size) % size];
    return a + (b - a) * fr;
  };
  const len = Math.round(SR * dur), fadeLen = Math.round(SR * 0.03);
  voice(bus, start, len, pan, send, (n, t) => {
    const x = n < excLen ? exc[n] : 0;
    const y = x + g * 0.5 * (read(w - P) + read(w - P - 1));
    buf[w % size] = y; w++;
    const tail = n > len - fadeLen ? (len - n) / fadeLen : 1;
    const body = sub ? sub * Math.sin(TAU * f * t) * Math.exp(-t / 0.35) * Math.min(1, t / 0.004) : 0;
    return amp * tail * (y + body);
  });
}

function bell(bus, start, midi, vel = 1, pan = 0, send = 0.5) {
  const f = mtof(midi);
  voice(bus, start, Math.round(SR * 2.5), pan, send, (n, t) => {
    const env = (1 - Math.exp(-t / 0.002)) * Math.exp(-t / 0.7);
    return 0.12 * vel * env * Math.sin(TAU * f * t + 1.8 * Math.exp(-t / 0.4) * Math.sin(TAU * 1.4 * f * t));
  });
}

// Partials capped near 2.4 kHz.
const CHORDS = {
  C6: [48, 55, 64, 69], Am7: [45, 52, 60, 67], Dsus: [50, 57, 62, 67],
  Gsus: [43, 50, 57, 60], Cfin: [48, 55, 64, 72]
};
function pad(bus, startS, endS, chord, brightness, firstChord) {
  const attack = firstChord ? 2.0 : 0.8, release = 1.2;
  const len = Math.round(endS - startS + release * SR), sustainEnd = (endS - startS) / SR;
  for (const m of CHORDS[chord]) {
    for (const [cents, p] of [[-6, -0.55], [6, 0.55]]) {
      const f = mtof(m) * Math.pow(2, cents / 1200), H = clamp(Math.floor(2400 / f), 1, 7);
      voice(bus, startS, len, p, 0.45, (n, t) => {
        const env = smooth(t / attack) * (t > sustainEnd ? Math.max(0, 1 - (t - sustainEnd) / release) : 1);
        const br = brightness((startS + n) / SPF);
        let s = 0;
        for (let k = 1; k <= H; k++) s += Math.sin(TAU * f * k * t + k * 0.7) * Math.pow(br, k - 1) / k;
        return 0.022 * env * s * (1 + 0.08 * Math.sin(TAU * 0.23 * t + m));
      });
    }
  }
}

function beep(bus, start, freq, ms, amp, pan) {
  const len = Math.round(SR * ms / 1000);
  voice(bus, start, len, pan, 0.15, (n, t) => {
    const env = Math.min(1, n / 96, (len - n) / 240);
    return amp * env * (Math.sin(TAU * freq * t) + Math.sin(TAU * 3 * freq * t) / 3 + Math.sin(TAU * 5 * freq * t) / 5);
  });
}

function chirp(bus, start, midi, pan, amp, rng) {
  const f0 = mtof(midi), len = Math.round(SR * (0.055 + rng() * 0.04)), up = rng() < 0.7;
  let ph = 0;
  voice(bus, start, len, pan, 0.3, (n, t) => {
    const u = n / len, f = f0 * (up ? 1 + 0.35 * u : 1.3 - 0.3 * u);
    ph += TAU * f / SR;
    const env = Math.sin(Math.PI * u) ** 2 * (0.75 + 0.25 * Math.sin(TAU * 38 * t));
    return amp * env * Math.sin(ph);
  });
}

// shape(u) -> [gain, cutoffHz], u in 0..1.
function noiseSweep(bus, start, len, pan, send, tag, shape, mode = 'band', q = 1.2) {
  const rng = rngFor(tag), filt = svf();
  voice(bus, start, len, pan, send, n => {
    const [g, fc] = shape(n / len);
    return g * filt(rng() * 2 - 1, fc, q)[mode];
  });
}

const LEAD = [
  [0, 72, 1], [1, 76, 0.5], [1.5, 79, 0.5], [2, 81, 1], [3, 79, 1],
  [4, 76, 0.5], [4.5, 72, 0.5], [5, 69, 1], [6, 72, 0.5], [6.5, 76, 0.5], [7, 74, 1],
  [8, 74, 0.5], [8.5, 69, 0.5], [9, 67, 1], [10, 69, 0.5], [10.5, 72, 0.5], [11, 74, 1],
  [12, 79, 0.5], [12.5, 76, 0.5], [14, 74, 0.5], [14.5, 76, 0.5], [15, 79, 1],
  [16, 81, 0.5], [16.5, 79, 0.5], [17, 76, 1],
  [20, 84, 2], [22.5, 79, 0.5], [23, 76, 1],
  [25, 69, 1], [27, 67, 1],
  [28.5, 74, 0.5], [29, 72, 1], [30, 74, 0.5], [30.5, 76, 0.5],
  [31, 79, 1], [32, 74, 1], [33, 72, 3]
];
const BASS = [[3, 48], [4, 45], [6.5, 52], [8, 50], [10.5, 45], [12, 43], [14.5, 50], [16, 45],
  [20, 48], [22.5, 55], [24, 45], [26.5, 52], [28, 50], [31, 43], [33, 36]];
const beatOf = name => EV[name] / 20;
const CHORD_PLAN = [[0, 'C6'], [4, 'Am7'], [8, 'Dsus'], [12, 'Gsus'], [16, 'Am7'],
  [beatOf('landmark_reveal'), 'C6'], [24, 'Am7'], [28, 'Dsus'], [31, 'Gsus'], [beatOf('music_resolve'), 'Cfin']];

function music(bus) {
  const brightness = frame => 0.42 + 0.16 * smooth((frame - EV.cloud_shadow) / 60);
  CHORD_PLAN.forEach(([b, name], k) => {
    const end = k + 1 < CHORD_PLAN.length ? CHORD_PLAN[k + 1][0] * BEAT : N;
    pad(bus, b * BEAT, end, name, brightness, k === 0);
  });
  const gapA = at('bus_occlusion'), gapB = at('landmark_reveal');
  for (const [b, m] of LEAD) {
    const s = b * BEAT;
    if (s >= gapA && s < gapB) continue;
    kalimba(bus, s, m, 1, Math.sin(b * 0.9) * 0.25);
  }
  BASS.forEach(([b, m], k) => pluck(bus, b * BEAT, m, { amp: 0.42, g: 0.995, dur: 1.8, bright: 0.35, pan: 0, send: 0.08, tag: `bass${k}`, sub: 0.6 }));
}

// Each cue renders standalone so syncReport() can measure it in isolation.
const CUES = [
  { name: 'overpass whoomp', event: 'overpass_whoomp', render(bus) {
    const s = at('overpass_whoomp');
    let ph = 0;
    voice(bus, s, Math.round(SR * 1.4), 0, 0.25, (n, t) => {
      ph += TAU * (38 + 72 * Math.exp(-t / 0.22)) / SR;
      return 0.55 * Math.min(1, t / 0.004) * Math.exp(-t / 0.42) * Math.sin(ph);
    });
    for (const [p, tag] of [[-0.7, 'whoompL'], [0.7, 'whoompR']])
      noiseSweep(bus, s, Math.round(SR * 1.3), p, 0.3, tag, u => [0.9 * Math.min(1, u * 300) * Math.exp(-u * 4), 420 - 300 * u], 'low');
  } },
  { name: 'bird chirp arpeggio', event: 'birds_start', render(bus) {
    const rng = rngFor('birds'), flockPan = f => clamp((-380 + (f - EV.birds_start) * 25) / 960 - 1, -1, 1);
    [96, 98, 100, 103, 105].forEach((m, k) => {
      const f = EV.birds_start + k * 5;
      chirp(bus, f * SPF, m, Math.max(-0.9, flockPan(f + 20)), 0.11, rng);
    });
    const notes = [96, 98, 100, 103, 105, 108];
    for (let f = EV.birds_start + 30; f < EV.overpass_clear; f += 6 + Math.floor(rng() * 9)) {
      chirp(bus, f * SPF + Math.floor(rng() * SPF), notes[Math.floor(rng() * notes.length)], flockPan(f), 0.05 + rng() * 0.04, rng);
      if (rng() < 0.4) chirp(bus, (f + 2) * SPF, notes[Math.floor(rng() * notes.length)], flockPan(f), 0.04, rng);
    }
  } },
  { name: 'green-light beep', event: 'crossing_green', render(bus) {
    beep(bus, at('crossing_green'), 1800, 75, 0.06, 0.6);
    beep(bus, at('crossing_green') + 4 * SPF, 1800, 75, 0.06, 0.6);
  } },
  { name: 'green-light chime', event: 'crossing_green', render(bus) {
    [84, 88, 91].forEach((m, k) => bell(bus, at('crossing_green') + k * 3 * SPF, m, 0.9 - k * 0.15, 0.35));
  } },
  { name: 'bus whoosh', event: 'bus_overtake', render(bus) {
    const s = at('bus_overtake'), len = (EV.landmark_reveal + 15 - EV.bus_overtake) * SPF, peakU = (EV.bus_occlusion - EV.bus_overtake) / (len / SPF);
    const shape = u => {
      const g = u < peakU ? smooth(u / peakU) : Math.exp(-(u - peakU) * 5);
      const fc = u < peakU ? 300 + 1500 * smooth(u / peakU) : 1800 - 1300 * smooth((u - peakU) / (1 - peakU));
      return [0.75 * g, fc];
    };
    noiseSweep(bus, s, len, 0.75, 0.2, 'whooshR', shape, 'band', 0.9);
    noiseSweep(bus, s, len, 0.25, 0.2, 'whooshC', u => { const [g, fc] = shape(u); return [0.35 * g, fc * 0.5]; }, 'band', 0.8);
    let ph = 0;
    voice(bus, s - 10 * SPF, len + 20 * SPF, 0.5, 0, (n, t) => {
      const u = n / (len + 20 * SPF), g = Math.sin(Math.PI * u) ** 2;
      ph += TAU * (52 + 18 * u) / SR;
      return 0.07 * g * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph));
    });
  } },
  { name: 'two-tone horn', event: 'landmark_reveal', render(bus) {
    for (const [off, dur] of [[0, 0.2], [9, 0.38]]) {
      const len = Math.round(SR * dur);
      voice(bus, at('landmark_reveal') + off * SPF, len, 0.4, 0.2, (n, t) => {
        const env = Math.min(1, t / 0.012, (len - n) / (0.05 * SR));
        let s = 0;
        for (const f of [mtof(64), mtof(67)])
          for (let k = 1; k <= 8; k++) s += Math.sin(TAU * f * k * t * (1 + 0.002 * Math.sin(TAU * 6 * t))) / Math.pow(k, 0.85);
        return 0.045 * env * s;
      });
    }
  } },
  { name: 'melody lands on C chord', event: 'landmark_reveal', render(bus) {
    [60, 64, 67, 72].forEach(m => kalimba(bus, at('landmark_reveal'), m, 0.6, 0));
  } },
  { name: 'leaf wake swish', event: 'leaf_release', render(bus) {
    noiseSweep(bus, at('leaf_release'), Math.round(SR * 0.7), 0.2, 0.3, 'leafSwish', u => [0.18 * Math.sin(Math.PI * u) ** 2, 3000 + 2500 * u], 'band', 2);
  } },
  ...[['leaf_spiral_1', 76, 0.1], ['leaf_spiral_2', 79, 0.25], ['leaf_spiral_3', 81, 0.4]].map(([ev, m, p]) => ({
    name: `leaf pizzicato ${mtofName(m)}`, event: ev, render(bus) {
      pluck(bus, at(ev), m, { amp: 0.5, g: 0.982, dur: 0.9, bright: 0.6, pan: p, send: 0.35, tag: ev });
    }
  })),
  { name: 'leaf lands, soft C6', event: 'leaf_land', render(bus) {
    pluck(bus, at('leaf_land'), 84, { amp: 0.3, g: 0.992, dur: 1.6, bright: 0.3, pan: 0.5, send: 0.5, tag: 'leaf_land' });
  } },
  { name: 'resolve arpeggio', event: 'music_resolve', render(bus) {
    [60, 64, 67, 76].forEach((m, k) => kalimba(bus, at('music_resolve') + k * BEAT / 4, m, 0.55, -0.2 + k * 0.13));
  } }
];
function mtofName(m) { return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + (Math.floor(m / 12) - 1); }

function ambience(bus) {
  const rl = rngFor('humL'), rr = rngFor('humR'), rc = rngFor('humC');
  const fl = svf(), fr = svf();
  let bl = 0, br = 0, bc = 0;
  for (let i = 0; i < N; i++) {
    const frame = i / SPF;
    const under = smooth((frame - EV.overpass_enter) / 40) * (1 - smooth((frame - EV.overpass_clear + 10) / 30));
    const fc = 360 - 180 * under, g = (0.9 + 0.5 * under) * (1 + 0.15 * Math.sin(TAU * 0.11 * i / SR));
    bc = bc * 0.995 + (rc() * 2 - 1) * 0.1;
    bl = bl * 0.995 + (rl() * 2 - 1) * 0.1;
    br = br * 0.995 + (rr() * 2 - 1) * 0.1;
    bus.L[i] += g * 0.16 * fl(0.7 * bc + 0.3 * bl, fc).low;
    bus.R[i] += g * 0.16 * fr(0.7 * bc + 0.3 * br, fc).low;
  }
  // No swishes during the bus pass; they mask the whoosh.
  const rng = rngFor('swish');
  for (let t = 0.7; t < 22.5; t += 1.1 + rng() * 0.9) {
    const f = t * schedule.fps;
    if (f > EV.bus_overtake - 15 && f < EV.landmark_reveal + 15) continue;
    const len = Math.round(SR * (0.55 + rng() * 0.35)), pan = (rng() < 0.5 ? -1 : 1) * (0.4 + rng() * 0.45);
    noiseSweep(bus, t * SR, len, pan, 0.05, `swish${Math.round(t * 100)}`, u => [0.16 * Math.sin(Math.PI * u) ** 2, 1500 - 800 * u], 'band', 0.8);
  }
  for (let f = EV.overpass_clear - 40; f < EV.crossing_green; f += 20) beep(bus, f * SPF, 1000, 40, 0.025, 0.6);
  for (let f = EV.pedestrians_walk; f < EV.bus_overtake; f += 10) beep(bus, f * SPF, 1800, 50, 0.028, 0.65);
}

function reverb(inL, inR) {
  const make = (delays, offset) => {
    const combs = delays.map(d => ({ b: new Float64Array(d + offset), i: 0, z: 0 }));
    const aps = [604, 480].map(d => ({ b: new Float64Array(d + offset), i: 0 }));
    return x => {
      let out = 0;
      for (const c of combs) {
        const y = c.b[c.i];
        c.z = y * 0.7 + c.z * 0.3;
        c.b[c.i] = x + c.z * 0.8;
        c.i = (c.i + 1) % c.b.length;
        out += y;
      }
      for (const a of aps) {
        const y = a.b[a.i];
        a.b[a.i] = out + y * 0.5;
        a.i = (a.i + 1) % a.b.length;
        out = y - out;
      }
      return out * 0.18;
    };
  };
  const D = [1693, 1759, 1622, 1547, 1452, 1389];
  const l = make(D, 0), r = make(D, 25);
  const oL = new Float64Array(N), oR = new Float64Array(N);
  for (let i = 0; i < N; i++) { oL[i] = l(inL[i]); oR[i] = r(inR[i]); }
  return [oL, oR];
}

function integratedLoudness(L, R) {
  const kw = x => {
    const out = new Float64Array(x.length);
    const stages = [
      [[1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]],
      [[1, -2, 1], [-1.99004745483398, 0.99007225036621]]
    ];
    out.set(x);
    for (const [[b0, b1, b2], [a1, a2]] of stages) {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < out.length; i++) {
        const xi = out[i], y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = xi; y2 = y1; y1 = y; out[i] = y;
      }
    }
    return out;
  };
  const kl = kw(L), kr = kw(R), block = 0.4 * SR, step = 0.1 * SR, z = [];
  for (let s = 0; s + block <= N; s += step) {
    let a = 0, b = 0;
    for (let i = s; i < s + block; i++) { a += kl[i] * kl[i]; b += kr[i] * kr[i]; }
    z.push((a + b) / block);
  }
  const lk = v => -0.691 + 10 * Math.log10(v);
  const abs = z.filter(v => lk(v) > -70);
  const rel = lk(abs.reduce((p, v) => p + v, 0) / abs.length) - 10;
  const gated = abs.filter(v => lk(v) > rel);
  return lk(gated.reduce((p, v) => p + v, 0) / gated.length);
}

// Offline lookahead limiter: window-min then box-average keeps gain <= required at every peak.
function limit(L, R, ceiling) {
  const W = 240, g = new Float64Array(N);
  for (let i = 0; i < N; i++) g[i] = Math.min(1, ceiling / Math.max(Math.abs(L[i]), Math.abs(R[i]), 1e-12));
  const m = new Float64Array(N), dq = new Int32Array(N);
  let h = 0, t = 0;
  for (let i = N - 1; i >= 0; i--) {
    while (t > h && g[dq[t - 1]] >= g[i]) t--;
    dq[t++] = i;
    while (dq[h] > i + W) h++;
    m[i] = g[dq[h]];
  }
  // Running sum over m[i-W..i]; indices before 0 count as unity gain.
  let acc = W + 1, env = 1;
  const rel = 1 - Math.exp(-1 / (0.08 * SR));
  for (let i = 0; i < N; i++) {
    acc += m[i] - (i - W - 1 >= 0 ? m[i - W - 1] : 1);
    env = Math.min(acc / (W + 1), env + (1 - env) * rel);
    L[i] *= env; R[i] *= env;
  }
}

function render() {
  const bus = makeBus();
  music(bus);
  ambience(bus);
  for (const c of CUES) c.render(bus);
  const [wL, wR] = reverb(bus.sL, bus.sR);
  const L = new Float64Array(N), R = new Float64Array(N);
  const fadeA = at('fade_begin'), fadeB = at('end');
  for (let i = 0; i < N; i++) {
    const fin = Math.min(1, i / (0.05 * SR));
    const fout = i < fadeA ? 1 : 0.5 * (1 + Math.cos(Math.PI * (i - fadeA) / (fadeB - fadeA)));
    L[i] = (bus.L[i] + wL[i]) * fin * fout;
    R[i] = (bus.R[i] + wR[i]) * fin * fout;
  }
  let lufs = integratedLoudness(L, R);
  for (let pass = 0; pass < 6 && Math.abs(lufs - TARGET_LUFS) > 0.02; pass++) {
    const k = Math.pow(10, (TARGET_LUFS - lufs) / 20);
    for (let i = 0; i < N; i++) { L[i] *= k; R[i] *= k; }
    limit(L, R, CEILING);
    lufs = integratedLoudness(L, R);
  }
  return { L, R, lufs };
}

function writeWav(file, L, R) {
  const rng = rngFor('dither'), data = Buffer.alloc(N * 4), q = v => clamp(Math.round(v * 32767 + rng() - rng()), -32768, 32767);
  for (let i = 0; i < N; i++) { data.writeInt16LE(q(L[i]), i * 4); data.writeInt16LE(q(R[i]), i * 4 + 2); }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

// Onset = first sample at -40 dB re. the cue's own peak.
function syncReport() {
  const bus = makeBus(), rows = [];
  for (const c of CUES) {
    clearBus(bus); c.render(bus);
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(bus.L[i]), Math.abs(bus.R[i]));
    let onset = -1, loud = -1;
    for (let i = 0; i < N; i++) {
      const a = Math.max(Math.abs(bus.L[i]), Math.abs(bus.R[i]));
      if (onset < 0 && a >= peak * 0.01) onset = i;
      if (a >= peak * 0.5) { loud = i; break; }
    }
    rows.push({ cue: c.name, event: c.event, eventFrame: EV[c.event], onsetFrame: +(onset / SPF).toFixed(2), halfPeakFrame: +(loud / SPF).toFixed(2) });
  }
  return rows;
}

function main() {
  const out = path.join(__dirname, '..', 'output');
  fs.mkdirSync(out, { recursive: true });
  const t0 = process.hrtime.bigint();
  const { L, R, lufs } = render();
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const wav = path.join(out, 'soundtrack.wav');
  writeWav(wav, L, R);
  const rows = syncReport();
  const md = [
    '# Audio cue sync check', '',
    `Generated by scripts/audio.cjs. 48 kHz stereo, ${N} samples (${(N / SR).toFixed(3)} s). Seed ${schedule.seed}.`,
    `Integrated loudness (internal BS.1770 meter): ${lufs.toFixed(2)} LUFS. Sample peak: ${(20 * Math.log10(peak)).toFixed(2)} dBFS.`, '',
    'Each cue is rendered in isolation. "Onset" is where it first reaches -40 dB of its own peak; "half-peak" is where it reaches -6 dB.', '',
    '| Cue | Event | Event frame | Onset frame | Half-peak frame |', '|---|---|---:|---:|---:|',
    ...rows.map(r => `| ${r.cue} | ${r.event} | ${r.eventFrame} | ${r.onsetFrame} | ${r.halfPeakFrame} |`)
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(out, 'audio_sync.md'), md);
  console.log(md);
  console.log(`wrote ${wav} in ${(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1)} s`);
}
main();

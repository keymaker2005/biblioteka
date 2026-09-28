// js/muzyka.js
// Fala 3 — muzyka: nokturny Chopina (Musopen, CC0 — assets/muzyka/README.md) przepuszczone
// przez „lo-fi”: ciepły filtr dolnoprzepustowy, lekkie falowanie tempa (wow), szum taśmy,
// rzadkie trzaski winylu i opcjonalny, bardzo cichy rytm (stopa + werbel + hi-hat, ~68 BPM).
// Start dopiero po geście użytkownika (wymóg iOS), pauza gdy karta jest w tle.

import { getAudioContext, unlockAudio, getMusicSettings, onMusicSettingsChange } from "./sound.js";

const TRACKS = [
  "assets/muzyka/nokturn-op9-nr2.mp3",
  "assets/muzyka/nokturn-op9-nr1.mp3",
  "assets/muzyka/nokturn-op72-nr1.mp3",
];
const FADE = 3; // s — płynne przejście między utworami
const BPM = 68;

let ctx = null;
let audioEl = null;
let master = null; // całość muzyki (głośność z ustawień × ducking)
let musicGain = null; // sam fortepian (fade in/out utworów)
let beatGain = null;
let noiseGain = null;
let started = false;
let order = [];
let current = -1;
let duck = 1;
let beatTimer = null;
let crackleTimer = null;
let settings = getMusicSettings();

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function targetVolume() {
  return settings.on ? settings.volume * duck : 0;
}

function applyVolume(rampS = 0.6) {
  if (!master) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setTargetAtTime(targetVolume() * 0.9, t, rampS / 3);
  if (beatGain) beatGain.gain.setTargetAtTime(settings.beat ? 0.16 : 0, t, 0.3);
}

function buildGraph() {
  ctx = getAudioContext();
  if (!ctx) return false;
  audioEl = new Audio();
  audioEl.preload = "auto";
  audioEl.crossOrigin = "anonymous";
  const src = ctx.createMediaElementSource(audioEl);

  musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 4200;
  lowpass.Q.value = 0.5;
  const warmth = ctx.createBiquadFilter();
  warmth.type = "lowshelf";
  warmth.frequency.value = 220;
  warmth.gain.value = 3;

  master = ctx.createGain();
  master.gain.value = 0;
  src.connect(warmth).connect(lowpass).connect(musicGain).connect(master);
  master.connect(ctx.destination);

  // Szum taśmy — pętla szumu przez pasmowy filtr, bardzo cicho.
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  const hiss = ctx.createBufferSource();
  hiss.buffer = buf;
  hiss.loop = true;
  const hissBp = ctx.createBiquadFilter();
  hissBp.type = "bandpass";
  hissBp.frequency.value = 5200;
  hissBp.Q.value = 0.4;
  noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.012;
  hiss.connect(hissBp).connect(noiseGain).connect(master);
  hiss.start();

  beatGain = ctx.createGain();
  beatGain.gain.value = settings.beat ? 0.16 : 0;
  beatGain.connect(master);

  audioEl.addEventListener("timeupdate", () => {
    if (audioEl.duration && audioEl.duration - audioEl.currentTime < FADE && !audioEl.dataset.fading) {
      audioEl.dataset.fading = "1";
      musicGain.gain.setTargetAtTime(0, ctx.currentTime, FADE / 3);
    }
  });
  audioEl.addEventListener("ended", playNext);
  audioEl.addEventListener("error", () => setTimeout(playNext, 1000));
  return true;
}

function playNext() {
  if (!order.length || current >= order.length - 1) {
    order = shuffle([...TRACKS]);
    current = -1;
  }
  current++;
  audioEl.dataset.fading = "";
  audioEl.src = order[current];
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setValueAtTime(0, ctx.currentTime);
  musicGain.gain.setTargetAtTime(1, ctx.currentTime + 0.1, FADE / 3);
  const p = audioEl.play();
  if (p && p.catch) p.catch(() => {});
}

// --- Rytm lo-fi (syntetyczny, z lekkim swingiem) ---------------------------

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}

function kick(t) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g).connect(beatGain);
  o.start(t);
  o.stop(t + 0.4);
}

function snare(t) {
  const s = noise();
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800;
  bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  s.connect(bp).connect(g).connect(beatGain);
  s.start(t);
  s.stop(t + 0.2);
}

function hat(t, gain) {
  const s = noise();
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  s.connect(hp).connect(g).connect(beatGain);
  s.start(t);
  s.stop(t + 0.06);
}

let nextBar = 0;
function scheduleBeat() {
  const beat = 60 / BPM;
  const now = ctx.currentTime;
  if (nextBar < now) nextBar = now + 0.1;
  // Planujemy z wyprzedzeniem ~1 takt; timer co 0,5 s.
  while (nextBar < now + 1.2) {
    const t = nextBar;
    kick(t);
    kick(t + beat * 2.5);
    snare(t + beat);
    snare(t + beat * 3);
    for (let i = 0; i < 8; i++) {
      const swing = i % 2 ? beat * 0.08 : 0;
      hat(t + (i * beat) / 2 + swing, i % 2 ? 0.06 : 0.1);
    }
    nextBar += beat * 4;
  }
  beatTimer = setTimeout(scheduleBeat, 500);
}

function scheduleCrackle() {
  if (ctx && settings.on) {
    const s = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2500 + Math.random() * 3000;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.05 + Math.random() * 0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    s.connect(bp).connect(g).connect(master);
    s.start(t);
    s.stop(t + 0.02);
  }
  crackleTimer = setTimeout(scheduleCrackle, 300 + Math.random() * 2200);
}

// „Wow” (falowanie tempa) wyłączone w 0.5: każda zmiana playbackRate w Safari na iPadzie
// powodowała krótkie zacięcie odtwarzania (zgłoszenie właściciela: „muzyka się przycina”).

// --- Publiczne API -----------------------------------------------------------

/** Wywoływać w obsłudze gestu (np. przycisk na ekranie powitalnym). Bezpieczne wielokrotnie. */
export function startMusic() {
  unlockAudio();
  if (!started) {
    if (!buildGraph()) return;
    started = true;
    order = shuffle([...TRACKS]);
    playNext();
    scheduleBeat();
    scheduleCrackle();
  } else if (audioEl.paused && settings.on && document.visibilityState === "visible") {
    const p = audioEl.play();
    if (p && p.catch) p.catch(() => {});
  }
  applyVolume();
}

/** Ściszenie o połowę, gdy otwarte jest okno (rozkładówka, menu, ustawienia). */
export function setDucked(on) {
  duck = on ? 0.5 : 1;
  applyVolume();
}

export function isMusicPlaying() {
  return !!audioEl && !audioEl.paused;
}

onMusicSettingsChange((s) => {
  settings = s;
  if (!started) return;
  if (settings.on && audioEl.paused && document.visibilityState === "visible") {
    const p = audioEl.play();
    if (p && p.catch) p.catch(() => {});
  }
  applyVolume();
});

document.addEventListener("visibilitychange", () => {
  if (!started) return;
  if (document.visibilityState === "hidden") {
    audioEl.pause();
    if (ctx && ctx.state === "running") ctx.suspend();
  } else {
    if (ctx && ctx.state === "suspended") ctx.resume();
    if (settings.on) {
      const p = audioEl.play();
      if (p && p.catch) p.catch(() => {});
    }
  }
});

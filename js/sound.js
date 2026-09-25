// js/sound.js
// Wszystkie dźwięki gry są syntezowane na żywo przez Web Audio API — brak plików audio.
// iOS wymaga, żeby AudioContext powstał (albo się wznowił) dopiero po geście użytkownika,
// dlatego kontekst tworzymy leniwie w unlock().

let ctx = null;
let soundsOn = true;

// Zaczep pod muzykę (etap 4 — sama muzyka nie gra jeszcze, tylko zapamiętujemy ustawienie).
let musicSettings = { on: true, volume: 0.7 };

export function setMusicSettings(opts = {}) {
  musicSettings = { ...musicSettings, ...opts };
}

export function getMusicSettings() {
  return { ...musicSettings };
}

export function setSoundsEnabled(on) {
  soundsOn = !!on;
}

export function getSoundsEnabled() {
  return soundsOn;
}

/** Tworzy AudioContext przy pierwszym dotknięciu ekranu i go wznawia, jeśli jest uśpiony. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  } catch (err) {
    // Brak dźwięku nie może wywrócić gry.
    console.warn("Audio niedostępne:", err);
  }
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function shouldPlay() {
  return !!ctx && soundsOn;
}

/** Prosty obwiedniowy generator tonu (oscylator + gałka głośności z ADSR w pigułce). */
function tone({ freq, duration, type = "sine", gain = 0.2, startAt = 0, freqEnd = null }) {
  if (!ctx) return;
  const t0 = now() + startAt;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
  }
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Krótki szum (do „drewnianego” stuku) — filtrowany biały szum przez krótką obwiednię. */
function noiseKnock({ startAt = 0, duration = 0.07, gain = 0.35, filterFreq = 900 }) {
  if (!ctx) return;
  const t0 = now() + startAt;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // Szum z opadającą obwiednią — brzmi jak stuk, nie syk.
    const decay = 1 - i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * decay;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.1;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

/** Dobre odłożenie książki: krótki drewniany stuk. */
export function playPlaceGood() {
  if (!shouldPlay()) return;
  noiseKnock({ duration: 0.09, gain: 0.4, filterFreq: 750 });
  tone({ freq: 180, duration: 0.12, type: "triangle", gain: 0.12, startAt: 0.01 });
}

/** Pomyłka: łagodny, niski ton — bez poczucia kary. */
export function playMistake() {
  if (!shouldPlay()) return;
  tone({ freq: 160, freqEnd: 110, duration: 0.35, type: "sine", gain: 0.15 });
}

/** Ukończenie regału: krótki akord. */
export function playShelfComplete() {
  if (!shouldPlay()) return;
  const chord = [261.63, 329.63, 392.0, 523.25]; // C-dur, z oktawą na górze
  chord.forEach((freq, i) => {
    tone({ freq, duration: 0.9, type: "sine", gain: 0.1, startAt: i * 0.03 });
  });
}

/** Krótki cichy szum przecierania kurzu/pajęczyny — wywoływany co kilka ruchów podczas gestu. */
export function playWipe() {
  if (!shouldPlay()) return;
  noiseKnock({ duration: 0.1, gain: 0.09, filterFreq: 2600 });
}

/** Kurz/pajęczyna znikają do końca — miękki, jasny szum. */
export function playDustGone() {
  if (!shouldPlay()) return;
  noiseKnock({ duration: 0.28, gain: 0.16, filterFreq: 1800 });
  tone({ freq: 660, freqEnd: 990, duration: 0.22, type: "sine", gain: 0.06, startAt: 0.02 });
}

/** Otwarcie szuflady biurka. */
export function playDrawer() {
  if (!shouldPlay()) return;
  noiseKnock({ duration: 0.22, gain: 0.22, filterFreq: 420 });
}

/** Szelest kryjówki (fotel, zasłona) albo odłożenie kartki do teczki. */
export function playPaper() {
  if (!shouldPlay()) return;
  noiseKnock({ duration: 0.16, gain: 0.18, filterFreq: 3200 });
}

/** Zapalenie kinkietu/żyrandola: ciepłe, krótkie „puff”. */
export function playCandle() {
  if (!shouldPlay()) return;
  tone({ freq: 520, freqEnd: 300, duration: 0.3, type: "sine", gain: 0.1 });
  noiseKnock({ duration: 0.06, gain: 0.12, filterFreq: 1200, startAt: 0.01 });
}

/** Bonus „Dobra epoka!” — mała złota iskra dźwiękowa. */
export function playEpochBonus() {
  if (!shouldPlay()) return;
  tone({ freq: 880, duration: 0.16, type: "sine", gain: 0.09 });
  tone({ freq: 1320, duration: 0.18, type: "sine", gain: 0.07, startAt: 0.05 });
}

/** Bonus „Ład chronologiczny” — cały regał ma dobrą epokę: mały arpeggio. */
export function playChronologyStar() {
  if (!shouldPlay()) return;
  [523.25, 659.25, 784.0, 1046.5].forEach((freq, i) => {
    tone({ freq, duration: 0.5, type: "sine", gain: 0.09, startAt: i * 0.05 });
  });
}

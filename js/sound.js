// js/sound.js
// Wszystkie dźwięki gry są syntezowane na żywo przez Web Audio API — brak plików audio.
// iOS wymaga, żeby AudioContext powstał (albo się wznowił) dopiero po geście użytkownika,
// dlatego kontekst tworzymy leniwie w unlock().

let ctx = null;

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
  if (!ctx) return;
  noiseKnock({ duration: 0.09, gain: 0.4, filterFreq: 750 });
  tone({ freq: 180, duration: 0.12, type: "triangle", gain: 0.12, startAt: 0.01 });
}

/** Pomyłka: łagodny, niski ton — bez poczucia kary. */
export function playMistake() {
  if (!ctx) return;
  tone({ freq: 160, freqEnd: 110, duration: 0.35, type: "sine", gain: 0.15 });
}

/** Ukończenie regału: krótki akord. */
export function playShelfComplete() {
  if (!ctx) return;
  const chord = [261.63, 329.63, 392.0, 523.25]; // C-dur, z oktawą na górze
  chord.forEach((freq, i) => {
    tone({ freq, duration: 0.9, type: "sine", gain: 0.1, startAt: i * 0.03 });
  });
}

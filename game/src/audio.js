// All sound is synthesised with WebAudio: no audio files are shipped. The context
// is created lazily on the first user gesture (browsers block audio before one),
// and every call is a no-op until then, so the screenshot scenes stay silent.

let context = null;
let master = null;
let muted = false;
let musicTimer = null;
let musicStep = 0;

/** Call from a user gesture (start, click) to unlock sound. */
export function unlockAudio() {
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') void context.resume();
  } catch {
    // No audio on this machine: the game plays silently.
  }
}

export function setMuted(value) {
  muted = value;
  if (master && context) master.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

function tone({ type = 'square', from = 440, to = 440, seconds = 0.08, volume = 0.2, when = 0 }) {
  if (!context || !master || muted) return;
  try {
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  } catch {
    // Ignore a failed blip; the game goes on.
  }
}

function noise({ seconds = 0.2, volume = 0.25, from = 1200, to = 200, when = 0 }) {
  if (!context || !master || muted) return;
  try {
    const t0 = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  } catch {
    // Ignore a failed burst; the game goes on.
  }
}

export const sfx = {
  shoot() {
    tone({ type: 'square', from: 920, to: 420, seconds: 0.07, volume: 0.1 });
  },
  hit() {
    noise({ seconds: 0.08, volume: 0.16, from: 2400, to: 500 });
  },
  explode() {
    noise({ seconds: 0.35, volume: 0.3, from: 900, to: 90 });
    tone({ type: 'sine', from: 160, to: 40, seconds: 0.3, volume: 0.28 });
  },
  hurt() {
    tone({ type: 'sawtooth', from: 220, to: 70, seconds: 0.25, volume: 0.25 });
    noise({ seconds: 0.15, volume: 0.2, from: 1600, to: 300 });
  },
  pickup() {
    tone({ type: 'sine', from: 660, to: 660, seconds: 0.09, volume: 0.18 });
    tone({ type: 'sine', from: 990, to: 990, seconds: 0.12, volume: 0.18, when: 0.08 });
  },
  dash() {
    noise({ seconds: 0.16, volume: 0.14, from: 3000, to: 500 });
  },
  wave() {
    tone({ type: 'sawtooth', from: 196, to: 196, seconds: 0.35, volume: 0.14 });
    tone({ type: 'sawtooth', from: 294, to: 294, seconds: 0.35, volume: 0.14, when: 0.05 });
  },
  boss() {
    tone({ type: 'sawtooth', from: 98, to: 49, seconds: 0.7, volume: 0.26 });
    noise({ seconds: 0.5, volume: 0.2, from: 500, to: 80 });
  },
  win() {
    for (let i = 0; i < 4; i += 1) {
      tone({ type: 'sine', from: 523 + i * 131, to: 523 + i * 131, seconds: 0.18, volume: 0.18, when: i * 0.13 });
    }
  },
};

/** A quiet bass pulse with a sparse arpeggio, scheduled a bar ahead. */
const BASS = [55, 0, 65.4, 0, 49, 0, 73.4, 0, 55, 0, 65.4, 0, 82.4, 73.4, 65.4, 0];
const ARP = [220, 277.2, 329.6, 440, 329.6, 277.2];

export function startMusic() {
  if (!context || musicTimer !== null) return;
  musicStep = 0;
  musicTimer = window.setInterval(() => {
    if (!context || muted) return;
    const bass = BASS[musicStep % BASS.length];
    if (bass > 0) tone({ type: 'triangle', from: bass, to: bass, seconds: 0.22, volume: 0.1 });
    if (musicStep % 2 === 0) {
      const note = ARP[(musicStep / 2) % ARP.length | 0];
      tone({ type: 'sine', from: note, to: note, seconds: 0.3, volume: 0.045 });
    }
    musicStep += 1;
  }, 210);
}

export function stopMusic() {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}

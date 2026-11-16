// LUMENFALL — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Waves: 10 to win. A boss (the Warden) guards waves 5 and 10. */
export const WAVES_TO_WIN = 10;
export const BOSS_WAVES = [5, 10];

export const PLAYER = {
  radius: 14,
  speed: 340,
  maxHp: 3,
  fireInterval: 0.14,
  bulletSpeed: 760,
  bulletDamage: 1,
  dashSpeed: 920,
  dashTime: 0.22,
  dashCooldown: 1.4,
  invulnerable: 1.2,
  pickupRadius: 26,
};

export const WEAPONS = {
  spreadSeconds: 12,
  overchargeSeconds: 10,
  overchargeRate: 0.45, // fire interval multiplier while overcharged
};

/** Combo: each kill inside the window raises the multiplier, up to x8. */
export const COMBO = { window: 3, max: 8 };

export const ENEMY = {
  drifter: { radius: 16, hp: 2, speed: 92, score: 10, touch: 1 },
  weaver: { radius: 13, hp: 1, speed: 175, score: 15, touch: 1 },
  spitter: { radius: 15, hp: 2, speed: 72, score: 20, touch: 1, range: 260, shotInterval: 2.2, orbSpeed: 210 },
  brute: { radius: 26, hp: 9, speed: 54, score: 40, touch: 1 },
  boss: { radius: 48, hp: 130, speed: 46, score: 500, touch: 2 },
};

/** Spawn budget per wave: points spent on enemies (drifter 1, weaver 1, spitter 2, brute 3). */
export const WAVE = {
  baseBudget: 6,
  budgetPerWave: 4,
  spawnInterval: 0.85,
  spawnIntervalMin: 0.3,
  betweenSeconds: 3,
  healEveryWaves: 2,
};

export const PICKUP = {
  dropChance: 0.13,
  heart: 0.14,
  spread: 0.28,
  shield: 0.28,
  overcharge: 0.3,
  lifeSeconds: 9,
  radius: 13,
};

export const PALETTE = {
  backdrop: '#070a18',
  nebulaA: '#131a3a',
  nebulaB: '#241335',
  grid: '#1a2340',
  player: '#5ef2ff',
  playerCore: '#e8feff',
  bullet: '#aef7ff',
  drifter: '#ff4fd8',
  weaver: '#4fd8ff',
  spitter: '#ff9a3d',
  brute: '#ff4d5e',
  boss: '#c04dff',
  orb: '#ffb14d',
  heart: '#ff5d7a',
  spread: '#ffd94d',
  shield: '#7dffb0',
  overcharge: '#c9a6ff',
  shard: '#8ef7d2',
  panel: '#0d1330',
  text: '#eef1f5',
  muted: '#8b93b8',
  gold: '#ffd94d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumenfall.best';

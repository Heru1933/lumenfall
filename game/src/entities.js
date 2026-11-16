// The things that move: the player ship, four enemy kinds plus the Warden boss,
// player bullets, enemy orbs, pickups, particles and floating score texts.
// Each factory returns a plain object; the world owns the lists and steps them.

import { ENEMY, FIELD, PICKUP, PLAYER, WAVE } from './config.js';
import { weightedPick } from './random.js';

let nextId = 1;

export function makePlayer() {
  return {
    id: nextId,
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    invulnerable: 0,
    shield: false,
    spreadTimer: 0,
    overchargeTimer: 0,
    thrust: 0,
  };
}

const ENEMY_KINDS = ['drifter', 'weaver', 'spitter', 'brute'];

function edgeSpawn(random) {
  const side = Math.floor(random() * 4);
  const margin = 30;
  if (side === 0) return { x: margin + random() * (FIELD.width - margin * 2), y: -margin };
  if (side === 1) return { x: margin + random() * (FIELD.width - margin * 2), y: FIELD.height + margin };
  if (side === 2) return { x: -margin, y: margin + random() * (FIELD.height - margin * 2) };
  return { x: FIELD.width + margin, y: margin + random() * (FIELD.height - margin * 2) };
}

export function makeEnemy(kind, wave, random, boss = false) {
  const spec = ENEMY[kind];
  const at = edgeSpawn(random);
  const hpScale = 1 + Math.max(0, wave - 1) * 0.12;
  return {
    id: nextId,
    kind,
    x: at.x,
    y: at.y,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: spec.radius,
    hp: Math.round(spec.hp * hpScale),
    maxHp: Math.round(spec.hp * hpScale),
    speed: spec.speed * (1 + Math.min(0.6, (wave - 1) * 0.05)),
    score: spec.score,
    touch: spec.touch,
    shotTimer: 1 + random() * 1.5,
    phase: random() * Math.PI * 2,
    boss,
    flash: 0,
  };
}

export function makeBoss(wave, random) {
  const enemy = makeEnemy('boss', wave, random, true);
  enemy.x = FIELD.width / 2;
  enemy.y = -70;
  enemy.enterY = 110;
  enemy.burstTimer = 2;
  enemy.summoned = false;
  return enemy;
}

/** The wave's spawn queue: a list of kinds, boss included, shuffled by the seed. */
export function buildWaveQueue(wave, random) {
  const budget = WAVE.baseBudget + WAVE.budgetPerWave * wave;
  const queue = [];
  let spent = 0;
  const table = [
    { value: 'drifter', weight: 10 },
    { value: 'weaver', weight: wave >= 2 ? 6 : 0 },
    { value: 'spitter', weight: wave >= 3 ? 5 : 0 },
    { value: 'brute', weight: wave >= 4 ? 4 : 0 },
  ];
  while (spent < budget) {
    const kind = weightedPick(random, table);
    const cost = kind === 'brute' ? 3 : kind === 'spitter' ? 2 : 1;
    if (spent + cost > budget && queue.length > 0) break;
    queue.push(kind);
    spent += cost;
  }
  // Shuffle so the wave never opens the same way twice.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

export function makeBullet(x, y, angle, speed, damage, friendly) {
  return {
    id: nextId,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: friendly ? 5 : 7,
    damage,
    friendly,
    life: 1.6,
  };
}

export function makePickup(kind, x, y) {
  return { id: nextId, kind, x, y, radius: PICKUP.radius, life: PICKUP.lifeSeconds, phase: 0 };
}

export function rollPickup(random) {
  if (random() > PICKUP.dropChance) return null;
  const roll = random();
  if (roll < PICKUP.heart) return 'heart';
  if (roll < PICKUP.heart + PICKUP.spread) return 'spread';
  if (roll < PICKUP.heart + PICKUP.spread + PICKUP.shield) return 'shield';
  return 'overcharge';
}

export function makeParticle(x, y, vx, vy, life, size, colour) {
  return { id: nextId, x, y, vx, vy, life, maxLife: life, size, colour };
}

export function burstParticles(list, x, y, colour, count, speed, random) {
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const v = speed * (0.3 + random() * 0.7);
    list.push(makeParticle(x, y, Math.cos(angle) * v, Math.sin(angle) * v, 0.4 + random() * 0.5, 2 + random() * 3, colour));
  }
}

export function makeFloatText(x, y, text, colour) {
  return { id: nextId, x, y, text, colour, life: 0.9, maxLife: 0.9 };
}

export { ENEMY_KINDS };

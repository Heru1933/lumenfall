// The world: one game state, stepped in fixed 1/60 s slices. It owns the player,
// the enemies, the bullets, the pickups and the particles, the wave queue, the
// combo multiplier and the score, and answers each step with event flags so the
// loop can play sounds and announce what happened.

import {
  BOSS_WAVES,
  COMBO,
  ENEMY,
  FIELD,
  PICKUP,
  PLAYER,
  STEP,
  WAVE,
  WAVES_TO_WIN,
  WEAPONS,
} from './config.js';
import {
  buildWaveQueue,
  burstParticles,
  makeBoss,
  makeBullet,
  makeEnemy,
  makeFloatText,
  makePickup,
  makePlayer,
  rollPickup,
} from './entities.js';
import { sfx } from './audio.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_WAVE = 4;
export const EVENT_BOSS = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_PICKUP = 64;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(random) {
  const state = {
    player: makePlayer(),
    enemies: [],
    bullets: [],
    orbs: [],
    pickups: [],
    particles: [],
    texts: [],
    wave: 0,
    score: 0,
    best: 0,
    kills: 0,
    combo: 1,
    comboTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    betweenTimer: 0,
    phase: 'title', // title | play | over | win
    time: 0,
    shake: 0,
    hitStop: 0,
    boss: null,
    demo: false,
    endless: false,
  };

  function startWave() {
    state.wave += 1;
    state.spawnQueue = buildWaveQueue(state.wave, random);
    state.spawnTimer = 0.5;
    state.betweenTimer = 0;
    if (BOSS_WAVES.includes(state.wave) || (state.endless && state.wave % 5 === 0)) {
      state.boss = makeBoss(state.wave, random);
      state.enemies.push(state.boss);
    }
    sfx.wave();
    if (state.boss) sfx.boss();
  }

  function reset() {
    state.player = makePlayer();
    state.enemies = [];
    state.bullets = [];
    state.orbs = [];
    state.pickups = [];
    state.particles = [];
    state.texts = [];
    state.wave = 0;
    state.score = 0;
    state.kills = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.betweenTimer = 0;
    state.phase = 'play';
    state.time = 0;
    state.shake = 0;
    state.hitStop = 0;
    state.boss = null;
    state.endless = false;
    startWave();
  }

  function addScore(base, x, y) {
    const gained = base * state.combo;
    state.score += gained;
    state.texts.push(makeFloatText(x, y, `+${gained}`, '#ffd94d'));
    return gained;
  }

  function damagePlayer(amount) {
    const player = state.player;
    if (player.invulnerable > 0 || player.dashTimer > 0 || state.demo) return 0;
    if (player.shield) {
      player.shield = false;
      player.invulnerable = PLAYER.invulnerable;
      burstParticles(state.particles, player.x, player.y, '#7dffb0', 14, 260, random);
      return 2; // shield absorbed it
    }
    player.hp -= amount;
    player.invulnerable = PLAYER.invulnerable;
    state.combo = 1;
    state.comboTimer = 0;
    state.shake = Math.min(1, state.shake + 0.7);
    burstParticles(state.particles, player.x, player.y, '#ff4d5e', 18, 320, random);
    sfx.hurt();
    if (player.hp <= 0) {
      state.phase = 'over';
      burstParticles(state.particles, player.x, player.y, '#5ef2ff', 46, 420, random);
      burstParticles(state.particles, player.x, player.y, '#e8feff', 24, 300, random);
      sfx.explode();
      return EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function killEnemy(enemy, index) {
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.combo = Math.min(COMBO.max, state.combo + 1);
    state.comboTimer = COMBO.window;
    addScore(enemy.score, enemy.x, enemy.y);
    const colours = { drifter: '#ff4fd8', weaver: '#4fd8ff', spitter: '#ff9a3d', brute: '#ff4d5e', boss: '#c04dff' };
    burstParticles(state.particles, enemy.x, enemy.y, colours[enemy.kind] ?? '#ffffff', enemy.boss ? 60 : 16, enemy.boss ? 480 : 300, random);
    if (enemy.kind === 'brute') {
      for (let i = 0; i < 2; i += 1) {
        const child = makeEnemy('drifter', state.wave, random);
        child.x = clamp(enemy.x + (i === 0 ? -20 : 20), 20, FIELD.width - 20);
        child.y = clamp(enemy.y, 20, FIELD.height - 20);
        state.enemies.push(child);
      }
    }
    if (enemy.boss) {
      state.boss = null;
      state.shake = 1;
      state.hitStop = 0.09;
      sfx.explode();
      if (state.wave >= WAVES_TO_WIN && !state.endless) {
        state.phase = 'win';
        sfx.win();
        return EVENT_WIN;
      }
    } else if (enemy.kind === 'brute') {
      sfx.explode();
    } else {
      sfx.hit();
    }
    const drop = rollPickup(random);
    if (drop) state.pickups.push(makePickup(drop, enemy.x, enemy.y));
    return EVENT_KILL;
  }

  function fireBullet(angle) {
    const player = state.player;
    const nose = player.radius + 8;
    state.bullets.push(
      makeBullet(
        player.x + Math.cos(angle) * nose,
        player.y + Math.sin(angle) * nose,
        angle,
        PLAYER.bulletSpeed,
        PLAYER.bulletDamage,
        true,
      ),
    );
    state.particles.push({
      id: 0,
      x: player.x + Math.cos(angle) * nose,
      y: player.y + Math.sin(angle) * nose,
      vx: Math.cos(angle) * 60,
      vy: Math.sin(angle) * 60,
      life: 0.12,
      maxLife: 0.12,
      size: 3,
      colour: '#aef7ff',
    });
  }

  function stepPlayer(dt, input) {
    const player = state.player;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.spreadTimer = Math.max(0, player.spreadTimer - dt);
    player.overchargeTimer = Math.max(0, player.overchargeTimer - dt);
    player.thrust = Math.max(0, player.thrust - dt * 3);

    const aimDx = input.aimX - player.x;
    const aimDy = input.aimY - player.y;
    if (Math.abs(aimDx) > 2 || Math.abs(aimDy) > 2) player.angle = Math.atan2(aimDy, aimDx);

    if (input.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      const mx = input.moveX;
      const my = input.moveY;
      const len = Math.hypot(mx, my);
      if (len > 0.1) {
        player.dashX = mx / len;
        player.dashY = my / len;
      } else {
        player.dashX = Math.cos(player.angle);
        player.dashY = Math.sin(player.angle);
      }
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.05);
      sfx.dash();
    }

    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.x += player.dashX * PLAYER.dashSpeed * dt;
      player.y += player.dashY * PLAYER.dashSpeed * dt;
    } else {
      player.x += input.moveX * PLAYER.speed * dt;
      player.y += input.moveY * PLAYER.speed * dt;
      if (input.moveX !== 0 || input.moveY !== 0) player.thrust = 1;
    }
    player.x = clamp(player.x, player.radius, FIELD.width - player.radius);
    player.y = clamp(player.y, player.radius, FIELD.height - player.radius);

    player.fireTimer -= dt;
    if (input.firing && player.fireTimer <= 0) {
      const interval = PLAYER.fireInterval * (player.overchargeTimer > 0 ? WEAPONS.overchargeRate : 1);
      player.fireTimer = interval;
      fireBullet(player.angle);
      if (player.spreadTimer > 0) {
        fireBullet(player.angle - 0.22);
        fireBullet(player.angle + 0.22);
      }
      sfx.shoot();
    }
  }

  function stepEnemies(dt) {
    const player = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      enemy.flash = Math.max(0, enemy.flash - dt * 4);
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      if (enemy.kind === 'drifter') {
        enemy.x += nx * enemy.speed * dt;
        enemy.y += ny * enemy.speed * dt;
        enemy.angle = Math.atan2(dy, dx);
      } else if (enemy.kind === 'weaver') {
        enemy.phase += dt * 5;
        const px = -ny;
        const py = nx;
        const sway = Math.sin(enemy.phase) * 120;
        enemy.x += (nx * enemy.speed + px * sway) * dt;
        enemy.y += (ny * enemy.speed + py * sway) * dt;
        enemy.angle = Math.atan2(dy, dx);
      } else if (enemy.kind === 'spitter') {
        if (dist > ENEMY.spitter.range + 40) {
          enemy.x += nx * enemy.speed * dt;
          enemy.y += ny * enemy.speed * dt;
        } else if (dist < ENEMY.spitter.range - 60) {
          enemy.x -= nx * enemy.speed * 0.6 * dt;
          enemy.y -= ny * enemy.speed * 0.6 * dt;
        }
        enemy.angle = Math.atan2(dy, dx);
        enemy.shotTimer -= dt;
        if (enemy.shotTimer <= 0 && dist < 520) {
          enemy.shotTimer = ENEMY.spitter.shotInterval;
          state.orbs.push(makeBullet(enemy.x, enemy.y, Math.atan2(dy, dx), ENEMY.spitter.orbSpeed, 1, false));
        }
      } else if (enemy.kind === 'brute') {
        enemy.x += nx * enemy.speed * dt;
        enemy.y += ny * enemy.speed * dt;
        enemy.angle += dt * 0.8;
      } else if (enemy.kind === 'boss') {
        if (enemy.y < enemy.enterY) {
          enemy.y += 60 * dt;
        } else {
          enemy.phase += dt;
          enemy.x += Math.cos(enemy.phase * 0.7) * 70 * dt;
          enemy.y += Math.sin(enemy.phase * 1.3) * 24 * dt;
          enemy.angle = Math.atan2(dy, dx);
          enemy.burstTimer -= dt;
          if (enemy.burstTimer <= 0) {
            enemy.burstTimer = 2.4;
            const count = 10 + Math.floor(state.wave / 2);
            for (let k = 0; k < count; k += 1) {
              const a = (k / count) * Math.PI * 2 + enemy.phase;
              state.orbs.push(makeBullet(enemy.x, enemy.y, a, 170, 1, false));
            }
            sfx.boss();
          }
          if (!enemy.summoned && enemy.hp <= enemy.maxHp / 2) {
            enemy.summoned = true;
            for (let k = 0; k < 3; k += 1) {
              const child = makeEnemy('drifter', state.wave, random);
              child.x = clamp(enemy.x + (k - 1) * 60, 20, FIELD.width - 20);
              child.y = clamp(enemy.y + 40, 20, FIELD.height - 20);
              state.enemies.push(child);
            }
          }
        }
      }

      // Foes stay inside the field where the player can see and shoot them.
      // The boss alone may hang off the top edge while it slides in.
      if (enemy.kind === 'boss') {
        enemy.x = clamp(enemy.x, -40, FIELD.width + 40);
        enemy.y = clamp(enemy.y, -40, FIELD.height + 40);
      } else {
        enemy.x = clamp(enemy.x, enemy.radius, FIELD.width - enemy.radius);
        enemy.y = clamp(enemy.y, enemy.radius, FIELD.height - enemy.radius);
      }
    }
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
      }
    }
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const orb = state.orbs[i];
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.life -= dt;
      if (orb.life <= 0 || orb.x < -20 || orb.x > FIELD.width + 20 || orb.y < -20 || orb.y > FIELD.height + 20) {
        state.orbs.splice(i, 1);
      }
    }
  }

  function stepCollisions() {
    let events = 0;
    const player = state.player;

    // Player bullets vs enemies.
    for (let b = state.bullets.length - 1; b >= 0; b -= 1) {
      const bullet = state.bullets[b];
      let consumed = false;
      for (let e = state.enemies.length - 1; e >= 0; e -= 1) {
        const enemy = state.enemies[e];
        const rr = enemy.radius + bullet.radius;
        if ((bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2 <= rr * rr) {
          enemy.hp -= bullet.damage;
          enemy.flash = 1;
          burstParticles(state.particles, bullet.x, bullet.y, '#aef7ff', 3, 140, random);
          state.bullets.splice(b, 1);
          consumed = true;
          if (enemy.hp <= 0) {
            const result = killEnemy(enemy, e);
            events |= result;
            if (result & EVENT_WIN) return events;
          }
          break;
        }
      }
      if (consumed) continue;
    }

    // Enemy orbs vs player.
    for (let o = state.orbs.length - 1; o >= 0; o -= 1) {
      const orb = state.orbs[o];
      const rr = player.radius + orb.radius;
      if ((orb.x - player.x) ** 2 + (orb.y - player.y) ** 2 <= rr * rr) {
        state.orbs.splice(o, 1);
        const result = damagePlayer(1);
        events |= result;
        if (result & EVENT_OVER) return events;
      }
    }

    // Enemies touching the player.
    for (let e = state.enemies.length - 1; e >= 0; e -= 1) {
      const enemy = state.enemies[e];
      const rr = player.radius + enemy.radius;
      if ((enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2 <= rr * rr) {
        const result = damagePlayer(enemy.touch);
        events |= result;
        // A touch knocks the enemy back so one touch is not a chain of hits.
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / dist) * 30;
        enemy.y += (dy / dist) * 30;
        if (result & EVENT_OVER) return events;
      }
    }

    // Pickups.
    for (let p = state.pickups.length - 1; p >= 0; p -= 1) {
      const pickup = state.pickups[p];
      pickup.phase += STEP * 3;
      pickup.life -= STEP;
      if (pickup.life <= 0) {
        state.pickups.splice(p, 1);
        continue;
      }
      if (distance(pickup.x, pickup.y, player.x, player.y) <= player.radius + PICKUP.radius + PLAYER.pickupRadius) {
        state.pickups.splice(p, 1);
        applyPickup(pickup.kind);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function applyPickup(kind) {
    const player = state.player;
    if (kind === 'heart') {
      player.hp = Math.min(PLAYER.maxHp, player.hp + 1);
      state.texts.push(makeFloatText(player.x, player.y - 24, '+1 HULL', '#ff5d7a'));
    } else if (kind === 'spread') {
      player.spreadTimer = WEAPONS.spreadSeconds;
      state.texts.push(makeFloatText(player.x, player.y - 24, 'TRIPLE SHOT', '#ffd94d'));
    } else if (kind === 'shield') {
      player.shield = true;
      state.texts.push(makeFloatText(player.x, player.y - 24, 'SHIELD', '#7dffb0'));
    } else if (kind === 'overcharge') {
      player.overchargeTimer = WEAPONS.overchargeSeconds;
      state.texts.push(makeFloatText(player.x, player.y - 24, 'OVERCHARGE', '#c9a6ff'));
    }
    sfx.pickup();
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.2;
      p.vy *= 1 - dt * 2.2;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.y -= 34 * dt;
      t.life -= dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 2.4);
  }

  function stepSpawning(dt) {
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval - state.wave * 0.05);
        // A long queue sends pairs, so the field stays busy instead of
        // trickling one foe at a time.
        const batch = state.spawnQueue.length > 10 ? 2 : 1;
        for (let i = 0; i < batch && state.spawnQueue.length > 0; i += 1) {
          const kind = state.spawnQueue.shift();
          state.enemies.push(makeEnemy(kind, state.wave, random));
        }
      }
      return 0;
    }
    if (state.enemies.length === 0 && !state.boss) {
      // Wave cleared.
      if (state.wave >= WAVES_TO_WIN && !state.endless) return 0;
      if (state.wave % WAVE.healEveryWaves === 0 && state.player.hp < PLAYER.maxHp) {
        state.player.hp += 1;
      }
      state.betweenTimer += dt;
      if (state.betweenTimer >= WAVE.betweenSeconds) {
        startWave();
        return EVENT_WAVE;
      }
    }
    return 0;
  }

  function step(dt, input) {
    if (state.hitStop > 0) {
      state.hitStop -= dt;
      return 0;
    }
    state.time += dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
    let events = 0;
    stepPlayer(dt, input);
    stepEnemies(dt);
    stepBullets(dt);
    events |= stepCollisions();
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
    events |= stepSpawning(dt);
    stepParticles(dt);
    return events;
  }

  /** The title screen's demo: the world plays itself, and the player cannot die. */
  function stepDemo(dt) {
    state.demo = true;
    if (state.wave === 0) startWave();
    const player = state.player;
    let nearest = null;
    let nearestDist = Infinity;
    for (const enemy of state.enemies) {
      const d = distance(enemy.x, enemy.y, player.x, player.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = enemy;
      }
    }
    const input = {
      moveX: 0,
      moveY: 0,
      aimX: nearest ? nearest.x : player.x,
      aimY: nearest ? nearest.y : player.y - 100,
      firing: true,
      dash: false,
    };
    if (nearest) {
      const dx = player.x - nearest.x;
      const dy = player.y - nearest.y;
      const len = Math.hypot(dx, dy) || 1;
      if (nearestDist < 150) {
        input.moveX = dx / len;
        input.moveY = dy / len;
      } else if (nearestDist > 320) {
        input.moveX = -dx / len;
        input.moveY = -dy / len;
      }
    }
    step(dt, input);
    state.demo = false;
  }

  /** After a victory, keep playing: waves continue past 10, a boss every 5. */
  function continueEndless() {
    state.endless = true;
    state.phase = 'play';
    state.betweenTimer = 0;
    startWave();
  }

  return { state, reset, step, stepDemo, startWave, continueEndless };
}

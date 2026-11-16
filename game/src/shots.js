// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (keep a healthy distance, aim at the nearest foe, fire always,
// dash out of trouble), so the frame is what a short game really looks like and
// the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const BOSS_SECONDS = 12;
const END_LIMIT_SECONDS = 600;

/**
 * The autopilot's steering for one step: move, aim and fire. It is deliberately
 * human-like — its aim wanders and it does not fire every step — so enemies
 * survive long enough for a screenshot to show a real fight, and so a human
 * player is not outclassed by the staging pilot. A precise pilot (exact aim,
 * constant fire) is used only for the boss scene, where survival matters more
 * than looking human.
 */
function autopilot(state, cautious, rnd, precise = false) {
  const player = state.player;
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = enemy;
    }
  }
  let moveX = 0;
  let moveY = 0;
  let dash = false;
  if (nearest) {
    const dx = player.x - nearest.x;
    const dy = player.y - nearest.y;
    const len = Math.hypot(dx, dy) || 1;
    if (cautious) {
      if (nearestDist < 170) {
        moveX = dx / len;
        moveY = dy / len;
      } else if (nearestDist > 340) {
        moveX = -dx / len;
        moveY = -dy / len;
      } else {
        // Strafe, so the frame shows motion rather than a stand-off.
        moveX = (-dy / len) * 0.6;
        moveY = (dx / len) * 0.6;
      }
      if (nearestDist < 70) dash = true;
    } else {
      // Reckless: chase the nearest foe and never dash, so it dies.
      moveX = -dx / len;
      moveY = -dy / len;
    }
  }
  // Dodge incoming orbs by sidestepping, and dash clear of a dense burst.
  let nearOrbs = 0;
  for (const orb of state.orbs) {
    const d = Math.hypot(orb.x - player.x, orb.y - player.y);
    if (d < 110) {
      nearOrbs += 1;
      if (cautious) {
        const px = -orb.vy;
        const py = orb.vx;
        const len = Math.hypot(px, py) || 1;
        moveX += (px / len) * 0.8;
        moveY += (py / len) * 0.8;
      }
    }
  }
  if (cautious && nearOrbs >= 2) dash = true;
  const mag = Math.hypot(moveX, moveY);
  if (mag > 1) {
    moveX /= mag;
    moveY /= mag;
  }
  // Aim at the nearest foe with a wander, and fire in bursts, not constantly.
  // A precise pilot aims exactly and fires constantly.
  let aimX = player.x + Math.cos(player.angle) * 100;
  let aimY = player.y + Math.sin(player.angle) * 100;
  let firing = false;
  if (nearest) {
    const wander = precise ? 0 : (rnd() - 0.5) * 0.35;
    const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x) + wander;
    aimX = player.x + Math.cos(angle) * nearestDist;
    aimY = player.y + Math.sin(angle) * nearestDist;
    firing = precise || (nearestDist < 560 && rnd() < 0.8);
  }
  return {
    moveX,
    moveY,
    aimX,
    aimY,
    firing,
    dash,
  };
}

function runFor(world, seconds, cautious, precise = false) {
  const rnd = createRandom(20261117);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilot(world.state, cautious, rnd, precise));
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    // Stop at the first busy moment (at least 6 foes alive, past the opening
    // seconds) instead of a fixed clock time, so the frame always shows a fight.
    const rnd = createRandom(20261117);
    let elapsed = 0;
    while (elapsed < 45) {
      const events = world.step(STEP, autopilot(world.state, true, rnd));
      elapsed += STEP;
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      if (elapsed > 8 && world.state.enemies.length >= 6) break;
    }
    const over = world.state.phase === 'over';
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    // Jump to wave 5: clear the opening wave and start the Warden's.
    world.state.enemies = [];
    world.state.spawnQueue = [];
    world.state.wave = 4;
    world.startWave();
    runFor(world, BOSS_SECONDS, true, true);
    const over = world.state.phase === 'over';
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    runFor(world, END_LIMIT_SECONDS, false);
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // start: the title over a live demo game.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.stepDemo(STEP);
  return { screen: SCREEN_TITLE, best: 0 };
}

export { FIELD };

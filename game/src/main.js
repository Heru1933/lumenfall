// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// game over and victory (with endless mode after a win).
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|boss|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_OVER, EVENT_WAVE, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { isMuted, setMuted, startMusic, stopMusic, unlockAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { drawScreen } from './ui.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** How long a wave banner stays up, in seconds. */
const BANNER_SECONDS = 2.2;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null);
    drawScreen(canvas.getContext('2d'), scene.screen, world.state, scene.best, 0, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let banner = null;
  let lastWave = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    unlockAudio();
    startMusic();
    world.reset();
    accumulator = 0;
    lastWave = 1;
    banner = { text: 'WAVE 1', sub: 'The void stirs — good hunting', until: performance.now() / 1000 + BANNER_SECONDS, alpha: 1 };
    screen = SCREEN_PLAY;
    announce('Playing. Wave 1. Survive 10 waves.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    stopMusic();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Victory. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      setMuted(!isMuted());
      announce(isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_WIN) {
      world.continueEndless();
      banner = { text: 'ENDLESS', sub: 'The waves keep coming', until: performance.now() / 1000 + BANNER_SECONDS, alpha: 1 };
      screen = SCREEN_PLAY;
      announce('Endless mode. How far can you go?');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.stepDemo(STEP);
      return;
    }
    const move = input.moveVector();
    const aim = input.aim();
    const events = world.step(STEP, {
      moveX: move.x,
      moveY: move.y,
      aimX: aim.x,
      aimY: aim.y,
      firing: input.isFiring(),
      dash: Boolean(actions & ACTION_DASH),
    });
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_WIN) winGame();
    else if (events & EVENT_HIT) {
      announce(world.state.player.hp === 1 ? 'Hit. 1 hull left.' : `Hit. ${world.state.player.hp} hull left.`);
    }
    if (events & EVENT_WAVE) {
      banner = { text: `WAVE ${world.state.wave}`, sub: world.state.boss ? 'THE WARDEN APPROACHES' : 'Hold the light', until: performance.now() / 1000 + BANNER_SECONDS, alpha: 1 };
      lastWave = world.state.wave;
      announce(`Wave ${world.state.wave}.`);
    }
    if (world.state.wave !== lastWave && screen === SCREEN_PLAY) lastWave = world.state.wave;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const nowSeconds = now / 1000;
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input.takeActions());
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(input.takeActions());
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    let activeBanner = null;
    if (banner && nowSeconds < banner.until) {
      activeBanner = { ...banner, alpha: Math.min(1, (banner.until - nowSeconds) / 0.6) };
    } else {
      banner = null;
    }
    const ctx = canvas.getContext('2d');
    renderer.draw(world.state, screen, best, activeBanner);
    drawScreen(ctx, screen, world.state, best, nowSeconds, isMuted());
  }

  // Leaving the tab pauses a running game rather than letting enemies close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lumenfall. Press Enter or click to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

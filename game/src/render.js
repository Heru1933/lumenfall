// The renderer: draws the world on a canvas. The playfield is a fixed 1280x720
// logical area scaled to the window; glow sprites are pre-rendered once per
// colour and shape so the frame stays fast with many entities on screen.

import { FIELD, FONT, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const STAR_COUNT = 110;

/** A radial glow disc, cached by colour and size. */
const spriteCache = new Map();
function glowSprite(colour, size) {
  const key = `${colour}|${size}`;
  let sprite = spriteCache.get(key);
  if (sprite) return sprite;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, colour);
  gradient.addColorStop(0.35, colour);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  sprite = canvas;
  spriteCache.set(key, sprite);
  return sprite;
}

function drawGlow(ctx, x, y, radius, colour, alpha = 1) {
  const size = radius * 4;
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(colour, 64), x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    stars.push({
      x: Math.random() * FIELD.width,
      y: Math.random() * FIELD.height,
      size: 0.6 + Math.random() * 1.6,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.5,
    });
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = FIELD.width * dpr;
    canvas.height = FIELD.height * dpr;
    ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawBackground(time) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Two slow nebulae.
    drawGlow(ctx, FIELD.width * 0.22, FIELD.height * 0.3, 260, PALETTE.nebulaA, 0.55);
    drawGlow(ctx, FIELD.width * 0.8, FIELD.height * 0.72, 300, PALETTE.nebulaB, 0.5);
    // Faint grid.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 80) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Drifting stars.
    for (const star of stars) {
      const y = (star.y + time * star.speed * 8) % FIELD.height;
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(time * 2 + star.twinkle);
      ctx.fillStyle = '#cfe6ff';
      ctx.fillRect(star.x, y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(player, time) {
    if (player.invulnerable > 0 && Math.floor(time * 14) % 2 === 0) return; // blink while invulnerable
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    drawGlow(ctx, 0, 0, 34, PALETTE.player, 0.7);
    // Engine flame.
    if (player.thrust > 0) {
      const flame = 10 + Math.sin(time * 40) * 4;
      ctx.fillStyle = '#ffb14d';
      ctx.beginPath();
      ctx.moveTo(-12, -5);
      ctx.lineTo(-12 - flame, 0);
      ctx.lineTo(-12, 5);
      ctx.closePath();
      ctx.fill();
    }
    // Hull: a swept dart.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -11);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(2, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Shield ring.
    if (player.shield) {
      ctx.strokeStyle = PALETTE.shield;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 6);
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Dash cooldown arc.
    if (player.dashCooldown > 0) {
      const frac = 1 - player.dashCooldown / 1.4;
      ctx.strokeStyle = PALETTE.muted;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 14, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemy(enemy, time) {
    const flash = enemy.flash > 0;
    const colour = {
      drifter: PALETTE.drifter,
      weaver: PALETTE.weaver,
      spitter: PALETTE.spitter,
      brute: PALETTE.brute,
      boss: PALETTE.boss,
    }[enemy.kind];
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    drawGlow(ctx, 0, 0, enemy.radius * 1.8, colour, 0.55);
    ctx.rotate(enemy.angle);
    ctx.fillStyle = flash ? '#ffffff' : colour;
    ctx.strokeStyle = flash ? '#ffffff' : colour;
    ctx.lineWidth = 2;
    if (enemy.kind === 'drifter') {
      ctx.beginPath();
      ctx.moveTo(enemy.radius, 0);
      ctx.lineTo(0, enemy.radius * 0.7);
      ctx.lineTo(-enemy.radius, 0);
      ctx.lineTo(0, -enemy.radius * 0.7);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'weaver') {
      ctx.beginPath();
      ctx.moveTo(enemy.radius, 0);
      ctx.lineTo(-enemy.radius * 0.7, enemy.radius * 0.6);
      ctx.lineTo(-enemy.radius * 0.3, 0);
      ctx.lineTo(-enemy.radius * 0.7, -enemy.radius * 0.6);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'spitter') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * enemy.radius;
        const y = Math.sin(a) * enemy.radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.backdrop;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'brute') {
      ctx.beginPath();
      ctx.rect(-enemy.radius * 0.8, -enemy.radius * 0.8, enemy.radius * 1.6, enemy.radius * 1.6);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-enemy.radius * 0.4, -enemy.radius * 0.4);
      ctx.lineTo(enemy.radius * 0.4, enemy.radius * 0.4);
      ctx.moveTo(enemy.radius * 0.4, -enemy.radius * 0.4);
      ctx.lineTo(-enemy.radius * 0.4, enemy.radius * 0.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // The Warden: a ringed core that breathes.
      const pulse = 1 + Math.sin(time * 3) * 0.06;
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Health bar for tough foes.
    if ((enemy.kind === 'brute' || enemy.kind === 'boss') && enemy.hp < enemy.maxHp) {
      const w = enemy.radius * 2;
      const y = enemy.y - enemy.radius - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(enemy.x - w / 2, y, w, 5);
      ctx.fillStyle = colour;
      ctx.fillRect(enemy.x - w / 2, y, w * (enemy.hp / enemy.maxHp), 5);
    }
  }

  function drawBullets(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bullet of state.bullets) {
      drawGlow(ctx, bullet.x, bullet.y, 10, PALETTE.bullet, 0.9);
      ctx.strokeStyle = PALETTE.bullet;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.012, bullet.y - bullet.vy * 0.012);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }
    for (const orb of state.orbs) {
      drawGlow(ctx, orb.x, orb.y, 14, PALETTE.orb, 0.9);
      ctx.fillStyle = PALETTE.orb;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPickups(state, time) {
    for (const pickup of state.pickups) {
      const bob = Math.sin(time * 4 + pickup.phase) * 3;
      const y = pickup.y + bob;
      const colours = { heart: PALETTE.heart, spread: PALETTE.spread, shield: PALETTE.shield, overcharge: PALETTE.overcharge };
      const colour = colours[pickup.kind];
      drawGlow(ctx, pickup.x, y, 20, colour, 0.7);
      ctx.fillStyle = colour;
      ctx.font = `bold 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const glyph = { heart: '♥', spread: '✦', shield: '◈', overcharge: '⚡' }[pickup.kind];
      ctx.fillText(glyph, pickup.x, y + 1);
      if (pickup.life < 3 && Math.floor(time * 6) % 2 === 0) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = colour;
        ctx.beginPath();
        ctx.arc(pickup.x, y, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawParticles(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.colour;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best) {
    const player = state.player;
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(String(state.score).padStart(6, '0'), 24, 44);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 24, 66);
    // Combo multiplier.
    if (state.combo > 1) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText(`x${state.combo} COMBO`, 24, 96);
      ctx.fillStyle = 'rgba(255,217,77,0.35)';
      ctx.fillRect(24, 104, 90 * (state.comboTimer / 3), 4);
    }
    // Wave, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(state.boss ? `WAVE ${state.wave} — THE WARDEN` : `WAVE ${state.wave} / 10`, FIELD.width / 2, 40);
    // Boss bar.
    if (state.boss) {
      const w = 420;
      const x = FIELD.width / 2 - w / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, 52, w, 10);
      ctx.fillStyle = PALETTE.boss;
      ctx.fillRect(x, 52, w * Math.max(0, state.boss.hp / state.boss.maxHp), 10);
    }
    // Hull hearts, top right.
    ctx.textAlign = 'right';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < player.hp ? PALETTE.heart : 'rgba(255,93,122,0.25)';
      ctx.font = '22px sans-serif';
      ctx.fillText('♥', FIELD.width - 24 - i * 30, 44);
    }
    // Active weapon timers.
    ctx.font = `bold 14px ${FONT}`;
    let line = 72;
    if (player.spreadTimer > 0) {
      ctx.fillStyle = PALETTE.spread;
      ctx.fillText(`TRIPLE ${Math.ceil(player.spreadTimer)}s`, FIELD.width - 24, line);
      line += 20;
    }
    if (player.overchargeTimer > 0) {
      ctx.fillStyle = PALETTE.overcharge;
      ctx.fillText(`OVERCHARGE ${Math.ceil(player.overchargeTimer)}s`, FIELD.width - 24, line);
      line += 20;
    }
    if (player.shield) {
      ctx.fillStyle = PALETTE.shield;
      ctx.fillText('SHIELD', FIELD.width - 24, line);
    }
    // Dash hint, bottom right.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(player.dashCooldown > 0 ? 'DASH…' : 'SPACE — DASH', FIELD.width - 24, FIELD.height - 20);
  }

  function draw(state, screen, best, banner) {
    ctx.save();
    if (state.shake > 0) {
      const mag = state.shake * 9;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    drawBackground(state.time);
    for (const enemy of state.enemies) drawEnemy(enemy, state.time);
    drawPickups(state, state.time);
    drawBullets(state);
    if (state.phase !== 'over') drawPlayer(state.player, state.time);
    drawParticles(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
    if (banner) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, banner.alpha);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 44px ${FONT}`;
      ctx.fillText(banner.text, FIELD.width / 2, FIELD.height / 2 - 40);
      ctx.font = `18px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(banner.sub, FIELD.width / 2, FIELD.height / 2 - 8);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  return { draw, resize };
}

// The screens drawn over the world: title, paused, game over and victory.
// Each one is plain canvas text and panels, so the screenshots show exactly
// what a player sees.

import { FIELD, FONT, PALETTE } from './config.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_TITLE, SCREEN_WIN } from './render.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(7,10,24,0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(94,242,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function centred(ctx, text, y, font, colour) {
  ctx.font = font;
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, FIELD.width / 2, y);
}

function blink(time) {
  return 0.55 + 0.45 * Math.sin(time * 4);
}

export function drawScreen(ctx, screen, state, best, time, muted) {
  if (screen === SCREEN_TITLE) {
    ctx.fillStyle = 'rgba(7,10,24,0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(ctx, FIELD.width / 2 - 330, 120, 660, 420);
    centred(ctx, 'LUMENFALL', 190, `bold 72px ${FONT}`, PALETTE.player);
    centred(ctx, 'a neon arena shooter', 232, `italic 20px ${FONT}`, PALETTE.muted);
    centred(ctx, 'Survive 10 waves. Break the Warden. Keep the light.', 292, `18px ${FONT}`, PALETTE.text);
    centred(ctx, 'WASD / ARROWS — fly      MOUSE — aim      HOLD CLICK — fire', 340, `16px ${FONT}`, PALETTE.text);
    centred(ctx, 'SPACE — dash through danger      P — pause      M — mute', 368, `16px ${FONT}`, PALETTE.text);
    centred(ctx, 'Chain kills to raise your combo. Grab hearts, shields,', 404, `16px ${FONT}`, PALETTE.muted);
    centred(ctx, 'triple shot and overcharge. Bosses guard waves 5 and 10.', 428, `16px ${FONT}`, PALETTE.muted);
    if (best > 0) centred(ctx, `BEST  ${best}`, 472, `bold 20px ${FONT}`, PALETTE.gold);
    ctx.globalAlpha = blink(time);
    centred(ctx, 'CLICK OR PRESS ENTER TO PLAY', 512, `bold 20px ${FONT}`, PALETTE.text);
    ctx.globalAlpha = 1;
    return;
  }

  if (screen === SCREEN_PAUSED) {
    ctx.fillStyle = 'rgba(7,10,24,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    centred(ctx, 'PAUSED', FIELD.height / 2 - 30, `bold 52px ${FONT}`, PALETTE.text);
    centred(ctx, `Score ${state.score}   •   Wave ${state.wave}   •   ${muted ? 'Muted' : 'Sound on (M)'}`, FIELD.height / 2 + 24, `18px ${FONT}`, PALETTE.muted);
    centred(ctx, 'P or click to resume', FIELD.height / 2 + 62, `16px ${FONT}`, PALETTE.text);
    return;
  }

  if (screen === SCREEN_OVER) {
    ctx.fillStyle = 'rgba(20,6,16,0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(ctx, FIELD.width / 2 - 300, 150, 600, 380);
    centred(ctx, 'THE LIGHT GOES OUT', 210, `bold 48px ${FONT}`, PALETTE.brute);
    centred(ctx, `You fell on wave ${state.wave}`, 268, `20px ${FONT}`, PALETTE.text);
    centred(ctx, `SCORE  ${state.score}`, 322, `bold 30px ${FONT}`, PALETTE.gold);
    centred(ctx, `${state.kills} voidborn destroyed   •   Best ${Math.max(best, state.score)}`, 362, `17px ${FONT}`, PALETTE.muted);
    centred(ctx, state.score >= best && state.score > 0 ? 'A new best score.' : 'The arena remembers its best.', 396, `17px ${FONT}`, PALETTE.muted);
    ctx.globalAlpha = blink(time);
    centred(ctx, 'CLICK OR PRESS ENTER TO FLY AGAIN', 486, `bold 19px ${FONT}`, PALETTE.text);
    ctx.globalAlpha = 1;
    return;
  }

  if (screen === SCREEN_WIN) {
    ctx.fillStyle = 'rgba(7,18,24,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(ctx, FIELD.width / 2 - 320, 140, 640, 400);
    centred(ctx, 'THE WARDEN FALLS', 200, `bold 52px ${FONT}`, PALETTE.gold);
    centred(ctx, 'Ten waves. The arena is yours, and the light holds.', 252, `19px ${FONT}`, PALETTE.text);
    centred(ctx, `SCORE  ${state.score}`, 310, `bold 32px ${FONT}`, PALETTE.gold);
    centred(ctx, `${state.kills} voidborn destroyed   •   Best ${Math.max(best, state.score)}`, 352, `17px ${FONT}`, PALETTE.muted);
    centred(ctx, 'Endless mode: the waves keep coming. How far can you go?', 390, `17px ${FONT}`, PALETTE.muted);
    ctx.globalAlpha = blink(time);
    centred(ctx, 'CLICK OR PRESS ENTER FOR ENDLESS', 494, `bold 19px ${FONT}`, PALETTE.text);
    ctx.globalAlpha = 1;
  }
}

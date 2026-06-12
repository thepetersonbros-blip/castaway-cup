import { FISH } from '../../shared/constants';
import type { FishPub } from '../../shared/protocol';
import { game, nameOf, colorIdxOf } from '../state';
import { chip, colorOf, txt, type GameView } from './common';

function poolRect(w: number, h: number): { x: number; y: number; pw: number; ph: number } {
  const top = h * 0.14;
  const scale = Math.min((w * 0.94) / FISH.poolW, (h * 0.8) / FISH.poolH);
  const pw = FISH.poolW * scale;
  const ph = FISH.poolH * scale;
  return { x: (w - pw) / 2, y: top + (h * 0.8 - ph) / 2, pw, ph };
}

export const fishView: GameView = {
  render(ctx, w, h, state: FishPub, now) {
    const { x, y, pw, ph } = poolRect(w, h);
    // scores row
    const per = Math.min(150, w / Math.max(1, state.scores.length));
    state.scores.forEach((s, i) => {
      const cx = w / 2 + (i - (state.scores.length - 1) / 2) * per;
      chip(ctx, cx - 30, h * 0.07, colorIdxOf(s.slot), `${nameOf(s.slot)} ${s.score}`, 13);
      if (s.cd && s.slot === game.you.slot) {
        txt(ctx, 'reloading...', cx, h * 0.07 + 18, 11, '#9fb3bf');
      }
    });
    // pool
    const water = ctx.createLinearGradient(0, y, 0, y + ph);
    water.addColorStop(0, '#2fb3a8');
    water.addColorStop(1, '#114a55');
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 18);
    ctx.fill();
    ctx.strokeStyle = '#e8d8a8';
    ctx.lineWidth = 5;
    ctx.stroke();
    const sx = pw / FISH.poolW;
    const sy = ph / FISH.poolH;
    // fish
    for (const f of state.fish) {
      const fx = x + f.x * sx;
      const fy = y + f.y * sy;
      const size = f.kind === 'small' ? 9 : f.kind === 'gold' ? 11 : 14;
      const col = f.kind === 'gold' ? '#ffd84a' : f.kind === 'small' ? '#9adcf0' : '#5a9ad0';
      if (f.kind === 'gold') {
        ctx.fillStyle = '#ffd84a44';
        ctx.beginPath();
        ctx.arc(fx, fy, size * 2 + Math.sin(now / 150) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(fx, fy, size, size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fx - f.dir * size, fy);
      ctx.lineTo(fx - f.dir * (size + 7), fy - 5);
      ctx.lineTo(fx - f.dir * (size + 7), fy + 5);
      ctx.fill();
      ctx.fillStyle = '#10202e';
      ctx.beginPath();
      ctx.arc(fx + f.dir * size * 0.45, fy - 1, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // splashes
    for (const s of state.splashes) {
      const age = 1 - (16 - Math.min(16, game.serverTick - s.t)) / 16;
      const r = 6 + age * 22;
      ctx.strokeStyle = s.hit ? colorOf(colorIdxOf(s.slot)) : '#ffffff88';
      ctx.lineWidth = s.hit ? 3.5 : 2;
      ctx.beginPath();
      ctx.arc(x + s.x * sx, y + s.y * sy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    txt(ctx, `🐟 small = ${FISH.pts.small} · big = ${FISH.pts.med} · ✨gold = ${FISH.pts.gold}`, w / 2, y + ph + 20, 13.5, '#9fb3bf');
  },
  onPointer(w, h, px, py) {
    const { x, y, pw, ph } = poolRect(w, h);
    const fx = ((px - x) / pw) * FISH.poolW;
    const fy = ((py - y) / ph) * FISH.poolH;
    if (fx < -1 || fx > FISH.poolW + 1 || fy < -1 || fy > FISH.poolH + 1) return null;
    return { g: 'fish', x: Math.max(0, Math.min(FISH.poolW, fx)), y: Math.max(0, Math.min(FISH.poolH, fy)) };
  }
};

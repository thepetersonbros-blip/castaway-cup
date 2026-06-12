import type { FirePub } from '../../shared/protocol';
import { game, nameOf, colorIdxOf } from '../state';
import { burst } from '../fx';
import { chip, flame, glow, shadowEllipse, txt, type GameView } from './common';

export const fireView: GameView = {
  render(ctx, w, h, state: FirePub, now) {
    // --- shared timing bar ---
    const barY = h * 0.13;
    const barW = Math.min(w * 0.86, 700);
    const barX = (w - barW) / 2;
    const barH = 26;
    ctx.fillStyle = '#10202e';
    ctx.fillRect(barX - 6, barY - 6, barW + 12, barH + 12);
    ctx.fillStyle = '#2a4660';
    ctx.fillRect(barX, barY, barW, barH);
    // hot zone with a living glow
    const zx = barX + (state.zone / 100) * barW;
    const zw = (state.zoneW / 100) * barW;
    glow(ctx, zx, barY + barH / 2, zw * 1.1, '#ff9a46', 0.5);
    const zg = ctx.createLinearGradient(zx - zw / 2, 0, zx + zw / 2, 0);
    zg.addColorStop(0, '#ff784600');
    zg.addColorStop(0.5, '#ffd84d');
    zg.addColorStop(1, '#ff784600');
    ctx.fillStyle = zg;
    ctx.fillRect(zx - zw / 2, barY, zw, barH);
    // glass shine on the bar
    ctx.fillStyle = '#ffffff14';
    ctx.fillRect(barX, barY, barW, barH * 0.4);
    // my cursor big, others tiny
    for (const p of state.players) {
      const cx = barX + (p.cursor / 100) * barW;
      if (p.slot === game.you.slot) {
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath();
        ctx.arc(cx, barY + barH / 2, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0008';
        ctx.stroke();
      } else {
        ctx.fillStyle = '#f4ecd866';
        ctx.fillRect(cx - 1.5, barY + 2, 3, barH - 4);
      }
    }
    txt(ctx, 'TAP when your spark is in the glow!', w / 2, barY + barH + 22, 15, '#ffe8c8');

    // --- fire pits ---
    const cols = Math.min(3, state.players.length);
    const rows = Math.ceil(state.players.length / cols);
    const gridTop = h * 0.3;
    const cellW = Math.min(w / cols, 320);
    const gridW = cellW * cols;
    const cellH = (h * 0.62) / rows;
    state.players.forEach((p, i) => {
      const cx = (w - gridW) / 2 + (i % cols) * cellW + cellW / 2;
      const cy = gridTop + Math.floor(i / cols) * cellH + cellH * 0.72;
      const mine = p.slot === game.you.slot;
      if (mine) {
        glow(ctx, cx, cy + 4, cellW * 0.42, '#ffd98a', 0.22);
        txt(ctx, '▼ you', cx, cy - cellH * 0.62, 12, '#ffd98a');
      }
      // firelight on the ground + drifting embers
      shadowEllipse(ctx, cx, cy + 14, 36, 8);
      if (p.meter > 3) {
        glow(ctx, cx, cy, 30 + (p.meter / 100) * 70, '#ff8c46', 0.1 + (p.meter / 100) * 0.25);
        if (Math.random() < 0.06 + (p.meter / 100) * 0.2) {
          burst(cx + (Math.random() - 0.5) * 16, cy - 10, {
            n: 1,
            colors: ['#ffd98a', '#ff9a4d', '#ffefb0'],
            speed: 0.7,
            size: 2.4,
            life: 55,
            grav: -0.035,
            up: true
          });
        }
      }
      // logs + stones
      ctx.strokeStyle = '#6e4a26';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy + 8);
      ctx.lineTo(cx + 22, cy - 2);
      ctx.moveTo(cx + 22, cy + 8);
      ctx.lineTo(cx - 22, cy - 2);
      ctx.stroke();
      ctx.fillStyle = '#3a4a58';
      for (let s = 0; s < 5; s++) {
        const a = Math.PI + (s / 4) * Math.PI;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 30, cy + 10 + Math.sin(a) * 4, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      flame(ctx, cx, cy, 12 + (p.meter / 100) * (cellH * 0.42), now);
      if (p.fizzle) {
        txt(ctx, '...fizzle...', cx, cy - cellH * 0.4, 14, '#9fb3bf');
      }
      if (p.fin >= 0) {
        txt(ctx, 'ROARING! 🔥', cx, cy - cellH * 0.46, 15, '#ffd98a');
      }
      chip(ctx, cx - 38, cy + 26, colorIdxOf(p.slot), `${nameOf(p.slot)} ${Math.round(p.meter)}%`, 13);
    });
  },
  onPointer() {
    return { g: 'fire' };
  },
  onKey(key) {
    return key === ' ' ? { g: 'fire' } : null;
  }
};

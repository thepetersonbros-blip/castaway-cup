import type { IdolPub } from '../../shared/protocol';
import { game, nameOf, colorIdxOf } from '../state';
import { burst } from '../fx';
import { chip, glow, txt, type GameView } from './common';
import { sfx } from '../audio';

let lastMode = '';

function godRays(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, now: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(now / 4000);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ctx.fillStyle = 'rgba(255,222,120,0.10)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a, a + 0.24);
    ctx.fill();
  }
  ctx.restore();
}

function drawIdol(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, glow: number): void {
  if (glow > 0) {
    const g = ctx.createRadialGradient(x, y, s * 0.2, x, y, s * 2.2);
    g.addColorStop(0, `rgba(255,216,74,${0.55 * glow})`);
    g.addColorStop(1, 'rgba(255,216,74,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4);
  }
  ctx.fillStyle = '#d8a020';
  ctx.beginPath();
  ctx.roundRect(x - s * 0.55, y - s * 0.8, s * 1.1, s * 1.6, s * 0.3);
  ctx.fill();
  ctx.fillStyle = '#b07810';
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.25, s * 0.34, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe8a0';
  ctx.beginPath();
  ctx.arc(x - s * 0.16, y - s * 0.28, s * 0.08, 0, Math.PI * 2);
  ctx.arc(x + s * 0.16, y - s * 0.28, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b07810';
  ctx.fillRect(x - s * 0.28, y + s * 0.18, s * 0.56, s * 0.12);
  ctx.fillRect(x - s * 0.2, y + s * 0.38, s * 0.4, s * 0.1);
}

export const idolView: GameView = {
  render(ctx, w, h, state: IdolPub, now) {
    const cx = w / 2;
    const cy = h * 0.42;
    if (state.mode !== lastMode) {
      if (state.mode === 'go') {
        sfx.gong();
        burst(cx, cy, {
          n: 36,
          colors: ['#ffd84a', '#fff3b0', '#ffaa30'],
          speed: 5,
          size: 3.4,
          life: 44,
          grav: 0.05
        });
      }
      lastMode = state.mode;
    }
    txt(ctx, `DRAW ${state.draw} OF ${state.draws}`, w / 2, h * 0.08, 20, '#ffd98a');
    if (state.mode === 'wait') {
      // dark jungle tension
      ctx.fillStyle = '#00000066';
      ctx.fillRect(0, 0, w, h);
      const pulse = 0.5 + Math.sin(now / 600) * 0.5;
      txt(ctx, 'wait for it', cx, cy, 26 + pulse * 4, `rgba(244,236,216,${0.35 + pulse * 0.4})`);
      txt(ctx, 'tap too soon and you lose a point...', cx, cy + 40, 14, '#9fb3bf');
    } else if (state.mode === 'go') {
      godRays(ctx, cx, cy, Math.min(w, h) * 0.5, now);
      glow(ctx, cx, cy, 180, '#ffd84a', 0.5);
      drawIdol(ctx, cx, cy, 70, 1);
      txt(ctx, 'GRAB IT!!', cx, cy + 110, 34, '#fff3b0');
    } else {
      drawIdol(ctx, cx, h * 0.2, 36, 0.4);
      // reaction board for this draw
      const grabbed = state.scores
        .filter((s) => s.ms !== null)
        .sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0));
      let y = h * 0.34;
      txt(ctx, grabbed.length === 0 ? 'Nobody grabbed it! 🦗' : 'THE GRAB:', cx, y, 18, '#ffe8c8');
      y += 30;
      grabbed.forEach((s, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] ?? '·';
        chip(ctx, cx - 90, y, colorIdxOf(s.slot), `${medal} ${nameOf(s.slot)}`, 14);
        txt(ctx, `${s.ms}ms`, cx + 70, y, 15, '#ffd98a', 'left');
        y += 26;
      });
      for (const s of state.scores) {
        if (s.locked) {
          chip(ctx, cx - 90, y, colorIdxOf(s.slot), `${nameOf(s.slot)}`, 13);
          txt(ctx, 'jumped the gun 🙈', cx + 30, y, 13, '#ff9a8a', 'left');
          y += 24;
        }
      }
    }

    // totals row
    const rowY = h * 0.86;
    const per = Math.min(160, w / Math.max(1, state.scores.length));
    state.scores.forEach((s, i) => {
      const px = w / 2 + (i - (state.scores.length - 1) / 2) * per;
      chip(ctx, px - 30, rowY, colorIdxOf(s.slot), `${nameOf(s.slot)} ${s.score}`, 12.5);
      if (s.locked && state.mode !== 'scored') txt(ctx, '🙈', px, rowY + 18, 12);
    });
  },
  onPointer() {
    return { g: 'idol' };
  },
  onKey(key) {
    return key === ' ' ? { g: 'idol' } : null;
  }
};

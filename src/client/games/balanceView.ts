import type { BalancePub } from '../../shared/protocol';
import { game, nameOf, colorIdxOf } from '../state';
import { castaway, chip, txt, type GameView } from './common';

export const balanceView: GameView = {
  render(ctx, w, h, state: BalancePub, now) {
    const seaY = h * 0.74;
    // wind streaks
    ctx.strokeStyle = '#ffffff2e';
    ctx.lineWidth = 2;
    const windPx = state.wind * 18;
    for (let i = 0; i < 10; i++) {
      const yy = h * 0.12 + i * (h * 0.05);
      const xx = ((now / 6) * (1 + (i % 3)) + i * 160) % (w + 200) - 100;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.quadraticCurveTo(xx + 30 + windPx, yy + 4, xx + 60 + windPx * 2, yy);
      ctx.stroke();
    }
    const n = state.players.length;
    const per = Math.min(w / Math.max(1, n), 220);
    state.players.forEach((p, i) => {
      const cx = w / 2 + (i - (n - 1) / 2) * per;
      const mine = p.slot === game.you.slot;
      const poleTop = seaY - h * 0.3;
      // pole
      ctx.strokeStyle = mine ? '#e8d8a8' : '#a8906a';
      ctx.lineWidth = mine ? 8 : 6;
      ctx.beginPath();
      ctx.moveTo(cx, seaY);
      ctx.lineTo(cx, poleTop);
      ctx.stroke();
      if (p.fallen >= 0) {
        // bobbing in the drink
        const bob = Math.sin(now / 350 + i) * 4;
        ctx.fillStyle = '#e8b88a';
        ctx.beginPath();
        ctx.arc(cx, seaY + 14 + bob, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff55';
        ctx.beginPath();
        ctx.ellipse(cx, seaY + 18 + bob, 20, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        txt(ctx, '💦', cx, seaY - 14, 18);
      } else {
        const lean = (p.angle / 45) * 0.9;
        castaway(ctx, cx, poleTop, mine ? 13 : 10, colorIdxOf(p.slot), lean, Math.abs(p.angle) > 25);
        // danger arc
        if (mine) {
          const danger = Math.min(1, Math.abs(p.angle) / 45);
          ctx.strokeStyle = danger > 0.65 ? '#e8443a' : danger > 0.35 ? '#ffb84d' : '#2fb24c';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(cx, poleTop, 46, -Math.PI / 2 - 0.9, -Math.PI / 2 - 0.9 + 1.8 * ((p.angle + 45) / 90));
          ctx.stroke();
        }
      }
      chip(ctx, cx - 32, seaY + 38, colorIdxOf(p.slot), nameOf(p.slot), 13);
    });
    txt(ctx, 'Tap LEFT / RIGHT side (or A / D) to lean against the wind', w / 2, h * 0.06, 15, '#ffe8c8');
    // edge hints
    ctx.fillStyle = '#ffffff10';
    ctx.fillRect(0, 0, w * 0.18, h);
    ctx.fillRect(w * 0.82, 0, w * 0.18, h);
    txt(ctx, '⟵', w * 0.09, h * 0.5, 40, '#ffffff55');
    txt(ctx, '⟶', w * 0.91, h * 0.5, 40, '#ffffff55');
  },
  onPointer(w, _h, x) {
    return { g: 'balance', dir: x < w / 2 ? -1 : 1 };
  },
  onKey(key) {
    if (key === 'a' || key === 'arrowleft') return { g: 'balance', dir: -1 };
    if (key === 'd' || key === 'arrowright') return { g: 'balance', dir: 1 };
    return null;
  }
};

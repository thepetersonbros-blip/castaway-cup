import { CLIMB } from '../../shared/constants';
import type { ClimbPub } from '../../shared/protocol';
import { game, nameOf, colorIdxOf } from '../state';
import { castaway, chip, palm, txt, type GameView } from './common';

export const climbView: GameView = {
  render(ctx, w, h, state: ClimbPub, now) {
    const groundY = h * 0.84;
    const topY = h * 0.16;
    const n = state.players.length;
    const per = Math.min(w / Math.max(1, n), 220);
    state.players.forEach((p, i) => {
      const cx = w / 2 + (i - (n - 1) / 2) * per;
      const mine = p.slot === game.you.slot;
      // trunk
      ctx.strokeStyle = mine ? '#b08a48' : '#8a6c3a';
      ctx.lineWidth = mine ? 14 : 11;
      ctx.beginPath();
      ctx.moveTo(cx - 4, groundY);
      ctx.quadraticCurveTo(cx + 10, (groundY + topY) / 2, cx, topY + 8);
      ctx.stroke();
      // rings
      ctx.strokeStyle = '#00000022';
      ctx.lineWidth = 2;
      for (let r = 1; r < 8; r++) {
        const ry = groundY - ((groundY - topY) * r) / 8;
        ctx.beginPath();
        ctx.moveTo(cx - 7, ry);
        ctx.lineTo(cx + 7, ry);
        ctx.stroke();
      }
      // fronds + coconuts
      palm(ctx, cx - 3, topY + 22, 26, '#2a5a3a');
      ctx.fillStyle = '#6e4a26';
      ctx.beginPath();
      ctx.arc(cx + 7, topY + 6, 5, 0, Math.PI * 2);
      ctx.arc(cx - 2, topY + 9, 5, 0, Math.PI * 2);
      ctx.fill();
      // climber
      const cy = groundY - (p.h / CLIMB.top) * (groundY - topY - 18);
      const wig = p.sting ? Math.sin(now / 30) * 4 : 0;
      castaway(ctx, cx + 12 + wig, cy, mine ? 11 : 9, colorIdxOf(p.slot), p.sting ? 0.4 : -0.12, p.fin >= 0);
      if (p.sting) txt(ctx, 'SLIP!', cx, cy - 44, 14, '#ff9a8a');
      if (p.fin >= 0) txt(ctx, '🥥 TOP!', cx, topY - 14, 16, '#ffd98a');
      chip(ctx, cx - 30, groundY + 24, colorIdxOf(p.slot), `${nameOf(p.slot)} ${Math.round(p.h)}%`, 12.5);
      // next-hand hint on my tree
      if (mine && p.fin < 0) {
        const next = p.last === 'L' ? 'R' : p.last === 'R' ? 'L' : 'either';
        txt(ctx, next === 'either' ? 'tap L or R' : `next: ${next}`, cx, cy + 22, 12, '#ffe8c8');
      }
    });
    txt(ctx, 'Alternate LEFT / RIGHT taps (or A / D). Same side twice = slip!', w / 2, h * 0.07, 15, '#ffe8c8');
    ctx.fillStyle = '#ffffff10';
    ctx.fillRect(0, h * 0.5, w * 0.5, h * 0.5);
    txt(ctx, 'L', w * 0.25, h * 0.93, 28, '#ffffff44');
    txt(ctx, 'R', w * 0.75, h * 0.93, 28, '#ffffff44');
  },
  onPointer(w, h, x, y) {
    if (y < h * 0.12) return null;
    return { g: 'climb', side: x < w / 2 ? 'L' : 'R' };
  },
  onKey(key) {
    if (key === 'a' || key === 'arrowleft') return { g: 'climb', side: 'L' };
    if (key === 'd' || key === 'arrowright') return { g: 'climb', side: 'R' };
    return null;
  }
};

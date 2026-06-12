import type { MemoryPub } from '../../shared/protocol';
import { game, nameOf, colorIdxOf } from '../state';
import { chip, glow, txt, type GameView } from './common';
import { sfx } from '../audio';

const TILE_COLORS = ['#e8443a', '#2fb24c', '#ffb84d', '#2f7fe8'];
const TILE_NAMES = ['DRUM', 'LEAF', 'SUN', 'WAVE'];

function tileRects(w: number, h: number): { x: number; y: number; s: number }[] {
  const s = Math.min(w * 0.38, h * 0.26, 220);
  const cx = w / 2;
  const cy = h * 0.42;
  const gap = s * 0.08;
  return [
    { x: cx - s - gap / 2, y: cy - s - gap / 2, s },
    { x: cx + gap / 2, y: cy - s - gap / 2, s },
    { x: cx - s - gap / 2, y: cy + gap / 2, s },
    { x: cx + gap / 2, y: cy + gap / 2, s }
  ];
}

function drawSymbol(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, s: number): void {
  ctx.strokeStyle = '#10202e';
  ctx.fillStyle = '#10202e';
  ctx.lineWidth = s * 0.06;
  if (i === 0) {
    // drum
    ctx.strokeRect(x - s * 0.18, y - s * 0.12, s * 0.36, s * 0.24);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.18, y - s * 0.12);
    ctx.lineTo(x + s * 0.18, y + s * 0.12);
    ctx.moveTo(x + s * 0.18, y - s * 0.12);
    ctx.lineTo(x - s * 0.18, y + s * 0.12);
    ctx.stroke();
  } else if (i === 1) {
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.2, s * 0.09, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (i === 2) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    for (let r = 0; r < 8; r++) {
      const a = (r / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * s * 0.17, y + Math.sin(a) * s * 0.17);
      ctx.lineTo(x + Math.cos(a) * s * 0.24, y + Math.sin(a) * s * 0.24);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.22, y + s * 0.06);
    ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.14, x, y + s * 0.02);
    ctx.quadraticCurveTo(x + s * 0.1, y + s * 0.16, x + s * 0.22, y - s * 0.04);
    ctx.stroke();
  }
}

let lastFlash = -1;
let lastMode = '';

export const memoryView: GameView = {
  render(ctx, w, h, state: MemoryPub, now) {
    if (state.flash !== lastFlash && state.flash >= 0) sfx.drum(state.flash);
    lastFlash = state.flash;
    if (state.mode !== lastMode) {
      if (state.mode === 'input') sfx.gong();
      lastMode = state.mode;
    }

    txt(ctx, `ROUND ${state.depth}`, w / 2, h * 0.07, 22, '#ffd98a');
    txt(
      ctx,
      state.mode === 'show' ? '👀 WATCH THE TOTEMS...' : state.mode === 'input' ? '🥁 YOUR TURN! Repeat it!' : '...',
      w / 2,
      h * 0.115,
      16,
      state.mode === 'input' ? '#ffe8c8' : '#9fb3bf'
    );

    const rects = tileRects(w, h);
    rects.forEach((r, i) => {
      const lit = state.flash === i;
      if (lit) glow(ctx, r.x + r.s / 2, r.y + r.s / 2, r.s * 1.05, TILE_COLORS[i], 0.75);
      // carved wooden tile: gradient face + bevel edges
      const tg = ctx.createLinearGradient(r.x, r.y, r.x + r.s, r.y + r.s);
      tg.addColorStop(0, TILE_COLORS[i]);
      tg.addColorStop(1, TILE_COLORS[i] + 'aa');
      ctx.fillStyle = tg;
      ctx.globalAlpha = lit ? 1 : state.mode === 'input' ? 0.9 : 0.5;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.s, r.s, 16);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff33';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(r.x + 3, r.y + 3, r.s - 6, r.s - 6, 13);
      ctx.stroke();
      if (lit) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.s, r.s, 16);
        ctx.stroke();
      }
      drawSymbol(ctx, i, r.x + r.s / 2, r.y + r.s / 2 - 6, r.s);
      txt(ctx, `${i + 1} · ${TILE_NAMES[i]}`, r.x + r.s / 2, r.y + r.s - 16, 13, '#10202ecc');
    });

    // input timer
    if (state.mode === 'input' && state.inputLeft > 0) {
      const tw = Math.min(w * 0.6, 420);
      ctx.fillStyle = '#142433';
      ctx.fillRect((w - tw) / 2, h * 0.75, tw, 10);
      ctx.fillStyle = '#ffb84d';
      ctx.fillRect((w - tw) / 2, h * 0.75, tw * (state.inputLeft / (14 * 20)), 10);
    }

    // player rows
    const rowY = h * 0.82;
    const per = Math.min(170, w / Math.max(1, state.players.length));
    state.players.forEach((p, i) => {
      const cx = w / 2 + (i - (state.players.length - 1) / 2) * per;
      chip(ctx, cx - 34, rowY, colorIdxOf(p.slot), nameOf(p.slot), 12.5);
      if (p.out) {
        txt(ctx, 'torch out 🪦', cx, rowY + 18, 11.5, '#9fb3bf');
      } else {
        txt(ctx, `${'🔥'.repeat(Math.max(0, p.lives))}  ${p.progress}/${state.depth + 2}`, cx, rowY + 18, 12, '#ffe8c8');
      }
    });
  },
  onPointer(w, h, x, y) {
    const rects = tileRects(w, h);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.s && y >= r.y && y <= r.y + r.s) return { g: 'memory', tile: i };
    }
    return null;
  },
  onKey(key) {
    const i = ['1', '2', '3', '4'].indexOf(key);
    return i >= 0 ? { g: 'memory', tile: i } : null;
  }
};

import { GATHER, TRIBE_COLORS } from '../../shared/constants';
import type { FoodKind, GatherPub } from '../../shared/protocol';
import { game, nameOf, colorIdxOf } from '../state';
import { sendPlay } from '../net';
import { burst } from '../fx';
import { castaway, chip, colorOf, glow, shadowEllipse, txt, type GameView } from './common';

const dizzySeen = new Map<number, boolean>();

function arenaRect(w: number, h: number): { x: number; y: number; aw: number; ah: number } {
  const top = h * 0.13;
  const scale = Math.min((w * 0.96) / GATHER.arenaW, (h * 0.78) / GATHER.arenaH);
  const aw = GATHER.arenaW * scale;
  const ah = GATHER.arenaH * scale;
  return { x: (w - aw) / 2, y: top + (h * 0.78 - ah) / 2, aw, ah };
}

function drawFood(ctx: CanvasRenderingContext2D, kind: FoodKind, x: number, y: number, s: number): void {
  if (kind === 'berry') {
    ctx.fillStyle = '#d8324a';
    for (const [ox, oy] of [[-0.25, 0], [0.25, 0.05], [0, -0.3]] as const) {
      ctx.beginPath();
      ctx.arc(x + ox * s, y + oy * s, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'coconut') {
    ctx.fillStyle = '#6e4a26';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2812';
    for (const ox of [-0.15, 0.15]) {
      ctx.beginPath();
      ctx.arc(x + ox * s, y - s * 0.15, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#f0c030';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.08, s * 0.34, s * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b08a10';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.2, y - s * 0.2);
    ctx.lineTo(x + s * 0.2, y + s * 0.3);
    ctx.moveTo(x + s * 0.2, y - s * 0.2);
    ctx.lineTo(x - s * 0.2, y + s * 0.3);
    ctx.stroke();
    ctx.strokeStyle = '#2a8a3a';
    ctx.lineWidth = 2;
    for (const a of [-0.6, 0, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.3);
      ctx.lineTo(x + Math.sin(a) * s * 0.3, y - s * 0.75);
      ctx.stroke();
    }
  }
}

// --- input state: held pointer and/or held keys steer the castaway ---
const held = { on: false, x: 0, y: 0 };
const keys = new Set<string>();
let lastSent = { dx: 0, dy: 0 };
let lastSendAt = 0;

function keyDir(): { dx: number; dy: number } | null {
  if (keys.size === 0) return null;
  let dx = 0;
  let dy = 0;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  return { dx, dy };
}

function maybeSend(dx: number, dy: number, now: number): void {
  const changed = Math.abs(dx - lastSent.dx) > 0.12 || Math.abs(dy - lastSent.dy) > 0.12;
  const stopped = dx === 0 && dy === 0 && (lastSent.dx !== 0 || lastSent.dy !== 0);
  if ((changed && now - lastSendAt > 70) || stopped) {
    lastSent = { dx, dy };
    lastSendAt = now;
    sendPlay({ g: 'gather', dx, dy });
  }
}

export const gatherView: GameView = {
  render(ctx, w, h, state: GatherPub, now) {
    const { x, y, aw, ah } = arenaRect(w, h);
    const sx = aw / GATHER.arenaW;
    const sy = ah / GATHER.arenaH;
    const px2 = (ax: number) => x + ax * sx;
    const py2 = (ay: number) => y + ay * sy;

    // steer: recompute direction every frame while held (finger steering)
    const me = state.players.find((p) => p.slot === game.you.slot);
    if (me) {
      const kd = keyDir();
      if (kd) {
        maybeSend(kd.dx, kd.dy, now);
      } else if (held.on) {
        const mx = px2(me.x);
        const my = py2(me.y);
        let dx = held.x - mx;
        let dy = held.y - my;
        const len = Math.hypot(dx, dy);
        if (len < 16) {
          dx = 0;
          dy = 0;
        } else {
          dx /= len;
          dy /= len;
        }
        maybeSend(dx, dy, now);
      } else {
        maybeSend(0, 0, now);
      }
    }

    // beach
    const sand = ctx.createLinearGradient(0, y, 0, y + ah);
    sand.addColorStop(0, '#e8cf9a');
    sand.addColorStop(1, '#c9a86e');
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.roundRect(x, y, aw, ah, 16);
    ctx.fill();
    ctx.strokeStyle = '#7a5c34';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#00000012';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(x + ((i * 97) % aw), y + ((i * 53) % ah), 3, 2);
    }

    // home mats with a soft beacon glow
    for (const p of state.players) {
      const mx = px2(p.hx);
      const my = py2(p.hy);
      const mine = p.slot === game.you.slot;
      glow(ctx, mx, my, GATHER.bankRadius * sx * 2, colorOf(colorIdxOf(p.slot)), mine ? 0.32 : 0.16);
      ctx.fillStyle = colorOf(colorIdxOf(p.slot)) + '55';
      ctx.strokeStyle = colorOf(colorIdxOf(p.slot));
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(mx, my, GATHER.bankRadius * sx, GATHER.bankRadius * sy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      txt(ctx, '🧺', mx, my, 16);
    }

    // food on the ground, each with a contact shadow
    for (const it of state.items) {
      shadowEllipse(ctx, px2(it.x), py2(it.y) + 7, 9, 3, 0.18);
      drawFood(ctx, it.kind, px2(it.x), py2(it.y), 16);
    }

    // castaways + their stacks
    const sorted = [...state.players].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      const cx = px2(p.x);
      const cy = py2(p.y);
      const mine = p.slot === game.you.slot;
      if (p.dizzy && !dizzySeen.get(p.slot)) {
        burst(cx, cy - 24, {
          n: 18,
          colors: ['#d8324a', '#6e4a26', '#f0c030', '#ffffff'],
          speed: 3.4,
          size: 3.2,
          life: 40,
          grav: 0.16,
          up: true
        });
      }
      dizzySeen.set(p.slot, p.dizzy);
      ctx.fillStyle = '#00000022';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      castaway(ctx, cx, cy, mine ? 8 : 7, colorIdxOf(p.slot), 0, false);
      // the stack: sway gets violent in the red zone
      const inRed = p.wobble > GATHER.redAt;
      const wob = (p.wobble / GATHER.wobbleCap) * 12 + (inRed ? Math.sin(now / 40) * 3 : 0);
      p.carry.forEach((k, i) => {
        const sway = Math.sin(now / 90 + i * 0.7) * wob * ((i + 1) / p.carry.length);
        drawFood(ctx, k, cx + sway, cy - 32 - i * 10, 13);
      });
      if (p.dizzy) {
        txt(ctx, '💫', cx, cy - 40, 18);
      }
      // wobble bar: fills to the red line, then it's pure flashing dice
      if (mine && p.wobble > 25 && !p.dizzy) {
        const bw = 44;
        const by = cy - 46 - p.carry.length * 10;
        ctx.fillStyle = '#10202e';
        ctx.fillRect(cx - bw / 2, by, bw, 6);
        if (inRed) {
          // no countdown in the red: just panic
          const flash = Math.floor(now / 110) % 2 === 0;
          ctx.fillStyle = flash ? '#e8443a' : '#ff9a8a';
          ctx.fillRect(cx - bw / 2, by, bw, 6);
          if (flash) txt(ctx, '⚠ STEADY!! ⚠', cx, by - 10, 13, '#ff6a5a');
        } else {
          const fill = p.wobble / GATHER.redAt;
          ctx.fillStyle = fill > 0.7 ? '#ffb84d' : '#2fb24c';
          ctx.fillRect(cx - bw / 2, by, bw * fill, 6);
        }
        // the red line everyone learns to fear
        ctx.fillStyle = '#e8443a';
        ctx.fillRect(cx - bw / 2 + bw - 1.5, by - 1, 3, 8);
      }
      txt(ctx, nameOf(p.slot), cx, cy + 14, 11.5, mine ? '#fff3b0' : '#f4ecd8cc');
    }

    // banked scores
    const per = Math.min(150, w / Math.max(1, state.players.length));
    state.players.forEach((p, i) => {
      const cx = w / 2 + (i - (state.players.length - 1) / 2) * per;
      chip(ctx, cx - 34, h * 0.065, colorIdxOf(p.slot), `${nameOf(p.slot)} 🧺${p.banked}`, 12.5);
    });
    txt(
      ctx,
      'Hold to run · grab food · stand still to steady the stack · bank at YOUR mat',
      w / 2,
      y + ah + 18,
      13.5,
      '#9fb3bf'
    );
  },

  onPointer(_w, _h, x, y) {
    held.on = true;
    held.x = x;
    held.y = y;
    return null; // steering is sent from the render loop
  },
  onPointerMove(_w, _h, x, y) {
    if (held.on) {
      held.x = x;
      held.y = y;
    }
  },
  onPointerUp() {
    held.on = false;
  },
  onKey(key) {
    if (['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
      keys.add(key);
    }
    return null;
  },
  onKeyUp(key) {
    keys.delete(key);
  }
};

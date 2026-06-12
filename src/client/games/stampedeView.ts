import { STAMPEDE } from '../../shared/constants';
import type { StampedePub } from '../../shared/protocol';
import { game, nameOf, colorIdxOf } from '../state';
import { sendPlay } from '../net';
import { burst } from '../fx';
import { castaway, chip, colorOf, glow, shadowEllipse, txt, type GameView } from './common';

let prevRocks = new Set<number>();
const aliveSeen = new Map<number, boolean>();
let lastDust = 0;

// Pastel mosaic tiles, Mario-Party style.
const TILE_COLORS = ['#bcd9c9', '#e8c9b0', '#c9c2e0', '#dfe0b8', '#bccfdd', '#e0bcc6'];

function arenaRect(w: number, h: number): { x: number; y: number; s: number } {
  const top = h * 0.15;
  const s = Math.min((w * 0.96) / STAMPEDE.gridW, (h * 0.72) / STAMPEDE.gridH);
  return { x: (w - STAMPEDE.gridW * s) / 2, y: top + (h * 0.72 - STAMPEDE.gridH * s) / 2, s };
}

// --- steering (held pointer or WASD), plus the CHARGE button ---
const held = { on: false, x: 0, y: 0 };
const keys = new Set<string>();
let lastSent = { dx: 0, dy: 0 };
let lastSendAt = 0;
let chargeBtn = { x: 0, y: 0, r: 0, visible: false };
const eased = new Map<number, { x: number; y: number }>();

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
    sendPlay({ g: 'stampede', dx, dy });
  }
}

function easeTo(slot: number, tx: number, ty: number): { x: number; y: number } {
  let e = eased.get(slot);
  if (!e || Math.hypot(e.x - tx, e.y - ty) > 4) {
    e = { x: tx, y: ty };
    eased.set(slot, e);
  }
  e.x += (tx - e.x) * 0.42;
  e.y += (ty - e.y) * 0.42;
  return e;
}

function drawElephant(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number, // 2 cells
  colorIdx: number,
  charging: boolean,
  now: number
): void {
  const stomp = Math.sin(now / 90) * size * 0.012;
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2 + stomp);
  // body
  ctx.fillStyle = charging ? '#9a7f8f' : '#8e93a4';
  ctx.beginPath();
  ctx.roundRect(-size * 0.46, -size * 0.42, size * 0.92, size * 0.84, size * 0.18);
  ctx.fill();
  ctx.strokeStyle = '#00000033';
  ctx.lineWidth = 3;
  ctx.stroke();
  // ears
  ctx.fillStyle = charging ? '#86687a' : '#767b8e';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * size * 0.38, -size * 0.18, size * 0.16, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // trunk + tusks
  ctx.strokeStyle = charging ? '#86687a' : '#767b8e';
  ctx.lineWidth = size * 0.12;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.05);
  ctx.quadraticCurveTo(0, size * 0.28, size * 0.1, size * 0.4);
  ctx.stroke();
  ctx.strokeStyle = '#f4ecd8';
  ctx.lineWidth = size * 0.06;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * size * 0.16, size * 0.1);
    ctx.quadraticCurveTo(sx * size * 0.26, size * 0.22, sx * size * 0.3, size * 0.12);
    ctx.stroke();
  }
  // angry eyes
  ctx.fillStyle = '#10202e';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * size * 0.14, -size * 0.16, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  // rider bandana band
  ctx.fillStyle = colorOf(colorIdx);
  ctx.fillRect(-size * 0.46, -size * 0.46, size * 0.92, size * 0.1);
  if (charging) {
    ctx.strokeStyle = '#ff6a5a';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.6 - i * 7, -size * 0.2 + i * size * 0.2);
      ctx.lineTo(-size * 0.45 - i * 7, -size * 0.2 + i * size * 0.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export const stampedeView: GameView = {
  render(ctx, w, h, state: StampedePub, now) {
    const { x, y, s } = arenaRect(w, h);
    const me = state.elephants.find((e) => e.slot === game.you.slot);
    const meHuman = state.humans.find((p) => p.slot === game.you.slot);

    // steering
    const kd = keyDir();
    if (kd) maybeSend(kd.dx, kd.dy, now);
    else if (held.on) {
      const mine = me
        ? { x: x + (me.cx + 1) * s, y: y + (me.cy + 1) * s }
        : meHuman
          ? { x: x + (meHuman.cx + 0.5) * s, y: y + (meHuman.cy + 0.5) * s }
          : null;
      if (mine) {
        let dx = held.x - mine.x;
        let dy = held.y - mine.y;
        const len = Math.hypot(dx, dy);
        if (len < 14) {
          dx = 0;
          dy = 0;
        } else {
          dx /= len;
          dy /= len;
        }
        maybeSend(dx, dy, now);
      }
    } else {
      maybeSend(0, 0, now);
    }

    // big timer, game-show style
    txt(ctx, String(Math.ceil(state.left / 20)), w / 2, h * 0.085, 44, '#7ae8e8');
    txt(ctx, `ROUND ${state.round} OF ${state.rounds}`, w / 2, h * 0.135, 14, '#ffd98a');

    // mosaic floor with beveled, Mario-Party-chunky tiles
    for (let cy = 0; cy < STAMPEDE.gridH; cy++) {
      for (let cx = 0; cx < STAMPEDE.gridW; cx++) {
        const tx = x + cx * s;
        const ty = y + cy * s;
        const base = TILE_COLORS[(cx * 7 + cy * 13 + ((cx * cy) % 5)) % TILE_COLORS.length];
        const tg = ctx.createLinearGradient(tx, ty, tx, ty + s);
        tg.addColorStop(0, base);
        tg.addColorStop(1, base + 'cc');
        ctx.fillStyle = tg;
        ctx.fillRect(tx, ty, s, s);
        // bevel: lit top edge, shaded bottom edge
        ctx.fillStyle = '#ffffff38';
        ctx.fillRect(tx, ty, s, s * 0.1);
        ctx.fillStyle = '#00000026';
        ctx.fillRect(tx, ty + s * 0.9, s, s * 0.1);
        ctx.strokeStyle = '#00000018';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 0.5, ty + 0.5, s - 1, s - 1);
        ctx.strokeStyle = '#ffffff24';
        ctx.strokeRect(tx + s * 0.2, ty + s * 0.2, s * 0.6, s * 0.6);
      }
    }
    // arena rim with depth
    ctx.strokeStyle = '#54402a';
    ctx.lineWidth = 8;
    ctx.strokeRect(x - 2, y - 2, STAMPEDE.gridW * s + 4, STAMPEDE.gridH * s + 4);
    ctx.strokeStyle = '#a8865a';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 5, y - 5, STAMPEDE.gridW * s + 10, STAMPEDE.gridH * s + 10);

    // rock-smash debris: any boulder that vanished explodes
    const nowRocks = new Set<number>(state.rocks.map(([rx, ry]) => ry * STAMPEDE.gridW + rx));
    for (const k of prevRocks) {
      if (!nowRocks.has(k) && state.mode === 'play') {
        const rx = k % STAMPEDE.gridW;
        const ry = Math.floor(k / STAMPEDE.gridW);
        burst(x + (rx + 0.5) * s, y + (ry + 0.5) * s, {
          n: 18,
          colors: ['#8a8f9a', '#6e7480', '#b8bcc4'],
          speed: 3.6,
          size: 3.4,
          life: 36,
          grav: 0.18,
          up: true
        });
      }
    }
    prevRocks = nowRocks;

    // rocks
    for (const [rx, ry] of state.rocks) {
      const tx = x + rx * s;
      const ty = y + ry * s;
      ctx.fillStyle = '#6e7480';
      ctx.beginPath();
      ctx.roundRect(tx + s * 0.08, ty + s * 0.05, s * 0.84, s * 0.9, s * 0.25);
      ctx.fill();
      ctx.fillStyle = '#ffffff22';
      ctx.beginPath();
      ctx.roundRect(tx + s * 0.16, ty + s * 0.12, s * 0.4, s * 0.3, s * 0.15);
      ctx.fill();
    }

    // pancaked humans first (under everything)
    for (const p of state.humans) {
      if (p.alive) continue;
      const e = easeTo(p.slot, x + (p.cx + 0.5) * s, y + (p.cy + 0.5) * s);
      if (aliveSeen.get(p.slot)) {
        burst(e.x, e.y, {
          n: 24,
          colors: [colorOf(colorIdxOf(p.slot)), '#ffffff', '#ffd98a'],
          speed: 4.2,
          size: 3.4,
          life: 42,
          grav: 0.1
        });
      }
      aliveSeen.set(p.slot, false);
      ctx.fillStyle = colorOf(colorIdxOf(p.slot)) + 'cc';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, s * 0.45, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      txt(ctx, '✖ ✖', e.x, e.y - 2, s * 0.22, '#10202e');
    }
    // live humans
    for (const p of state.humans) {
      if (!p.alive) continue;
      aliveSeen.set(p.slot, true);
      const e = easeTo(p.slot, x + (p.cx + 0.5) * s, y + (p.cy + 0.5) * s);
      shadowEllipse(ctx, e.x, e.y + s * 0.42, s * 0.32, s * 0.1, 0.28);
      castaway(ctx, e.x, e.y + s * 0.4, s * 0.27, colorIdxOf(p.slot), 0, false);
      txt(ctx, nameOf(p.slot), e.x, e.y + s * 0.62, 10.5, '#10202ecc');
    }
    // elephants on top, kicking up dust when charging
    for (const el of state.elephants) {
      const e = easeTo(el.slot + 100, x + el.cx * s, y + el.cy * s);
      shadowEllipse(ctx, e.x + s, e.y + s * 1.92, s * 0.95, s * 0.22, 0.3);
      if (el.charging) {
        glow(ctx, e.x + s, e.y + s, s * 2.1, '#ff7a5a', 0.18);
        if (now - lastDust > 70) {
          lastDust = now;
          burst(e.x + s, e.y + s * 1.85, {
            n: 4,
            colors: ['#d8c8a8', '#b8a888', '#ffffff'],
            speed: 1.6,
            size: 4,
            life: 30,
            grav: -0.02
          });
        }
      }
      drawElephant(ctx, e.x, e.y, s * 2, colorIdxOf(el.slot), el.charging, now);
      txt(ctx, nameOf(el.slot), e.x + s, e.y - 6, 11.5, '#fff3b0');
    }

    // role banner + charge button
    chargeBtn.visible = false;
    if (state.mode === 'play') {
      if (me) {
        txt(ctx, "YOU'RE AN ELEPHANT 🐘 CRUSH!", w / 2, y - 14, 15, '#ff9a8a');
        chargeBtn = { x: w - 64, y: h - 84, r: 40, visible: true };
        const ready = me.cdLeft <= 0 && !me.charging;
        ctx.fillStyle = ready ? '#e8443a' : '#5a4348';
        ctx.beginPath();
        ctx.arc(chargeBtn.x, chargeBtn.y, chargeBtn.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#10202e';
        ctx.lineWidth = 4;
        ctx.stroke();
        if (!ready && me.cdLeft > 0) {
          ctx.strokeStyle = '#ffd98a';
          ctx.beginPath();
          ctx.arc(chargeBtn.x, chargeBtn.y, chargeBtn.r - 5, -Math.PI / 2, -Math.PI / 2 + (1 - me.cdLeft / 120) * Math.PI * 2);
          ctx.stroke();
        }
        txt(ctx, me.charging ? '💨' : 'CHARGE', chargeBtn.x, chargeBtn.y, 14, '#fff3b0');
        txt(ctx, '(or SPACE)', chargeBtn.x, chargeBtn.y + chargeBtn.r + 12, 11, '#9fb3bf');
      } else if (meHuman) {
        txt(
          ctx,
          meHuman.alive ? 'RUN!! Squeeze through gaps they can’t fit!' : 'You got pancaked. Respect.',
          w / 2,
          y - 14,
          15,
          meHuman.alive ? '#ffe8c8' : '#9fb3bf'
        );
      }
    } else {
      // between rounds
      ctx.fillStyle = '#10202ecc';
      ctx.fillRect(x, y + (STAMPEDE.gridH * s) / 2 - 50, STAMPEDE.gridW * s, 100);
      const next = state.nextElephants.map((sl) => nameOf(sl)).join(' & ');
      txt(
        ctx,
        next ? `Next on elephant-back: ${next}!` : 'Final scores coming up...',
        w / 2,
        y + (STAMPEDE.gridH * s) / 2,
        20,
        '#ffd98a'
      );
    }

    // scores
    const per = Math.min(150, w / Math.max(1, state.scores.length));
    state.scores.forEach((p, i) => {
      const cx = w / 2 + (i - (state.scores.length - 1) / 2) * per;
      chip(ctx, cx - 30, h * 0.94, colorIdxOf(p.slot), `${nameOf(p.slot)} ${p.score}`, 12.5);
    });
  },

  onPointer(_w, _h, px, py) {
    if (chargeBtn.visible && Math.hypot(px - chargeBtn.x, py - chargeBtn.y) <= chargeBtn.r + 8) {
      return { g: 'stampede', charge: true };
    }
    held.on = true;
    held.x = px;
    held.y = py;
    return null;
  },
  onPointerMove(_w, _h, px, py) {
    if (held.on) {
      held.x = px;
      held.y = py;
    }
  },
  onPointerUp() {
    held.on = false;
  },
  onKey(key) {
    if (key === ' ') return { g: 'stampede', charge: true };
    if (['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
      keys.add(key);
    }
    return null;
  },
  onKeyUp(key) {
    keys.delete(key);
  }
};

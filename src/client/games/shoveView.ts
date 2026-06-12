import { SHOVE } from '../../shared/constants';
import type { ShovePub } from '../../shared/protocol';
import { game, nameOf, colorIdxOf } from '../state';
import { sendPlay } from '../net';
import { burst } from '../fx';
import { castaway, chip, colorOf, glow, shadowEllipse, txt, type GameView } from './common';
import { sfx } from '../audio';

function arenaRect(w: number, h: number): { x: number; y: number; s: number } {
  const top = h * 0.12;
  const s = Math.min((w * 0.96) / SHOVE.arena, (h * 0.74) / SHOVE.arena);
  return { x: (w - SHOVE.arena * s) / 2, y: top + (h * 0.74 - SHOVE.arena * s) / 2, s };
}

// steering + action buttons
const held = { on: false, x: 0, y: 0 };
const keys = new Set<string>();
let lastSent = { dx: 0, dy: 0 };
let lastSendAt = 0;
const outSeen = new Map<number, boolean>();
const feed: { text: string; at: number }[] = [];
let buttons: { a: 'bump' | 'charge' | 'dodge'; x: number; y: number; r: number }[] = [];

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
    sendPlay({ g: 'shove', dx, dy });
  }
}

export const shoveView: GameView = {
  render(ctx, w, h, state: ShovePub, now) {
    const { x, y, s } = arenaRect(w, h);
    const px2 = (ax: number) => x + ax * s;
    const py2 = (ay: number) => y + ay * s;
    const cx = px2(SHOVE.arena / 2);
    const cy = py2(SHOVE.arena / 2);
    const me = state.players.find((p) => p.slot === game.you.slot);

    // steering
    const kd = keyDir();
    if (kd) maybeSend(kd.dx, kd.dy, now);
    else if (held.on && me && !me.out) {
      let dx = held.x - px2(me.x);
      let dy = held.y - py2(me.y);
      const len = Math.hypot(dx, dy);
      if (len < 14) {
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

    // open water
    const water = ctx.createRadialGradient(cx, cy, s * 2, cx, cy, s * SHOVE.arena * 0.7);
    water.addColorStop(0, '#2c8d96');
    water.addColorStop(1, '#0e2c3c');
    ctx.fillStyle = water;
    ctx.fillRect(x - s, y - s, SHOVE.arena * s + s * 2, SHOVE.arena * s + s * 2);
    ctx.strokeStyle = '#ffffff1e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, s * (state.radius + 1.5 + i * 1.6) + Math.sin(now / 500 + i) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // the rock: shaded disk + foam ring that closes in
    const R = state.radius * s;
    shadowEllipse(ctx, cx, cy + R * 0.12, R * 1.04, R * 0.5, 0.25);
    ctx.strokeStyle = '#e8f6f4';
    ctx.lineWidth = 5 + Math.sin(now / 240) * 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
    ctx.stroke();
    const rock = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.2, cx, cy, R);
    rock.addColorStop(0, '#9a9486');
    rock.addColorStop(0.7, '#7c7668');
    rock.addColorStop(1, '#5c5648');
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    // cracks + barnacles
    ctx.strokeStyle = '#00000022';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3);
      ctx.lineTo(cx + Math.cos(a + 0.4) * R * 0.7, cy + Math.sin(a + 0.4) * R * 0.7);
      ctx.stroke();
    }

    txt(ctx, `ROUND ${state.round} OF ${state.rounds}`, w / 2, h * 0.065, 16, '#ffd98a');
    const aliveN = state.players.filter((p) => !p.out).length;
    txt(ctx, `${aliveN} still dry`, w / 2, h * 0.1, 13, '#9fb3bf');

    // players
    const sorted = [...state.players].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      const X = px2(p.x);
      const Y = py2(p.y);
      if (p.out) {
        if (outSeen.get(p.slot) === false || outSeen.get(p.slot) === undefined) {
          if (state.mode === 'play') {
            burst(X, Y, { n: 26, colors: ['#bfeef0', '#ffffff', '#7ad0c8'], speed: 3.6, size: 3.2, life: 40, grav: 0.12, up: true });
            sfx.splash();
            const by = p.outBy >= 0 ? nameOf(p.outBy) : 'the tide';
            feed.push({ text: `${by} sent ${nameOf(p.slot)} swimming!`, at: now });
            if (feed.length > 3) feed.shift();
          }
          outSeen.set(p.slot, true);
        }
        // bobbing in the water
        const bob = Math.sin(now / 380 + p.slot) * 3;
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#e8b88a';
        ctx.beginPath();
        ctx.arc(X, Y + bob, s * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colorOf(colorIdxOf(p.slot));
        ctx.fillRect(X - s * 0.34, Y + bob - s * 0.26, s * 0.68, s * 0.16);
        ctx.globalAlpha = 1;
        continue;
      }
      outSeen.set(p.slot, false);
      const mine = p.slot === game.you.slot;
      if (p.charging) {
        glow(ctx, X, Y, s * 1.6, '#ff5a3a', 0.4);
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = 0.25 - i * 0.06;
          castaway(ctx, X - p.fx * i * 7, Y - p.fy * i * 7 + s * 0.45, s * 0.34, colorIdxOf(p.slot), 0, true);
        }
        ctx.globalAlpha = 1;
      }
      if (p.dodging) glow(ctx, X, Y, s * 1.1, '#ffffff', 0.45);
      shadowEllipse(ctx, X, Y + s * 0.48, s * 0.4, s * 0.13, 0.3);
      castaway(ctx, X, Y + s * 0.45, mine ? s * 0.38 : s * 0.34, colorIdxOf(p.slot), p.stagger ? Math.sin(now / 60) * 0.25 : 0, p.charging);
      if (p.stagger) txt(ctx, '💫', X, Y - s * 0.8, 15);
      txt(ctx, nameOf(p.slot), X, Y + s * 0.72, 11, mine ? '#fff3b0' : '#f4ecd8bb');
    }

    // KO feed
    feed.forEach((f, i) => {
      const age = (now - f.at) / 4000;
      if (age > 1) return;
      ctx.globalAlpha = 1 - age;
      txt(ctx, f.text, w / 2, h * 0.135 + i * 18, 13.5, '#ffe8c8');
      ctx.globalAlpha = 1;
    });

    // between rounds banner
    if (state.mode === 'between') {
      ctx.fillStyle = '#10202ecc';
      ctx.fillRect(x, cy - 40, SHOVE.arena * s, 80);
      txt(ctx, state.round < state.rounds ? `Round ${state.round} done! Back on the rock...` : 'Final tally...', w / 2, cy, 20, '#ffd98a');
    }

    // action buttons (mine only)
    buttons = [];
    if (me && !me.out && state.mode === 'play') {
      const defs: { a: 'bump' | 'charge' | 'dodge'; label: string; key: string; cd: number; max: number; color: string }[] = [
        { a: 'bump', label: 'BUMP', key: 'SPACE', cd: me.cds.bump, max: SHOVE.bumpCd, color: '#f0a030' },
        { a: 'charge', label: 'CHARGE', key: 'E', cd: me.cds.charge, max: SHOVE.chargeCd, color: '#e8443a' },
        { a: 'dodge', label: 'DODGE', key: 'Q', cd: me.cds.dodge, max: SHOVE.dodgeCd, color: '#27c5c5' }
      ];
      defs.forEach((d, i) => {
        const bx = w - 56;
        const by = h - 60 - i * 92;
        const r = 36;
        buttons.push({ a: d.a, x: bx, y: by, r });
        const ready = d.cd <= 0;
        ctx.fillStyle = ready ? d.color : '#3a4a58';
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#10202e';
        ctx.lineWidth = 4;
        ctx.stroke();
        if (!ready) {
          ctx.strokeStyle = '#ffd98a';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(bx, by, r - 5, -Math.PI / 2, -Math.PI / 2 + (1 - d.cd / d.max) * Math.PI * 2);
          ctx.stroke();
        }
        txt(ctx, d.label, bx, by - 5, 12.5, '#fff3b0');
        txt(ctx, d.key, bx, by + 11, 10, '#10202e');
      });
      txt(ctx, 'Dodge a CHARGE at the last second to counter it!', w / 2, h - 18, 12.5, '#9fb3bf');
    }

    // scores
    const per = Math.min(150, w / Math.max(1, state.scores.length));
    state.scores.forEach((p, i) => {
      const sx = w / 2 + (i - (state.scores.length - 1) / 2) * per;
      chip(ctx, sx - 34, h * 0.945, colorIdxOf(p.slot), `${nameOf(p.slot)} ${p.score}`, 12);
    });
  },

  onPointer(_w, _h, px, py) {
    for (const b of buttons) {
      if (Math.hypot(px - b.x, py - b.y) <= b.r + 8) return { g: 'shove', a: b.a };
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
    if (key === ' ') return { g: 'shove', a: 'bump' };
    if (key === 'e') return { g: 'shove', a: 'charge' };
    if (key === 'q') return { g: 'shove', a: 'dodge' };
    if (['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
      keys.add(key);
    }
    return null;
  },
  onKeyUp(key) {
    keys.delete(key);
  }
};

// THE STAMPEDE: a chunky grid arena. Two players ride elephants (2x2 cells,
// slow, with a terrifying charge). Everyone else is a human (1 cell, quick)
// squeezing through gaps the elephants can't fit. Get stepped on = pancake.
// Roles rotate so every castaway gets one round on elephant-back.

import { STAMPEDE } from '../../shared/constants';
import type { Challenge, Ctx } from './types';

interface Mover {
  cx: number;
  cy: number;
  dx: number; // held direction, -1/0/1 after dominant-axis pick happens at step time
  dy: number;
  stepCd: number;
}
interface Elephant extends Mover {
  charging: number; // ticks left
  chargeCd: number;
}
interface Human extends Mover {
  alive: boolean;
}
interface St {
  pairs: number[][];
  roundIdx: number;
  mode: 'play' | 'between';
  modeAt: number;
  rocks: Set<number>; // cy * gridW + cx
  elephants: Map<number, Elephant>;
  humans: Map<number, Human>;
  score: Record<number, number>;
  finished: boolean;
}

const W = STAMPEDE.gridW;
const H = STAMPEDE.gridH;
const key = (cx: number, cy: number) => cy * W + cx;

function elephantFits(st: St, cx: number, cy: number, self: Elephant): boolean {
  if (cx < 0 || cy < 0 || cx + 1 >= W || cy + 1 >= H) return false;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      if (st.rocks.has(key(cx + dx, cy + dy))) return false;
    }
  }
  for (const e of st.elephants.values()) {
    if (e === self) continue;
    if (Math.abs(e.cx - cx) < 2 && Math.abs(e.cy - cy) < 2) return false;
  }
  return true;
}

function humanFits(st: St, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= W || cy >= H) return false;
  if (st.rocks.has(key(cx, cy))) return false;
  // an elephant is a wall (walking into one on purpose is not a feature)
  for (const e of st.elephants.values()) {
    if (cx >= e.cx && cx <= e.cx + 1 && cy >= e.cy && cy <= e.cy + 1) return false;
  }
  return true;
}

// Held direction -> one 4-way grid step, sliding to the other axis if blocked.
function tryStep(m: Mover, fits: (cx: number, cy: number) => boolean): void {
  if (m.dx === 0 && m.dy === 0) return;
  const horizFirst = Math.abs(m.dx) >= Math.abs(m.dy);
  const opts: [number, number][] = horizFirst
    ? [
        [Math.sign(m.dx), 0],
        [0, Math.sign(m.dy)]
      ]
    : [
        [0, Math.sign(m.dy)],
        [Math.sign(m.dx), 0]
      ];
  for (const [sx, sy] of opts) {
    if (sx === 0 && sy === 0) continue;
    if (fits(m.cx + sx, m.cy + sy)) {
      m.cx += sx;
      m.cy += sy;
      return;
    }
  }
}

function squashCheck(ctx: Ctx, st: St): void {
  for (const [eSlot, e] of st.elephants) {
    for (const [hSlot, h] of st.humans) {
      if (!h.alive) continue;
      if (h.cx >= e.cx && h.cx <= e.cx + 1 && h.cy >= e.cy && h.cy <= e.cy + 1) {
        h.alive = false;
        st.score[eSlot] = (st.score[eSlot] ?? 0) + STAMPEDE.squashPts;
      }
    }
  }
}

function setupRound(ctx: Ctx, st: St): void {
  st.mode = 'play';
  st.modeAt = ctx.t;
  st.elephants = new Map();
  st.humans = new Map();
  const elephants = st.pairs[st.roundIdx] ?? [];
  // rocks: fresh scatter each round, clear of spawn zones
  st.rocks = new Set();
  let placed = 0;
  let attempts = 0;
  while (placed < STAMPEDE.rocks && attempts++ < 300) {
    const cx = 1 + Math.floor(ctx.rand() * (W - 2));
    const cy = 1 + Math.floor(ctx.rand() * (H - 2));
    const nearCenter = Math.abs(cx - W / 2) < 4 && Math.abs(cy - H / 2) < 3;
    const nearCorner =
      (cx < 4 || cx > W - 5) && (cy < 4 || cy > H - 5);
    if (nearCenter || nearCorner || st.rocks.has(key(cx, cy))) continue;
    st.rocks.add(key(cx, cy));
    placed++;
  }
  elephants.forEach((slot, i) => {
    st.elephants.set(slot, {
      cx: Math.floor(W / 2) + (i === 0 ? -4 : 2),
      cy: Math.floor(H / 2) - 1,
      dx: 0,
      dy: 0,
      stepCd: 0,
      charging: 0,
      chargeCd: 0
    });
  });
  const corners: [number, number][] = [
    [1, 1],
    [W - 2, 1],
    [1, H - 2],
    [W - 2, H - 2],
    [Math.floor(W / 2), 1],
    [Math.floor(W / 2), H - 2]
  ];
  let c = 0;
  for (const slot of ctx.slots) {
    if (elephants.includes(slot)) continue;
    const [cx, cy] = corners[c++ % corners.length];
    st.humans.set(slot, { cx, cy, dx: 0, dy: 0, stepCd: 0, alive: true });
  }
}

export const stampede: Challenge = {
  key: 'stampede',
  title: 'THE STAMPEDE',
  tagline: 'Two elephants. Nowhere to hide.',
  howTo:
    'Two castaways ride ELEPHANTS: huge (4 squares!), slow, and angry, with a CHARGE button for a burst of speed. Everyone else is on foot: small, quick, and able to squeeze through gaps elephants cannot. Get stepped on and you are a pancake. Squashing scores, surviving scores, and everyone gets one round on elephant-back. Hold to run, A/D/W/S works too.',
  maxTicks: 99999,

  init(ctx: Ctx): void {
    // shuffled pairs: every slot rides exactly once. Small lobbies (2-3
    // players) ride solo so there's always somebody left to chase.
    const order = [...ctx.slots];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(ctx.rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const chunk = order.length >= 4 ? 2 : 1;
    const pairs: number[][] = [];
    for (let i = 0; i < order.length; i += chunk) pairs.push(order.slice(i, i + chunk));
    const st: St = {
      pairs,
      roundIdx: 0,
      mode: 'play',
      modeAt: 0,
      rocks: new Set(),
      elephants: new Map(),
      humans: new Map(),
      score: Object.fromEntries(ctx.slots.map((s) => [s, 0])),
      finished: false
    };
    ctx.priv = st;
    setupRound(ctx, st);
  },

  tick(ctx: Ctx): void {
    const st = ctx.priv as St;
    const elapsed = ctx.t - st.modeAt;

    if (st.mode === 'play') {
      for (const e of st.elephants.values()) {
        if (e.charging > 0) e.charging--;
        if (e.chargeCd > 0) e.chargeCd--;
        if (--e.stepCd <= 0) {
          tryStep(e, (cx, cy) => elephantFits(st, cx, cy, e));
          e.stepCd = e.charging > 0 ? STAMPEDE.chargeStep : STAMPEDE.elephantStep;
        }
      }
      for (const h of st.humans.values()) {
        if (!h.alive) continue;
        if (--h.stepCd <= 0) {
          tryStep(h, (cx, cy) => humanFits(st, cx, cy));
          h.stepCd = STAMPEDE.humanStep;
        }
      }
      squashCheck(ctx, st);
      // staying alive pays rent
      if (elapsed > 0 && elapsed % STAMPEDE.alivePtsEvery === 0) {
        for (const [slot, h] of st.humans) {
          if (h.alive) st.score[slot] = (st.score[slot] ?? 0) + 1;
        }
      }
      const anyAlive = [...st.humans.values()].some((h) => h.alive);
      if (elapsed >= STAMPEDE.roundTicks || !anyAlive) {
        for (const [slot, h] of st.humans) {
          if (h.alive) st.score[slot] = (st.score[slot] ?? 0) + STAMPEDE.surviveBonus;
        }
        st.mode = 'between';
        st.modeAt = ctx.t;
      }
    } else if (st.mode === 'between' && elapsed >= STAMPEDE.betweenTicks) {
      st.roundIdx++;
      if (st.roundIdx >= st.pairs.length) {
        st.finished = true;
      } else {
        setupRound(ctx, st);
      }
    }

    ctx.pub = {
      g: 'stampede',
      mode: st.mode,
      round: Math.min(st.roundIdx + 1, st.pairs.length),
      rounds: st.pairs.length,
      left: st.mode === 'play' ? Math.max(0, STAMPEDE.roundTicks - (ctx.t - st.modeAt)) : 0,
      rocks: [...st.rocks].map((k) => [k % W, Math.floor(k / W)] as [number, number]),
      elephants: [...st.elephants.entries()].map(([slot, e]) => ({
        slot,
        cx: e.cx,
        cy: e.cy,
        charging: e.charging > 0,
        cdLeft: e.chargeCd
      })),
      humans: [...st.humans.entries()].map(([slot, h]) => ({
        slot,
        cx: h.cx,
        cy: h.cy,
        alive: h.alive
      })),
      nextElephants: st.pairs[st.roundIdx + 1] ?? [],
      scores: ctx.slots.map((s) => ({ slot: s, score: st.score[s] ?? 0 }))
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'stampede') return;
    const st = ctx.priv as St;
    if (st.mode !== 'play') return;
    const e = st.elephants.get(slot);
    const h = st.humans.get(slot);
    if (msg.charge && e && e.chargeCd <= 0 && e.charging <= 0) {
      e.charging = STAMPEDE.chargeTicks;
      e.chargeCd = STAMPEDE.chargeCd + STAMPEDE.chargeTicks;
      e.stepCd = Math.min(e.stepCd, 1); // the charge kicks in NOW
      return;
    }
    if (msg.dx === undefined || msg.dy === undefined) return;
    const dx = Number(msg.dx);
    const dy = Number(msg.dy);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const target = e ?? h;
    if (!target || (h && !h.alive)) return;
    target.dx = Math.max(-1, Math.min(1, dx));
    target.dy = Math.max(-1, Math.min(1, dy));
  },

  done(ctx: Ctx): boolean {
    return (ctx.priv as St).finished;
  },

  result(ctx: Ctx) {
    const st = ctx.priv as St;
    return ctx.slots.map((s) => ({
      slot: s,
      value: st.score[s] ?? 0,
      display: `${st.score[s] ?? 0} pts`
    }));
  }
};

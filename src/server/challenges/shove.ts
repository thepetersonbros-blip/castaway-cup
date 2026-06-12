// OFF THE ROCK: sumo free-for-all on a shrinking rock over the sea.
// Lean into people to push (gang-ups stack), BUMP for a quick shove,
// CHARGE for a huge hit, and DODGE: time it against a charge and you
// sidestep while the charger stumbles past. Last one dry wins the round.

import { SHOVE } from '../../shared/constants';
import type { Challenge, Ctx } from './types';

interface P {
  x: number;
  y: number;
  dx: number; // held steer
  dy: number;
  fx: number; // facing (last nonzero steer)
  fy: number;
  vx: number; // knockback velocity
  vy: number;
  out: boolean;
  outBy: number;
  outAt: number; // tick eliminated (for placement)
  charging: number;
  cx: number; // charge direction
  cy: number;
  dodging: number;
  stagger: number;
  bumpCd: number;
  chargeCd: number;
  dodgeCd: number;
  lastHitBy: number;
  lastHitAt: number;
}
interface St {
  p: Record<number, P>;
  round: number;
  mode: 'play' | 'between';
  modeAt: number;
  score: Record<number, number>;
  kos: Record<number, number>;
  finished: boolean;
}

const C = SHOVE.arena / 2; // platform center

function radiusAt(elapsed: number): number {
  if (elapsed <= SHOVE.shrinkStart) return SHOVE.platformR0;
  const t = Math.min(1, (elapsed - SHOVE.shrinkStart) / SHOVE.shrinkTicks);
  return SHOVE.platformR0 - (SHOVE.platformR0 - SHOVE.platformRMin) * t;
}

function setupRound(ctx: Ctx, st: St): void {
  st.mode = 'play';
  st.modeAt = ctx.t;
  const n = ctx.slots.length;
  ctx.slots.forEach((slot, i) => {
    const a = (i / n) * Math.PI * 2 + 0.4;
    st.p[slot] = {
      x: C + Math.cos(a) * SHOVE.platformR0 * 0.62,
      y: C + Math.sin(a) * SHOVE.platformR0 * 0.62,
      dx: 0,
      dy: 0,
      fx: Math.cos(a + Math.PI),
      fy: Math.sin(a + Math.PI),
      vx: 0,
      vy: 0,
      out: false,
      outBy: -1,
      outAt: -1,
      charging: 0,
      cx: 0,
      cy: 0,
      dodging: 0,
      stagger: 0,
      bumpCd: 0,
      chargeCd: 0,
      dodgeCd: 0,
      lastHitBy: -1,
      lastHitAt: -999
    };
  });
}

function credit(st: St, victim: P, by: number, t: number): void {
  victim.lastHitBy = by;
  victim.lastHitAt = t;
}

export const shove: Challenge = {
  key: 'shove',
  title: 'OFF THE ROCK',
  tagline: 'Push or be pushed.',
  howTo:
    'Everyone on one rock; the tide eats it. Lean into people to push them (friends pushing together STACK). BUMP is a quick shove. CHARGE is a haymaker. DODGE at the right moment and a charger stumbles right past you, usually into the sea. Last castaway dry wins the round. Three rounds. Knockouts score extra.',
  maxTicks: 99999,

  init(ctx: Ctx): void {
    const st: St = {
      p: {},
      round: 1,
      mode: 'play',
      modeAt: 0,
      score: Object.fromEntries(ctx.slots.map((s) => [s, 0])),
      kos: Object.fromEntries(ctx.slots.map((s) => [s, 0])),
      finished: false
    };
    ctx.priv = st;
    setupRound(ctx, st);
  },

  tick(ctx: Ctx): void {
    const st = ctx.priv as St;
    const elapsed = ctx.t - st.modeAt;
    const R = radiusAt(elapsed);

    if (st.mode === 'play') {
      const alive = ctx.slots.filter((s) => !st.p[s].out);
      // move + timers
      for (const slot of alive) {
        const me = st.p[slot];
        if (me.bumpCd > 0) me.bumpCd--;
        if (me.chargeCd > 0) me.chargeCd--;
        if (me.dodgeCd > 0) me.dodgeCd--;
        if (me.dodging > 0) me.dodging--;
        if (me.stagger > 0) me.stagger--;

        if (me.charging > 0) {
          me.charging--;
          me.x += me.cx * SHOVE.chargeSpeed;
          me.y += me.cy * SHOVE.chargeSpeed;
        } else if (me.stagger <= 0) {
          if (me.dx !== 0 || me.dy !== 0) {
            me.fx = me.dx;
            me.fy = me.dy;
            const boost = me.dodging > 0 ? 1.25 : 1;
            me.x += me.dx * SHOVE.speed * boost;
            me.y += me.dy * SHOVE.speed * boost;
          }
        }
        me.x += me.vx;
        me.y += me.vy;
        me.vx *= SHOVE.velDecay;
        me.vy *= SHOVE.velDecay;
      }

      // charge impacts (checked before soft contact so the big hit lands)
      for (const slot of alive) {
        const me = st.p[slot];
        if (me.charging <= 0) continue;
        for (const os of alive) {
          if (os === slot) continue;
          const them = st.p[os];
          const d = Math.hypot(them.x - me.x, them.y - me.y);
          if (d > SHOVE.bodyR * 2) continue;
          if (them.dodging > 0) {
            // COUNTERED: sidestep, and the charger stumbles on through
            const side = Math.sign(me.cx * (them.y - me.y) - me.cy * (them.x - me.x)) || 1;
            const px = -me.cy * side;
            const py = me.cx * side;
            const nx = them.x + px * SHOVE.dodgeStep;
            const ny = them.y + py * SHOVE.dodgeStep;
            // the sidestep itself never throws the dodger off the rock
            if (Math.hypot(nx - C, ny - C) < R - SHOVE.bodyR * 0.5) {
              them.x = nx;
              them.y = ny;
            }
            me.stagger = SHOVE.staggerTicks;
            me.vx = me.cx * 0.55;
            me.vy = me.cy * 0.55;
            me.charging = 0;
            credit(st, me, os, ctx.t); // falling charger credits the dodger
          } else {
            them.vx += me.cx * SHOVE.chargeKick;
            them.vy += me.cy * SHOVE.chargeKick;
            credit(st, them, slot, ctx.t);
            me.charging = 0;
            me.vx = me.cx * 0.1;
            me.vy = me.cy * 0.1;
          }
          break;
        }
      }

      // soft body contact: leaning into someone pushes them; gang-ups stack
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          const a = st.p[alive[i]];
          const b = st.p[alive[j]];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          if (d >= SHOVE.bodyR * 2) continue;
          const nx = dx / d;
          const ny = dy / d;
          const sep = (SHOVE.bodyR * 2 - d) / 2;
          a.x -= nx * sep * 0.5;
          a.y -= ny * sep * 0.5;
          b.x += nx * sep * 0.5;
          b.y += ny * sep * 0.5;
          // press force in the direction each one is steering
          if (a.dx * nx + a.dy * ny > 0.3) {
            b.vx += a.dx * SHOVE.contactPush;
            b.vy += a.dy * SHOVE.contactPush;
            credit(st, b, alive[i], ctx.t);
          }
          if (b.dx * -nx + b.dy * -ny > 0.3) {
            a.vx += b.dx * SHOVE.contactPush;
            a.vy += b.dy * SHOVE.contactPush;
            credit(st, a, alive[j], ctx.t);
          }
        }
      }

      // the sea takes what leaves the rock
      for (const slot of alive) {
        const me = st.p[slot];
        if (Math.hypot(me.x - C, me.y - C) > R + SHOVE.bodyR * 0.3) {
          me.out = true;
          me.outAt = ctx.t;
          me.outBy = ctx.t - me.lastHitAt <= SHOVE.creditTicks ? me.lastHitBy : -1;
          if (me.outBy >= 0 && me.outBy !== slot) {
            st.kos[me.outBy] = (st.kos[me.outBy] ?? 0) + 1;
            st.score[me.outBy] = (st.score[me.outBy] ?? 0) + SHOVE.koPts;
          }
        }
      }

      const still = ctx.slots.filter((s) => !st.p[s].out);
      if (still.length <= 1 || elapsed >= SHOVE.maxRoundTicks) {
        // placement points: the longer you lasted, the more you get
        const order = ctx.slots
          .filter((s) => st.p[s].out)
          .sort((a, b) => st.p[a].outAt - st.p[b].outAt);
        order.forEach((s, i) => {
          st.score[s] = (st.score[s] ?? 0) + i;
        });
        for (const s of still) {
          st.score[s] = (st.score[s] ?? 0) + order.length + SHOVE.surviveBonus;
        }
        st.mode = 'between';
        st.modeAt = ctx.t;
      }
    } else if (st.mode === 'between' && elapsed >= SHOVE.betweenTicks) {
      st.round++;
      if (st.round > SHOVE.rounds) {
        st.finished = true;
      } else {
        setupRound(ctx, st);
      }
    }

    ctx.pub = {
      g: 'shove',
      mode: st.mode,
      round: Math.min(st.round, SHOVE.rounds),
      rounds: SHOVE.rounds,
      left: st.mode === 'play' ? Math.max(0, SHOVE.maxRoundTicks - elapsed) : 0,
      radius: Math.round(R * 100) / 100,
      players: ctx.slots.map((slot) => {
        const me = st.p[slot];
        return {
          slot,
          x: Math.round(me.x * 50) / 50,
          y: Math.round(me.y * 50) / 50,
          fx: Math.round(me.fx * 100) / 100,
          fy: Math.round(me.fy * 100) / 100,
          out: me.out,
          outBy: me.outBy,
          charging: me.charging > 0,
          dodging: me.dodging > 0,
          stagger: me.stagger > 0,
          cds: { bump: me.bumpCd, charge: me.chargeCd, dodge: me.dodgeCd }
        };
      }),
      scores: ctx.slots.map((s) => ({ slot: s, score: st.score[s] ?? 0, kos: st.kos[s] ?? 0 }))
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'shove') return;
    const st = ctx.priv as St;
    if (st.mode !== 'play') return;
    const me = st.p[slot];
    if (!me || me.out) return;

    if (msg.a === 'bump') {
      if (me.bumpCd > 0 || me.charging > 0 || me.stagger > 0) return;
      me.bumpCd = SHOVE.bumpCd;
      for (const os of ctx.slots) {
        if (os === slot) continue;
        const them = st.p[os];
        if (them.out || them.dodging > 0) continue;
        const dx = them.x - me.x;
        const dy = them.y - me.y;
        const d = Math.hypot(dx, dy);
        if (d > SHOVE.bumpRange) continue;
        if (me.fx * dx + me.fy * dy < 0) continue; // behind me
        them.vx += me.fx * SHOVE.bumpKick;
        them.vy += me.fy * SHOVE.bumpKick;
        credit(st, them, slot, ctx.t);
      }
      return;
    }
    if (msg.a === 'charge') {
      if (me.chargeCd > 0 || me.charging > 0 || me.stagger > 0) return;
      const len = Math.hypot(me.fx, me.fy) || 1;
      me.cx = me.fx / len;
      me.cy = me.fy / len;
      me.charging = SHOVE.chargeTicks;
      me.chargeCd = SHOVE.chargeCd + SHOVE.chargeTicks;
      return;
    }
    if (msg.a === 'dodge') {
      if (me.dodgeCd > 0 || me.stagger > 0) return;
      me.dodging = SHOVE.dodgeTicks;
      me.dodgeCd = SHOVE.dodgeCd + SHOVE.dodgeTicks;
      return;
    }
    if (msg.dx === undefined || msg.dy === undefined) return;
    let dx = Number(msg.dx);
    let dy = Number(msg.dy);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
      dx = 0;
      dy = 0;
    }
    me.dx = dx;
    me.dy = dy;
  },

  done(ctx: Ctx): boolean {
    return (ctx.priv as St).finished;
  },

  result(ctx: Ctx) {
    const st = ctx.priv as St;
    return ctx.slots.map((s) => ({
      slot: s,
      value: (st.score[s] ?? 0) * 100 + (st.kos[s] ?? 0),
      display: `${st.score[s] ?? 0} pts · ${st.kos[s] ?? 0} KOs`
    }));
  }
};

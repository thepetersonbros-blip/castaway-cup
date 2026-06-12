import { IDOL, TICK_MS } from '../../shared/constants';
import { randInt } from '../../shared/rng';
import type { Challenge, Ctx } from './types';

interface P {
  score: number;
  locked: boolean; // false-started this draw
  grabbedAt: number; // tick of grab this draw, -1
  bestMs: number;
}
interface St {
  p: Record<number, P>;
  draw: number; // 1-based
  mode: 'wait' | 'go' | 'scored';
  modeAt: number;
  goAt: number; // tick the idol appears (secret until it happens)
  order: number[]; // slots in grab order this draw
  finished: boolean;
}

export const idol: Challenge = {
  key: 'idol',
  title: 'SNATCH THE IDOL',
  tagline: 'Wait for it... WAIT for it...',
  howTo:
    'Keep your finger ready. The moment the idol appears, TAP (or SPACE). First grab scores 3, second 2, third 1. Grab too early and you lose a point and sit out the draw. Five draws. Reaction times are public. Choose your friends wisely.',
  maxTicks: 99999,

  init(ctx: Ctx): void {
    const p: Record<number, P> = {};
    for (const s of ctx.slots) p[s] = { score: 0, locked: false, grabbedAt: -1, bestMs: 99999 };
    const st: St = {
      p,
      draw: 1,
      mode: 'wait',
      modeAt: 0,
      goAt: randInt(ctx.rand, IDOL.waitMin, IDOL.waitMax),
      order: [],
      finished: false
    };
    ctx.priv = st;
  },

  tick(ctx: Ctx): void {
    const st = ctx.priv as St;

    if (st.mode === 'wait' && ctx.t >= st.goAt) {
      st.mode = 'go';
      st.modeAt = ctx.t;
    } else if (st.mode === 'go') {
      const allIn = ctx.slots.every((s) => st.p[s].grabbedAt >= 0 || st.p[s].locked || !ctx.connected(s));
      if (ctx.t - st.modeAt >= IDOL.goWindow || allIn) {
        // award the podium
        st.order.forEach((slot, i) => {
          if (i < IDOL.podium.length) st.p[slot].score += IDOL.podium[i];
        });
        st.mode = 'scored';
        st.modeAt = ctx.t;
      }
    } else if (st.mode === 'scored' && ctx.t - st.modeAt >= IDOL.showTicks) {
      if (st.draw >= IDOL.draws) {
        st.finished = true;
      } else {
        st.draw++;
        st.mode = 'wait';
        st.modeAt = ctx.t;
        st.goAt = ctx.t + randInt(ctx.rand, IDOL.waitMin, IDOL.waitMax);
        st.order = [];
        for (const s of ctx.slots) {
          st.p[s].locked = false;
          st.p[s].grabbedAt = -1;
        }
      }
    }

    ctx.pub = {
      g: 'idol',
      mode: st.mode,
      draw: st.draw,
      draws: IDOL.draws,
      scores: ctx.slots.map((s) => ({
        slot: s,
        score: st.p[s].score,
        locked: st.p[s].locked,
        ms:
          st.p[s].grabbedAt >= 0 && st.mode !== 'wait'
            ? Math.round((st.p[s].grabbedAt - st.goAt) * TICK_MS)
            : null
      }))
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'idol') return;
    const st = ctx.priv as St;
    const me = st.p[slot];
    if (!me || st.finished) return;
    if (st.mode === 'wait') {
      if (!me.locked) {
        me.locked = true;
        me.score += IDOL.falseStart;
      }
      return;
    }
    if (st.mode === 'go' && !me.locked && me.grabbedAt < 0) {
      me.grabbedAt = ctx.t;
      const ms = (ctx.t - st.goAt) * TICK_MS;
      me.bestMs = Math.min(me.bestMs, ms);
      st.order.push(slot);
    }
  },

  done(ctx: Ctx): boolean {
    return (ctx.priv as St).finished;
  },

  result(ctx: Ctx) {
    const st = ctx.priv as St;
    return ctx.slots.map((s) => ({
      slot: s,
      // score first; best single reaction breaks ties
      value: st.p[s].score * 1000 + (999 - Math.min(999, st.p[s].bestMs)),
      display: `${st.p[s].score} pts${st.p[s].bestMs < 99999 ? ` · best ${st.p[s].bestMs}ms` : ''}`
    }));
  }
};

import { CLIMB, TICKS_PER_SEC } from '../../shared/constants';
import type { Challenge, Ctx } from './types';

interface P {
  h: number;
  last: 'L' | 'R' | null;
  stingUntil: number;
  fin: number;
}

export const climb: Challenge = {
  key: 'climb',
  title: 'THE PALMS',
  tagline: 'Race to the coconuts.',
  howTo:
    'Climb your palm tree by alternating LEFT and RIGHT taps (or A/D keys). Tap the same side twice and you slip. First to the top takes it.',
  maxTicks: CLIMB.maxTicks,

  init(ctx: Ctx): void {
    const p: Record<number, P> = {};
    for (const s of ctx.slots) p[s] = { h: 0, last: null, stingUntil: 0, fin: -1 };
    ctx.priv = { p };
  },

  tick(ctx: Ctx): void {
    const { p } = ctx.priv as { p: Record<number, P> };
    ctx.pub = {
      g: 'climb',
      players: ctx.slots.map((s) => ({
        slot: s,
        h: Math.round(p[s].h * 10) / 10,
        fin: p[s].fin,
        sting: ctx.t < p[s].stingUntil,
        last: p[s].last
      }))
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'climb') return;
    const { p } = ctx.priv as { p: Record<number, P> };
    const me = p[slot];
    if (!me || me.fin >= 0 || ctx.t < me.stingUntil) return;
    const side = msg.side === 'L' ? 'L' : 'R';
    if (me.last === side) {
      me.h = Math.max(0, me.h - CLIMB.slip);
      me.stingUntil = ctx.t + CLIMB.stingTicks;
      me.last = null; // after a slip, either hand works
      return;
    }
    me.last = side;
    me.h += CLIMB.step;
    if (me.h >= CLIMB.top) {
      me.h = CLIMB.top;
      me.fin = ctx.t;
    }
  },

  done(ctx: Ctx): boolean {
    const { p } = ctx.priv as { p: Record<number, P> };
    return ctx.slots.every((s) => p[s].fin >= 0);
  },

  result(ctx: Ctx) {
    const { p } = ctx.priv as { p: Record<number, P> };
    return ctx.slots.map((s) => {
      const me = p[s];
      if (me.fin >= 0) {
        return {
          slot: s,
          value: 100000 - me.fin,
          display: `🥥 ${(me.fin / TICKS_PER_SEC).toFixed(1)}s`
        };
      }
      return { slot: s, value: me.h, display: `${Math.round(me.h)}% up` };
    });
  }
};

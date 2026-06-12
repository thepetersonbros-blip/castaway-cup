import { CLIMB, TICKS_PER_SEC } from '../../shared/constants';
import type { Challenge, Ctx } from './types';

interface P {
  h: number;
  idx: number; // position in the shared grip pattern
  stingUntil: number;
  fin: number;
}

// Build the grip pattern: runs of the same arm (L, LL, RRR, ...) so it's a
// read-and-react rhythm, not mindless alternation. Same pattern for everyone.
export function buildSeq(rand: () => number, len = 90): string {
  let s = '';
  while (s.length < len) {
    const side = rand() < 0.5 ? 'L' : 'R';
    const r = rand();
    const run = r < 0.4 ? 1 : r < 0.75 ? 2 : r < 0.95 ? 3 : 4;
    s += side.repeat(run);
  }
  return s.slice(0, len);
}

export const climb: Challenge = {
  key: 'climb',
  title: 'THE PALMS',
  tagline: 'Race to the coconuts.',
  howTo:
    'Climb your palm by following the grip pattern: tap LEFT or RIGHT (or A / D) to match the next letter shown. Sometimes it is L R L R, sometimes L L R R R: read it! A wrong arm means you slip. First to the top takes it.',
  maxTicks: CLIMB.maxTicks,

  init(ctx: Ctx): void {
    const p: Record<number, P> = {};
    for (const s of ctx.slots) p[s] = { h: 0, idx: 0, stingUntil: 0, fin: -1 };
    ctx.priv = { p, seq: buildSeq(ctx.rand) };
  },

  tick(ctx: Ctx): void {
    const { p, seq } = ctx.priv as { p: Record<number, P>; seq: string };
    ctx.pub = {
      g: 'climb',
      seq,
      players: ctx.slots.map((s) => ({
        slot: s,
        h: Math.round(p[s].h * 10) / 10,
        fin: p[s].fin,
        sting: ctx.t < p[s].stingUntil,
        idx: p[s].idx
      }))
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'climb') return;
    const { p, seq } = ctx.priv as { p: Record<number, P>; seq: string };
    const me = p[slot];
    if (!me || me.fin >= 0 || ctx.t < me.stingUntil) return;
    const side = msg.side === 'L' ? 'L' : 'R';
    if (side !== seq[me.idx]) {
      me.h = Math.max(0, me.h - CLIMB.slip);
      me.stingUntil = ctx.t + CLIMB.stingTicks;
      return;
    }
    me.idx++;
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

import { FIRE, TICKS_PER_SEC } from '../../shared/constants';
import type { Challenge, Ctx } from './types';

interface P {
  meter: number;
  fin: number; // tick finished, -1
  fizzleUntil: number;
  phase: number; // personal cursor phase offset (same start for all = 0)
}

// The spark cursor sweeps faster as your fire grows. Same hot zone for all.
// Exported for tests, which need to know exactly when a tap should land.
export function cursorPos(t: number, meter: number): number {
  const speed = 0.055 + (meter / 100) * 0.075; // radians per tick
  return 50 + 50 * Math.sin(t * speed);
}
export function zonePos(t: number, seedShift: number): number {
  return 50 + 38 * Math.sin(t * 0.013 + seedShift) * Math.cos(t * 0.007 + seedShift * 0.7);
}

export const fire: Challenge = {
  key: 'fire',
  title: 'FRICTION',
  tagline: 'First flame wins.',
  howTo:
    'Tap (or press SPACE) when the spark crosses the glowing hot zone. Good hits grow your fire. Misses fizzle it. First to a roaring flame wins!',
  maxTicks: FIRE.maxTicks,

  init(ctx: Ctx): void {
    const priv: Record<number, P> = {};
    for (const s of ctx.slots) priv[s] = { meter: 0, fin: -1, fizzleUntil: 0, phase: 0 };
    ctx.priv = { p: priv, seedShift: ctx.rand() * 6.28 };
  },

  tick(ctx: Ctx): void {
    const { p, seedShift } = ctx.priv as { p: Record<number, P>; seedShift: number };
    const zoneW =
      FIRE.zoneWidthStart -
      (FIRE.zoneWidthStart - FIRE.zoneWidthEnd) * Math.min(1, ctx.t / FIRE.maxTicks);
    ctx.pub = {
      g: 'fire',
      zone: zonePos(ctx.t, seedShift),
      zoneW,
      players: ctx.slots.map((s) => ({
        slot: s,
        meter: Math.round(p[s].meter),
        cursor: cursorPos(ctx.t, p[s].meter),
        fin: p[s].fin,
        fizzle: ctx.t < p[s].fizzleUntil
      }))
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'fire') return;
    const { p, seedShift } = ctx.priv as { p: Record<number, P>; seedShift: number };
    const me = p[slot];
    if (!me || me.fin >= 0 || ctx.t < me.fizzleUntil) return;
    const cur = cursorPos(ctx.t, me.meter);
    const zone = zonePos(ctx.t, seedShift);
    const zoneW =
      FIRE.zoneWidthStart -
      (FIRE.zoneWidthStart - FIRE.zoneWidthEnd) * Math.min(1, ctx.t / FIRE.maxTicks);
    const dist = Math.abs(cur - zone);
    if (dist <= zoneW / 2 + 2) {
      // +2 = a little latency mercy
      me.meter += FIRE.hitMin + FIRE.hitBonus * (1 - dist / (zoneW / 2 + 2));
      if (me.meter >= FIRE.target) {
        me.meter = FIRE.target;
        me.fin = ctx.t;
      }
    } else {
      me.meter = Math.max(0, me.meter - FIRE.missPenalty);
      me.fizzleUntil = ctx.t + FIRE.fizzleTicks;
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
        const secs = me.fin / TICKS_PER_SEC;
        return { slot: s, value: 100000 - me.fin, display: `🔥 ${secs.toFixed(1)}s` };
      }
      return { slot: s, value: me.meter, display: `${Math.round(me.meter)}% lit` };
    });
  }
};

import { BALANCE, TICKS_PER_SEC } from '../../shared/constants';
import type { Challenge, Ctx } from './types';

interface P {
  angle: number;
  vel: number;
  fallen: number; // tick, -1 alive
  lastImpulse: number;
}

export const balance: Challenge = {
  key: 'balance',
  title: 'THE PERCH',
  tagline: 'Last one standing on the pole.',
  howTo:
    'You are balancing on a pole over the lagoon. The SAME gusts of wind hit everyone. Tap the left or right side (or A/D) to lean against the tilt. Lean past 45 degrees and you take a swim. Outlast everybody.',
  maxTicks: BALANCE.maxTicks,

  init(ctx: Ctx): void {
    const p: Record<number, P> = {};
    for (const s of ctx.slots) p[s] = { angle: 0, vel: 0, fallen: -1, lastImpulse: -99 };
    // pre-roll a shared wind pattern so it's identical for every player
    const wind: number[] = [];
    let w = 0;
    for (let i = 0; i < BALANCE.maxTicks + 10; i++) {
      if (i % 24 === 0) w = (ctx.rand() * 2 - 1) * 1.4; // new gust target several times a sec
      wind.push(w);
    }
    ctx.priv = { p, wind };
  },

  tick(ctx: Ctx): void {
    const { p, wind } = ctx.priv as { p: Record<number, P>; wind: number[] };
    const gust = wind[Math.min(ctx.t, wind.length - 1)];
    const strength = BALANCE.windBase + BALANCE.windGrow * ctx.t;
    for (const s of ctx.slots) {
      const me = p[s];
      if (me.fallen >= 0) continue;
      // disconnected castaways stop fighting the wind (and soon swim)
      me.vel += gust * strength;
      me.vel *= BALANCE.damping;
      me.angle += me.vel;
      if (Math.abs(me.angle) >= BALANCE.fallAngle) {
        me.angle = Math.sign(me.angle) * BALANCE.fallAngle;
        me.fallen = ctx.t;
      }
    }
    ctx.pub = {
      g: 'balance',
      players: ctx.slots.map((s) => ({
        slot: s,
        angle: Math.round(p[s].angle * 10) / 10,
        fallen: p[s].fallen
      })),
      wind: gust * strength * 10,
      left: this.maxTicks - ctx.t
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'balance') return;
    const { p } = ctx.priv as { p: Record<number, P> };
    const me = p[slot];
    if (!me || me.fallen >= 0) return;
    if (ctx.t - me.lastImpulse < BALANCE.impulseCd) return;
    me.lastImpulse = ctx.t;
    me.vel += (msg.dir === -1 ? -1 : 1) * BALANCE.impulse * 0.12;
    me.angle += (msg.dir === -1 ? -1 : 1) * BALANCE.impulse;
  },

  done(ctx: Ctx): boolean {
    const { p } = ctx.priv as { p: Record<number, P> };
    const alive = ctx.slots.filter((s) => p[s].fallen < 0);
    return alive.length <= 1;
  },

  result(ctx: Ctx) {
    const { p } = ctx.priv as { p: Record<number, P> };
    return ctx.slots.map((s) => {
      const me = p[s];
      if (me.fallen < 0) {
        // survivors rank above all fallen; steadier pole breaks ties
        return {
          slot: s,
          value: 1_000_000 + (45 - Math.abs(me.angle)),
          display: `🧍 still up!`
        };
      }
      return {
        slot: s,
        value: me.fallen,
        display: `💦 ${(me.fallen / TICKS_PER_SEC).toFixed(1)}s`
      };
    });
  }
};

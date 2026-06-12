import { FISH } from '../../shared/constants';
import { randInt } from '../../shared/rng';
import type { Challenge, Ctx } from './types';

interface Fish {
  id: number;
  x: number;
  y: number;
  vx: number;
  wob: number; // wobble phase
  kind: 'small' | 'med' | 'gold';
}
interface P {
  score: number;
  cdUntil: number;
}

export const fish: Challenge = {
  key: 'fish',
  title: 'THE SHALLOWS',
  tagline: 'One lagoon. Six spears.',
  howTo:
    'Tap a fish to spear it. Small fish are quick and worth 3, the slow ones 2, and the golden fish 5. Everyone hunts the SAME lagoon, so steal the catch right out from under your friends. One second between throws.',
  maxTicks: FISH.maxTicks,

  init(ctx: Ctx): void {
    const p: Record<number, P> = {};
    for (const s of ctx.slots) p[s] = { score: 0, cdUntil: 0 };
    ctx.priv = { p, fish: [] as Fish[], nextId: 1, splashes: [] as any[], lastSpawn: 0 };
  },

  tick(ctx: Ctx): void {
    const st = ctx.priv as {
      p: Record<number, P>;
      fish: Fish[];
      nextId: number;
      splashes: { x: number; y: number; t: number; hit: boolean; slot: number }[];
      lastSpawn: number;
    };
    // spawn (a fuller pond for bigger tribes)
    const fishCap = Math.max(FISH.maxFish, ctx.slots.length + 3);
    if (ctx.t - st.lastSpawn >= FISH.spawnEvery && st.fish.length < fishCap) {
      st.lastSpawn = ctx.t;
      const roll = ctx.rand();
      const kind: Fish['kind'] = roll < 0.12 ? 'gold' : roll < 0.5 ? 'small' : 'med';
      const fromLeft = ctx.rand() < 0.5;
      const speed =
        (kind === 'small' ? 0.16 : kind === 'gold' ? 0.13 : 0.085) * (0.85 + ctx.rand() * 0.3);
      st.fish.push({
        id: st.nextId++,
        x: fromLeft ? -1 : FISH.poolW + 1,
        y: 2.5 + ctx.rand() * (FISH.poolH - 5),
        vx: fromLeft ? speed : -speed,
        wob: ctx.rand() * 6.28,
        kind
      });
    }
    // swim
    for (let i = st.fish.length - 1; i >= 0; i--) {
      const f = st.fish[i];
      f.x += f.vx;
      f.y += Math.sin(ctx.t * 0.08 + f.wob) * 0.045;
      if (f.x < -2 || f.x > FISH.poolW + 2) st.fish.splice(i, 1);
    }
    // old splashes fade
    st.splashes = st.splashes.filter((s) => ctx.t - s.t < 16);

    ctx.pub = {
      g: 'fish',
      fish: st.fish.map((f) => ({
        id: f.id,
        x: Math.round(f.x * 10) / 10,
        y: Math.round(f.y * 10) / 10,
        kind: f.kind,
        dir: Math.sign(f.vx)
      })),
      splashes: st.splashes,
      scores: ctx.slots.map((s) => ({
        slot: s,
        score: st.p[s].score,
        cd: ctx.t < st.p[s].cdUntil
      })),
      left: this.maxTicks - ctx.t
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'fish') return;
    const st = ctx.priv as { p: Record<number, P>; fish: Fish[]; splashes: any[] };
    const me = st.p[slot];
    if (!me || ctx.t < me.cdUntil) return;
    const x = Math.max(0, Math.min(FISH.poolW, Number(msg.x)));
    const y = Math.max(0, Math.min(FISH.poolH, Number(msg.y)));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    me.cdUntil = ctx.t + FISH.spearCd;
    // nearest fish within the spear radius (a little generous for lag)
    let best: Fish | null = null;
    let bestD = FISH.spearRadius;
    for (const f of st.fish) {
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    if (best) {
      st.fish.splice(st.fish.indexOf(best), 1);
      me.score += FISH.pts[best.kind];
      st.splashes.push({ x, y, t: ctx.t, hit: true, slot });
    } else {
      st.splashes.push({ x, y, t: ctx.t, hit: false, slot });
    }
  },

  done(): boolean {
    return false; // runs the full clock
  },

  result(ctx: Ctx) {
    const st = ctx.priv as { p: Record<number, P> };
    return ctx.slots.map((s) => ({
      slot: s,
      value: st.p[s].score,
      display: `🐟 ${st.p[s].score} pts`
    }));
  }
};

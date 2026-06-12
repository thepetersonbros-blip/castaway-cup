import { MEMORY } from '../../shared/constants';
import { randInt } from '../../shared/rng';
import type { Challenge, Ctx } from './types';

interface P {
  lives: number;
  progress: number;
  doneRound: boolean;
  outDepth: number; // -1 alive
  mistakes: number;
}
interface St {
  p: Record<number, P>;
  seq: number[];
  mode: 'show' | 'input' | 'between';
  modeAt: number; // tick the mode started
  depth: number; // 1-based round number
}

export const memory: Challenge = {
  key: 'memory',
  title: 'ECHOES OF THE ELDERS',
  tagline: 'The drums remember. Do you?',
  howTo:
    'Watch the totems flash, then repeat the sequence by tapping them in order (keys 1-4 work too). Each round adds one more beat. Two mistakes and your torch goes out. Outlast everyone.',
  maxTicks: 99999, // ends by elimination or max depth

  init(ctx: Ctx): void {
    const p: Record<number, P> = {};
    for (const s of ctx.slots) p[s] = { lives: MEMORY.lives, progress: 0, doneRound: false, outDepth: -1, mistakes: 0 };
    const seq: number[] = [];
    for (let i = 0; i < MEMORY.startLen; i++) seq.push(randInt(ctx.rand, 0, MEMORY.tiles - 1));
    const st: St = { p, seq, mode: 'show', modeAt: 0, depth: 1 };
    ctx.priv = st;
  },

  tick(ctx: Ctx): void {
    const st = ctx.priv as St;
    const elapsed = ctx.t - st.modeAt;

    if (st.mode === 'show') {
      const idx = Math.floor(elapsed / MEMORY.showTicks);
      if (idx >= st.seq.length) {
        st.mode = 'input';
        st.modeAt = ctx.t;
        for (const s of ctx.slots) {
          st.p[s].progress = 0;
          st.p[s].doneRound = st.p[s].outDepth >= 0; // the eliminated sit out
        }
      }
    } else if (st.mode === 'input') {
      const everyoneDone = ctx.slots.every((s) => st.p[s].doneRound);
      const timeUp = elapsed >= MEMORY.inputTicks;
      if (everyoneDone || timeUp) {
        if (timeUp) {
          for (const s of ctx.slots) {
            const me = st.p[s];
            if (!me.doneRound && me.outDepth < 0) {
              me.lives--;
              me.mistakes++;
              if (me.lives <= 0) me.outDepth = st.depth;
            }
          }
        }
        st.mode = 'between';
        st.modeAt = ctx.t;
      }
    } else if (st.mode === 'between') {
      if (elapsed >= MEMORY.betweenTicks) {
        st.depth++;
        st.seq.push(randInt(ctx.rand, 0, MEMORY.tiles - 1));
        st.mode = 'show';
        st.modeAt = ctx.t;
      }
    }

    const flashIdx =
      st.mode === 'show' ? Math.floor((ctx.t - st.modeAt) / MEMORY.showTicks) : -1;
    const withinFlash =
      st.mode === 'show' && (ctx.t - st.modeAt) % MEMORY.showTicks < MEMORY.showTicks * 0.7;
    ctx.pub = {
      g: 'memory',
      mode: st.mode,
      depth: st.depth,
      flash: flashIdx >= 0 && flashIdx < st.seq.length && withinFlash ? st.seq[flashIdx] : -1,
      inputLeft: st.mode === 'input' ? Math.max(0, MEMORY.inputTicks - (ctx.t - st.modeAt)) : 0,
      players: ctx.slots.map((s) => ({
        slot: s,
        progress: st.p[s].progress,
        lives: st.p[s].lives,
        out: st.p[s].outDepth >= 0
      }))
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'memory') return;
    const st = ctx.priv as St;
    if (st.mode !== 'input') return;
    const me = st.p[slot];
    if (!me || me.doneRound || me.outDepth >= 0) return;
    const tile = Number(msg.tile);
    if (!Number.isInteger(tile) || tile < 0 || tile >= MEMORY.tiles) return;
    if (tile === st.seq[me.progress]) {
      me.progress++;
      if (me.progress >= st.seq.length) me.doneRound = true;
    } else {
      me.lives--;
      me.mistakes++;
      me.progress = 0;
      if (me.lives <= 0) {
        me.outDepth = st.depth;
        me.doneRound = true;
      }
    }
  },

  done(ctx: Ctx): boolean {
    const st = ctx.priv as St;
    const alive = ctx.slots.filter((s) => st.p[s].outDepth < 0);
    return alive.length <= 1 || st.depth > MEMORY.maxDepth;
  },

  result(ctx: Ctx) {
    const st = ctx.priv as St;
    return ctx.slots.map((s) => {
      const me = st.p[s];
      if (me.outDepth < 0) {
        return {
          slot: s,
          value: 1000 + (MEMORY.lives - 0) * 10 - me.mistakes,
          display: `🧠 survived ${st.depth - 1} beats`
        };
      }
      return { slot: s, value: me.outDepth * 10 - me.mistakes, display: `out at round ${me.outDepth}` };
    });
  }
};

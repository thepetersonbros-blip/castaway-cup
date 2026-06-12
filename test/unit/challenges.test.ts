// Drive every mini-game's server logic directly and prove the winners win.

import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/shared/rng';
import type { Ctx } from '../../src/server/challenges/types';
import { fire, cursorPos, zonePos } from '../../src/server/challenges/fire';
import { fish } from '../../src/server/challenges/fish';
import { balance } from '../../src/server/challenges/balance';
import { climb } from '../../src/server/challenges/climb';
import { memory } from '../../src/server/challenges/memory';
import { idol } from '../../src/server/challenges/idol';
import { gather } from '../../src/server/challenges/gather';
import { type as typeGame } from '../../src/server/challenges/type';
import { stampede } from '../../src/server/challenges/stampede';
import { rankRows } from '../../src/server/season';
import { GATHER, STAMPEDE, TYPE } from '../../src/shared/constants';

function mkCtx(slots: number[], seed = 7): Ctx {
  return { t: 0, rand: mulberry32(seed), slots, connected: () => true, priv: null, pub: null };
}
function step(ctx: Ctx, ch: { tick(c: Ctx): void }, n = 1, each?: () => void): void {
  for (let i = 0; i < n; i++) {
    ctx.t++;
    ch.tick(ctx);
    each?.();
  }
}

describe('fire', () => {
  it('well-timed taps win; spam lights nothing', () => {
    const ctx = mkCtx([0, 1]);
    fire.init(ctx);
    fire.tick(ctx);
    const shift = (ctx.priv as any).seedShift as number;
    // slot 0 taps only when the spark is inside the zone; slot 1 never plays
    step(ctx, fire, fire.maxTicks - 1, () => {
      const me = (ctx.priv as any).p[0];
      if (me.fin >= 0) return;
      const cur = cursorPos(ctx.t, me.meter);
      if (Math.abs(cur - zonePos(ctx.t, shift)) < 5) fire.input(ctx, 0, { g: 'fire' });
    });
    const rows = rankRows(fire.result(ctx));
    expect(rows[0].slot).toBe(0);
    expect((ctx.priv as any).p[0].fin).toBeGreaterThan(0);
    expect((ctx.priv as any).p[1].meter).toBe(0);
  });

  it('misses fizzle the flame', () => {
    const ctx = mkCtx([0]);
    fire.init(ctx);
    fire.tick(ctx);
    const shift = (ctx.priv as any).seedShift as number;
    const me = (ctx.priv as any).p[0];
    me.meter = 50;
    // find a tick where the cursor is far from the zone, then tap
    step(ctx, fire, 200, () => {
      if (me.fizzleUntil > 0) return;
      const cur = cursorPos(ctx.t, me.meter);
      if (Math.abs(cur - zonePos(ctx.t, shift)) > 30) fire.input(ctx, 0, { g: 'fire' });
    });
    expect(me.meter).toBeLessThan(50);
  });
});

describe('fish', () => {
  it('spearing a real fish scores; water does not; reload is enforced', () => {
    const ctx = mkCtx([0, 1]);
    fish.init(ctx);
    step(ctx, fish, 60); // let some fish spawn
    const st = ctx.priv as any;
    expect(st.fish.length).toBeGreaterThan(0);
    const target = st.fish[0];
    fish.input(ctx, 0, { g: 'fish', x: target.x, y: target.y });
    expect(st.p[0].score).toBeGreaterThan(0);
    const after = st.p[0].score;
    // immediately again: still reloading, even on a perfect throw
    const t2 = st.fish[0];
    if (t2) {
      fish.input(ctx, 0, { g: 'fish', x: t2.x, y: t2.y });
      expect(st.p[0].score).toBe(after);
    }
    // a throw at empty water misses
    step(ctx, fish, 30);
    fish.input(ctx, 1, { g: 'fish', x: 0.2, y: 0.2 });
    expect(st.p[1].score).toBe(0);
    const rows = rankRows(fish.result(ctx));
    expect(rows[0].slot).toBe(0);
  });
});

describe('balance', () => {
  it('doing nothing means swimming; fighting the wind outlasts', () => {
    const ctx = mkCtx([0, 1]);
    balance.init(ctx);
    const st = ctx.priv as any;
    let guard = 0;
    while (!balance.done(ctx) && guard++ < balance.maxTicks) {
      ctx.t++;
      balance.tick(ctx);
      const me = st.p[0];
      if (me.fallen < 0 && Math.abs(me.angle) > 4) {
        balance.input(ctx, 0, { g: 'balance', dir: me.angle > 0 ? -1 : 1 });
      }
    }
    expect(st.p[1].fallen).toBeGreaterThanOrEqual(0); // the idle one swam
    const rows = rankRows(balance.result(ctx));
    expect(rows[0].slot).toBe(0);
  });
});

describe('climb', () => {
  it('the grip pattern mixes runs (LL, RRR), not plain alternation', () => {
    const ctx = mkCtx([0]);
    climb.init(ctx);
    const seq = (ctx.priv as any).seq as string;
    expect(seq.length).toBeGreaterThanOrEqual(60);
    expect(seq).toMatch(/^[LR]+$/);
    // must contain at least one double of each hand somewhere
    expect(seq).toMatch(/LL/);
    expect(seq).toMatch(/RR/);
  });

  it('reading the pattern climbs; wrong arms slip and stall', () => {
    const ctx = mkCtx([0, 1]);
    climb.init(ctx);
    climb.tick(ctx);
    const st = ctx.priv as any;
    // slot 1 always presses the WRONG arm: zero progress, zero pattern advance
    for (let i = 0; i < 30; i++) {
      ctx.t += 10;
      climb.tick(ctx);
      const want = st.seq[st.p[1].idx];
      climb.input(ctx, 1, { g: 'climb', side: want === 'L' ? 'R' : 'L' });
    }
    expect(st.p[1].h).toBe(0);
    expect(st.p[1].idx).toBe(0);
    // slot 0 follows the pattern to the top
    let guard = 0;
    while (st.p[0].fin < 0 && guard++ < 300) {
      ctx.t += 2;
      climb.tick(ctx);
      climb.input(ctx, 0, { g: 'climb', side: st.seq[st.p[0].idx] });
    }
    expect(st.p[0].fin).toBeGreaterThan(0);
    const rows = rankRows(climb.result(ctx));
    expect(rows[0].slot).toBe(0);
  });
});

describe('memory', () => {
  it('correct echoes survive, wrong taps burn lives, last torch wins', () => {
    const ctx = mkCtx([0, 1]);
    memory.init(ctx);
    const st = ctx.priv as any;
    let guard = 0;
    while (!memory.done(ctx) && guard++ < 20000) {
      ctx.t++;
      memory.tick(ctx);
      if (st.mode === 'input') {
        // slot 0 plays perfectly (reads the sequence like a cheating genius)
        const me = st.p[0];
        if (!me.doneRound && me.outDepth < 0) {
          memory.input(ctx, 0, { g: 'memory', tile: st.seq[me.progress] });
        }
        // slot 1 mashes the wrong tile
        const them = st.p[1];
        if (!them.doneRound && them.outDepth < 0) {
          memory.input(ctx, 1, { g: 'memory', tile: (st.seq[them.progress] + 1) % 4 });
        }
      }
    }
    expect(st.p[1].outDepth).toBeGreaterThan(0);
    expect(st.p[0].outDepth).toBe(-1);
    const rows = rankRows(memory.result(ctx));
    expect(rows[0].slot).toBe(0);
  });
});

describe('idol', () => {
  it('false starts cost a point; fastest grabs score the podium', () => {
    const ctx = mkCtx([0, 1, 2]);
    idol.init(ctx);
    const st = ctx.priv as any;
    // slot 2 jumps the gun on draw 1
    ctx.t++;
    idol.tick(ctx);
    idol.input(ctx, 2, { g: 'idol' });
    expect(st.p[2].score).toBe(-1);
    expect(st.p[2].locked).toBe(true);
    let guard = 0;
    while (!idol.done(ctx) && guard++ < 5000) {
      ctx.t++;
      idol.tick(ctx);
      if (st.mode === 'go') {
        // slot 0 grabs instantly, slot 1 a beat later
        if (st.p[0].grabbedAt < 0) idol.input(ctx, 0, { g: 'idol' });
        else if (ctx.t - st.goAt > 4 && st.p[1].grabbedAt < 0 && !st.p[1].locked) {
          idol.input(ctx, 1, { g: 'idol' });
        }
      }
    }
    expect(st.p[0].score).toBeGreaterThan(st.p[1].score);
    const rows = rankRows(idol.result(ctx));
    expect(rows[0].slot).toBe(0);
    // shame is permanent: the early bird never out-scores the champion
    expect(rows.find((r) => r.slot === 2)!.place).toBeGreaterThan(1);
  });
});

describe('gather', () => {
  const noSpawn = (ctx: Ctx) => {
    (ctx.priv as any).items = [];
    (ctx.priv as any).lastSpawn = 9_999_999;
  };

  it('weight slows you down; banking at your mat scores it', () => {
    const ctx = mkCtx([0, 1]);
    gather.init(ctx);
    noSpawn(ctx);
    const st = ctx.priv as any;
    const me = st.p[0];
    // empty-handed sprint
    me.x = 8;
    me.y = 10;
    gather.input(ctx, 0, { g: 'gather', dx: 1, dy: 0 });
    step(ctx, gather, 10);
    const fast = me.x - 8;
    // loaded waddle
    me.x = 8;
    me.carry = ['pine', 'pine'];
    me.wobble = 0;
    step(ctx, gather, 10);
    const slow = me.x - 8;
    expect(slow).toBeLessThan(fast * 0.8);
    // pickup
    gather.input(ctx, 0, { g: 'gather', dx: 0, dy: 0 });
    st.items.push({ id: 99, x: me.x, y: me.y, kind: 'berry' });
    step(ctx, gather, 1);
    expect(me.carry).toContain('berry');
    expect(st.items.length).toBe(0);
    // banking
    me.x = me.hx;
    me.y = me.hy;
    const expectPts = me.carry.reduce((s: number, k: string) => s + (GATHER.pts as any)[k], 0);
    step(ctx, gather, 1);
    expect(me.banked).toBe(expectPts);
    expect(me.carry.length).toBe(0);
    const rows = rankRows(gather.result(ctx));
    expect(rows[0].slot).toBe(0);
  });

  it('running with a heavy stack topples it and scatters the food', () => {
    const ctx = mkCtx([0]);
    gather.init(ctx);
    noSpawn(ctx);
    const st = ctx.priv as any;
    const me = st.p[0];
    me.x = 18;
    me.y = 10;
    me.carry = Array(8).fill('coconut');
    gather.input(ctx, 0, { g: 'gather', dx: 1, dy: 0 });
    let guard = 0;
    while (me.dizzy <= 0 && guard++ < 400) step(ctx, gather, 1);
    expect(me.dizzy).toBeGreaterThan(0);
    expect(me.carry.length).toBe(0);
    expect(st.items.length).toBe(8); // scattered, stealable
  });

  it('below the red line, a stack never topples', () => {
    const ctx = mkCtx([0]);
    gather.init(ctx);
    noSpawn(ctx);
    const st = ctx.priv as any;
    const me = st.p[0];
    me.x = 18;
    me.y = 10;
    me.carry = ['coconut', 'coconut'];
    gather.input(ctx, 0, { g: 'gather', dx: 1, dy: 0 });
    for (let i = 0; i < 300; i++) {
      me.wobble = Math.min(me.wobble, GATHER.redAt - 5); // disciplined pulser
      me.x = 10; // stay off walls and the mat
      step(ctx, gather, 1);
      expect(me.dizzy).toBe(0);
    }
    expect(me.carry.length).toBe(2);
  });

  it('standing still steadies the stack', () => {
    const ctx = mkCtx([0]);
    gather.init(ctx);
    noSpawn(ctx);
    const st = ctx.priv as any;
    const me = st.p[0];
    me.x = 18; // step off the home mat first, or the coconut banks itself
    me.y = 10;
    me.carry = ['coconut'];
    me.wobble = 60;
    gather.input(ctx, 0, { g: 'gather', dx: 0, dy: 0 });
    step(ctx, gather, 30);
    expect(me.wobble).toBe(0);
    expect(me.carry.length).toBe(1); // still on your head
  });
});

describe('type (message in a bottle)', () => {
  it('fastest correct words take the podium; typos and silence score nothing', () => {
    const ctx = mkCtx([0, 1, 2]);
    typeGame.init(ctx);
    const st = ctx.priv as any;
    let guard = 0;
    while (!typeGame.done(ctx) && guard++ < 40000) {
      ctx.t++;
      typeGame.tick(ctx);
      if (st.mode === 'go') {
        const word = st.words[st.round - 1] as string;
        // slot 0: instant, in capitals (case must not matter)
        if (st.p[0].doneAt < 0) typeGame.input(ctx, 0, { g: 'type', word: word.toUpperCase() });
        // slot 1: a typo first, then the word with messy spacing
        if (st.p[1].doneAt < 0) {
          typeGame.input(ctx, 1, { g: 'type', word: `${word}x` });
          if (ctx.t - st.modeAt > 6) typeGame.input(ctx, 1, { g: 'type', word: `  ${word}  ` });
        }
        // slot 2: stares at the sea
      }
    }
    expect(typeGame.done(ctx)).toBe(true);
    expect(st.p[0].score).toBe(TYPE.rounds * TYPE.podium[0]);
    expect(st.p[1].score).toBe(TYPE.rounds * TYPE.podium[1]);
    expect(st.p[2].score).toBe(0);
    const rows = rankRows(typeGame.result(ctx));
    expect(rows[0].slot).toBe(0);
    expect(rows[2].slot).toBe(2);
  });
});

describe('stampede', () => {
  it('every castaway rides an elephant exactly once', () => {
    const ctx = mkCtx([0, 1, 2, 3, 4, 5]);
    stampede.init(ctx);
    const st = ctx.priv as any;
    expect(st.pairs.length).toBe(3);
    expect(st.pairs.flat().sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('humans outrun elephants in the open', () => {
    const ctx = mkCtx([0, 1, 2]);
    stampede.init(ctx);
    const st = ctx.priv as any;
    st.rocks = new Set();
    const eSlot = st.pairs[0][0] as number;
    const hSlot = [0, 1, 2].find((s) => s !== eSlot)!;
    const e = st.elephants.get(eSlot);
    const hu = st.humans.get(hSlot);
    e.cx = 2;
    e.cy = 2;
    hu.cx = 2;
    hu.cy = 9;
    stampede.input(ctx, eSlot, { g: 'stampede', dx: 1, dy: 0 });
    stampede.input(ctx, hSlot, { g: 'stampede', dx: 1, dy: 0 });
    step(ctx, stampede, 60);
    expect(hu.cx - 2).toBeGreaterThan((e.cx - 2) * 1.5);
  });

  it('getting stepped on pancakes you and pays the elephant', () => {
    const ctx = mkCtx([0, 1, 2]);
    stampede.init(ctx);
    const st = ctx.priv as any;
    st.rocks = new Set();
    const eSlot = st.pairs[0][0] as number;
    const hSlot = [0, 1, 2].find((s) => s !== eSlot)!;
    const e = st.elephants.get(eSlot);
    const hu = st.humans.get(hSlot);
    e.cx = 5;
    e.cy = 5;
    hu.cx = 8;
    hu.cy = 6;
    hu.dx = 0;
    hu.dy = 0;
    stampede.input(ctx, eSlot, { g: 'stampede', dx: 1, dy: 0 });
    step(ctx, stampede, 60);
    expect(hu.alive).toBe(false);
    expect(st.score[eSlot]).toBe(STAMPEDE.squashPts);
  });

  it('a one-cell gap lets humans through and stops elephants', () => {
    const ctx = mkCtx([0, 1, 2]);
    stampede.init(ctx);
    const st = ctx.priv as any;
    // a wall down column 10 with a single gap at row 6
    st.rocks = new Set();
    for (let row = 0; row < STAMPEDE.gridH; row++) {
      if (row !== 6) st.rocks.add(row * STAMPEDE.gridW + 10);
    }
    const eSlot = st.pairs[0][0] as number;
    const hSlot = [0, 1, 2].find((s) => s !== eSlot)!;
    const e = st.elephants.get(eSlot);
    const hu = st.humans.get(hSlot);
    e.cx = 4;
    e.cy = 5;
    hu.cx = 7;
    hu.cy = 6;
    stampede.input(ctx, eSlot, { g: 'stampede', dx: 1, dy: 0 });
    stampede.input(ctx, hSlot, { g: 'stampede', dx: 1, dy: 0 });
    step(ctx, stampede, 120);
    expect(hu.cx).toBeGreaterThan(10); // slipped through the gap
    expect(e.cx).toBeLessThanOrEqual(8); // too wide, no crossing
  });

  it('rocks are few, far apart, and away from walls (no hiding pockets)', () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const ctx = mkCtx([0, 1, 2, 3, 4, 5], seed);
      stampede.init(ctx);
      const st = ctx.priv as any;
      const cells: [number, number][] = [...st.rocks].map((k: number) => [
        k % STAMPEDE.gridW,
        Math.floor(k / STAMPEDE.gridW)
      ]);
      expect(cells.length).toBeLessThanOrEqual(STAMPEDE.rocks);
      for (const [cx, cy] of cells) {
        expect(cx).toBeGreaterThanOrEqual(STAMPEDE.rockMargin);
        expect(cx).toBeLessThan(STAMPEDE.gridW - STAMPEDE.rockMargin);
        expect(cy).toBeGreaterThanOrEqual(STAMPEDE.rockMargin);
        expect(cy).toBeLessThan(STAMPEDE.gridH - STAMPEDE.rockMargin);
      }
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const d = Math.max(
            Math.abs(cells[i][0] - cells[j][0]),
            Math.abs(cells[i][1] - cells[j][1])
          );
          expect(d, `seed ${seed}: rocks ${i},${j} too close`).toBeGreaterThanOrEqual(
            STAMPEDE.rockSpacing
          );
        }
      }
    }
  });

  it('the first step after standing still is instant', () => {
    const ctx = mkCtx([0, 1, 2]);
    stampede.init(ctx);
    const st = ctx.priv as any;
    st.rocks = new Set();
    const hSlot = [0, 1, 2].find((s) => st.humans.has(s))!;
    const hu = st.humans.get(hSlot);
    hu.cx = 10;
    hu.cy = 6;
    step(ctx, stampede, 30); // idle: timers drain
    stampede.input(ctx, hSlot, { g: 'stampede', dx: 1, dy: 0 });
    step(ctx, stampede, 1);
    expect(hu.cx).toBe(11); // moved on the very next tick
  });

  it('flattening everyone ends the round early', () => {
    const ctx = mkCtx([0, 1, 2]);
    stampede.init(ctx);
    const st = ctx.priv as any;
    for (const h of st.humans.values()) h.alive = false;
    step(ctx, stampede, 2);
    expect(st.mode).toBe('between');
  });
});

describe('ranking', () => {
  it('ties share the better place and its points', () => {
    const rows = rankRows([
      { slot: 0, value: 50, display: 'a' },
      { slot: 1, value: 50, display: 'b' },
      { slot: 2, value: 10, display: 'c' }
    ]);
    expect(rows.find((r) => r.slot === 0)!.place).toBe(1);
    expect(rows.find((r) => r.slot === 1)!.place).toBe(1);
    expect(rows.find((r) => r.slot === 2)!.place).toBe(3);
    expect(rows.find((r) => r.slot === 0)!.pts).toBe(10);
    expect(rows.find((r) => r.slot === 1)!.pts).toBe(10);
    expect(rows.find((r) => r.slot === 2)!.pts).toBe(5);
  });
});

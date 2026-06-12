// THE FEAST: one shared beach, food everywhere. Stack it over your head.
// Weight slows you down and builds wobble while you move; stand still to
// steady the stack. Push too hard and it all topples for anyone to steal.
// Only food banked at your own mat counts.

import { GATHER } from '../../shared/constants';
import type { FoodKind } from '../../shared/protocol';
import type { Challenge, Ctx } from './types';

interface Item {
  id: number;
  x: number;
  y: number;
  kind: FoodKind;
}
interface P {
  x: number;
  y: number;
  dx: number;
  dy: number;
  carry: FoodKind[];
  banked: number;
  wobble: number;
  dizzy: number;
  hx: number;
  hy: number;
}
interface St {
  p: Record<number, P>;
  items: Item[];
  nextId: number;
  lastSpawn: number;
}

const weightOf = (carry: FoodKind[]) => carry.reduce((s, k) => s + GATHER.pts[k], 0);

function rollKind(ctx: Ctx, x: number): FoodKind {
  const centerish = Math.abs(x - GATHER.arenaW / 2) < GATHER.arenaW / 6;
  const r = ctx.rand();
  if (centerish && r < 0.3) return 'pine'; // the jackpots live mid-beach
  if (r < 0.55) return 'berry';
  return 'coconut';
}

function spawnItem(ctx: Ctx, st: St): void {
  const x = 2 + ctx.rand() * (GATHER.arenaW - 4);
  const y = 2 + ctx.rand() * (GATHER.arenaH - 4);
  st.items.push({ id: st.nextId++, x, y, kind: rollKind(ctx, x) });
}

export const gather: Challenge = {
  key: 'gather',
  title: 'THE FEAST',
  tagline: 'Stack it high. Walk it home.',
  howTo:
    'Hold a finger (or arrow keys / WASD) to run around the beach. Run over food and it stacks above your head. The heavier the stack, the slower you go, and moving makes it WOBBLE. Stand still to steady it, or it all topples and anyone can grab it. Bank food at YOUR colored mat. Berries 1, coconuts 2, pineapples 5. Only banked food counts!',
  maxTicks: GATHER.maxTicks,

  init(ctx: Ctx): void {
    const st: St = { p: {}, items: [], nextId: 1, lastSpawn: 0 };
    const n = ctx.slots.length;
    ctx.slots.forEach((slot, i) => {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      const hx = GATHER.arenaW / 2 + Math.cos(a) * (GATHER.arenaW / 2 - 3.5);
      const hy = GATHER.arenaH / 2 + Math.sin(a) * (GATHER.arenaH / 2 - 2.8);
      st.p[slot] = { x: hx, y: hy, dx: 0, dy: 0, carry: [], banked: 0, wobble: 0, dizzy: 0, hx, hy };
    });
    for (let i = 0; i < GATHER.startItems; i++) spawnItem(ctx, st);
    ctx.priv = st;
  },

  tick(ctx: Ctx): void {
    const st = ctx.priv as St;
    // restock the beach
    if (ctx.t - st.lastSpawn >= GATHER.spawnEvery && st.items.length < GATHER.maxItems) {
      st.lastSpawn = ctx.t;
      spawnItem(ctx, st);
    }

    for (const slot of ctx.slots) {
      const me = st.p[slot];
      if (me.dizzy > 0) {
        me.dizzy--;
        me.wobble = 0;
        continue;
      }
      const weight = weightOf(me.carry);
      const moving = me.dx !== 0 || me.dy !== 0;
      if (moving) {
        const speed =
          GATHER.baseSpeed * Math.max(GATHER.minSpeedFactor, 1 - GATHER.slowPerWeight * weight);
        me.x = Math.min(GATHER.arenaW - 1, Math.max(1, me.x + me.dx * speed));
        me.y = Math.min(GATHER.arenaH - 1, Math.max(1, me.y + me.dy * speed));
        if (weight > 0) me.wobble += GATHER.wobbleBase + GATHER.wobblePerWeight * weight;
      } else {
        me.wobble = Math.max(0, me.wobble - GATHER.wobbleDecay);
      }

      // TIMBER!
      if (me.wobble >= GATHER.toppleAt) {
        for (const k of me.carry) {
          if (st.items.length >= GATHER.scatterMax) break;
          st.items.push({
            id: st.nextId++,
            x: Math.min(GATHER.arenaW - 1, Math.max(1, me.x + (ctx.rand() * 2 - 1) * 3)),
            y: Math.min(GATHER.arenaH - 1, Math.max(1, me.y + (ctx.rand() * 2 - 1) * 3)),
            kind: k
          });
        }
        me.carry = [];
        me.wobble = 0;
        me.dizzy = GATHER.dizzyTicks;
        continue;
      }

      // pickups
      if (me.carry.length < GATHER.maxStack) {
        for (let i = st.items.length - 1; i >= 0; i--) {
          const it = st.items[i];
          if (Math.hypot(it.x - me.x, it.y - me.y) <= GATHER.pickupRadius) {
            me.carry.push(it.kind);
            st.items.splice(i, 1);
            if (me.carry.length >= GATHER.maxStack) break;
          }
        }
      }

      // banking
      if (me.carry.length > 0 && Math.hypot(me.hx - me.x, me.hy - me.y) <= GATHER.bankRadius) {
        me.banked += weightOf(me.carry);
        me.carry = [];
        me.wobble = 0;
      }
    }

    ctx.pub = {
      g: 'gather',
      items: st.items.map((it) => ({
        id: it.id,
        x: Math.round(it.x * 10) / 10,
        y: Math.round(it.y * 10) / 10,
        kind: it.kind
      })),
      players: ctx.slots.map((slot) => {
        const me = st.p[slot];
        return {
          slot,
          x: Math.round(me.x * 20) / 20,
          y: Math.round(me.y * 20) / 20,
          moving: me.dx !== 0 || me.dy !== 0,
          carry: me.carry,
          wobble: Math.round(Math.min(100, me.wobble)),
          banked: me.banked,
          dizzy: me.dizzy > 0,
          hx: Math.round(me.hx * 10) / 10,
          hy: Math.round(me.hy * 10) / 10
        };
      }),
      left: this.maxTicks - ctx.t
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'gather') return;
    const st = ctx.priv as St;
    const me = st.p[slot];
    if (!me) return;
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

  done(): boolean {
    return false; // the feast runs the full clock
  },

  result(ctx: Ctx) {
    const st = ctx.priv as St;
    return ctx.slots.map((slot) => ({
      slot,
      value: st.p[slot].banked,
      display: `🧺 ${st.p[slot].banked} banked`
    }));
  }
};

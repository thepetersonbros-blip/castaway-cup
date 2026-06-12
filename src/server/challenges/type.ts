// MESSAGE IN A BOTTLE: a survivor word washes ashore, everyone types it.
// The client auto-submits the instant the text matches, so this is a pure
// typing race. Fastest three correct each round score 3 / 2 / 1.

import { TICK_MS, TYPE } from '../../shared/constants';
import type { Challenge, Ctx } from './types';

export const WORDS = [
  'coconut', 'immunity', 'blindside', 'campfire', 'machete', 'torch', 'bamboo',
  'lagoon', 'monsoon', 'driftwood', 'jellyfish', 'volcano', 'quicksand', 'papaya',
  'castaway', 'betrayal', 'alliance', 'shipwreck', 'barnacle', 'hammock', 'snorkel',
  'typhoon', 'outwit', 'outplay', 'outlast', 'bonfire', 'seaweed', 'mangrove',
  'plankton', 'tide pool', 'sea turtle', 'wild boar', 'palm frond', 'fire dance',
  'coconut crab', 'tribal council', 'hidden idol', 'rice rations', 'spear fishing',
  'sand crab', 'banana leaf', 'island breeze', 'salt water', 'jungle vine',
  'coral reef', 'storm cloud', 'rogue wave', 'message in a bottle'
];

export const normWord = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

interface P {
  score: number;
  doneAt: number; // tick finished this round, -1
  lastMs: number | null; // this round's time, frozen at the finish
  totalMs: number;
  bestMs: number;
}
interface St {
  p: Record<number, P>;
  words: string[];
  round: number; // 1-based
  mode: 'go' | 'scored';
  modeAt: number;
  order: number[]; // finish order this round
  finished: boolean;
}

export const type: Challenge = {
  key: 'type',
  title: 'MESSAGE IN A BOTTLE',
  tagline: 'Read it. Type it. FAST.',
  howTo:
    'A word washes ashore. Type it in the box, exactly: it sends itself the moment it is right, so just fix your typos and keep hammering. The three fastest each round score 3, 2, 1 points. Ten bottles. Thumbs count.',
  maxTicks: 99999, // ends after the last bottle

  init(ctx: Ctx): void {
    const p: Record<number, P> = {};
    for (const s of ctx.slots) {
      p[s] = { score: 0, doneAt: -1, lastMs: null, totalMs: 0, bestMs: 999999 };
    }
    // deal 10 distinct words, seeded
    const deck = [...WORDS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(ctx.rand() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const st: St = {
      p,
      words: deck.slice(0, TYPE.rounds),
      round: 1,
      mode: 'go',
      modeAt: 0,
      order: [],
      finished: false
    };
    ctx.priv = st;
  },

  tick(ctx: Ctx): void {
    const st = ctx.priv as St;
    const elapsed = ctx.t - st.modeAt;

    if (st.mode === 'go') {
      const allDone = ctx.slots.every((s) => st.p[s].doneAt >= 0 || !ctx.connected(s));
      if (allDone || elapsed >= TYPE.roundTicks) {
        st.order.forEach((slot, i) => {
          if (i < TYPE.podium.length) st.p[slot].score += TYPE.podium[i];
        });
        st.mode = 'scored';
        st.modeAt = ctx.t;
      }
    } else if (st.mode === 'scored' && elapsed >= TYPE.scoredTicks) {
      if (st.round >= TYPE.rounds) {
        st.finished = true;
      } else {
        st.round++;
        st.mode = 'go';
        st.modeAt = ctx.t;
        st.order = [];
        for (const s of ctx.slots) {
          st.p[s].doneAt = -1;
          st.p[s].lastMs = null;
        }
      }
    }

    ctx.pub = {
      g: 'type',
      round: st.round,
      rounds: TYPE.rounds,
      mode: st.mode,
      word: st.words[st.round - 1],
      players: ctx.slots.map((s) => ({
        slot: s,
        score: st.p[s].score,
        done: st.p[s].doneAt >= 0,
        ms: st.p[s].lastMs
      }))
    };
  },

  input(ctx: Ctx, slot: number, msg): void {
    if (msg.g !== 'type') return;
    const st = ctx.priv as St;
    if (st.mode !== 'go' || st.finished) return;
    const me = st.p[slot];
    if (!me || me.doneAt >= 0) return;
    const attempt = String(msg.word ?? '').slice(0, 60);
    if (normWord(attempt) !== normWord(st.words[st.round - 1])) return;
    me.doneAt = ctx.t;
    const ms = (ctx.t - st.modeAt) * TICK_MS;
    me.lastMs = ms;
    me.totalMs += ms;
    me.bestMs = Math.min(me.bestMs, ms);
    st.order.push(slot);
  },

  done(ctx: Ctx): boolean {
    return (ctx.priv as St).finished;
  },

  result(ctx: Ctx) {
    const st = ctx.priv as St;
    return ctx.slots.map((s) => {
      const me = st.p[s];
      return {
        slot: s,
        // score rules; total typing time breaks ties (less = better)
        value: me.score * 1_000_000 - Math.min(999_999, me.totalMs),
        display: `⌨ ${me.score} pts${me.bestMs < 999999 ? ` · best ${(me.bestMs / 1000).toFixed(1)}s` : ''}`
      };
    });
  }
};

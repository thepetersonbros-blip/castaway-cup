import {
  COUNTDOWN_TICKS,
  INTRO_TICKS,
  POINTS,
  RESULTS_TICKS,
  STANDINGS_TICKS
} from '../shared/constants';
import { mulberry32, shuffle } from '../shared/rng';
import type { ChallengeCard, FinalMsg, PlacementRow, ResultsMsg } from '../shared/protocol';
import { CHALLENGES, CHALLENGE_KEYS } from './challenges';
import type { Ctx, ResultRow } from './challenges/types';
import type { PlayerSlot, Room } from './types';

export function connectedPlayers(room: Room): PlayerSlot[] {
  return room.players.filter((p): p is PlayerSlot => !!p && p.socketId !== null);
}

export function totalsOf(room: Room): { slot: number; total: number }[] {
  return room.players
    .filter((p): p is PlayerSlot => !!p)
    .map((p) => ({ slot: p.slot, total: p.total }))
    .sort((a, b) => b.total - a.total);
}

export function cardOf(room: Room): ChallengeCard | null {
  if (room.idx >= room.order.length || room.order.length === 0) return null;
  const c = CHALLENGES[room.order[room.idx]];
  return {
    key: c.key,
    title: c.title,
    tagline: c.tagline,
    howTo: c.howTo,
    index: room.idx + 1,
    total: room.order.length
  };
}

export function startSeason(room: Room): void {
  for (const p of room.players) if (p) p.total = 0;
  room.order = shuffle(room.rand, CHALLENGE_KEYS);
  room.idx = 0;
  room.results = null;
  room.final = null;
  enterIntro(room);
}

function enterIntro(room: Room): void {
  room.phase = 'intro';
  room.phaseTicks = INTRO_TICKS;
  room.challenge = null;
  room.ctx = null;
  room.pendingSync = true;
}

function enterCountdown(room: Room): void {
  room.phase = 'countdown';
  room.phaseTicks = COUNTDOWN_TICKS;
  room.pendingSync = true;
}

function enterPlaying(room: Room): void {
  const key = room.order[room.idx];
  const challenge = CHALLENGES[key];
  const slots = connectedPlayers(room).map((p) => p.slot);
  const ctx: Ctx = {
    t: 0,
    rand: mulberry32((room.seed ^ (room.idx * 2654435761)) >>> 0),
    slots,
    connected: (slot) => room.players[slot]?.socketId !== null,
    priv: null,
    pub: null
  };
  challenge.init(ctx);
  challenge.tick(ctx); // first public state immediately
  room.challenge = challenge;
  room.ctx = ctx;
  room.phase = 'playing';
  room.pendingSync = true;
}

// Rank result rows: higher value = better place; equal values share a place.
export function rankRows(rows: ResultRow[]): PlacementRow[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const out: PlacementRow[] = [];
  let place = 0;
  let prev = Number.NaN;
  sorted.forEach((r, i) => {
    if (r.value !== prev) {
      place = i + 1;
      prev = r.value;
    }
    out.push({
      slot: r.slot,
      place,
      display: r.display,
      pts: POINTS[Math.min(place - 1, POINTS.length - 1)] ?? 1
    });
  });
  return out;
}

function finishChallenge(room: Room): void {
  const challenge = room.challenge!;
  const ctx = room.ctx!;
  const rows = rankRows(challenge.result(ctx));
  for (const r of rows) {
    const p = room.players[r.slot];
    if (p) p.total += r.pts;
  }
  room.results = {
    card: cardOf(room)!,
    rows,
    totals: totalsOf(room)
  };
  room.challenge = null;
  room.ctx = null;
  room.phase = 'results';
  room.phaseTicks = RESULTS_TICKS;
  room.pendingSync = true;
}

function enterStandingsOrFinal(room: Room): void {
  room.idx++;
  if (room.idx >= room.order.length) {
    const totals = totalsOf(room);
    const top = totals.length > 0 ? totals[0].total : 0;
    const final: FinalMsg = {
      totals,
      champions: totals.filter((t) => t.total === top).map((t) => t.slot)
    };
    room.final = final;
    room.phase = 'final';
    room.pendingSync = true;
    return;
  }
  room.phase = 'standings';
  room.phaseTicks = STANDINGS_TICKS;
  room.pendingSync = true;
}

export function seasonTick(room: Room): void {
  room.tick++;
  switch (room.phase) {
    case 'lobby':
    case 'final':
      return;
    case 'intro': {
      room.phaseTicks--;
      if (room.phaseTicks <= 0) enterCountdown(room);
      return;
    }
    case 'countdown': {
      room.phaseTicks--;
      if (room.phaseTicks <= 0) enterPlaying(room);
      return;
    }
    case 'playing': {
      const c = room.challenge;
      const ctx = room.ctx;
      if (!c || !ctx) return;
      ctx.t++;
      c.tick(ctx);
      if (c.done(ctx) || ctx.t >= c.maxTicks) finishChallenge(room);
      return;
    }
    case 'results': {
      room.phaseTicks--;
      if (room.phaseTicks <= 0) enterStandingsOrFinal(room);
      return;
    }
    case 'standings': {
      room.phaseTicks--;
      if (room.phaseTicks <= 0) enterIntro(room);
      return;
    }
  }
}

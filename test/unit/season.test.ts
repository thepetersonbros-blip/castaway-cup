// A whole season, start to crown, driven tick by tick with no sockets.

import { describe, expect, it } from 'vitest';
import { CHALLENGE_KEYS } from '../../src/server/challenges';
import { createRoom, joinRoom, rooms } from '../../src/server/rooms';
import { endSeasonNow, pickChallenge, remaining, seasonTick, startSeason } from '../../src/server/season';
import type { Room } from '../../src/server/types';

// drive a season; the "host" rolls the dice whenever a pick is due
function runToFinal(room: Room, onTick?: () => void): void {
  let guard = 0;
  while (room.phase !== 'final' && guard++ < 120000) {
    if (room.phase === 'pick') pickChallenge(room, 'random');
    seasonTick(room);
    onTick?.();
  }
}

function mkRoom(n: number): Room {
  const room = createRoom(123);
  for (let i = 0; i < n; i++) {
    const out = joinRoom({ v: 1, room: room.code, name: `P${i}`, color: i });
    if (out.ok) out.player.socketId = `fake-${i}`;
  }
  return room;
}

describe('a full season', () => {
  it('runs every challenge, scores every game, and crowns a champion', () => {
    const room = mkRoom(6);
    startSeason(room);
    expect(room.phase).toBe('pick'); // the host chooses first
    expect(remaining(room).length).toBe(CHALLENGE_KEYS.length);

    const phasesSeen = new Set<string>();
    const resultsSeen: string[] = [];
    let lastResults = null as unknown;
    runToFinal(room, () => {
      phasesSeen.add(room.phase);
      if (room.results && room.results !== lastResults) {
        lastResults = room.results;
        resultsSeen.push(room.results.card.key);
        // every connected player got a placement row and points were applied
        expect(room.results.rows.length).toBe(6);
        for (const row of room.results.rows) {
          expect(row.pts).toBeGreaterThan(0);
          expect(row.place).toBeGreaterThanOrEqual(1);
          expect(row.place).toBeLessThanOrEqual(6);
        }
      }
    });

    expect(room.phase).toBe('final');
    expect(resultsSeen.length).toBe(CHALLENGE_KEYS.length);
    expect(new Set(resultsSeen).size).toBe(CHALLENGE_KEYS.length);
    for (const p of ['intro', 'countdown', 'playing', 'results', 'standings']) {
      expect(phasesSeen.has(p), `phase ${p} happened`).toBe(true);
    }
    expect(room.final).not.toBeNull();
    expect(room.final!.champions.length).toBeGreaterThanOrEqual(1);
    // totals are the sum of every game's points: at least 1 per challenge
    for (const t of room.final!.totals) {
      expect(t.total).toBeGreaterThanOrEqual(CHALLENGE_KEYS.length);
    }
    // the champion has the top total
    const top = Math.max(...room.final!.totals.map((t) => t.total));
    for (const c of room.final!.champions) {
      expect(room.final!.totals.find((t) => t.slot === c)!.total).toBe(top);
    }
    rooms.delete(room.code);
  });

  it('the host can run season after season; totals reset', () => {
    const room = mkRoom(3);
    startSeason(room);
    runToFinal(room);
    const totalsA = room.final!.totals.map((t) => t.total);
    expect(Math.max(...totalsA)).toBeGreaterThan(0);
    startSeason(room); // "new season" resets the slate
    expect(room.phase).toBe('pick');
    expect(room.players.filter(Boolean).every((p) => p!.total === 0)).toBe(true);
    expect(remaining(room).length).toBe(CHALLENGE_KEYS.length);
    rooms.delete(room.code);
  });

  it('the host picks specific games; played ones cannot repeat', () => {
    const room = mkRoom(4);
    startSeason(room);
    pickChallenge(room, 'fire');
    expect(room.currentKey).toBe('fire');
    let guard = 0;
    while (room.phase !== 'pick' && guard++ < 40000) seasonTick(room);
    expect(room.played).toEqual(['fire']);
    pickChallenge(room, 'fire'); // already played: refused
    expect(room.phase).toBe('pick');
    pickChallenge(room, 'idol');
    expect(room.currentKey).toBe('idol');
    rooms.delete(room.code);
  });

  it('the host can end the season early and crown the leader', () => {
    const room = mkRoom(4);
    startSeason(room);
    endSeasonNow(room); // nothing played yet: refused
    expect(room.phase).toBe('pick');
    pickChallenge(room, 'climb');
    let guard = 0;
    while (room.phase !== 'pick' && guard++ < 40000) seasonTick(room);
    endSeasonNow(room);
    expect(room.phase).toBe('final');
    expect(room.final!.champions.length).toBeGreaterThanOrEqual(1);
    rooms.delete(room.code);
  });

  it('a player who disconnects mid-season still appears in results (last-ish)', () => {
    const room = mkRoom(4);
    startSeason(room);
    pickChallenge(room, 'random');
    let guard = 0;
    // run into the first playing phase, then drop one player
    while (room.phase !== 'playing' && guard++ < 5000) seasonTick(room);
    const victim = room.players[3]!;
    victim.socketId = null;
    while (room.phase !== 'results' && guard++ < 40000) seasonTick(room);
    expect(room.results!.rows.some((r) => r.slot === 3)).toBe(true);
    rooms.delete(room.code);
  });
});

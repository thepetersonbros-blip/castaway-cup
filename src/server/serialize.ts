import type { Server } from 'socket.io';
import { PROTOCOL_VERSION, SNAP_EVERY } from '../shared/constants';
import type { RosterEntry, Snap, SyncMsg } from '../shared/protocol';
import { cardOf, totalsOf } from './season';
import type { PlayerSlot, Room } from './types';

export function buildRoster(room: Room): RosterEntry[] {
  return room.players
    .filter((p): p is PlayerSlot => !!p)
    .map((p) => ({
      slot: p.slot,
      name: p.name,
      color: p.color,
      connected: p.socketId !== null,
      isHost: p.isHost
    }));
}

export function buildSync(room: Room, p: PlayerSlot): SyncMsg {
  return {
    v: PROTOCOL_VERSION,
    tick: room.tick,
    phase: room.phase,
    code: room.code,
    you: { slot: p.slot, token: p.token },
    roster: buildRoster(room),
    totals: totalsOf(room),
    card: cardOf(room),
    state: room.ctx?.pub ?? null,
    phaseLeft: room.phaseTicks,
    results: room.results,
    final: room.final
  };
}

export function buildSnap(room: Room): Snap | null {
  if (!room.ctx?.pub) return null;
  return { t: room.tick, state: room.ctx.pub, phaseLeft: room.phaseTicks };
}

export function flushRoom(io: Server, room: Room): void {
  const connected = room.players.filter((p): p is PlayerSlot => !!p && p.socketId !== null);
  if (room.pendingSync) {
    room.pendingSync = false;
    for (const p of connected) {
      io.sockets.sockets.get(p.socketId!)?.emit('sync', buildSync(room, p));
    }
  }
  if (room.phase === 'playing' && room.tick % SNAP_EVERY === 0) {
    const snap = buildSnap(room);
    if (snap) io.to(room.code).emit('snap', snap);
  }
}

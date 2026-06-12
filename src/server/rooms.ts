import { randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import { MAX_PLAYERS, PROTOCOL_VERSION, ROOM_GC_MS, TICK_MS, TRIBE_COLORS } from '../shared/constants';
import type { ErrMsg, JoinAuth } from '../shared/protocol';
import { mulberry32 } from '../shared/rng';
import { seasonTick } from './season';
import { flushRoom } from './serialize';
import type { PlayerSlot, Room } from './types';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const rooms = new Map<string, Room>();

function genCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

export function createRoom(seed?: number): Room {
  let code = genCode();
  while (rooms.has(code)) code = genCode();
  const s = seed ?? ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  const room: Room = {
    code,
    seed: s,
    rand: mulberry32(s),
    lastActivity: Date.now(),
    tick: 0,
    phase: 'lobby',
    players: new Array(MAX_PLAYERS).fill(null),
    order: [],
    idx: 0,
    challenge: null,
    ctx: null,
    phaseTicks: 0,
    results: null,
    final: null,
    pendingSync: false
  };
  rooms.set(code, room);
  return room;
}

function sanitizeName(raw: string, room: Room): string | null {
  const name = (raw ?? '').toString().replace(/[^\w !?'.-]/g, '').trim().slice(0, 14);
  if (name.length < 1) return null;
  const taken = (n: string) => room.players.some((p) => p && p.name.toLowerCase() === n.toLowerCase());
  let candidate = name;
  let i = 2;
  while (taken(candidate)) candidate = `${name.slice(0, 12)}${i++}`;
  return candidate;
}

function pickColor(room: Room, wanted: number): number {
  const used = new Set(room.players.filter(Boolean).map((p) => p!.color));
  if (wanted >= 0 && wanted < TRIBE_COLORS.length && !used.has(wanted)) return wanted;
  for (let c = 0; c < TRIBE_COLORS.length; c++) if (!used.has(c)) return c;
  return 0;
}

export type JoinOutcome =
  | { ok: true; room: Room; player: PlayerSlot; rejoined: boolean }
  | { ok: false; err: ErrMsg['code'] };

export function joinRoom(auth: JoinAuth): JoinOutcome {
  if (!auth || auth.v !== PROTOCOL_VERSION) return { ok: false, err: 'bad-version' };
  let room: Room | undefined;
  if (auth.create) {
    room = createRoom();
  } else {
    room = rooms.get((auth.room ?? '').toUpperCase().trim());
    if (!room) return { ok: false, err: 'room-not-found' };
  }
  if (auth.token) {
    const existing = room.players.find((p) => p?.token === auth.token);
    if (existing) return { ok: true, room, player: existing, rejoined: true };
  }
  const count = room.players.filter(Boolean).length;
  if (count >= MAX_PLAYERS) return { ok: false, err: 'room-full' };
  const name = sanitizeName(auth.name, room);
  if (!name) return { ok: false, err: 'bad-name' };
  const slot = room.players.findIndex((p) => p === null);
  const player: PlayerSlot = {
    slot,
    name,
    color: pickColor(room, auth.color),
    token: randomUUID(),
    socketId: null,
    isHost: count === 0,
    total: 0
  };
  room.players[slot] = player;
  room.lastActivity = Date.now();
  return { ok: true, room, player, rejoined: false };
}

export function migrateHost(room: Room): void {
  if (room.players.some((p) => p?.isHost && p.socketId !== null)) return;
  for (const p of room.players) if (p) p.isHost = false;
  const next = room.players.find((p) => p && p.socketId !== null);
  if (next) next.isHost = true;
}

let driver: ReturnType<typeof setInterval> | null = null;

export function startDriver(io: Server): void {
  if (driver) return;
  driver = setInterval(() => {
    for (const [code, room] of rooms) {
      try {
        seasonTick(room);
        flushRoom(io, room);
      } catch (err) {
        console.error(`room ${code} tick error`, err);
      }
      const empty = room.players.every((p) => !p || p.socketId === null);
      if (empty && Date.now() - room.lastActivity > ROOM_GC_MS) rooms.delete(code);
    }
  }, TICK_MS);
}

export function stopDriver(): void {
  if (driver) clearInterval(driver);
  driver = null;
}

import type { Server, Socket } from 'socket.io';
import { MIN_PLAYERS, TRIBE_COLORS } from '../shared/constants';
import type { JoinAuth, LobbyMsg, PlayMsg } from '../shared/protocol';
import { joinRoom, migrateHost } from './rooms';
import { connectedPlayers, startSeason } from './season';
import { buildSync } from './serialize';
import type { PlayerSlot, Room } from './types';

interface SocketCtx {
  room: Room;
  player: PlayerSlot;
}

export function attachHandlers(io: Server): void {
  io.use((socket, next) => {
    const auth = socket.handshake.auth as Partial<JoinAuth>;
    const outcome = joinRoom({
      v: Number(auth.v),
      create: !!auth.create,
      room: typeof auth.room === 'string' ? auth.room : undefined,
      name: typeof auth.name === 'string' ? auth.name : '',
      color: Number.isInteger(auth.color) ? (auth.color as number) : -1,
      token: typeof auth.token === 'string' ? auth.token : undefined
    });
    if (!outcome.ok) {
      next(new Error(outcome.err));
      return;
    }
    (socket.data as SocketCtx).room = outcome.room;
    (socket.data as SocketCtx).player = outcome.player;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const { room, player } = socket.data as SocketCtx;
    if (player.socketId && player.socketId !== socket.id) {
      io.sockets.sockets.get(player.socketId)?.disconnect(true);
    }
    player.socketId = socket.id;
    room.lastActivity = Date.now();
    socket.join(room.code);
    socket.emit('sync', buildSync(room, player));
    room.pendingSync = true;

    let budget = 120; // generous: mash games are spammy by design
    let windowStart = Date.now();
    const allow = (): boolean => {
      const now = Date.now();
      if (now - windowStart > 1000) {
        windowStart = now;
        budget = 120;
      }
      return budget-- > 0;
    };

    socket.on('play', (raw: PlayMsg) => {
      if (!allow() || typeof raw !== 'object' || raw === null) return;
      if (room.phase !== 'playing' || !room.challenge || !room.ctx) return;
      if (!room.ctx.slots.includes(player.slot)) return; // joined mid-challenge: spectate
      room.challenge.input(room.ctx, player.slot, raw);
      room.lastActivity = Date.now();
    });

    socket.on('lobby', (raw: LobbyMsg) => {
      if (!allow() || typeof raw !== 'object' || raw === null) return;
      if (raw.type === 'color') {
        if (room.phase !== 'lobby' && room.phase !== 'final') return;
        const color = Number(raw.color);
        if (!Number.isInteger(color) || color < 0 || color >= TRIBE_COLORS.length) return;
        if (room.players.some((p) => p && p !== player && p.color === color)) return;
        player.color = color;
        room.pendingSync = true;
        return;
      }
      if (raw.type === 'start') {
        if (!player.isHost || room.phase !== 'lobby') return;
        if (connectedPlayers(room).length < MIN_PLAYERS) return;
        startSeason(room);
        return;
      }
      if (raw.type === 'again') {
        if (!player.isHost || room.phase !== 'final') return;
        startSeason(room);
      }
    });

    socket.on('disconnect', () => {
      if (player.socketId !== socket.id) return;
      player.socketId = null;
      room.lastActivity = Date.now();
      migrateHost(room);
      room.pendingSync = true;
    });
  });
}

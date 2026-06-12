import { io, type Socket } from 'socket.io-client';
import { PROTOCOL_VERSION } from '../shared/constants';
import type { LobbyMsg, PlayMsg, Snap, SyncMsg } from '../shared/protocol';
import { applySnap, applySync, game, update } from './state';

let socket: Socket | null = null;

export interface ConnectOpts {
  create?: boolean;
  room?: string;
  name: string;
  color: number;
}

const tokenKey = (code: string) => `cc.token.${code}`;

export function connect(opts: ConnectOpts): void {
  disconnect();
  game.connState = 'connecting';
  game.errCode = '';
  update();
  const token = opts.room ? localStorage.getItem(tokenKey(opts.room.toUpperCase())) ?? undefined : undefined;
  socket = io({
    transports: ['websocket', 'polling'],
    auth: { v: PROTOCOL_VERSION, create: !!opts.create, room: opts.room, name: opts.name, color: opts.color, token },
    reconnectionAttempts: 12,
    reconnectionDelayMax: 4000
  });

  socket.on('connect', () => {
    game.connState = 'on';
    update();
  });
  socket.on('connect_error', (err) => {
    const code = (err?.message ?? '').toString();
    if (['room-not-found', 'room-full', 'bad-version', 'bad-name'].includes(code)) {
      game.errCode = code;
      game.connState = 'failed';
      socket?.disconnect();
      socket = null;
      update();
    }
  });
  socket.on('disconnect', (reason) => {
    if (reason === 'io client disconnect') return;
    game.connState = 'reconnecting';
    setTimeout(update, 1500);
  });
  socket.io.on('reconnect_failed', () => {
    game.connState = 'failed';
    game.errCode = 'lost';
    update();
  });

  socket.on('sync', (msg: SyncMsg) => {
    applySync(msg);
    localStorage.setItem(tokenKey(msg.code), msg.you.token);
    localStorage.setItem('cc.lastRoom', msg.code);
    const url = new URL(location.href);
    url.searchParams.set('room', msg.code);
    history.replaceState(null, '', url.toString());
    update();
  });
  socket.on('snap', (s: Snap) => applySnap(s));
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}

export const sendPlay = (m: PlayMsg) => socket?.emit('play', m);
export const sendLobby = (m: LobbyMsg) => socket?.emit('lobby', m);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && socket && !socket.connected) socket.connect();
});

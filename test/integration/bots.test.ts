// Real server, real sockets: six bots gather, the season starts, snapshots
// flow, inputs land, and a dropped bot rejoins with its token.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connectIo, type Socket } from 'socket.io-client';
import { PROTOCOL_VERSION } from '../../src/shared/constants';
import type { Snap, SyncMsg } from '../../src/shared/protocol';
import { createGameServer, type GameServer } from '../../src/server/app';

let server: GameServer;
let port: number;

interface Bot {
  sock: Socket;
  sync: SyncMsg | null;
  snaps: Snap[];
}

function mkBot(name: string, auth: Record<string, unknown>): Promise<Bot> {
  return new Promise((resolve, reject) => {
    const sock = connectIo(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { v: PROTOCOL_VERSION, name, color: -1, ...auth }
    });
    const bot: Bot = { sock, sync: null, snaps: [] };
    sock.on('sync', (s: SyncMsg) => {
      const first = bot.sync === null;
      bot.sync = s;
      if (first) resolve(bot);
    });
    sock.on('snap', (s: Snap) => {
      bot.snaps.push(s);
      if (bot.snaps.length > 80) bot.snaps.shift();
    });
    sock.on('connect_error', (e) => reject(new Error(`${name}: ${e.message}`)));
    setTimeout(() => reject(new Error(`${name}: no sync after 5s`)), 5000);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor<T>(fn: () => T | null | undefined | false, what: string, ms = 25000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v as T;
    if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
    await sleep(60);
  }
}

describe('six castaways online', () => {
  const bots: Bot[] = [];

  beforeAll(async () => {
    server = createGameServer();
    port = await server.listen(0);
  });

  afterAll(async () => {
    for (const b of bots) b.sock.disconnect();
    await server.close();
  });

  it('lobby fills with unique bandanas', async () => {
    const host = await mkBot('Host', { create: true });
    bots.push(host);
    const code = host.sync!.code;
    for (let i = 1; i < 6; i++) bots.push(await mkBot(`Bot${i}`, { room: code }));
    await waitFor(() => bots[0].sync?.roster.filter((r) => r.connected).length === 6, 'full roster');
    const colors = new Set(bots[0].sync!.roster.map((r) => r.color));
    expect(colors.size).toBe(6);
  });

  it('the season starts: intro card, then live snapshots', async () => {
    bots[0].sock.emit('lobby', { type: 'start' });
    await waitFor(() => bots[3].sync?.phase === 'intro', 'intro phase');
    expect(bots[3].sync!.card?.title?.length).toBeGreaterThan(2);
    // through countdown into the first challenge (about 12 seconds)
    await waitFor(() => bots[3].snaps.length > 3, 'snapshots flowing', 20000);
    const g = bots[3].snaps.at(-1)!.state.g;
    expect(['fire', 'fish', 'balance', 'climb', 'memory', 'idol', 'gather']).toContain(g);
  });

  it('inputs reach the game without breaking anything', async () => {
    // every bot mashes a plausible input for whatever game is on
    for (const b of bots) {
      const g = b.snaps.at(-1)?.state.g;
      if (!g) continue;
      const msg =
        g === 'fish'
          ? { g, x: 5, y: 5 }
          : g === 'balance'
            ? { g, dir: 1 }
            : g === 'climb'
              ? { g, side: 'L' }
              : g === 'memory'
                ? { g, tile: 0 }
                : g === 'gather'
                  ? { g, dx: 1, dy: 0 }
                  : { g };
      for (let i = 0; i < 5; i++) b.sock.emit('play', msg);
    }
    await sleep(600);
    expect(bots[0].snaps.length).toBeGreaterThan(3); // still alive and snapping
  });

  it('a dropped castaway rejoins into the same slot mid-season', async () => {
    const b = bots[4];
    const code = b.sync!.code;
    const token = b.sync!.you.token;
    const slot = b.sync!.you.slot;
    b.sock.disconnect();
    await sleep(300);
    const back = await mkBot('Bot4', { room: code, token });
    expect(back.sync!.you.slot).toBe(slot);
    bots[4] = back;
  });
});

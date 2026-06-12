import type {
  ChallengeCard,
  ChallengePub,
  FinalMsg,
  Phase,
  ResultsMsg,
  RosterEntry,
  Snap,
  SyncMsg
} from '../shared/protocol';

export const game = {
  connState: 'boot' as 'boot' | 'connecting' | 'on' | 'reconnecting' | 'failed',
  errCode: '',
  phase: 'lobby' as Phase,
  code: '',
  you: { slot: -1, token: '' },
  roster: [] as RosterEntry[],
  totals: [] as { slot: number; total: number }[],
  card: null as ChallengeCard | null,
  state: null as ChallengePub | null,
  results: null as ResultsMsg | null,
  final: null as FinalMsg | null,
  serverTick: 0,
  phaseDeadline: 0 // performance.now()-based end of the current timed phase
};

type Listener = () => void;
const listeners = new Set<Listener>();
export function onUpdate(fn: Listener): void {
  listeners.add(fn);
}
export function update(): void {
  for (const fn of listeners) fn();
}

export function applySync(msg: SyncMsg): void {
  game.phase = msg.phase;
  game.code = msg.code;
  game.you = msg.you;
  game.roster = msg.roster;
  game.totals = msg.totals;
  game.card = msg.card;
  game.state = msg.state;
  game.results = msg.results;
  game.final = msg.final;
  game.serverTick = msg.tick;
  game.phaseDeadline = performance.now() + msg.phaseLeft * 50;
}

export function applySnap(s: Snap): void {
  game.serverTick = s.t;
  game.state = s.state;
  game.phaseDeadline = performance.now() + s.phaseLeft * 50;
}

export function phaseSecondsLeft(): number {
  return Math.max(0, (game.phaseDeadline - performance.now()) / 1000);
}

export function nameOf(slot: number): string {
  return game.roster.find((r) => r.slot === slot)?.name ?? '???';
}
export function colorIdxOf(slot: number): number {
  return game.roster.find((r) => r.slot === slot)?.color ?? 0;
}

// Every message that crosses the wire, both directions.

export type Phase = 'lobby' | 'intro' | 'countdown' | 'playing' | 'results' | 'standings' | 'final';

export type ChallengeKey = 'fire' | 'fish' | 'balance' | 'climb' | 'memory' | 'idol';

// ---------- client -> server ----------

export interface JoinAuth {
  v: number;
  create?: boolean;
  room?: string;
  name: string;
  color: number;
  token?: string;
}

export type PlayMsg =
  | { g: 'fire' } // tap
  | { g: 'fish'; x: number; y: number } // throw spear at pool coords
  | { g: 'balance'; dir: -1 | 1 } // lean
  | { g: 'climb'; side: 'L' | 'R' }
  | { g: 'memory'; tile: number }
  | { g: 'idol' }; // grab

export type LobbyMsg =
  | { type: 'color'; color: number }
  | { type: 'start' } // host
  | { type: 'again' }; // host, from final

// ---------- challenge public states (sent in snapshots) ----------

export interface FirePub {
  g: 'fire';
  zone: number; // hot zone center 0..100
  zoneW: number;
  players: { slot: number; meter: number; cursor: number; fin: number; fizzle: boolean }[];
}
export interface FishPub {
  g: 'fish';
  fish: { id: number; x: number; y: number; kind: 'small' | 'med' | 'gold'; dir: number }[];
  splashes: { x: number; y: number; t: number; hit: boolean; slot: number }[];
  scores: { slot: number; score: number; cd: boolean }[];
  left: number;
}
export interface BalancePub {
  g: 'balance';
  players: { slot: number; angle: number; fallen: number }[]; // fallen = tick or -1
  wind: number; // current gust, for leaves blowing
  left: number;
}
export interface ClimbPub {
  g: 'climb';
  players: { slot: number; h: number; fin: number; sting: boolean; last: 'L' | 'R' | null }[];
}
export interface MemoryPub {
  g: 'memory';
  mode: 'show' | 'input' | 'between';
  depth: number;
  flash: number; // tile index being flashed, -1 none
  inputLeft: number;
  players: { slot: number; progress: number; lives: number; out: boolean }[];
}
export interface IdolPub {
  g: 'idol';
  mode: 'wait' | 'go' | 'scored';
  draw: number; // 1-based
  draws: number;
  scores: { slot: number; score: number; locked: boolean; ms: number | null }[]; // ms = this draw's reaction
}
export type ChallengePub = FirePub | FishPub | BalancePub | ClimbPub | MemoryPub | IdolPub;

// ---------- server -> client ----------

export interface RosterEntry {
  slot: number;
  name: string;
  color: number;
  connected: boolean;
  isHost: boolean;
}

export interface ChallengeCard {
  key: ChallengeKey;
  title: string;
  tagline: string;
  howTo: string;
  index: number; // 1-based position in the season
  total: number;
}

export interface PlacementRow {
  slot: number;
  place: number; // 1-based, ties share
  display: string; // "14.2s", "23 pts"
  pts: number;
}

export interface ResultsMsg {
  card: ChallengeCard;
  rows: PlacementRow[];
  totals: { slot: number; total: number }[];
}

export interface FinalMsg {
  totals: { slot: number; total: number }[];
  champions: number[]; // slot(s), ties possible
}

export interface SyncMsg {
  v: number;
  tick: number;
  phase: Phase;
  code: string;
  you: { slot: number; token: string };
  roster: RosterEntry[];
  totals: { slot: number; total: number }[];
  card: ChallengeCard | null;
  state: ChallengePub | null;
  phaseLeft: number; // ticks left in timed phases
  results: ResultsMsg | null;
  final: FinalMsg | null;
}

export interface Snap {
  t: number;
  state: ChallengePub;
  phaseLeft: number;
}

export interface ErrMsg {
  code: 'room-not-found' | 'room-full' | 'bad-version' | 'bad-name';
  msg: string;
}

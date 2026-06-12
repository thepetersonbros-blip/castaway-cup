// Every message that crosses the wire, both directions.

export type Phase =
  | 'lobby'
  | 'pick' // the host chooses the next challenge
  | 'intro'
  | 'countdown'
  | 'playing'
  | 'results'
  | 'standings'
  | 'final';

export type ChallengeKey =
  | 'fire'
  | 'fish'
  | 'balance'
  | 'climb'
  | 'memory'
  | 'idol'
  | 'gather'
  | 'type'
  | 'stampede'
  | 'shove';

export type FoodKind = 'berry' | 'coconut' | 'pine';

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
  | { g: 'idol' } // grab
  | { g: 'gather'; dx: number; dy: number } // held movement direction, (0,0) = stop
  | { g: 'type'; word: string } // a typed attempt at the current word
  | { g: 'stampede'; dx?: number; dy?: number; charge?: boolean }
  | { g: 'shove'; dx?: number; dy?: number; a?: 'bump' | 'charge' | 'dodge' };

export type LobbyMsg =
  | { type: 'color'; color: number }
  | { type: 'start' } // host
  | { type: 'again' } // host, from final
  | { type: 'pick'; key: ChallengeKey } // host, from the pick screen
  | { type: 'random' } // host: surprise me
  | { type: 'finish' }; // host: end the season now, crown with current totals

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
  seq: string; // the shared grip pattern, e.g. "LLRLRRRL..." (same for everyone)
  players: { slot: number; h: number; fin: number; sting: boolean; idx: number }[];
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
export interface GatherPub {
  g: 'gather';
  items: { id: number; x: number; y: number; kind: FoodKind }[];
  players: {
    slot: number;
    x: number;
    y: number;
    moving: boolean;
    carry: FoodKind[];
    wobble: number; // 0..100
    banked: number;
    dizzy: boolean;
    hx: number; // home mat
    hy: number;
  }[];
  left: number;
}

export interface TypePub {
  g: 'type';
  round: number; // 1-based
  rounds: number;
  mode: 'go' | 'scored';
  word: string;
  players: { slot: number; score: number; done: boolean; ms: number | null }[];
}

export interface StampedePub {
  g: 'stampede';
  mode: 'play' | 'between';
  round: number; // 1-based
  rounds: number;
  left: number;
  rocks: [number, number][];
  elephants: { slot: number; cx: number; cy: number; charging: boolean; cdLeft: number }[];
  humans: { slot: number; cx: number; cy: number; alive: boolean }[];
  nextElephants: number[]; // shown during 'between'
  scores: { slot: number; score: number }[];
}

export interface ShovePub {
  g: 'shove';
  mode: 'play' | 'between';
  round: number;
  rounds: number;
  left: number;
  radius: number; // current platform radius
  players: {
    slot: number;
    x: number;
    y: number;
    fx: number; // facing unit vector
    fy: number;
    out: boolean;
    outBy: number; // slot that shoved them in, -1 if nobody
    charging: boolean;
    dodging: boolean;
    stagger: boolean;
    cds: { bump: number; charge: number; dodge: number };
  }[];
  scores: { slot: number; score: number; kos: number }[];
}

export type ChallengePub =
  | FirePub
  | FishPub
  | BalancePub
  | ClimbPub
  | MemoryPub
  | IdolPub
  | GatherPub
  | TypePub
  | StampedePub
  | ShovePub;

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

export interface PickEntry {
  key: ChallengeKey;
  title: string;
  tagline: string;
  played: boolean;
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
  pick: PickEntry[] | null; // present during the 'pick' phase
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

import type { ChallengeKey, ChallengePub, PlayMsg } from '../../shared/protocol';

export interface Ctx {
  t: number; // ticks since the challenge started
  rand: () => number; // seeded per challenge
  slots: number[]; // participating player slots
  connected: (slot: number) => boolean;
  priv: any; // server-only state
  pub: ChallengePub | null; // rebuilt by tick(), shipped in snapshots
}

export interface ResultRow {
  slot: number;
  value: number; // HIGHER is better, always (negate times)
  display: string;
}

export interface Challenge {
  key: ChallengeKey;
  title: string;
  tagline: string;
  howTo: string;
  maxTicks: number;
  init(ctx: Ctx): void;
  tick(ctx: Ctx): void;
  input(ctx: Ctx, slot: number, msg: PlayMsg): void;
  done(ctx: Ctx): boolean;
  result(ctx: Ctx): ResultRow[];
}

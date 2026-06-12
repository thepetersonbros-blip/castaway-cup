import type { ChallengeKey, FinalMsg, Phase, ResultsMsg } from '../shared/protocol';
import type { Challenge, Ctx } from './challenges/types';

export interface PlayerSlot {
  slot: number;
  name: string;
  color: number;
  token: string;
  socketId: string | null;
  isHost: boolean;
  total: number; // season points
}

export interface Room {
  code: string;
  seed: number;
  rand: () => number;
  lastActivity: number;
  tick: number;
  phase: Phase;
  players: (PlayerSlot | null)[];
  order: ChallengeKey[];
  idx: number; // which challenge of the season
  challenge: Challenge | null;
  ctx: Ctx | null;
  phaseTicks: number; // remaining in intro/countdown/results/standings
  results: ResultsMsg | null;
  final: FinalMsg | null;
  pendingSync: boolean;
}

import type { ChallengeKey } from '../../shared/protocol';
import type { Challenge } from './types';
import { fire } from './fire';
import { fish } from './fish';
import { balance } from './balance';
import { climb } from './climb';
import { memory } from './memory';
import { idol } from './idol';
import { gather } from './gather';

export const CHALLENGES: Record<ChallengeKey, Challenge> = {
  fire,
  fish,
  balance,
  climb,
  memory,
  idol,
  gather
};

export const CHALLENGE_KEYS: ChallengeKey[] = [
  'fire',
  'fish',
  'balance',
  'climb',
  'memory',
  'idol',
  'gather'
];

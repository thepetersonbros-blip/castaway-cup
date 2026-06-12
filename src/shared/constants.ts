// Every tunable number for Castaway Cup.

export const TICK_MS = 50; // 20 Hz
export const TICKS_PER_SEC = 1000 / TICK_MS;
export const SNAP_EVERY = 2; // 10 Hz snapshots
export const sec = (s: number) => Math.round(s * TICKS_PER_SEC);

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;
export const ROOM_GC_MS = 10 * 60 * 1000;

// season flow
export const INTRO_TICKS = sec(9); // read the rules card
export const COUNTDOWN_TICKS = sec(3);
export const RESULTS_TICKS = sec(8);
export const STANDINGS_TICKS = sec(8);

// points by finishing place (ties share the better place's points)
export const POINTS = [10, 7, 5, 3, 2, 1, 1, 1];

// player colors (bandanas/torches)
export const TRIBE_COLORS = [
  '#e8443a', // red
  '#2f7fe8', // blue
  '#2fb24c', // green
  '#f0c030', // yellow
  '#9b59d0', // purple
  '#f07f2f', // orange
  '#27c5c5', // teal
  '#e667ad' // pink
] as const;

// ---- challenge tunables ----
export const FIRE = {
  maxTicks: sec(75),
  target: 100,
  hitMin: 8,
  hitBonus: 5,
  missPenalty: 6,
  fizzleTicks: sec(0.55),
  zoneWidthStart: 20, // out of 100
  zoneWidthEnd: 11
};

export const FISH = {
  maxTicks: sec(60),
  poolW: 32,
  poolH: 18,
  maxFish: 8,
  spawnEvery: sec(0.8),
  spearRadius: 2.0,
  spearCd: sec(1),
  pts: { small: 3, med: 2, gold: 5 }
};

export const BALANCE = {
  maxTicks: sec(90),
  fallAngle: 45,
  impulse: 1.6,
  impulseCd: 3, // ticks
  windBase: 0.055,
  windGrow: 0.0011, // per tick
  damping: 0.985
};

export const CLIMB = {
  maxTicks: sec(75),
  top: 100,
  step: 2.4,
  slip: 1.5,
  stingTicks: sec(0.4)
};

export const MEMORY = {
  tiles: 4,
  lives: 2,
  startLen: 3,
  maxDepth: 10,
  showTicks: sec(0.62), // per symbol
  inputTicks: sec(14), // per round time limit
  betweenTicks: sec(1.2)
};

export const GATHER = {
  maxTicks: sec(90),
  arenaW: 36,
  arenaH: 20,
  baseSpeed: 0.26, // units per tick, empty-handed
  slowPerWeight: 0.05, // each point of carried weight slows you 5%
  minSpeedFactor: 0.3,
  maxStack: 10,
  wobbleBase: 0.5, // wobble per moving tick (loaded)
  wobblePerWeight: 0.3,
  wobbleDecay: 4, // per standing tick
  toppleAt: 100,
  dizzyTicks: sec(1.2),
  pickupRadius: 0.9,
  bankRadius: 1.7,
  startItems: 12,
  maxItems: 20,
  scatterMax: 30, // map cap including toppled food
  spawnEvery: sec(1.2),
  pts: { berry: 1, coconut: 2, pine: 5 }
};

export const IDOL = {
  draws: 5,
  waitMin: sec(1.6),
  waitMax: sec(6),
  goWindow: sec(1.6),
  showTicks: sec(2.6),
  falseStart: -1,
  podium: [3, 2, 1]
};

export const PROTOCOL_VERSION = 1;

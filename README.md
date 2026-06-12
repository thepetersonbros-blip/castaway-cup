# Castaway Cup

An island game-show night for six friends in the browser. No downloads: join with a link and a 4-letter code. Nine quick challenges, points for every finish, a torch leaderboard between games, and one Island Champion at the end.

## The nine challenges (shuffled each season)

1. **FRICTION**: tap when the spark crosses the hot zone to grow your fire. Misses fizzle it. First flame wins.
2. **THE SHALLOWS**: one shared lagoon. Spear fish for points (gold fish = 5). Steal your friends' catches.
3. **THE PERCH**: balance on a pole while the same wind gusts hit everyone. Lean left/right. Last one dry wins.
4. **THE PALMS**: climb by alternating left/right taps. Same hand twice = slip.
5. **ECHOES OF THE ELDERS**: watch the totems flash, repeat the sequence. One more beat each round. Two mistakes and your torch goes out.
6. **SNATCH THE IDOL**: pure reaction. Wait for the idol... GRAB. False starts cost a point. Reaction times are public, in milliseconds, for maximum arguing.
7. **THE FEAST**: one shared beach covered in food. Run over it and it stacks above your head. Weight makes you slower and wobblier; push into the flashing red and the stack can topple at ANY moment, scattering everything for anyone to steal. Stand still to steady it, bank at your colored mat. Fast little runs or one giant haul: your call.
8. **MESSAGE IN A BOTTLE**: a survivor word washes ashore and everyone types it. It auto-sends the instant it's exactly right, so it's a pure typing race. Fastest three score 3, 2, 1 each round. Ten bottles.
9. **THE STAMPEDE**: a Mario-Party-style grid arena. Two players ride elephants: four squares big, slow, with a charge button. Everyone else is small and quick, slipping through one-square gaps the elephants can't fit. Get stepped on = pancake. Squashes and survival both score, and everyone gets a round on elephant-back.

Scoring: 1st place 10, then 7, 5, 3, 2, 1. Ties share the better points. Most points after nine challenges takes the Cup. The host can run a fresh season any time.

## Run it locally

```
npm install
npm run dev
```

Open http://localhost:5174 in two windows (make the second one private/incognito, or it counts as the same player rejoining).

## Put it online (same recipe as Mole in the Mine)

1. Create a GitHub repo named `castaway-cup`, push this folder to it.
2. On render.com: New + > Blueprint > pick the repo > Apply. `render.yaml` does the rest.
3. Open the URL 5 minutes before game night (free servers nap; the join screen says "Rowing to the island..." while it wakes).

## Game night

1. Host opens the link, clicks "Start a new island," copies the invite link into the group chat.
2. Everyone joins on phone or computer. Get on a voice call.
3. Host lights the torches. Six challenges, about 12 to 15 minutes a season. Run as many seasons as the night survives.

## Tests

```
npm test            # game logic + a full simulated season + 6-bot socket test
npx playwright test # 3 real browser tabs play the season opener
```

Tuning lives in `src/shared/constants.ts` (points, durations, difficulty).

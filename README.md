# Impetus

Abstract 1v1 board game, zero randomness. Simple to learn (2 actions, 30 seconds), designed for a depth comparable to go and chess. *(Formerly "Glisse" during the design phase.)*

## Pitch

Every stone placed redraws all the slide corridors on the board. Blocking, deflecting, deliberately closing off your own exit: space itself is the weapon.

## Rules (v1.2)

- **9x9** board. **10 stones** in reserve per player. Black starts from the top, White from the bottom.
- On their turn, each player performs **one action only**:
  1. **Place**: put a stone from their reserve on an empty cell of their home row;
  2. **Slide**: choose one of their stones and a direction (up/down/left/right): the stone moves straight ahead by **at most 3 cells** and stops at the first obstacle encountered. Enemy obstacle -> **capture** (possible even on an adjacent cell); allied obstacle or border -> stops just before; otherwise it stops at the end of its range.
- **Victory** if:
  - a stone survives **one move** on the enemy home row (**deferred breakthrough**): the opponent has one chance to capture it, otherwise it wins;
  - the opponent has no stones left (**annihilation**);
  - the opponent has no legal move (**immobilisation**).
- **Repetition rule**: reproducing the same position three times is forbidden.
- **Swap rule**: after the very first move, player 2 may undo it: the black stone is removed and a white stone is placed at its symmetric position (central mirror of the board). Neutralises the first-player advantage without changing seats.
- *Fast variant*: immediate breakthrough (arrival wins without delay), available in the game panel.

## Why it can be deep

| Inspiration | What it brings |
|---|---|
| Go | Each stone modifies the global topology of corridors -> walls, thickness, latent potential |
| Chess | Deterministic sequences = calculable forced lines; chain captures crossing the entire board |
| Barricade | Blocking is central: closing a corridor, trapping yourself in it, redirecting enemy slides |

## Rules changelog

- **v1**: unlimited slide to the first obstacle.
- **v1.1**: **slide range limited to 3 cells**, adjacent capture allowed. *Reason*: playtesting showed that with unlimited range, Black crosses the empty board on their 2nd move and wins trivially. Range 3 requires several exposed moves to break through, making defence and blocking central again.
- **v1.2**: **deferred breakthrough**: a stone on the enemy row only wins if it **survives a response** (the opponent must be able to capture it, otherwise it wins on the next move). *Reason*: +37% game length, rich defensive counterplay (double threats, protected sacrifices), balance confirmed at self-play (55/45, within noise) and a distinct tactical identity. Immediate breakthrough remains available as a variant.

## Open questions (to be settled by testing)

- ~~Board size, reserve size, slide range~~ -> **settled by self-play variant sweep (v1.2)**: 9x9 / reserve 10 / range 3 is the only balanced configuration tested (see "Measured figures")
- ~~Exact form of the repetition rule~~ -> occ2 (3-position rule) retained; occ1 (strict ko) viable but no measured gain
- ~~Draws, infinite games, forced win at opening~~ -> **none of the three exist**: no draw rule (the game is always decisive), termination guaranteed by the repetition rule (finite states x 2 occurrences max), no forced win detected at the opening (depth 13: score ~= 0; first forced breakthrough detected between moves 25 and 52, average 37)
- ~~Adopt deferred breakthrough?~~ -> **adopted in v1.2** (standard); immediate breakthrough remains available as a local variant. Slight White bias (55/45) to monitor in human play.
- Should endgame variety be diversified? Annihilation/immobilisation remain safety nets: making them frequent would require slowing the game (breakthrough x2) at the cost of balance

## Tools

| Command | Description |
|---|---|
| `npm run dev` | Playable prototype (http://localhost:5273) |
| `npm test` | Engine + AI + solver tests |
| `npm run stats` | AI vs AI self-play (`npm run stats -- <games> <hardBudgetMs>`) |
| `npm run balance` | Variant sweep in self-play (`npm run balance -- <games> <budgetMs> <level> <indices>`) |
| `npm run solve` | Complexity of the standard game + resolvability frontier of reduced variants |
| `npm run duel` | New engine vs old AI (budget in ms, 2xn games) |

The **Hard** level uses the analysis engine (negamax + Zobrist transposition table + quiescence + hanging stones detection). The UI offers **live analysis**: evaluation bar, best-move arrow, top 3 annotated (`a1->a4`, `place d9`...), depth/nodes.

## Measured figures (v1.1)

- Game tree ~= **10^71**, upper bound on states ~= **10^41** (9x9, reserve 10)
- In-house exhaustive solver: solves up to 7x7 reserve 2; fails from reserve 3 on 6x6 (~6.5M nodes / 25s)
- Self-play: perfect Black/White balance at Hard level via swap (played in 100% of games)
- Calculation depth pays off: ~78% win rate for the higher level in cross-match play (0.35s/move)

### Variant sweep (`npm run balance`, self-play 12-16 games)

| Variant | Normal (no swap) | Hard (with swap) | Verdict |
|---|---|---|---|
| **9x9 · reserve 10 · range 3** | 58/42 | **50/50** · 33 plies | ✅ reference |
| 7x7 | 100% Black · 8 plies | n/a | degenerate (breakthrough in 2 slides) |
| 11x11 | 75% Black · 32 plies | n/a | Black advantage, long games |
| range 2 | 42/58 · 49 plies | 19/81 · 83 plies | too defensive |
| range 4 | 100% Black · 9 plies | n/a | degenerate |
| reserve 8 | 58/42 | n/a | neutral |
| reserve 12 | 25/75 | 38/63 | leans White |
| occ1 (strict ko) | 50/50 | 44/56 | viable, no gain vs occ2 |

All measured endings are breakthroughs: breakthrough dominance is the next rules task.

### Breakthrough and material (sweep v2, hard with swap, 16-32 games)

| Variant | Black/White | plies avg | Endings | Verdict |
|---|---|---|---|---|
| **reference b1·r10** | **53/47** | 40 | breakthrough x32 | ✅ reference balance |
| breakthrough x2 | 13/88 · 38/63 | 42-80 | breakthrough + annihilation 1-2 | overcorrects toward defence, games x2 |
| deferred breakthrough (survives 1 move) | 55/45 · recalibrated AI | 51 | breakthrough x64 | **+37% length, balance confirmed: v1.2 candidate** |
| deferred·r7 | 28/72 | 37 | breakthrough x32 | clear White bias |
| deferred·r6 | 44/56 | 31 | breakthrough x32 | near balance |
| reserve 7 | 50/50 | 29 | breakthrough x16 | valid tempo variant |
| reserve 6 | 56/44 | 22 | breakthrough x16 | short, slightly Black |
| reserves 5 / 4 | 63/37 · 56/44 | ~19 | breakthrough x16 | even faster games, breakthrough still dominant |

**Structural findings**: breakthroughs account for 100% of endings regardless of reserve size (4-12). Capturing remains voluntary and risky; attrition is never profitable before the breakthrough. Annihilation and immobilisation are **anti-degenerate safety nets**, not realistic winning paths in the current form. Deferred breakthrough is the best measured depth avenue to date: it forces the defender to respond to arrivals (double threats, protected sacrifices, exchanges on the arrival row) without breaking the balance.

## Toward a platform

The client is structured **local-first**: profile, Elo and history live in `src/platform/store.ts` (localStorage) behind a `StorageLike` interface. When the back-end arrives, this layer will be replaced by an `ApiClient` (auth + WebSocket) without touching the game or the UI.

Already in place:
- **Play · Games · Profile** tabs (SPA with no dependency)
- **Local Elo** by AI level (K=32, targets 700/1200/1650) with progression curves
- **Persistent history** (last 200 games) and **move-by-move or auto-play replay**
- Analysis engine isolated in a Web Worker

Online roadmap:
1. Node server + WebSocket: rooms, move synchronisation, clocks
2. **Server-side** move validation (the rules engine is already a pure reusable module on the Node side)
3. Accounts + global Elo (the `elo.ts` module is shared client/server)
4. Rating-based matchmaking, breakthrough puzzles, seasonal leaderboards

## Roadmap

1. **Playable prototype**: local web, two players on the same screen (TypeScript + Vite, pure game core with no render dependency)
2. **Minimal AI + random playouts**: detect trivially winning strategies, measure balance
3. **`game-solver` synergy**: depth/complexity analysis, partial resolution
4. **Rules iterations** until competitive stability
5. **Online 1v1**: accounts, ELO, matchmaking, chess.com format

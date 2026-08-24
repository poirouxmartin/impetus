# Impetus

Jeu de plateau abstrait 1v1, zéro hasard. Simple à apprendre (2 actions, 30 secondes), conçu pour une profondeur comparable au go et aux échecs. *(Anciennement « Glisse » pendant la phase de conception.)*

## Pitch

Chaque pierre posée redessine tous les couloirs de glisse du plateau. Bloquer, dévier, se fermer volontairement une sortie : l'espace lui-même est l'arme.

## Règles (v1)

- Plateau **9×9**. Réserve de **10 pierres** par joueur. Noir part du haut, Blanc du bas.
- À son tour, chaque joueur exécute **une seule action** :
  1. **Poser** — placer une pierre de sa réserve sur une case vide de sa rangée de départ ;
  2. **Glisser** — choisir une de ses pierres et une direction (haut/bas/gauche/droite) : la pierre avance tout droit d'**au plus 3 cases** et s'arrête au premier obstacle rencontré. Obstacle adverse → **capture** (possible même case adjacente) ; obstacle allié ou bord → arrêt juste avant ; sinon elle s'arrête au bout de sa portée.
- **Victoire** si :
  - une pierre atteint la rangée de départ adverse (**percée**) ;
  - l'adversaire ne possède plus aucune pierre (**anéantissement**) ;
  - l'adversaire n'a aucun coup légal (**immobilisation**).
- **Anti-répétition** : interdiction de recréer une position identique trois fois *(paramètre à calibrer)*.
- **Règle du swap** : après le tout premier coup, le joueur 2 peut l'annuler — la pierre noire est retirée et une pierre blanche est posée à sa position symétrique (miroir central du plateau). Neutralise l'avantage du premier joueur sans changer les sièges.

## Pourquoi ça peut être profond

| Inspiration | Ce que ça apporte |
|---|---|
| Go | Chaque pierre modifie la topologie globale des couloirs → murs, épaisseur, potentialités latentes |
| Échecs | Séquences déterministes = lignes forcées calculables ; captures en chaîne traversant tout le plateau |
| Barricade | Le blocage est central : fermer un couloir, s'y enfermer soi-même, rediriger les glisses adverses |

## Journal des règles

- **v1** — glisse illimitée jusqu'au premier obstacle.
- **v1.1** — **portée de glisse limitée à 3 cases**, capture adjacente autorisée. *Raison* : les tests ont montré qu'à portée illimitée, Noir traverse le plateau vide dès son 2e coup et gagne trivialement. La portée 3 impose plusieurs coups exposés pour percer : défense et blocage redeviennent centraux.

## Questions ouvertes (à trancher par le test)

- ~~Taille du plateau, taille de réserve, portée de glisse~~ → **tranché par sweep self-play (v1.2)** : 9×9 / réserve 10 / portée 3 est la seule config équilibrée testée (voir « Chiffres mesurés »)
- ~~Forme exacte de l'anti-répétition~~ → occ2 (règle des 3 positions) conservée ; occ1 (ko strict) viable mais sans gain mesuré
- **La percée domine** : 100 % des fins de parties en self-play, tous niveaux. Anéantissement et immobilisation ne sortent jamais. Faut-il durcir la percée (2 pierres sur la rangée adverse ?) ou booster les captures pour équilibrer les motifs de fin ?

## Outils

| Commande | Description |
|---|---|
| `npm run dev` | Prototype jouable (http://localhost:5273) |
| `npm test` | Tests moteur + IA + solveur |
| `npm run stats` | Self-play IA vs IA (`npm run stats -- <parties> <budgetMsDifficile>`) |
| `npm run balance` | Sweep de variantes en self-play (`npm run balance -- <parties> <budgetMs> <niveau> <indices>`) |
| `npm run solve` | Complexité du jeu standard + frontière de résolubilité des variantes réduites |
| `npm run duel` | Nouveau moteur vs ancienne IA (budget en ms, 2×n parties) |

Le niveau **Difficile** utilise le moteur d'analyse (négamax + table de transposition Zobrist + quiescence + détection des pierres en prise). L'UI propose une **analyse en direct** : barre d'évaluation, flèche du meilleur coup, top 3 noté (`a1→a4`, `poser d9`…), profondeur/nœuds.

## Chiffres mesurés (v1.1)

- Arbre de jeu ≈ **10^71** · borne haute d'états ≈ **10^41** (9×9, réserve 10)
- Solveur exhaustif maison : résout jusqu'à 7×7 réserve 2 ; échoue dès réserve 3 en 6×6 (~6,5 M nœuds / 25 s)
- Self-play : équilibre parfait Noir/Blanc au niveau Difficile via le swap (joué dans 100 % des parties)
- La profondeur de calcul paie : ~78 % de victoire du niveau supérieur en affrontement croisé (0,35 s/coup)

### Sweep de variantes (`npm run balance`, self-play 12–16 parties)

| Variante | Normal (sans swap) | Difficile (avec swap) | Verdict |
|---|---|---|---|
| **9×9 · réserve 10 · portée 3** | 58/42 | **50/50** · 33 plies | ✅ référence |
| 7×7 | 100 % Noir · 8 plies | — | dégénéré (percée en 2 glisses) |
| 11×11 | 75 % Noir · 32 plies | — | avantage Noir, parties longues |
| portée 2 | 42/58 · 49 plies | 19/81 · 83 plies | trop défensif |
| portée 4 | 100 % Noir · 9 plies | — | dégénéré |
| réserve 8 | 58/42 | — | neutre |
| réserve 12 | 25/75 | 38/63 | penche Blanc |
| occ1 (ko strict) | 50/50 | 44/56 | viable, pas de gain vs occ2 |

Toutes les fins mesurées sont des percées — la domination de la percée est le prochain chantier de règles.

## Vers la plateforme

Le client est structuré **local-first** : profil, Elo et historique vivent dans `src/platform/store.ts` (localStorage) derrière une interface `StorageLike`. Quand le back-end arrivera, cette couche sera remplacée par un `ApiClient` (auth + WebSocket) sans toucher au jeu ni à l'UI.

Déjà en place :
- Onglets **Jouer · Parties · Profil** (SPA sans dépendance)
- **Elo local** par niveau d'IA (K=32, cibles 700/1200/1650) avec courbes de progression
- **Historique persistant** (200 dernières parties) et **relecture** coup à coup ou auto-play
- Moteur d'analyse isolé dans un Web Worker

Feuille de route online :
1. Serveur Node + WebSocket : salons, synchronisation des coups, horloges
2. Validation **serveur** des coups (le moteur de règles est déjà un module pur réutilisable côté Node)
3. Comptes + Elo global (le module `elo.ts` est partagé client/serveur)
4. Matchmaking par rating, puzzles de percée, classements saisonniers

## Roadmap

1. **Prototype jouable** — web local, deux joueurs sur le même écran (TypeScript + Vite, cœur de jeu pur sans dépendance rendu)
2. **IA minimale + random playouts** — détecter les stratégies triviales gagnantes, mesurer l'équilibre
3. **Synergie `game-solver`** — analyse de profondeur/complexité, résolution partielle
4. **Itérations de règles** jusqu'à stabilité compétitive
5. **Online 1v1** — comptes, ELO, matchmaking, format chess.com

# Glisse

Jeu de plateau abstrait 1v1, zéro hasard. Simple à apprendre (2 actions, 30 secondes), conçu pour une profondeur comparable au go et aux échecs. *(Nom de travail — à confirmer une fois le jeu validé.)*

## Pitch

Chaque pierre posée redessine tous les couloirs de glisse du plateau. Bloquer, dévier, se fermer volontairement une sortie : l'espace lui-même est l'arme.

## Règles (v1)

- Plateau **9×9**. Réserve de **10 pierres** par joueur. Noir part du haut, Blanc du bas.
- À son tour, chaque joueur exécute **une seule action** :
  1. **Poser** — placer une pierre de sa réserve sur une case vide de sa rangée de départ ;
  2. **Glisser** — choisir une de ses pierres et une direction (haut/bas/gauche/droite) : la pierre avance tout droit et s'arrête sur la dernière case libre avant le premier obstacle. Si l'obstacle est une pierre adverse, elle est **capturée** et la pierre s'arrête sur sa case.
- **Victoire** si :
  - une pierre atteint la rangée de départ adverse (**percée**) ;
  - l'adversaire ne possède plus aucune pierre (**anéantissement**) ;
  - l'adversaire n'a aucun coup légal (**immobilisation**).
- **Anti-répétition** : interdiction de recréer une position identique trois fois *(paramètre à calibrer)*.
- **Règle du swap** : après le tout premier coup, le joueur 2 peut échanger les couleurs (neutralise l'avantage du premier joueur).

## Pourquoi ça peut être profond

| Inspiration | Ce que ça apporte |
|---|---|
| Go | Chaque pierre modifie la topologie globale des couloirs → murs, épaisseur, potentialités latentes |
| Échecs | Séquences déterministes = lignes forcées calculables ; captures en chaîne traversant tout le plateau |
| Barricade | Le blocage est central : fermer un couloir, s'y enfermer soi-même, rediriger les glisses adverses |

## Questions ouvertes (à trancher par le test)

- Taille du plateau (7×7 ? 9×9 ? 11×11 ?) et taille de réserve
- Ratio poser/glisser optimal — faut-il limiter les poses ?
- Forme exacte de l'anti-répétition (ko simple ? règle des 3 positions ?)
- La percée est-elle trop facile contre une défense molle ? Trop dure contre une bonne défense ?

## Roadmap

1. **Prototype jouable** — web local, deux joueurs sur le même écran (TypeScript + Vite, cœur de jeu pur sans dépendance rendu)
2. **IA minimale + random playouts** — détecter les stratégies triviales gagnantes, mesurer l'équilibre
3. **Synergie `game-solver`** — analyse de profondeur/complexité, résolution partielle
4. **Itérations de règles** jusqu'à stabilité compétitive
5. **Online 1v1** — comptes, ELO, matchmaking, format chess.com

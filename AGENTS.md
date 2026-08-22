# AGENTS.md — Glisse

## Description

Jeu de plateau abstrait 1v1, zéro hasard : poser ou glisser des pierres, capturer en percutant, gagner par percée, anéantissement ou immobilisation. Simple à apprendre (30 secondes), profondeur visée type go/échecs. Règles complètes et roadmap dans `README.md`.

## Stack

- TypeScript, Vite.
- Cœur de jeu en module pur (aucune dépendance au rendu) : testable unitairement et branchable sur `game-solver`.
- Rendu Canvas 2D léger ; Phaser seulement si le besoin grandit.

## Règles (v1.1 — synthèse)

- Plateau 9×9, réserve de 10 pierres chacun. Noir commence (rangée du haut), Blanc en bas.
- Une action par tour : **Poser** (case vide de sa rangée de départ) ou **Glisser** (tout droit, **portée max 3** ; obstacle adverse = capture, même adjacent ; obstacle allié/bord = arrêt avant ; sinon arrêt en fin de portée).
- Victoire : percée (atteindre la rangée adverse) · anéantissement (plus de pierres adverses) · immobilisation (adversaire sans coup non répétitif).
- Swap miroir possible après le premier coup (pierre noire retirée, blanche posée en miroir) ; anti-répétition : une position identique ne peut pas être recréée une 3e fois.
- Portée illimitée (v1) = percée triviale au 2e coup → voir « Journal des règles » du README.

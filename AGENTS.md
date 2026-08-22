# AGENTS.md — Glisse

## Description

Jeu de plateau abstrait 1v1, zéro hasard : poser ou glisser des pierres, capturer en percutant, gagner par percée, anéantissement ou immobilisation. Simple à apprendre (30 secondes), profondeur visée type go/échecs. Règles complètes et roadmap dans `README.md`.

## Stack

- TypeScript, Vite.
- Cœur de jeu en module pur (aucune dépendance au rendu) : testable unitairement et branchable sur `game-solver`.
- Rendu Canvas 2D léger ; Phaser seulement si le besoin grandit.

## Règles (v1 — synthèse)

- Plateau 9×9, réserve de 10 pierres chacun. Noir commence (rangée du haut), Blanc en bas.
- Une action par tour : **Poser** (case vide de sa rangée de départ) ou **Glisser** (tout droit jusqu'au premier obstacle ; obstacle adverse = capture).
- Victoire : percée (atteindre la rangée adverse) · anéantissement (plus de pierres adverses) · immobilisation (adversaire sans coup légal).
- Swap possible après le premier coup ; anti-répétition à calibrer.

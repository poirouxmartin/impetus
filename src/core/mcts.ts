/**
 * IA MCTS (PUCT — Upper Confidence bounds on Trees).
 * Priors : réseau NN (si poids présents) mélangé à des heuristiques.
 * Valeur des feuilles : NN (échelle ±400 cp) mêlée à l'évaluation statique.
 * Interface prête pour un entraînement AlphaZero-lite continu.
 */
import { Action, Color, Position, applyAction, legalActions, other, slideDestination, targetRow, winnerAfter } from './rules'
import { evaluate } from './ai'
import { encodeInput, forward, moveIndex, type NnWeights } from './nn'
import nnWeightsJson from './nn-weights.json'

const C_PUCT = 1.4
const WIN = 1_000_000

/** Réseau entraîné (src/core/nn-weights.json) — toujours présent une fois l'entraînement lancé. */
const NET = nnWeightsJson as unknown as NnWeights | null

function distanceToTarget(row: number, color: Color): number {
  return Math.abs(row - targetRow(color))
}

/** Prior heuristique d'un coup : captures et promotions poussées, progression sinon. */
function heuristicPrior(pos: Position, a: Action): number {
  if (a.kind === 'swap') return 1.2
  if (a.kind === 'place') return 0.6
  const dest = slideDestination(pos.cells, a.row, a.col, a.dir, pos.turn)
  if (!dest) return 0.01
  if (dest.capture) return 3
  if (distanceToTarget(dest.row, pos.turn) === 0) return 2.5
  const gain = distanceToTarget(a.row, pos.turn) - distanceToTarget(dest.row, pos.turn)
  return 0.5 + Math.max(0, gain) * 0.4
}

interface Node {
  pos: Position
  parent: Node | null
  move: Action | null
  prior: number
  children: Node[]
  untried: Action[]
  visits: number
  value: number // cumulé du point de vue du trait de CE nœud
  nnDone: boolean
  nnLogits: Float64Array | null
  nnValue: number | null
}

function newNode(pos: Position, parent: Node | null, move: Action | null, prior: number): Node {
  return {
    pos,
    parent,
    move,
    prior,
    children: [],
    untried: [],
    visits: 0,
    value: 0,
    nnDone: false,
    nnLogits: null,
    nnValue: null,
  }
}

/** Forward NN du nœud (une seule fois) : logits + valeur. */
function ensureNn(node: Node): void {
  if (node.nnDone) return
  node.nnDone = true
  if (NET) {
    const f = forward(NET, encodeInput(node.pos))
    node.nnLogits = f.logits
    node.nnValue = f.value
  }
}

/** Prior d'une action : NN (softmax sur les coups restants) mêlé à l'heuristique. */
function actionPrior(node: Node, action: Action): number {
  const heur = heuristicPrior(node.pos, action)
  ensureNn(node)
  if (!node.nnLogits) return heur
  let max = -Infinity
  const keys = node.untried.map(moveIndex)
  for (const k of keys) if (node.nnLogits[k] > max) max = node.nnLogits[k]
  const kSelf = moveIndex(action)
  let sum = Math.exp(node.nnLogits[kSelf] - max)
  for (const k of keys) sum += Math.exp(node.nnLogits[k] - max)
  const nnP = Math.exp(node.nnLogits[kSelf] - max) / sum
  return 0.5 * nnP + 0.5 * heur
}

function bestChild(node: Node): Node {
  let best = node.children[0]
  let bestScore = -Infinity
  const logN = Math.log(Math.max(1, node.visits))
  for (const ch of node.children) {
    const q = ch.visits > 0 ? -ch.value / ch.visits : 0
    const u = q + (C_PUCT * ch.prior * Math.sqrt(logN)) / (1 + ch.visits)
    if (u > bestScore) {
      bestScore = u
      best = ch
    }
  }
  return best
}

/**
 * Choisit un coup par MCTS (budget en ms). `allowed` est déjà filtré par les règles.
 */
export function chooseActionMCTS(
  pos: Position,
  allowed: Action[],
  budgetMs = 900,
): Action | null {
  const res = analyseMCTS(pos, allowed, budgetMs)
  return res?.best ?? null
}

export interface MctsLine {
  move: Action
  visits: number
  /** Estimation de victoire pour le trait, en % (0–100). */
  winrate: number
}

export interface MctsAnalysis {
  best: Action | null
  sims: number
  lines: MctsLine[]
}

/** MCTS complet avec statistiques racine (pour le panneau d'analyse). */
export function analyseMCTS(
  pos: Position,
  allowed: Action[],
  budgetMs = 600,
): MctsAnalysis | null {
  if (allowed.length === 0) return null

  const me = pos.turn
  for (const a of allowed) {
    if (winnerAfter(applyAction(pos, a), me) === me) {
      return {
        best: a,
        sims: 0,
        lines: allowed.map((x) => ({
          move: x,
          visits: x === a ? 1 : 0,
          winrate: x === a ? 100 : 0,
        })),
      }
    }
  }

  const root = newNode(pos, null, null, 1)
  root.untried = [...allowed].sort(() => Math.random() - 0.5)
  const deadline = Date.now() + Math.max(60, budgetMs)
  let sims = 0

  while (Date.now() < deadline) {
    let node = root
    // 1. sélection : descendre par PUCT tant que tout est développé
    while (node.untried.length === 0 && node.children.length > 0) node = bestChild(node)
    // 2. valeur du nœud (terminale, nouvellement développée, ou évaluée)
    let v: number
    const lost = winnerAfter(node.pos, other(node.pos.turn))
    if (lost !== null) {
      v = lost === node.pos.turn ? WIN : -WIN
    } else if (node.untried.length > 0) {
      const action = node.untried.pop()!
      const childPos = applyAction(node.pos, action)
      const pr = actionPrior(node, action)
      const child = newNode(childPos, node, action, pr)
      // l'enfant doit pouvoir s'étendre à son tour, sinon l'arbre reste à profondeur 1
      child.untried = legalActions(childPos).sort(() => Math.random() - 0.5)
      node.children.push(child)
      node = child
      const lost2 = winnerAfter(node.pos, other(node.pos.turn))
      if (lost2 !== null) {
        v = lost2 === node.pos.turn ? WIN : -WIN
      } else {
        ensureNn(node)
        const staticEval = evaluate(node.pos, node.pos.turn)
        v = NET && node.nnValue !== null ? 0.5 * (400 * node.nnValue) + 0.5 * staticEval : staticEval
      }
    } else {
      v = evaluate(node.pos, node.pos.turn)
    }
    // 3. sauvegarde : la valeur alterne de signe à chaque niveau (perspective du trait)
    let cur: Node | null = node
    while (cur) {
      cur.visits++
      cur.value += v
      v = -v
      cur = cur.parent
    }
    sims++
  }

  const lines: MctsLine[] = root.children
    .map((ch) => ({
      move: ch.move!,
      visits: ch.visits,
      // child.value est du point de vue du trait de l'enfant = l'adversaire du trait racine
      winrate: Math.round(
        50 - 50 * Math.tanh(ch.visits > 0 ? ch.value / ch.visits / 400 : 0),
      ),
    }))
    .sort((a, b) => b.visits - a.visits)

  return { best: lines[0]?.move ?? null, sims, lines }
}

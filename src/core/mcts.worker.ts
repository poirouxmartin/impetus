import type { Action, Position } from './rules'
import { legalActions, setRules, type RuleConfig } from './rules'
import { MctsEngine, setNnWeight, type MctsAnalysis } from './mcts'

interface MctsMsg {
  type: 'mcts'
  gen: number
  pos: Position
  rules: RuleConfig
  budget: number
  /** Poids du réseau dans le mélange (0 = heuristiques seules). */
  blend: number
}

let currentGen = 0
let engine: MctsEngine | null = null
let enginePos: Position | null = null

self.addEventListener('message', (e: MessageEvent<MctsMsg>) => {
  const msg = e.data
  if (msg.gen < currentGen) return
  currentGen = msg.gen
  const myGen = msg.gen
  setRules(msg.rules)
  setNnWeight(msg.blend)

  // même position que le tour précédent → on continue d'accumuler les simulations
  const samePos =
    enginePos !== null &&
    enginePos.cells.length === msg.pos.cells.length &&
    enginePos.cells.every((c, i) => c === msg.pos.cells[i]) &&
    enginePos.turn === msg.pos.turn &&
    enginePos.moveCount === msg.pos.moveCount

  if (!samePos) {
    const legal: Action[] = legalActions(msg.pos)
    engine = new MctsEngine(msg.pos, legal)
    enginePos = msg.pos
  }
  // simulations continues : le root persiste tant que la position ne change pas
  engine!.run(msg.budget)
  const res: MctsAnalysis = engine!.stats()
  self.postMessage({ type: 'mcts', gen: myGen, res })
})

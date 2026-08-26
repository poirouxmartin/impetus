import type { Action, Position } from './rules'
import { legalActions, setRules, type RuleConfig } from './rules'
import { analyseMCTS } from './mcts'

interface MctsMsg {
  type: 'mcts'
  gen: number
  pos: Position
  rules: RuleConfig
  budget: number
}

let currentGen = 0

self.addEventListener('message', (e: MessageEvent<MctsMsg>) => {
  const msg = e.data
  if (msg.gen < currentGen) return
  currentGen = msg.gen
  const myGen = msg.gen
  setRules(msg.rules)
  const legal: Action[] = legalActions(msg.pos)
  const res = analyseMCTS(msg.pos, legal, msg.budget)
  self.postMessage({ type: 'mcts', gen: myGen, res })
})

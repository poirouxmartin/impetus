import { Analyzer } from './engine'
import { setRules, type Position, type RuleConfig } from './rules'

interface AnalyseMsg {
  type: 'analyse'
  gen: number
  pos: Position
  rules: RuleConfig
}

interface StopMsg {
  type: 'stop'
  gen: number
}

let currentGen = 0

self.addEventListener('message', (e: MessageEvent<AnalyseMsg | StopMsg>) => {
  const msg = e.data
  if (msg.type === 'stop') {
    if (msg.gen >= currentGen) currentGen = msg.gen
    return
  }
  if (msg.type === 'analyse') {
    if (msg.gen < currentGen) return
    currentGen = msg.gen
    const myGen = msg.gen
    setRules(msg.rules)
    const analyzer = new Analyzer(msg.pos)
    const loop = (): void => {
      if (myGen !== currentGen) return
      const a = analyzer.step()
      if (!a) return
      ;(self as unknown as Worker).postMessage({ type: 'progress', gen: myGen, analysis: a })
      setTimeout(loop, 0)
    }
    loop()
  }
})

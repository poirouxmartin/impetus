import { writeFileSync } from 'fs'
import { randomWeights, serializeWeights } from '../core/nn'

writeFileSync('src/core/nn-weights.json', serializeWeights(randomWeights()))
console.log('poids aléatoires initiaux écrits : src/core/nn-weights.json')

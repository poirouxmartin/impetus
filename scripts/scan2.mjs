import fs from 'node:fs'
const src = fs.readFileSync('server/server.ts', 'utf8')
let i = 0
let line = 1
const stack = []
let targetDepth = -1
while (i < src.length) {
  const c = src[i]
  if (c === '\n') { line++; i++; continue }
  if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
  if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++ } i += 2; continue }
  if (c === '"' || c === "'" || c === '`') {
    const q = c; i++
    while (i < src.length) { if (src[i] === '\\') { i += 2; continue } if (src[i] === q) break; if (src[i] === '\n') line++; i++ }
    i++; continue
  }
  if ('([{'.includes(c)) { stack.push([c, line]); if (line === 288 && c === '{') targetDepth = stack.length; i++; continue }
  if (')]}'.includes(c)) {
    const o = stack.pop()
    if (targetDepth > 0 && stack.length < targetDepth && o[1] !== 288) {
      console.log(`le corps du handler (ligne 288) se referme ligne ${line} via ${o[0]} qui ferme en réalité ${o[1]}`)
      process.exit(0)
    }
    i++
    continue
  }
  i++
}
console.log('jamais refermé avant EOF ?!')

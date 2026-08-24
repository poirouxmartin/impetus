import fs from 'node:fs'
const src = fs.readFileSync('server/server.ts', 'utf8')
let i = 0
let line = 1
const stack = []
const fail = (msg) => {
  console.log('ERREUR ligne', line, ':', msg)
  process.exit(0)
}
while (i < src.length) {
  const c = src[i]
  if (c === '\n') { line++; i++; continue }
  if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
  if (c === '/' && src[i + 1] === '*') {
    i += 2
    while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++ }
    i += 2
    continue
  }
  if (c === '"' || c === "'" || c === '`') {
    const q = c
    i++
    while (i < src.length) {
      if (src[i] === '\\') { i += 2; continue }
      if (src[i] === q) break
      if (src[i] === '\n') { if (q !== '`') fail('newline dans chaîne') }
      i++
    }
    i++
    continue
  }
  if ('([{'.includes(c)) { stack.push([c, line]); i++; continue }
  if (')]}'.includes(c)) {
    const o = stack.pop()
    if (!o) fail('fermeture orpheline ' + c)
    if ('([{'.indexOf(o[0]) !== ')]}'.indexOf(c)) fail('mismatch ' + o[0] + '(ligne ' + o[1] + ') vs ' + c)
    i++
    continue
  }
  i++
}
console.log('fin de fichier. non fermés :', JSON.stringify(stack))

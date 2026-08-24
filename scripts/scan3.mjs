import fs from 'node:fs'
const src = fs.readFileSync('server/server.ts', 'utf8')
let i = 0
let line = 1
const stack = []
while (i < src.length) {
  const c = src[i]
  if (c === '\n') { line++; i++; continue }
  if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
  if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++ } i += 2; continue }
  if (c === '"' || c === "'" || c === '`') {
    const q = c; i++
    while (i < src.length) { if (src[i] === '\\') { i += 2; continue } if (src[i] === q) break; if (src[i] === '\n') { if (q !== '`') fail() ; line++ } i++ }
    function fail(){ console.log('newline string ligne', line); process.exit(0) }
    i++; continue
  }
  if ('([{'.includes(c)) {
    stack.push([c, line])
    if (line >= 460 && line <= 505) console.log(line, 'OUVRE', c, '→ profondeur', stack.length)
    i++
    continue
  }
  if (')]}'.includes(c)) {
    const o = stack.pop()
    if (line >= 460 && line <= 505) console.log(line, 'FERME', c, '←', o?.[0], 'ligne', o?.[1], '→ profondeur', stack.length)
    i++
    continue
  }
  i++
}

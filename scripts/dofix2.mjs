import fs from 'node:fs'
const FILE = 'server/server.ts'
const lines = fs.readFileSync(FILE, 'utf8').split(/\r?\n/)

const occurrences = []
lines.forEach((l, i) => {
  if (l === 'function lobbyList() {') occurrences.push(i)
})
if (occurrences.length !== 2) {
  console.log('attendu 2 occurrences, trouvé', occurrences.length)
  process.exit(1)
}
const start = occurrences[1]
let end = -1
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i] === '}') { end = i; break }
}
// englober aussi le broadcastLobby qui suit immédiatement
let endBl = -1
for (let i = end + 1; i < lines.length; i++) {
  if (lines[i] === '}') { endBl = i; break }
}
console.log('suppression lignes', start + 1, 'à', endBl + 1)
lines.splice(start, endBl - start + 1 + 1) // +1 pour la ligne vide qui suit
fs.writeFileSync(FILE, lines.join('\n'))

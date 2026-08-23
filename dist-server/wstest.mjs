// scripts/wstest.ts
import { WebSocket } from "ws";
var URL = "ws://localhost:8787";
var failures = 0;
function expect(cond, label) {
  if (!cond) {
    failures++;
    console.log(`KO  ${label}`);
  } else {
    console.log(`ok  ${label}`);
  }
}
function once(ws, filter, ms = 3e3) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    const handler = (raw) => {
      const m = JSON.parse(String(raw));
      if (filter(m)) {
        clearTimeout(timer);
        ws.off("message", handler);
        resolve(m);
      }
    };
    ws.on("message", handler);
  });
}
var a = new WebSocket(URL);
await new Promise((r) => a.on("open", r));
a.send(JSON.stringify({ type: "create", name: "Alice" }));
var joinedA = await once(a, (m) => m.type === "joined");
expect(joinedA.color === "black", "Alice recoit Noir");
expect(/^[A-Z0-9]{4}$/.test(joinedA.code), `code salon (${joinedA.code})`);
var b = new WebSocket(URL);
await new Promise((r) => b.on("open", r));
b.send(JSON.stringify({ type: "join", code: joinedA.code, name: "Bob" }));
var joinedB = await once(b, (m) => m.type === "joined");
expect(joinedB.color === "white", "Bob recoit Blanc");
await once(a, (m) => m.type === "oppJoined");
a.send(JSON.stringify({ type: "move", action: { kind: "place", row: 0, col: 4 } }));
var mvB = await once(b, (m) => m.type === "move");
expect(mvB.action.kind === "place", "coup relaye a Bob");
b.send(JSON.stringify({ type: "move", action: { kind: "place", row: 8, col: 4 } }));
var mvA = await once(a, (m) => m.type === "move");
expect(mvA.action.kind === "place", "reponse de Bob relayee a Alice");
b.send(JSON.stringify({ type: "move", action: { kind: "place", row: 8, col: 5 } }));
var errB = await once(b, (m) => m.type === "error");
expect(String(errB.message).includes("tour"), "hors-tour refuse");
a.close();
b.close();
console.log(failures === 0 ? "\nTOUT PASSE" : `
${failures} echec(s)`);
process.exit(failures === 0 ? 0 : 1);

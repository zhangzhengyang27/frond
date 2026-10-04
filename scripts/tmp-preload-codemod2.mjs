import ts from 'typescript'
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'src/preload/index.ts'
const source = readFileSync(FILE, 'utf-8')
const sf = ts.createSourceFile(FILE, source, ts.ScriptTarget.Latest, true)

const edits = []
let processed = 0
const skipped = []

function walk(node) {
  if (ts.isArrowFunction(node)) {
    const untyped = node.parameters.filter((p) => !p.type && !p.dotDotDotToken)
    if (untyped.length === 1) {
      let call = null
      const findCall = (n) => {
        if (call) return
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'typedInvoke') call = n
        n.forEachChild(findCall)
      }
      findCall(node.body)
      if (call && call.arguments.length >= 2 && ts.isIdentifier(call.arguments[1])) {
        const channelArg = call.arguments[0]
        if (ts.isStringLiteral(channelArg) && call.arguments[1].text === untyped[0].name.getText()) {
          const channel = channelArg.text
          const p = untyped[0]
          const optional = p.questionToken ? '?' : ''
          edits.push({ start: p.getStart(sf), end: p.getEnd(), text: `${p.name.getText()}${optional}: IpcRequest<'${channel}'>` })
          processed++
        }
      }
    }
  }
  node.forEachChild(walk)
}
walk(sf)

edits.sort((a, b) => b.start - a.start)
let out = source
for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
writeFileSync(FILE, out)
console.log('annotated:', edits.length)
for (const s of skipped) console.log('skip:', s)

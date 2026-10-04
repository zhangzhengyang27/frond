import ts from 'typescript'
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'src/preload/index.ts'
const source = readFileSync(FILE, 'utf-8')
const sf = ts.createSourceFile(FILE, source, ts.ScriptTarget.Latest, true)

const edits = []
let processed = 0
let skipped = []

function walk(node) {
  if (ts.isArrowFunction(node)) {
    const untyped = node.parameters.filter((p) => !p.type && !p.dotDotDotToken)
    if (untyped.length > 0) {
      // 找函数体内的 typedInvoke 调用
      let call = null
      const findCall = (n) => {
        if (call) return
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'typedInvoke') {
          call = n
        }
        n.forEachChild(findCall)
      }
      findCall(node.body)
      if (call && call.arguments.length >= 2 && ts.isObjectLiteralExpression(call.arguments[1])) {
        const channelArg = call.arguments[0]
        const obj = call.arguments[1]
        if (ts.isStringLiteral(channelArg)) {
          const channel = channelArg.text
          const propType = new Map()
          for (const prop of obj.properties) {
            if (ts.isShorthandPropertyAssignment(prop)) {
              propType.set(prop.name.text, true)
            } else if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              // 非简写：值若直接引用同名参数也算
              if (ts.isIdentifier(prop.initializer)) propType.set(prop.name.text, prop.initializer.text)
            }
          }
          const replaceParts = []
          let allMapped = true
          for (const p of untyped) {
            const pname = p.name.getText()
            if (propType.has(pname)) {
              const optional = p.questionToken ? '?' : ''
              replaceParts.push({ param: p, text: `${pname}${optional}: IpcRequest<'${channel}'>['${pname}']` })
            } else {
              allMapped = false
            }
          }
          if (allMapped) {
            for (const part of replaceParts) {
              // 可选参：若原参无 ? 但字段在 req 中可选，保守不动（类型容错）
              edits.push({ start: part.param.getStart(sf), end: part.param.getEnd(), text: part.text })
            }
            processed++
          } else {
            skipped.push(`${channel}: ${untyped.map((p) => p.name.getText()).join(',')}`)
          }
        }
      } else if (call) {
        skipped.push(`${call.arguments[0]?.getText?.() ?? '?'}(非对象字面量): ${untyped.map((p) => p.name.getText()).join(',')}`)
      }
    }
  }
  node.forEachChild(walk)
}
walk(sf)

// 自底向上应用编辑
edits.sort((a, b) => b.start - a.start)
let out = source
for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)

// 加 IpcRequest 导入
if (!out.includes('IpcRequest') || !out.match(/import[^\n]*IpcRequest/)) {
  out = out.replace("import { typedInvoke } from './typedIpc'", "import { typedInvoke } from './typedIpc'\nimport type { IpcRequest } from '../shared/ipc-contract'")
}
writeFileSync(FILE, out)
console.log('annotated params:', edits.length, '| arrows:', processed)
console.log('skipped:'); for (const s of skipped) console.log('  -', s)

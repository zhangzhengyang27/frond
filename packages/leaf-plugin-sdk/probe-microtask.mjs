// 一次性探测脚本（不入库）：哪种模式在 supportsMicrotasks:true + 同步 scheduleMicrotask 下
// 会让 root 调度在自身栈内递归
import { createElement, useEffect, useState } from 'react'
import { start } from './dist/index.js'

const submitted = []
globalThis.launcherApi = {
  renderView: async (v) => {
    submitted.push(v)
    return { ok: true }
  },
  onCallback: () => {}
}

let depth = 0
let maxDepth = 0
let overflow = null

function probe(label, makeElement) {
  depth = 0
  maxDepth = 0
  try {
    makeElement()
    // eslint-disable-next-line no-console
    console.log(label, '→ maxDepth:', maxDepth, 'submitted:', submitted.length)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(label, '→ THREW:', e.constructor.name, String(e.message).slice(0, 60))
    if (overflow === null) overflow = label
  }
}

// 模式 A：useEffect 内 setState 链
function ChainA({ n, limit }) {
  const [c, setC] = useState(0)
  useEffect(() => {
    depth++
    if (c > maxDepth) maxDepth = c
    try {
      if (c < limit) setC(c + 1)
    } finally {
      depth--
    }
    if (depth > maxDepth) maxDepth = depth
    return undefined
  }, [c])
  return null
}

probe('A useEffect->setState x50', () => start(createElement(ChainA, { n: 0, limit: 50 })))

// 模式 B：useEffect 内重新 start()（re-entrant render 调用）
function ChainB({ limit }) {
  const [c, setC] = useState(0)
  useEffect(() => {
    depth += 1
    if (depth > maxDepth) maxDepth = depth
    try {
      if (c < limit) start(createElement(ChainB, { limit }))
      void setC
    } finally {
      depth -= 1
    }
    return undefined
  }, [c])
  return null
}
probe('B useEffect->start()', () => start(createElement(ChainB, { limit: 50 })))

// 模式 C：useEffect 内 setState 链，但用 List 组件（真实视图树）
const sdk = await import('./dist/index.js')
function ChainC({ limit }) {
  const [c, setC] = useState(0)
  useEffect(() => {
    depth += 1
    if (depth > maxDepth) maxDepth = depth
    try {
      if (c < limit) setC((x) => x + 1)
    } finally {
      depth -= 1
    }
    return undefined
  }, [c])
  return createElement(sdk.List, null, createElement(sdk.List.Item, { title: String(c) }))
}
probe('C useEffect->setState x50 + List', () => start(createElement(ChainC, { limit: 50 })))

await new Promise((r) => setTimeout(r, 200))
// eslint-disable-next-line no-console
console.log('final submitted count:', submitted.length, 'overflow at:', overflow)

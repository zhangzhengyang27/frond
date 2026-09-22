// 一次性基准（不入库）：fuzzyEngine 每候选 new Fuse vs 复用实例
import Fuse from 'fuse.js'

const OPTS = { ignoreLocation: true, threshold: 0.4, includeMatches: true, includeScore: true }
const CANDIDATES = Array.from({ length: 500 }, (_, i) => `leaf-module-${i}-filesystem-search`)
const QUERIES = ['chorme', 'flie', 'serx', 'navigaton', 'clipbaord', 'pomodoro', 'launcher', 'setting', 'perferenes', 'shorcut']

function bench(label, fn) {
  fn() // warm
  const t = process.hrtime.bigint()
  const hits = fn()
  const ms = Number(process.hrtime.bigint() - t) / 1e6
  console.log(`${label}: ${ms.toFixed(1)}ms  hits=${hits}`)
  return ms
}

function perCandidateNew() {
  let hits = 0
  for (const q of QUERIES)
    for (const text of CANDIDATES) {
      const [r] = new Fuse([text], OPTS).search(q)
      if (r) hits++
    }
  return hits
}

function perCandidateShared() {
  let hits = 0
  const fuse = new Fuse([], OPTS)
  for (const q of QUERIES)
    for (const text of CANDIDATES) {
      fuse.setCollection([text])
      const [r] = fuse.search(q)
      if (r) hits++
    }
  return hits
}

function batchOnce() {
  let hits = 0
  const fuse = new Fuse(CANDIDATES, OPTS)
  for (const q of QUERIES) hits += fuse.search(q).length
  return hits
}

const a = bench('new Fuse per candidate (现状)', perCandidateNew)
const b = bench('shared instance + setCollection', perCandidateShared)
const c = bench('one instance, batch search over collection', batchOnce)
console.log(`\n5000 probes: 复用实例省 ${((1 - b / a) * 100).toFixed(0)}%；批量口径 ${((1 - c / a) * 100).toFixed(0)}% 且命中数语义不同`)

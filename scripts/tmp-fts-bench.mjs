// 一次性基准（不入库）：50 万条目下 unicode61 / trigram / LIKE 三条路径的成本
import Database from 'better-sqlite3'

const N = 500000
const db = new Database(':memory:')
db.exec(`
CREATE TABLE files (path TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE VIRTUAL TABLE fts_u USING fts5(name, path, tokenize='unicode61');
`)
const t0 = Date.now()
const insertU = db.prepare('INSERT INTO files(path, name) VALUES (?, ?)')
const rows = db.prepare('INSERT INTO fts_u(rowid, name, path) VALUES (?, ?, ?)')
const tx = db.transaction((start, end) => {
  for (let i = start; i < end; i++) {
    const name = i % 500 === 0 ? `项目计划-${i}.md` : `frond-module-${i}-filesystem-search.ts`
    insertU.run(`/home/u/dir${i % 200}/${name}`, name)
    rows.run(i + 1, name, `/home/u/dir${i % 200}/${name}`)
  }
})
tx(0, N)
console.log(`建库 + unicode61 索引: ${Date.now() - t0}ms`)

const t1 = Date.now()
db.exec(`CREATE VIRTUAL TABLE fts_t USING fts5(name, path, content='files', content_rowid='rowid', tokenize='trigram')`)
db.exec(`INSERT INTO fts_t(fts_t) VALUES ('build')`)
console.log(`建 trigram 影子索引: ${Date.now() - t1}ms`)

function time(label, fn) {
  fn()
  const t = Date.now()
  let hits = 0
  for (let i = 0; i < 10; i++) hits += fn().length
  console.log(`${label}: ${((Date.now() - t) / 10).toFixed(1)}ms/次 hits=${hits}`)
}

time('unicode61 前缀 "frond-module-12*"', () => db.prepare(`SELECT name FROM fts_u WHERE fts_u MATCH '"frond-module-12"*' LIMIT 30`).all())
time('trigram 中缀 "mentp"（≥3）', () => db.prepare(`SELECT name FROM fts_t WHERE fts_t MATCH 'mentp' LIMIT 30`).all())
time('trigram 中缀 "iles-se"（≥3）', () => db.prepare(`SELECT name FROM fts_t WHERE fts_t MATCH '"iles-se"' LIMIT 30`).all())
time('LIKE 两字 CJK "%计划%"（无索引全扫）', () => db.prepare(`SELECT name FROM files WHERE name LIKE '%计划%' LIMIT 30`).all())
time('LIKE 长中缀 "%filesystem-search"（无索引全扫）', () => db.prepare(`SELECT name FROM files WHERE name LIKE '%filesystem-search' LIMIT 30`).all())
console.log('trigram 里查 2 字:', db.prepare(`SELECT name FROM fts_t WHERE fts_t MATCH '计划' LIMIT 5`).all().length, '（预期 0：trigram 需 ≥3 字符）')
db.close()

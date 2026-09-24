import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileIndexDb } from '../db'
import { fullScan, rescanDir, compensateStaleDirs } from '../scanner'
// 索引里存的路径是 normPath 的 '/' 规范形态；断言与生产函数同源，win32 才不会
// 因 join() 的反斜杠假红（2026-09-24 CI windows 咬到）
import { normPath } from '../paths'

/**
 * 扫描器（#9）：初始全量 + 单目录增量 diff。
 * 排除剪枝 / .frondignore / 内容提取 / 增量增删改，全部走真实临时目录验证。
 */
let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'frond-fidx-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function makeDb(): FileIndexDb {
  return FileIndexDb.openInMemory()
}

describe('fullScan', () => {
  it('递归索引嵌套文件与目录本身', async () => {
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'README.md'), 'hello')
    writeFileSync(join(root, 'src', 'a.ts'), 'const a = 1')
    const db = makeDb()
    // 返回值 = 文件数（目录行走单独路径，不计入 scanned）
    const result = await fullScan({ roots: [root], db, policy: { hidden: true } })
    expect(result.scanned).toBe(2)
    expect(db.count()).toBe(4) // root + src 目录行 + 2 文件
    const hits = db.search(['readme'], { mode: 'name', limit: 5 })
    expect(hits.map((h) => h.name)).toContain('README.md')
    // 目录本身也被索引（FilesPage 目录浏览）
    const dirs = db.search(['src'], { mode: 'name', limit: 5 })
    expect(dirs.some((h) => h.isDir)).toBe(true)
  })

  it('内置排除剪枝：node_modules / 隐藏目录不进索引', async () => {
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(join(root, 'node_modules', 'pkg', 'x.js'), 'x')
    mkdirSync(join(root, '.secret'))
    writeFileSync(join(root, '.secret', 'k.txt'), 'k')
    writeFileSync(join(root, 'keep.txt'), 'keep')
    const db = makeDb()
    await fullScan({ roots: [root], db, policy: { hidden: true } })
    expect(db.search(['x.js'], { mode: 'name', limit: 5 })).toEqual([])
    expect(db.search(['k.txt'], { mode: 'name', limit: 5 })).toEqual([])
    expect(db.search(['keep'], { mode: 'name', limit: 5 })).toHaveLength(1)
  })

  it('.frondignore 标记目录跳过', async () => {
    mkdirSync(join(root, 'scratch'))
    writeFileSync(join(root, 'scratch', '.frondignore'), '')
    writeFileSync(join(root, 'scratch', 'big.dat'), 'x')
    const db = makeDb()
    await fullScan({ roots: [root], db, policy: { hidden: true } })
    expect(db.search(['big.dat'], { mode: 'name', limit: 5 })).toEqual([])
  })

  it('内容提取：白名单文本入 FTS，二进制不进', async () => {
    writeFileSync(join(root, 'doc.md'), '# 标题\n独特正文内容')
    const bin = Buffer.alloc(32)
    bin.write('BM', 0)
    bin[20] = 0
    writeFileSync(join(root, 'doc.md.bin'), bin)
    const db = makeDb()
    await fullScan({ roots: [root], db, policy: { hidden: true } })
    const hits = db.search(['独特正文'], { mode: 'content', limit: 5 })
    expect(hits.map((h) => h.path)).toContain(normPath(join(root, 'doc.md')))
  })
})

describe('rescanDir 增量 diff', () => {
  let db: FileIndexDb
  beforeEach(async () => {
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src', 'a.ts'), 'const a = 1')
    db = makeDb()
    await fullScan({ roots: [root], db, policy: { hidden: true } })
    // 推进目录水位，避免 mtime 粒度跳过
    utimesSync(join(root, 'src'), new Date(1000000), new Date(1000000))
  })

  it('新增文件 → 出现；删除文件 → 消失', async () => {
    writeFileSync(join(root, 'src', 'b.ts'), 'const b = 2')
    await rescanDir(db, join(root, 'src'), { hidden: true })
    expect(db.search(['b.ts'], { mode: 'name', limit: 5 })).toHaveLength(1)

    rmSync(join(root, 'src', 'b.ts'))
    await rescanDir(db, join(root, 'src'), { hidden: true })
    expect(db.search(['b.ts'], { mode: 'name', limit: 5 })).toEqual([])
  })

  it('改名 = 旧消失 + 新出现', async () => {
    writeFileSync(join(root, 'src', 'renamed.ts'), 'const a = 1')
    rmSync(join(root, 'src', 'a.ts'))
    await rescanDir(db, join(root, 'src'), { hidden: true })
    expect(db.search(['renamed'], { mode: 'name', limit: 5 })).toHaveLength(1)
    expect(db.search(['a.ts'], { mode: 'name', limit: 5 })).toEqual([])
  })
})

describe('fullScan 逐根隔离（外接卷未挂载等）', () => {
  const MISSING = '/definitely-not-a-volume-xyz'

  it('某个范围读不到只跳过它，其余照常索引并记录原因', async () => {
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'README.md'), 'hello')
    writeFileSync(join(root, 'src', 'a.ts'), 'const a = 1')
    const db = makeDb()
    const result = await fullScan({ roots: [MISSING, root], db, policy: { hidden: true } })
    expect(result.scanned).toBe(2)
    expect(result.unavailable).toHaveLength(1)
    expect(result.unavailable[0]?.root).toBe(MISSING)
    expect(result.unavailable[0]?.reason).toMatch(/ENOENT/)
    expect(db.search(['readme'], { mode: 'name', limit: 5 }).map((h) => h.name)).toContain(
      'README.md'
    )
  })

  it('全部范围都读不到：不抛，scanned=0 且逐条记录', async () => {
    const db = makeDb()
    const result = await fullScan({
      roots: [MISSING, '/another-missing-volume'],
      db,
      policy: { hidden: true }
    })
    expect(result.scanned).toBe(0)
    expect(result.unavailable.map((u) => u.root)).toEqual([MISSING, '/another-missing-volume'])
  })

  it('跳过的范围不删既有索引行（卷插回来还能用，误删反而要全量重扫）', async () => {
    const volume = join(root, 'Volume')
    mkdirSync(volume)
    writeFileSync(join(volume, 'keep.md'), 'k')
    const db = makeDb()
    await fullScan({ roots: [volume], db, policy: { hidden: true } })
    expect(db.search(['keep'], { mode: 'name', limit: 5 })).toHaveLength(1)
    rmSync(volume, { recursive: true, force: true })
    const again = await fullScan({ roots: [volume], db, policy: { hidden: true } })
    expect(again.unavailable).toHaveLength(1)
    expect(db.search(['keep'], { mode: 'name', limit: 5 })).toHaveLength(1)
  })
})

describe('compensateStaleDirs（启动期水位补偿）', () => {
  const all = (): boolean => true
  let db: FileIndexDb

  beforeEach(async () => {
    mkdirSync(join(root, 'src'))
    mkdirSync(join(root, 'gone'))
    writeFileSync(join(root, 'src', 'a.ts'), 'const a = 1')
    writeFileSync(join(root, 'gone', 'x.txt'), 'x')
    db = makeDb()
    await fullScan({ roots: [root], db, policy: { hidden: true } })
  })

  it('停机期间的新增/删除在下一趟被回补，之后无事可做', async () => {
    rmSync(join(root, 'src', 'a.ts'))
    writeFileSync(join(root, 'src', 'b.ts'), 'const b = 2')
    // 目录 mtime 与水位错开 = 「进程没在跑的时候发生过变更」
    utimesSync(join(root, 'src'), new Date(1000000), new Date(1000000))
    expect(await compensateStaleDirs(db, { hidden: true }, all)).toBeGreaterThan(0)
    expect(db.search(['b.ts'], { mode: 'name', limit: 5 })).toHaveLength(1)
    expect(db.search(['a.ts'], { mode: 'name', limit: 5 })).toEqual([])
    // 水位已被推进：没有新变更就不该再重扫任何目录
    expect(await compensateStaleDirs(db, { hidden: true }, all)).toBe(0)
  })

  it('目录消失：索引行与水位一并清掉（水位表不再只增不减）', async () => {
    rmSync(join(root, 'gone'), { recursive: true, force: true })
    await compensateStaleDirs(db, { hidden: true }, all)
    expect(db.search(['x.txt'], { mode: 'name', limit: 5 })).toEqual([])
    expect(db.listDirs().some((d) => d.path.endsWith('/gone'))).toBe(false)
  })

  it('范围外的水位不动（收缩范围后交给重建清理）', async () => {
    utimesSync(join(root, 'src'), new Date(1000000), new Date(1000000))
    const n = await compensateStaleDirs(db, { hidden: true }, (p) => !p.endsWith('/src'))
    expect(n).toBe(0)
  })
})

/**
 * Frond · 旧品牌（Leaf）存量数据搬迁
 *
 * 2026-09-23 项目由 Leaf 改名 Frond。代码侧一次改完，但盘上还留着按旧名写的东西：
 *   - `Application Support/leaf-desktop` 整个 userData（库文件、剪贴板历史、文件索引、Local Storage）
 *   - 库文件名 `leaf.db`；加密密钥文件 `.leaf-key`
 *   - 已安装插件目录 `launcher-plugins/com.leaf.*` 与 `installed.json` 里的插件 id
 * 不搬的后果不是「难看」而是**数据看起来没了**：`database.ts` 找的是 `frond.db`，
 * 找不到就新建一个空库，用户开机见到的是全新产品。
 *
 * 纪律：只做 rename（可逆），任何路径都不递归删；旧目录搬空后也原样留着，由人确认后自行清理。
 * 必须在 `requestSingleInstanceLock()` 之前调用——那一步会创建 userData 目录，
 * 之后「目标不存在才整体搬」这条判据就永远不成立了。
 */
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'

/** 旧名（按历史顺序：dev 用包名、打包用 productName），命中一个即搬 */
const LEGACY_USER_DATA_NAMES = ['leaf-desktop', 'Leaf']
/** userData 里按旧名写的单文件（目录另有处理） */
const LEGACY_FILES = ['leaf.db', 'leaf.db-wal', 'leaf.db-shm', '.leaf-key']

const log = (msg: string): void => console.log(`[BrandMigration] ${msg}`)

function rename(from: string, to: string, what: string): boolean {
  if (existsSync(to)) return false
  renameSync(from, to)
  log(`搬迁${what}: ${from} → ${to}`)
  return true
}

/**
 * 把旧 userData 整体搬到当前路径；目标已存在（新版已经跑过一次）时只补缺的旧名文件。
 * 返回是否发生了搬迁。
 */
function relocateUserData(userDataDir: string): boolean {
  if (!existsSync(userDataDir)) {
    for (const legacy of LEGACY_USER_DATA_NAMES) {
      const legacyDir = join(userDataDir, '..', legacy)
      if (legacyDir !== userDataDir && existsSync(legacyDir)) {
        renameSync(legacyDir, userDataDir)
        log(`搬迁 userData: ${legacyDir} → ${userDataDir}`)
        return true
      }
    }
  }
  let moved = false
  for (const legacy of LEGACY_USER_DATA_NAMES) {
    const legacyDir = join(userDataDir, '..', legacy)
    if (legacyDir === userDataDir || !existsSync(legacyDir)) continue
    for (const file of LEGACY_FILES) {
      if (!existsSync(join(legacyDir, file))) continue
      const from = join(legacyDir, file)
      const to = join(userDataDir, file)
      try {
        moved = rename(from, to, '旧数据文件') || moved
      } catch (error) {
        console.error(
          '[BrandMigration] 旧数据文件搬迁失败，继续用现有数据:',
          (error as Error).message
        )
      }
    }
  }
  return moved
}

/** userData 内的历史库文件名与密钥文件名跟着品牌走 */
function renameLegacyFileNames(userDataDir: string): void {
  const pairs: Array<[string, string]> = [
    ['leaf.db', 'frond.db'],
    ['leaf.db-wal', 'frond.db-wal'],
    ['leaf.db-shm', 'frond.db-shm'],
    ['.leaf-key', '.frond-key']
  ]
  for (const [from, to] of pairs) {
    if (!existsSync(join(userDataDir, from))) continue
    try {
      rename(join(userDataDir, from), join(userDataDir, to), '旧文件名')
    } catch (error) {
      console.error('[BrandMigration] 文件改名失败:', (error as Error).message)
    }
  }
}

/**
 * 已安装插件：目录名就是插件 id，`installed.json` 的 id/sourcePath 与插件自己的
 * `plugin.json` 清单都带着旧命名空间。不改的后果是 21 个内置插件在管理页集体
 * 消失（目录名 / 索引 / 清单三者对不上）。
 */
function renameLegacyPluginIds(userDataDir: string): void {
  const root = join(userDataDir, 'launcher-plugins')
  if (!existsSync(root)) return
  try {
    for (const name of readdirSync(root)) {
      if (!name.startsWith('com.leaf.')) continue
      const target = join(root, name.replace('com.leaf.', 'com.frond.'))
      if (!rename(join(root, name), target, '插件目录')) continue
      const manifest = join(target, 'plugin.json')
      if (existsSync(manifest)) {
        writeFileSync(
          manifest,
          readFileSync(manifest, 'utf-8').replaceAll('com.leaf.', 'com.frond.')
        )
      }
    }
    const index = join(root, 'installed.json')
    if (!existsSync(index)) return
    const raw = readFileSync(index, 'utf-8')
    const next = raw.replaceAll('com.leaf.', 'com.frond.').replaceAll('"Leaf"', '"Frond"')
    if (next !== raw) {
      writeFileSync(index, next)
      log('已重写 installed.json 里的插件 id')
    }
  } catch (error) {
    console.error('[BrandMigration] 插件 id 搬迁失败:', (error as Error).message)
  }
}

export function migrateLegacyBrandData(userDataDir: string): void {
  try {
    relocateUserData(userDataDir)
    renameLegacyFileNames(userDataDir)
    renameLegacyPluginIds(userDataDir)
  } catch (error) {
    // 搬迁失败不能挡住启动：旧库仍在原处，最坏是这次以新库起来，用户数据没丢
    console.error('[BrandMigration] 异常，已跳过:', (error as Error).message)
  }
}

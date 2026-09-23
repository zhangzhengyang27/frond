/**
 * Frond · 旧品牌存量搬迁的契约
 *
 * 这块代码只跑一次、只在真机上有副作用，出错的形态是「用户数据看起来没了」，
 * 所以断言落在真实文件系统上（mkdtemp 自己的根，跑完自己清）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { migrateLegacyBrandData } from '../brandMigration'

function seedLegacyUserData(dir: string): void {
  mkdirSync(join(dir, 'launcher-plugins', 'com.leaf.jwt'), { recursive: true })
  mkdirSync(join(dir, 'clipboard-history'), { recursive: true })
  writeFileSync(join(dir, 'leaf.db'), 'DB-BYTES')
  writeFileSync(join(dir, 'leaf.db-wal'), 'WAL-BYTES')
  writeFileSync(join(dir, '.leaf-key'), 'KEY-BYTES')
  writeFileSync(join(dir, 'clipboard-history', 'a.png'), 'PNG')
  writeFileSync(
    join(dir, 'launcher-plugins', 'installed.json'),
    JSON.stringify([{ id: 'com.leaf.jwt', author: 'Leaf', sourcePath: '/x/plugins/com.leaf.jwt' }])
  )
  writeFileSync(
    join(dir, 'launcher-plugins', 'com.leaf.jwt', 'plugin.json'),
    '{"id":"com.leaf.jwt"}'
  )
}

describe('migrateLegacyBrandData', () => {
  let appData: string
  const userData = (): string => join(appData, 'frond-desktop')

  beforeEach(() => {
    appData = mkdtempSync(join(tmpdir(), 'frond-brand-migration-'))
  })
  afterEach(() => {
    rmSync(appData, { recursive: true, force: true })
  })

  it('目标 userData 还不存在：整目录搬过去，非品牌文件（剪贴板历史）一起走', () => {
    seedLegacyUserData(join(appData, 'leaf-desktop'))
    migrateLegacyBrandData(userData())

    expect(readFileSync(join(userData(), 'frond.db'), 'utf-8')).toBe('DB-BYTES')
    expect(readFileSync(join(userData(), 'clipboard-history', 'a.png'), 'utf-8')).toBe('PNG')
    expect(existsSync(join(appData, 'leaf-desktop'))).toBe(false)
  })

  it('目标已存在（新版已经起来过）：只补缺的旧名文件，不动已有内容', () => {
    seedLegacyUserData(join(appData, 'leaf-desktop'))
    mkdirSync(userData(), { recursive: true })
    writeFileSync(join(userData(), 'frond.db'), 'FRESH')

    migrateLegacyBrandData(userData())

    expect(readFileSync(join(userData(), 'frond.db'), 'utf-8')).toBe('FRESH')
    expect(readFileSync(join(userData(), '.frond-key'), 'utf-8')).toBe('KEY-BYTES')
  })

  it('库文件与密钥改名，插件目录与 installed.json 里的旧命名空间一起换', () => {
    mkdirSync(userData(), { recursive: true })
    seedLegacyUserData(userData())

    migrateLegacyBrandData(userData())

    expect(existsSync(join(userData(), 'leaf.db'))).toBe(false)
    expect(existsSync(join(userData(), '.leaf-key'))).toBe(false)
    expect(existsSync(join(userData(), 'launcher-plugins', 'com.frond.jwt'))).toBe(true)
    const installed = JSON.parse(
      readFileSync(join(userData(), 'launcher-plugins', 'installed.json'), 'utf-8')
    )[0]
    expect(installed.id).toBe('com.frond.jwt')
    expect(installed.sourcePath).toBe('/x/plugins/com.frond.jwt')
    expect(
      readFileSync(join(userData(), 'launcher-plugins', 'com.frond.jwt', 'plugin.json'), 'utf-8')
    ).toBe('{"id":"com.frond.jwt"}')
  })

  it('跑第二遍什么都不动（幂等）', () => {
    seedLegacyUserData(join(appData, 'leaf-desktop'))
    migrateLegacyBrandData(userData())
    const snapshot = join(appData, 'snapshot')
    cpSync(userData(), snapshot, { recursive: true })

    migrateLegacyBrandData(userData())

    expect(readFileSync(join(userData(), 'frond.db'), 'utf-8')).toBe('DB-BYTES')
    expect(existsSync(join(userData(), 'launcher-plugins', 'com.leaf.jwt'))).toBe(false)
    expect(readFileSync(join(snapshot, 'launcher-plugins', 'installed.json'), 'utf-8')).toBe(
      readFileSync(join(userData(), 'launcher-plugins', 'installed.json'), 'utf-8')
    )
  })

  it('没有旧目录也不报错（全新安装）', () => {
    expect(() => migrateLegacyBrandData(userData())).not.toThrow()
    expect(existsSync(userData())).toBe(false)
  })
})

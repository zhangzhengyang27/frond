/**
 * Frond · 测试隔离门禁（不得写真实用户目录）
 *
 * 背景（2026-09-24）：`RecordingSettingsDataStore.storage.test.ts` 只 mock 了
 * `electron`，以为 `app.getPath('userData')` 被指到 tmpdir 就万事大吉。但
 * **electron-store 在非 Electron 进程里根本不查 `app.getPath`** —— 它走
 * env-paths 的默认目录。实测跑一次该文件就会刷新真实的
 *
 *     ~/Library/Preferences/electron-store-nodejs/recording-settings.json
 *
 * 并在沙箱拦截时留下 `.tmp-*` 残骸。测试污染开发者的真实用户数据，属于
 * 「跑测试把人数据改了」这类最难排查的问题之一。
 *
 * 本门禁的判据：任何测试只要（直接）引用了会 import electron-store 的模块，
 * 就必须自己 `vi.mock('electron-store', …)` 掉它。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'

const REPO_ROOT = join(__dirname, '../../..')
const SRC_DIR = join(REPO_ROOT, 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue
      walk(full, out)
    } else {
      out.push(full)
    }
  }
  return out
}

/** 把相对 import 说明符解析到磁盘上的真实文件（尝试常见扩展名） */
function resolveLocal(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.vue`,
    join(base, 'index.ts'),
    join(base, 'index.tsx')
  ]
  for (const c of candidates) {
    try {
      if (statSync(c).isFile()) return c
    } catch {
      /* 试下一个 */
    }
  }
  return null
}

describe('测试隔离（不得写真实用户目录）', { timeout: 30_000 }, () => {
  it('引用 electron-store 支撑模块的测试必须 mock 掉 electron-store', () => {
    const testFiles = walk(SRC_DIR).filter((f) => /\.test\.ts$/.test(f))
    // 体量哨兵：扫不到测试文件说明路径错了，不是「通过」
    expect(testFiles.length, '一个测试文件都没扫到 = 路径错').toBeGreaterThan(80)

    const candidates: string[] = []
    const offenders: string[] = []

    for (const tf of testFiles) {
      const src = readFileSync(tf, 'utf-8')
      const specs = [...src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1])
      const importsStoreBacked = specs.some((spec) => {
        const p = resolveLocal(tf, spec)
        if (!p) return false
        try {
          return /from\s+['"]electron-store['"]/.test(readFileSync(p, 'utf-8'))
        } catch {
          return false
        }
      })
      if (!importsStoreBacked) continue
      candidates.push(relative(REPO_ROOT, tf))
      if (!src.includes("vi.mock('electron-store'")) offenders.push(relative(REPO_ROOT, tf))
    }

    expect(
      candidates.length,
      '候选集为空 = 解析可能失效；若 electron-store 已被彻底移除，请删掉本用例'
    ).toBeGreaterThan(0)

    expect(
      offenders,
      '这些测试引用了基于 electron-store 的模块却没有 mock 它 —— electron-store 在非 Electron\n' +
        '进程里走 env-paths 默认目录，会写进真实的 ~/Library/Preferences/<name>-nodejs/：\n  ' +
        offenders.join('\n  ')
    ).toEqual([])
  })
})

/**
 * lint-css-changed 重建件 · 契约测试
 *
 * 背景：`scripts/lint-css-changed.mjs` 与 stylelint 配置都是 2026-09-22 删除事故的
 * 丢失件（从未入库，见 rebuildLedger.test.ts 的 RECOVERED_WITHOUT_MARKER 台账）。
 * 本文件把可考的调用点契约钉住，重建不得回退：
 *
 *   1. B16（docs/BUGS.md:224）：必须用 `^(..)\s+(.+)$` 解析 porcelain 行，
 *      **已暂存文件（`M  ` 前缀）的路径不得被截掉首字符** —— 原件正是死在这一步，
 *      导致严格 CSS 检查形同虚设。这条是最早写下的回归用例。
 *   2. ci.yml:36-39：增量零容忍 —— STRICT_CSS_LINT=1 时 warning 也算失败
 *      （「新增代码必须用 design token 写颜色」）。
 *   3. CONTRIBUTING.md:26：只查改动的 .css/.less/.vue。
 *   4. CLI 集成：真实 stylelint 跑一遍临时 git 仓库里的违规文件，exit 1 且报出规则名。
 */

import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parsePorcelainStatus,
  selectStyleFiles,
  resolveDiffRange,
  decideOutcome,
  listChangedStyleFiles
} from '../lib/lintCssChanged.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLI = join(REPO_ROOT, 'scripts', 'lint-css-changed.mjs')

describe('parsePorcelainStatus（B16 回归核心）', () => {
  it('已暂存（`M  ` 前缀）：路径首字符不得被截掉 —— 原件 bug 就是死在这', () => {
    expect(parsePorcelainStatus('M  src/renderer/a.vue')).toEqual(['src/renderer/a.vue'])
  })

  it('未暂存（` M` 前缀）与未跟踪（`??`）三种形态都兼容（B16 修复目标）', () => {
    expect(parsePorcelainStatus(' M src/a.css')).toEqual(['src/a.css'])
    expect(parsePorcelainStatus('?? src/new.css')).toEqual(['src/new.css'])
  })

  it('暂存+未暂存同时改（`MM`）只报一次；rename 取新路径', () => {
    expect(parsePorcelainStatus('MM src/a.css')).toEqual(['src/a.css'])
    expect(parsePorcelainStatus('R  old/dir.css -> new/dir.css')).toEqual(['new/dir.css'])
  })

  it('路径里的空格不丢；空行跳过；空输入返回空数组', () => {
    expect(parsePorcelainStatus('M  my dir/a.css')).toEqual(['my dir/a.css'])
    expect(parsePorcelainStatus('\nM  a.css\n\n?? b.css\n')).toEqual(['a.css', 'b.css'])
    expect(parsePorcelainStatus('')).toEqual([])
  })
})

describe('selectStyleFiles', () => {
  it('只留 .css/.less/.vue，大小写不敏感，去重且保序', () => {
    expect(
      selectStyleFiles(['src/a.css', 'src/b.ts', 'src/c.vue', 'src/a.css', 'README.md', 'D.UP.CSS'])
    ).toEqual(['src/a.css', 'src/c.vue', 'D.UP.CSS'])
  })
})

describe('resolveDiffRange（CI 增量口径）', () => {
  it('非 CI 环境 → null（走 git status 口径）', () => {
    expect(resolveDiffRange({})).toBeNull()
    expect(resolveDiffRange({ GITHUB_ACTIONS: 'false' })).toBeNull()
  })

  it('pull_request：与目标分支三点 diff（merge-base 起，PR 口径）', () => {
    expect(
      resolveDiffRange({
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_BASE_REF: 'main'
      })
    ).toMatchObject({ range: 'origin/main...HEAD' })
  })

  it('push：diff event.before..HEAD；before 全零（新建分支）与坏 event 文件 → null', () => {
    const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push' }
    expect(resolveDiffRange(env, () => '{"before":"abc123"}')).toMatchObject({
      range: 'abc123..HEAD'
    })
    expect(resolveDiffRange(env, () => '{"before":"0000000000000000000000000000000000000000"}')).toBeNull()
    expect(resolveDiffRange(env, () => 'not-json')).toBeNull()
  })
})

describe('decideOutcome（零容忍门禁判定）', () => {
  const base = { errorCount: 0, warningCount: 0 }
  it('有 error → 失败（无论 strict）', () => {
    expect(decideOutcome({ ...base, errorCount: 1 }, false).ok).toBe(false)
    expect(decideOutcome({ ...base, errorCount: 1 }, true).ok).toBe(false)
  })
  it('STRICT_CSS_LINT=1：warning 也失败（增量零容忍，ci.yml:36 的契约）', () => {
    expect(decideOutcome({ ...base, warningCount: 3 }, true).ok).toBe(false)
    expect(decideOutcome({ ...base, warningCount: 3 }, true).kind).toBe('warning')
  })
  it('非 strict：warning 不拦（全量存量 946 warnings 的容忍口径）', () => {
    expect(decideOutcome({ ...base, warningCount: 946 }, false).ok).toBe(true)
  })
})

describe('listChangedStyleFiles（注入 git runner）', () => {
  it('status 模式：porcelain → 解析 → 样式筛选 → 剔除已删除文件', async () => {
    const calls: string[] = []
    const files = await listChangedStyleFiles({
      runGit: async (sub: string, range?: string) => {
        calls.push(range === undefined ? sub : `${sub} ${range}`)
        return 'M  src/gone.css\nM  src/keep.vue\n'
      },
      fileExists: (p: string) => p.endsWith('keep.vue')
    })
    expect(calls).toEqual(['status'])
    expect(files).toEqual(['src/keep.vue'])
  })

  it('CI push 模式：改走 diff 口径，不再读 status', async () => {
    const calls: string[] = []
    await listChangedStyleFiles({
      runGit: async (sub: string, range?: string) => {
        calls.push(range === undefined ? sub : `${sub} ${range}`)
        return 'src/diff.vue\n'
      },
      fileExists: () => true,
      env: { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push' },
      readEventFile: () => '{"before":"abc123"}'
    })
    expect(calls).toEqual(['diff abc123..HEAD'])
  })

  it('--base 显式指定：本地也能按 diff 口径查（分支开发场景）', async () => {
    const calls: string[] = []
    await listChangedStyleFiles({
      runGit: async (sub: string, range?: string) => {
        calls.push(range === undefined ? sub : `${sub} ${range}`)
        return ''
      },
      fileExists: () => true,
      base: 'main'
    })
    expect(calls).toEqual(['diff main...HEAD'])
  })
})

describe('CLI 集成（真实 stylelint）', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'frond-lint-css-'))

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('仓库当前改动（无样式文件）→ exit 0，输出「没有需要 lint」', () => {
    const out = execFileSync('node', [CLI], { cwd: REPO_ROOT, encoding: 'utf8' })
    expect(out).toContain('没有需要 lint')
  })

  it('临时 git 仓库 + 已暂存的违规 hex 文件 + STRICT_CSS_LINT=1 → exit 1 且报出 color-no-hex', () => {
    writeFileSync(join(tmp, 'bad.css'), '.a { color: #ffffff; }\n')
    execFileSync('git', ['init'], { cwd: tmp })
    execFileSync('git', ['add', 'bad.css'], { cwd: tmp })
    const r = spawnSync('node', [CLI], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, STRICT_CSS_LINT: '1' }
    })
    expect(r.status, `stdout: ${r.stdout}\nstderr: ${r.stderr}`).toBe(1)
    expect(r.stdout).toContain('color-no-hex')
  })

  it('同一文件、非 strict（存量容忍口径）→ exit 0 但列出 warning', () => {
    const r = spawnSync('node', [CLI], { cwd: tmp, encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('color-no-hex')
  })
})

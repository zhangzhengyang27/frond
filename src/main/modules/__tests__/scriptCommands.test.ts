import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 脚本命令目录（P-3 2.7）：目录发现/描述解析/包含校验/执行，真实 tmpdir + 真实进程。
 * electron 只 mock app.getPath（userData 指到 tmpdir）；执行用例仅在非 Windows 跑
 * （CI 矩阵含 windows，.sh 语义在那边不成立）。
 */
const ROOT = mkdtempSync(join(tmpdir(), 'frond-scriptcmds-'))

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => ROOT), isPackaged: false },
  shell: { openPath: vi.fn(async () => '') }
}))

import {
  ensureScriptsDir,
  listScriptCommands,
  resolveScriptPath,
  runScriptCommand,
  scriptsDir
} from '../scriptCommands'

beforeAll(() => {
  rmSync(join(ROOT, 'scripts'), { recursive: true, force: true })
})

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('ensureScriptsDir / listScriptCommands', () => {
  it('首次创建目录并放 example.sh；二次调用不重复创建', () => {
    const first = ensureScriptsDir()
    expect(first.created).toBe(true)
    expect(listScriptCommands().map((s) => s.id)).toContain('example.sh')
    const second = ensureScriptsDir()
    expect(second.created).toBe(false)
  })

  it('平铺扫描：只认 .sh/.ps1，跳过隐藏文件与子目录，描述取首个注释行', () => {
    const dir = scriptsDir()
    writeFileSync(
      join(dir, 'deploy.sh'),
      '#!/bin/bash\n# 部署站点到 staging\nrsync -a ./ public/\n',
      { mode: 0o755 }
    )
    writeFileSync(join(dir, 'report.ps1'), '# 生成周报\nWrite-Host ok\n')
    writeFileSync(join(dir, 'notes.txt'), '# 不是脚本')
    writeFileSync(join(dir, '.hidden.sh'), '# hidden')
    mkdirSync(join(dir, 'nested.sh')) // 目录恰好叫 *.sh：必须跳过
    const scripts = listScriptCommands()
    const ids = scripts.map((s) => s.id)
    expect(ids).toContain('deploy.sh')
    expect(ids).toContain('report.ps1')
    expect(ids).toContain('example.sh')
    expect(ids).not.toContain('notes.txt')
    expect(ids).not.toContain('.hidden.sh')
    expect(ids).not.toContain('nested.sh')
    const deploy = scripts.find((s) => s.id === 'deploy.sh')!
    expect(deploy.name).toBe('deploy')
    expect(deploy.description).toBe('部署站点到 staging')
  })
})

describe('resolveScriptPath 包含校验', () => {
  it('目录穿越 / 绝对路径 / 子路径 / 非法扩展 / 隐藏文件一律拒绝', () => {
    expect(resolveScriptPath('deploy.sh')).not.toBeNull()
    expect(resolveScriptPath('../secrets.sh')).toBeNull()
    expect(resolveScriptPath('a/b.sh')).toBeNull()
    expect(resolveScriptPath('/etc/passwd')).toBeNull()
    expect(resolveScriptPath('notes.txt')).toBeNull()
    expect(resolveScriptPath('.hidden.sh')).toBeNull()
    expect(resolveScriptPath('')).toBeNull()
  })
})

describe('runScriptCommand（非 Windows）', () => {
  it.runIf(process.platform !== 'win32')('执行 .sh 并捕获输出；无执行位经 sh 兜底', async () => {
    const dir = scriptsDir()
    const withBit = join(dir, 'hello-bit.sh')
    writeFileSync(withBit, '#!/bin/sh\necho bit-ok\n', { mode: 0o755 })
    const noBit = join(dir, 'hello-nobit.sh')
    writeFileSync(noBit, 'echo nobit-ok\n', { mode: 0o644 })
    chmodSync(noBit, 0o644)

    const r1 = await runScriptCommand('hello-bit.sh')
    expect(r1.ok).toBe(true)
    expect(r1.output).toBe('bit-ok')
    const r2 = await runScriptCommand('hello-nobit.sh')
    expect(r2.ok).toBe(true)
    expect(r2.output).toBe('nobit-ok')
  })

  it.runIf(process.platform !== 'win32')('有执行位但没 shebang：ENOEXEC 回落 sh 兜底', async () => {
    const dir = scriptsDir()
    const noShebang = join(dir, 'no-shebang.sh')
    writeFileSync(noShebang, 'echo shebang-less\n', { mode: 0o755 })
    const r = await runScriptCommand('no-shebang.sh')
    expect(r.ok).toBe(true)
    expect(r.output).toBe('shebang-less')
  })

  it.runIf(process.platform !== 'win32')('失败带非零退出语义；穿越 id 拒绝', async () => {
    const dir = scriptsDir()
    writeFileSync(join(dir, 'fail.sh'), '#!/bin/sh\necho before-fail\nexit 3\n', { mode: 0o755 })
    const r = await runScriptCommand('fail.sh')
    expect(r.ok).toBe(false)
    expect(r.output).toBe('before-fail')
    expect(r.error).toBeDefined()
    const bad = await runScriptCommand('../outside.sh')
    expect(bad.ok).toBe(false)
    expect(bad.error).toContain('非法')
  })
})

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { safeOpenablePath } from '../openPathGuard'

/**
 * openPath 内容通道守卫：拒绝可执行扩展名（含目录形态的 bundle），
 * 拒绝不可执行脚本/安装包；普通内容文件/目录放行。
 * 审查 I-8：.app 是目录，扩展名检查曾被 isFile 短路放行 → 任意应用启动。
 */
let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'leaf-openguard-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('safeOpenablePath', () => {
  it('目录形态的 .app 被拒绝（即使真实存在）', () => {
    mkdirSync(join(dir, 'Calculator.app'))
    expect(safeOpenablePath(join(dir, 'Calculator.app'))).toBeNull()
  })

  it('目录形态的 .bundle/.xpc 被拒绝', () => {
    mkdirSync(join(dir, 'plug.bundle'))
    expect(safeOpenablePath(join(dir, 'plug.bundle'))).toBeNull()
  })

  it('文件形态的可执行扩展名被拒绝', () => {
    writeFileSync(join(dir, 'run.sh'), '#!/bin/sh')
    expect(safeOpenablePath(join(dir, 'run.sh'))).toBeNull()
  })

  it('普通内容文件 / 目录放行', () => {
    writeFileSync(join(dir, 'doc.md'), '# hi')
    mkdirSync(join(dir, 'notes'))
    expect(safeOpenablePath(join(dir, 'doc.md'))).toBe(join(dir, 'doc.md'))
    expect(safeOpenablePath(join(dir, 'notes'))).toBe(join(dir, 'notes'))
  })

  it('相对路径 / 不存在路径返回 null', () => {
    expect(safeOpenablePath('relative.md')).toBeNull()
    expect(safeOpenablePath(join(dir, 'ghost.md'))).toBeNull()
  })
})

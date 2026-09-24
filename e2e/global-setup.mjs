/**
 * Playwright 全局前置：构建 e2e 依赖的插件产物。
 *
 * 背景（2026-09-24）：example-react 的 dist 被 .gitignore 的 `dist` 规则排除、
 * pnpm install 也不构建，而 react-view / plugin-arg-slots / plugin-schedule 等
 * spec 靠它播种插件。本机曾拿着**改名前**（09-22 构建的 dist 里还是 leaf/* 前缀）
 * 的陈旧产物跑出 22 条红，一度全被记成「回归」——实际是种子数据过时。
 * 与 vitest.global-setup（前置构建 SDK，同一思想见 636f7f2）对齐：套件开跑前重建，
 * 顺带杜绝「改了插件/SDK 源码却测着旧字节码」。顺序有依赖：example-react 引 SDK 的 dist。
 */
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const PKGS_IN_ORDER = [
  join(ROOT, 'packages', 'frond-plugin-sdk'),
  join(ROOT, 'example-react')
]

export default function setup() {
  for (const dir of PKGS_IN_ORDER) {
    execFileSync('npm', ['run', 'build'], { cwd: dir, stdio: 'ignore' })
  }
}

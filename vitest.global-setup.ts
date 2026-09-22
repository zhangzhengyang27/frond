/**
 * vitest 全局前置：构建 workspace 包产物。
 *
 * SDK 与 @raycast 别名层的单测都直接测 dist（与插件真实打包同源），而 dist 被
 * .gitignore 的 `dist` 规则排除、pnpm install 也不构建 —— 没有这一步，全新 clone
 * 的 pnpm test 起手即红。每次跑测试前重建，同时杜绝「改了源码却测着旧字节码」
 * 这个本仓库反复踩的坑。顺序有依赖：别名层引 SDK 的 dist。
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const BUILD_IN_ORDER = ['leaf-plugin-sdk', 'leaf-raycast-api']

export default function setup(): void {
  for (const pkg of BUILD_IN_ORDER) {
    execFileSync('npm', ['run', 'build'], {
      cwd: join(process.cwd(), 'packages', pkg),
      stdio: 'ignore'
    })
  }
}

/**
 * Frond · Playwright E2E 配置
 *
 * 仅本地跑，不进 CI（Linux runner 需 xvfb 包装 + 重新设计）。
 * 跑前先 `pnpm build` 产生 out/main/index.js。
 */

import { defineConfig } from 'playwright/test'
import { join } from 'node:path'

// e2e 实例使用独立 userData（FROND_USER_DATA_DIR）：与正在运行的 dev/正式实例并存
// （单实例锁按 userData 隔离），且测试不读写真实用户数据。目录在 test-results 下（已 gitignore）。
process.env.FROND_USER_DATA_DIR ||= join(process.cwd(), 'test-results', 'e2e-userdata')
// e2e 跳过内置插件自动安装：避免污染结果行序与冷启动基线，测试自行精确播种插件
process.env.FROND_SKIP_BUILTIN_PLUGINS = '1'
// 文件索引（#9）：范围覆盖到测试专用目录（spec 播种后验证索引/增量/排除链路），
// 同时避免 e2e 触发 home 全量扫描
process.env.FROND_FILE_INDEX_SCOPES = join(process.cwd(), 'test-results', 'file-index-scopes')

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry'
  },
  // electron 项目没有 webServer，由 beforeAll 里 _electron.launch 启动
  projects: [
    {
      name: 'electron'
    }
  ]
})

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
  /**
   * retries 与 trace 是**一对**，不能只改一个（P1-9）。
   *
   * 此前配置是 `trace: 'on-first-retry'` 而 retries 没设（默认 0）—— 于是
   * **trace 永远不会产生**：`on-first-retry` 的语义是「第一次重试时开始录」，
   * 没有重试就永远不录。结果任何失败都只有一行错误信息，没有 trace / 截图可看，
   * 定位只能靠猜（本仓多次出现「本地复现不了、CI 上一片红」）。
   *
   * 现在两头都补上：
   * - `trace: 'retain-on-failure'`：每个用例都录，通过则丢弃 —— **不依赖重试**，
   *   本地跑失败时也有 trace（这是 Playwright 官方推荐的调试默认值）
   * - `retries`：本地 0（不让本地变慢、也不掩盖 flake）；CI 1（容忍基础设施抖动，
   *   且重试用例同样留 trace）
   */
  retries: process.env.CI ? 1 : 0,
  use: {
    trace: 'retain-on-failure'
  },
  // electron 项目没有 webServer，由 beforeAll 里 _electron.launch 启动
  projects: [
    {
      name: 'electron'
    }
  ]
})

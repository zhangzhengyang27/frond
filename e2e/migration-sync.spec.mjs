/**
 * Frond · 迁移中心「多设备同步」分区 E2E（批 7b 补网，P-产品-08/36）
 *
 * 背景：dataSync 双后端（行级合并 + WebDAV 加密备份）在迁移中心接线前
 * 对用户完全不可达——本 spec 钉住「摸得到」这件事本身：
 *   1. 分区渲染 + 状态行（未配置态）
 *   2. 未配置 WebDAV 时推送/拉平按钮禁用（防误点的第一道闸）
 *   3. 配置与真实同步链路需要 WebDAV 服务器——用 main 侧 minimalDav 起本地
 *      服务的方案评估过：e2e 进程与主进程的配置传递要打通 pref 存储，成本高；
 *      归「真机验证轮」（批 8）用真实 NAS/网盘走。此处先钉 UI 与禁用契约。
 *
 * 复用 snippets-crud 的两条经验：窗口按 url 匹配 /index.html；env 走顶层选项。
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null
let mainPage = null

const getMainWindow = async () => {
  if (mainPage && !mainPage.isClosed()) return mainPage

  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url())) {
          mainPage = w
          return w
        }
      } catch {
        // 窗口可能已关闭
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('30s 内没等到主窗口（out/renderer/index.html）')
}

test.beforeAll(async () => {
  const env = { ...process.env }
  const userData = join(ROOT, 'test-results', 'e2e-userdata-sync-ui')
  rmSync(userData, { recursive: true, force: true })
  env.FROND_USER_DATA_DIR = userData
  env.FROND_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE

  app = await electron.launch({ args: [MAIN_ENTRY], env })
  await getMainWindow()
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('迁移中心渲染「多设备同步」分区：状态行 + 未配置态', async () => {
  const page = await getMainWindow()
  // 路由守卫只认 markOnboardingCompleted()：全新 userData 先跳过引导
  await page.getByText('跳过引导').first().click()
  await expect(page.getByText('跳过引导')).toHaveCount(0)
  await page.evaluate(() => {
    window.location.hash = '#/migration'
  })
  await expect(page.getByRole('heading', { name: '数据迁移中心' })).toBeVisible({
    timeout: 20000
  })

  const section = page.getByRole('heading', { name: '多设备同步' })
  await expect(section).toBeVisible({ timeout: 10000 })

  // 状态行：全新 userData 下 WebDAV 未配置、从未同步
  await expect(page.getByText('WebDAV：')).toBeVisible()
  await expect(page.getByText('未配置')).toBeVisible()
  await expect(page.getByText('上次应用：从未')).toBeVisible()
})

test('未配置 WebDAV 时推送/拉平按钮禁用（防误点闸）', async () => {
  const page = await getMainWindow()
  const push = page.getByRole('button', { name: '推送到云端' })
  const pull = page.getByRole('button', { name: '从云端拉平' })
  await expect(push).toBeDisabled()
  await expect(pull).toBeDisabled()

  // 配置入口提示指向启动器管理页（与 getSyncConfig 同源，批 5 已核）
  await expect(page.getByText('WebDAV 服务器在「启动器管理页 → WebDAV 同步」配置')).toBeVisible()
})

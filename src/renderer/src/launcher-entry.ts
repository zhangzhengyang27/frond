/**
 * 启动器胶囊窗独立入口（launcher.html）。
 *
 * 与主应用完全隔离：无路由 / 无 pinia / 无 AppShell，
 * 只挂载搜索胶囊 UI——窗口常驻隐藏、全局快捷键唤起，
 * 独立入口保证唤起时立即可用（不拖主应用全局状态）。
 */
import './assets/main.css'
import 'remixicon/fonts/remixicon.css'

import { createApp } from 'vue'
import LauncherApp from './launcher/LauncherApp.vue'
import { useTheme } from './composables/useTheme'

async function bootstrap(): Promise<void> {
  // 主题先行：与主窗口共享同一持久化主题（html.dark / data-theme）。
  // 读取失败不阻塞挂载（按默认 auto 渲染），胶囊窗口 ready-to-show 前隐藏，无闪烁。
  try {
    await useTheme().initTheme()
  } catch {
    /* theme init 失败按默认主题渲染 */
  }
  createApp(LauncherApp).mount('#app')
}

void bootstrap()

/**
 * 截图覆盖窗独立入口（screenshot.html）。
 *
 * 与主应用 index.html 完全隔离：无 router / 无 pinia / 无 AppShell，
 * 只挂载 CapturePage —— 截图 BrowserView 是常驻隐藏窗口，
 * 独立入口保证它不被主应用的全局状态/路由守卫拖累，可立即加载。
 * OCR（tesseract.js）运行时从 CDN 拉取 worker 与语言包，
 * screenshot.html 的 CSP 已放行对应域名。
 */
import './assets/main.css'
import 'remixicon/fonts/remixicon.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import CapturePage from './views/screenshot/pages/CapturePage.vue'

const app = createApp(CapturePage)
app.use(createPinia())
app.mount('#app')

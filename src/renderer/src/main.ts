import './assets/main.css'
import 'remixicon/fonts/remixicon.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// 改名前（Leaf）写在 localStorage 的键搬到新前缀：侧栏展开态、任务与 Todoist 的
// 对应关系都是按键名取的，认不出旧键就静默回到默认值。反向遍历边搬边删，跑完不再有 leaf.*。
for (let i = localStorage.length - 1; i >= 0; i--) {
  const key = localStorage.key(i)
  if (!key?.startsWith('leaf.')) continue
  const next = `frond.${key.slice('leaf.'.length)}`
  const value = localStorage.getItem(key)
  if (value !== null && localStorage.getItem(next) === null) localStorage.setItem(next, value)
  localStorage.removeItem(key)
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

/**
 * 启动闪屏：Vue mount 后立刻淡出 #splash。
 * 兜底机制：万一异常没移除，1.5s 后强制移除（防止永远挡住主界面）。
 */
function hideSplash(): void {
  const splash = document.getElementById('splash')
  if (!splash) return
  splash.classList.add('splash-fadeout')
  // 240ms 过渡结束后真正移除（不再占据 DOM）
  window.setTimeout(() => splash.remove(), 260)
}

if (typeof window !== 'undefined') {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void) => number
    setTimeout: typeof setTimeout
  }
  // 用 rIC 等下一帧；mount 是同步的，但 Vue 响应式挂载完成是异步的
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(hideSplash)
  } else {
    w.setTimeout(hideSplash, 0)
  }
  // 兜底：1.5s 强移除
  w.setTimeout(hideSplash, 1500)
}

// 监听来自主进程的路由导航消息
if (window.api && window.api.onNavigateToRoute) {
  window.api.onNavigateToRoute((route: string) => {
    router.push(route)
  })
}

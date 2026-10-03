// 样式四件套（批 1，dump 已退役）：
// tailwind.css —— TW4 生成管线（五层声明 + tokens 桥 + @utility），先加载以声明层序；
// tokens.css —— 唯一视觉事实源（原 dump 内联 tokens 的维护版，变量集已核等价）；
// legacy-preflight.css —— TW3 基线重置逐字保留（@layer base，血统与退役计划见文件头）；
// global.css —— splash/玻璃/滚动条/Markdown 排版等全局自定义段（@layer global）。
import './styles/tailwind.css'
import './styles/tokens.css'
import './styles/legacy-preflight.css'
import './styles/global.css'
import 'remixicon/fonts/remixicon.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { installConsoleBridge } from './utils/consoleBridge'

// B52①：console 桥最先挂——后续任何模块的 console.* 都会进主进程日志通道
installConsoleBridge()

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
    void router.push(route)
  })
}

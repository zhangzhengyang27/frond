import { createRouter, createWebHashHistory } from 'vue-router'
import { ref } from 'vue'
import { cancelRouteTiming, finishRouteTiming, startRouteTiming } from '../utils/routePerf'

/**
 * 路由窗口语义（IA v2「路由与窗口语义正式化」）
 *
 * 一个路由表只描述三类东西，用 meta.window 区分，不再靠命名约定和硬编码名单：
 * - shell（默认） → 主窗口页面，AppShell 包裹；导航可见性由 MODULES 决定
 *                  （侧边栏/⌘K 只读 MODULES，非模块页面天然不进导航）
 * - overlay       → 主窗口内的沉浸式覆盖层（无壳）：录屏剪辑画布
 * - floating      → 主进程创建的独立悬浮窗，以 hash 直接加载：
 *                  迷你番茄钟 /mini-timer（miniWindow）
 * - capsule       → 启动台胶囊窗：独立入口 launcher.html，无对应路由，列出仅为语义完整
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** 窗口语义，缺省为 'shell' */
    window?: 'shell' | 'overlay' | 'floating' | 'capsule'
    /** 首启引导未完成时仍放行（router.beforeEach 消费） */
    bypassOnboarding?: boolean
  }
}

/**
 * Onboarding 状态单例（router 共享）
 * - false: 未完成（首次启动），router 守卫推到 /onboarding
 * - true: 已完成，正常跳转
 * - null: 未知（首次启动时 IPC 还没问）
 * 设置页「重新开始引导」可调 resetOnboardingState() 重置为 false
 */
export const onboardingState = ref<boolean | null>(null)

/** 重置为「未完成」——供设置页让用户重看引导 */
export function resetOnboardingState(): void {
  onboardingState.value = false
}

/** 标记完成（设置页主动调，或 OnboardingView 内部触发） */
export function markOnboardingCompleted(): void {
  onboardingState.value = true
}

const router = createRouter({
  history: createWebHashHistory(),
  // 配置滚动行为，处理自定义滚动容器
  // B3 修复：滚动容器有两个 —— 沉浸式分支的 .App-router 与
  // AppShell 分支的 .app-scroll；window 本身不可滚（h-screen + 内部滚动），
  // 声明式 return { top: 0 } / savedPosition 对自定义容器无效，必须命令式处理
  scrollBehavior(_to, _from, savedPosition) {
    const scrollContainer =
      document.querySelector<HTMLElement>('.App-router') ??
      document.querySelector<HTMLElement>('.app-scroll')
    if (!scrollContainer) return { top: 0 }

    // 前进/后退：恢复保存的位置；普通导航：复位到顶
    scrollContainer.scrollTop = savedPosition?.top ?? 0
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      // Raycast 化：设置页独立渲染，无 AppShell 顶栏
      meta: { window: 'overlay' }
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('../views/OnboardingView.vue'),
      // onboarding 本身就是路由表，redirect 没用，去掉；
      // 不在 MODULES 中，天然不进侧边栏/⌘K
      meta: { bypassOnboarding: true }
    },
    {
      path: '/migration',
      name: 'migration',
      component: () => import('../views/MigrationCenterView.vue')
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue')
    },
    {
      // 启动器管理页（IA v2：fastSearch → launcher 改名，2026-09）
      path: '/launcher',
      name: 'launcher',
      component: () => import('../views/launcher/index.vue')
    },
    // 旧路径兼容重定向
    { path: '/fastSearch', redirect: '/launcher' },    {
      path: '/pomodoro',
      name: 'pomodoro',
      component: () => import('../views/pomodoro/index.vue')
    },
    {
      // 迷你番茄钟悬浮窗：miniWindow.ts 以 hash 直接加载
      path: '/mini-timer',
      name: 'miniTimer',
      component: () => import('../views/pomodoro/MiniTimer.vue'),
      meta: { window: 'floating' }
    },
    {
      // 浮动笔记悬浮窗：floatingNote.ts 以 hash 直接加载
      path: '/floating-note',
      name: 'floatingNote',
      component: () => import('../views/notes/FloatingNote.vue'),
      meta: { window: 'floating' }
    },
    {
      // 贴图悬浮窗：PinService 以 hash 直接加载（无此路由则窗口空白，见 PinPage 头注释）
      path: '/screenshot/pin',
      name: 'screenshotPin',
      component: () => import('../views/screenshot/pages/PinPage.vue'),
      meta: { window: 'floating' }
    },
    {
      path: '/snippets',
      name: 'snippets',
      component: () => import('../views/snippets/index.vue')
    },
    {
      path: '/screenRecorder',
      component: () => import('../views/screenRecorder/Layout.vue'),
      redirect: '/screenRecorder/record',
      children: [
        {
          path: 'record',
          name: 'screenRecorderRecord',
          component: () => import('../views/screenRecorder/pages/RecordPage.vue')
        },
        {
          path: 'history',
          name: 'screenRecorderHistory',
          component: () => import('../views/screenRecorder/pages/HistoryPage.vue')
        },
        {
          path: 'playback',
          name: 'screenRecorderPlayback',
          component: () => import('../views/screenRecorder/pages/PlaybackPage.vue')
        },
        {
          path: 'clip',
          name: 'screenRecorderClip',
          component: () => import('../views/screenRecorder/pages/ClipPage.vue'),
          // 剪辑画布：主窗口内沉浸式覆盖层（AppShell 隐藏）
          meta: { window: 'overlay' }
        }
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  startRouteTiming(to)

  // 首次启动引导：未完成 onboarding 且访问非 onboarding 路由 → 推到 /onboarding
  // 顺序：先 await ipc 拿状态，再决定 next 是放行还是重定向
  // （vue-router 3 风格 next 句柄更简单，异步也兼容）
  if (to.path === '/onboarding' || to.meta?.bypassOnboarding) {
    next()
    return
  }

  // 超时兜底：IPC 挂起时不阻塞路由（3s 后强制放行）
  let settled = false
  const timer = setTimeout(() => {
    if (!settled) {
      settled = true
      next()
    }
  }, 3000)

  void (async (): Promise<void> => {
    try {
      const cached = onboardingState.value
      if (cached === null) {
        const real = await window.api.preferences.isOnboardingCompleted()
        onboardingState.value = real
      }
      if (settled) return // 超时已放行
      settled = true
      clearTimeout(timer)
      if (onboardingState.value === false) {
        next({ path: '/onboarding', replace: true })
        return
      }
    } catch {
      // IPC 失败不阻断
      if (settled) return
      settled = true
      clearTimeout(timer)
    }
    next()
  })()
})

router.afterEach((to, _from, failure) => {
  if (failure) {
    cancelRouteTiming(to)
    return
  }

  finishRouteTiming(to)
})

export default router

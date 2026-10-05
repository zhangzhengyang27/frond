/**
 * Frond · 主进程 → 渲染端：菜单 / dock / tray 跳转统一处理
 *
 * 订阅的 channel（src/main/modules/appMenu.ts 发出）：
 * - app:openModule           { moduleId, path }
 * - app:openCommandPalette
 * - app:openSettings
 * - app:openAbout
 *
 * 跳转路径与 ⌘1-9 / CommandPalette 完全一致：router.push + usage.recordUse。
 * 调用方（App.vue）在挂载时 install() 一次；卸载时 uninstall() 释放 listener。
 */

import { useRouter, useRoute } from 'vue-router'

type Unsubscribe = () => void

export function useAppMenu(): {
  install: () => Unsubscribe
} {
  // 必须在 setup 上下文内取 router（调用方在 setup 中调用本 composable）。
  // 事件回调里再调 useRouter() 会拿到 undefined（inject 脱离 setup 失效）——
  // 这正是「胶囊搜模块回车没反应」的根因（B/Fix 2026-09）。
  const router = useRouter()
  const route = useRoute()

  function navigateAndRecord(moduleId: string, path: string): void {
    void router.push(path)
    if (window.api?.usage?.recordUse) {
      void window.api.usage.recordUse(moduleId)
    }
  }

  function install(): Unsubscribe {
    const unsubs: Unsubscribe[] = []

    if (window.api.launcher?.onAppRouteTaken) {
      // IA v2 阶段C：独立模块窗接管某路由时，主窗口若正显示同一路由则让位回 Hub，
      // 避免同一模块出现「沉浸窗 + 主窗口带侧栏」两份界面
      unsubs.push(
        window.api.launcher.onAppRouteTaken(({ path }) => {
          const target = path.split('?')[0]
          if (route.path === target) {
            // 让位 = 隐藏主窗（Raycast 式退后台）。旧实现 push('/')——Home 页
            // 退役后 '/' 重定向 /settings，主窗会永久停在无返回的设置页
            void window.api.hideMainWindow()
          }
        })
      )
    }

    if (window.api?.onAppOpenModule) {
      unsubs.push(
        window.api.onAppOpenModule(({ moduleId, path }) => {
          navigateAndRecord(moduleId, path)
        })
      )
    }
    if (window.api?.onAppOpenCommandPalette) {
      unsubs.push(
        window.api.onAppOpenCommandPalette(() => {
          // 引入 useCommandPalette（动态 import 避免 SSR / 测试环境报错）
          void import('./useCommandPalette').then(({ useCommandPalette }) => {
            useCommandPalette().open()
          })
        })
      )
    }
    if (window.api?.onAppOpenSettings) {
      unsubs.push(
        window.api.onAppOpenSettings(() => {
          void router.push('/settings')
        })
      )
    }
    if (window.api?.onAppOpenAbout) {
      unsubs.push(
        window.api.onAppOpenAbout(() => {
          void router.push('/about')
        })
      )
    }

    return () => {
      for (const u of unsubs) u()
    }
  }

  return { install }
}

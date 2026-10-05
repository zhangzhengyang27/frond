<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import RouteLoading from './components/RouteLoading.vue'
import CommandPalette from './components/shell/CommandPalette.vue'
import AppShell from './components/shell/AppShell.vue'
import SettingsModal from './components/SettingsModal.vue'
import UToastProvider from './components/ui/UToastProvider.vue'
import UConfirmProvider from './components/ui/UConfirmProvider.vue'
import { useAppMenu } from './composables/useAppMenu'
import { installTrackpadSwipe } from './composables/useTrackpadGesture'
import { ensurePomodoroBridgeSync } from './composables/usePomodoroAppBridge'
import { useModuleShortcuts } from './composables/useModuleShortcuts'
import { useTheme } from './composables/useTheme'

// useAppMenu 需要在 setup 上下文内调用（内部取 router），install 推迟到挂载时
const { install: installAppMenu } = useAppMenu()

const route = useRoute()

// B59：模块快捷键（⌘1-9）与主题初始化从 AppShell 上移——/snippets 等去壳
// 路由不挂 AppShell，留在壳里会让快捷键在模块页失灵、主题在直落模块页时不初始化
useModuleShortcuts()
void useTheme().initTheme()

// 窗口标题跟随路由——document.title 会覆盖 BrowserWindow 标题，且一旦设置
// 就跨路由滞留（此前进过设置页后标题永远挂「设置」，片段页也是「设置」）。
// 注意 route 必须先于 watcher 声明：immediate getter 同步求值，
// 后置声明会踩 TDZ 静默炸掉 watcher（实测：标题从此再也不更新）
const ROUTE_TITLES: Record<string, string> = {
  settings: '设置',
  snippets: '代码片段',
  pomodoro: '番茄钟',
  migration: '迁移中心',
  about: '关于 Frond',
  onboarding: '欢迎',
  screenRecorderRecord: '屏幕录制',
  screenRecorderHistory: '录屏历史',
  screenRecorderPlayback: '录屏回放',
  screenRecorderClip: '录屏剪辑'
}
watch(
  () => route.name,
  (name) => {
    document.title = ROUTE_TITLES[String(name ?? '')] ?? 'Frond'
  },
  { immediate: true }
)

type LoadingVariant =
  | 'default'
  | 'editor'
  | 'capture'

/**
 * 壳显隐由路由 meta.window 驱动（语义定义见 router/index.ts）：
 * - shell（默认）：AppShell 包裹（顶栏 + 侧边栏）
 * - overlay：无壳直接渲染（设置页 / 重型工作模块 / 录屏剪辑画布）——
 *   B59 起 /snippets 也是 overlay：三栏管理面即整个窗口，壳顶栏是噪音
 * - ?immersive=1（IA v2 阶段C）：启动台 / ⌘K 打开的独立模块窗口，
 *   无壳直接渲染模块本身——搜什么就只看什么
 */
const showShell = computed(
  () => (route.meta.window ?? 'shell') === 'shell' && route.query.immersive !== '1'
)

// 订阅主进程菜单 / dock / tray 跳转指令
let uninstallAppMenu: (() => void) | null = null
let uninstallTrackpad: (() => void) | null = null
onMounted(() => {
  uninstallAppMenu = installAppMenu()

  // Trackpad 双指水平 swipe → 触发主进程 history.back/forward
  // （macOS 原生体验；wheel 监听 passive=true 不阻塞主线程滚动）
  uninstallTrackpad = installTrackpadSwipe(
    window,
    () => window.history.back(),
    () => window.history.forward()
  )

  // 番茄钟桥（计时器单例 + 全局快捷键 + tray 快照）：只在主窗口初始化，
  // mini / pin / capture 等 window 路由窗口不装（IA v2 阶段A：胶囊「开始专注」前置）
  void installPomodoroBridgeIfPrimary()
})

async function installPomodoroBridgeIfPrimary(): Promise<void> {
  try {
    if ((route.meta.window ?? 'shell') !== 'shell') return
    if (await window.api.isPrimaryWindow()) {
      ensurePomodoroBridgeSync()
    }
  } catch {
    /* 判定失败不阻塞主流程 */
  }
}
onBeforeUnmount(() => {
  uninstallAppMenu?.()
  uninstallAppMenu = null
  uninstallTrackpad?.()
  uninstallTrackpad = null
})

const loadingVariant = computed<LoadingVariant>(() => {
  const routeName = String(route.name || '')

  if (routeName === 'snippets') {
    return 'editor'
  }

  if (routeName === 'screenshot' || routeName === 'screenshotCapture') {
    return 'capture'
  }

  return 'default'
})

const loadingDelay = computed(() => {
  if (loadingVariant.value.startsWith('recorder') || loadingVariant.value === 'capture') {
    return 160
  }

  return 120
})
</script>

<template>
  <!-- 沉浸式路由：直接渲染（无壳子） -->
  <div v-if="!showShell" class="App-router h-screen overflow-auto">
    <router-view v-slot="{ Component }">
      <Suspense timeout="0">
        <component :is="Component" />
        <template #fallback>
          <RouteLoading :variant="loadingVariant" :delay="loadingDelay" />
        </template>
      </Suspense>
    </router-view>
  </div>

  <!-- 普通路由：AppShell 包裹（顶栏 + 侧边栏） -->
  <AppShell v-else>
    <router-view v-slot="{ Component }">
      <Suspense timeout="0">
        <component :is="Component" />
        <template #fallback>
          <RouteLoading :variant="loadingVariant" :delay="loadingDelay" />
        </template>
      </Suspense>
    </router-view>
  </AppShell>

  <!-- 命令面板（⌘K）：主窗全局能力——Home 删除后主窗可能落在 /settings 等无壳路由，
       面板必须与路由解耦（2026-10-04 实测反馈） -->
  <CommandPalette />

  <!-- 全局 Toast / 确认弹窗容器：同 CommandPalette 道理必须挂根层——
       B59 前挂在 AppShell 里，/snippets 去壳后确认弹窗与 toast 在模块页整个消失 -->
  <UToastProvider />
  <UConfirmProvider />

  <!-- 设置模态浮层：必须挂模板根层（全窗口常驻）。曾误插进沉浸分支的
       Suspense #fallback 插槽——该插槽仅在路由加载瞬间渲染，模态等于不存在 -->
  <SettingsModal />
</template>

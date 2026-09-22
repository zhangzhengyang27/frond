<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import RouteLoading from './components/RouteLoading.vue'
import AppShell from './components/shell/AppShell.vue'
import { useAppMenu } from './composables/useAppMenu'
import { installTrackpadSwipe } from './composables/useTrackpadGesture'
import { ensurePomodoroBridgeSync } from './composables/usePomodoroAppBridge'

// useAppMenu 需要在 setup 上下文内调用（内部取 router），install 推迟到挂载时
const { install: installAppMenu } = useAppMenu()

type LoadingVariant =
  | 'default'
  | 'editor'
  | 'recorder-record'
  | 'recorder-history'
  | 'recorder-playback'
  | 'recorder-clip'
  | 'capture'

const route = useRoute()

/**
 * 壳显隐由路由 meta.window 驱动（语义定义见 router/index.ts）：
 * - shell（默认）：AppShell 包裹（顶栏 + 侧边栏）
 * - overlay：沉浸式覆盖层直接渲染（截图捕获 / 录屏剪辑画布）
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

  if (routeName === 'screenRecorderRecord') {
    return 'recorder-record'
  }

  if (routeName === 'screenRecorderHistory') {
    return 'recorder-history'
  }

  if (routeName === 'screenRecorderPlayback') {
    return 'recorder-playback'
  }

  if (routeName === 'screenRecorderClip') {
    return 'recorder-clip'
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
</template>

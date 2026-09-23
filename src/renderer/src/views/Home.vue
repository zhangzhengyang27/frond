<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { findModule, type ModuleMeta } from '../constants/modules'
import type { FirstPartyPage } from '@shared/commands'
import AppIcon from '@components/AppIcon.vue'
import { useToast } from '@composables/useToast'

const router = useRouter()
const toast = useToast()
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

/** 唤起启动器胶囊窗 */
function openLauncher(): void {
  void window.api.launcher.show?.()
}

/** 搜索框聚焦时唤起启动器（Raycast 风格：搜索即入口） */
function onSearchFocus(): void {
  openLauncher()
  searchQuery.value = ''
  searchInput.value?.blur()
}
const navigate = (m: ModuleMeta): void => {
  void window.api.usage.recordUse(m.id)
  router.push(m.path)
}

// 常用功能（固定展示）
const quickActions: Array<{ label: string; icon: string; path?: string; action?: string }> = [
  // 截图不是一条路由：它是主进程发起的一次覆盖层截图（`screenshot:startCapture`）。
  // 这里曾写 `path: '/screenshot'` —— 路由表从来没这条，点下去主内容区整块空白
  { label: '截图', icon: 'camera-line', action: 'screenshot' },
  { label: '录屏', icon: 'video-line', path: '/screenRecorder/record' },
  { label: '番茄钟', icon: 'timer-line', path: '/pomodoro' },
  { label: '代码片段', icon: 'code-s-slash-line', path: '/snippets' },
  { label: '剪贴板', icon: 'clipboard-line', action: 'clipboard' },
  { label: '文件搜索', icon: 'search-2-line', action: 'files' },
  { label: 'AI 对话', icon: 'sparkling-2-line', action: 'ai' },
  { label: '笔记', icon: 'sticky-note-line', action: 'notes' }
]

function onQuickAction(action: { path?: string; action?: string }): void {
  if (action.action === 'screenshot') {
    // 覆盖层由主进程起，失败要说得出来（没给屏幕录制授权时以前是静默的）
    void window.api.screenshot.startCapture().then((res) => {
      if (!res.success) toast.error(res.error ?? '截图启动失败')
    })
    return
  }
  if (action.path) {
    router.push(action.path)
  } else if (action.action) {
    // 唤起启动器并打开对应页面
    void window.api.launcher.show?.()
    setTimeout(() => {
      window.api.launcher.openFirstParty?.(action.action as FirstPartyPage)
    }, 200)
  }
}

// ----- 最近使用 -----
const recent = ref<ModuleMeta[]>([])

const refresh = async (): Promise<void> => {
  const recentIds = await window.api.usage.getRecent(6)
  recent.value = recentIds.map((id) => findModule(id)).filter((m): m is ModuleMeta => !!m)
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="LeafRaycastHome min-h-screen flex flex-col items-center justify-center px-6 py-12">
    <!-- ═══ Logo + 标题 ═══ -->
    <div class="mb-8 text-center">
      <div
        class="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/25"
      >
        <AppIcon icon="search-eye" :size="28" class="text-white" />
      </div>
      <h1 class="text-[28px] font-semibold tracking-tight text-fg-primary">Leaf</h1>
      <p class="mt-1 text-sm text-fg-muted">你的全能启动器 · 所有功能一键直达</p>
    </div>

    <!-- ═══ 大搜索框（Raycast Root Search 风格）═══ -->
    <div class="relative w-full max-w-[560px] mb-10">
      <div
        class="flex items-center gap-3 rounded-xl border border-line-default bg-surface-1 px-4 py-3.5 shadow-lg shadow-black/5 transition-all hover:border-brand-500/40 hover:shadow-xl focus-within:border-brand-500 focus-within:shadow-ring-focus"
      >
        <AppIcon icon="search" :size="18" class="shrink-0 text-fg-tertiary" />
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          class="flex-1 bg-transparent text-[15px] text-fg-primary placeholder:text-fg-tertiary focus:outline-none"
          placeholder="搜索功能、文件、命令…"
          spellcheck="false"
          @focus="onSearchFocus"
        />
        <kbd
          class="hidden shrink-0 rounded-md border border-line-subtle bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg-tertiary sm:inline-block"
        >
          Alt Space
        </kbd>
      </div>
      <p class="mt-2 text-center text-xs text-fg-tertiary">
        点击搜索框或按 <span class="font-medium text-fg-secondary">Alt + Space</span> 唤起启动器
      </p>
    </div>

    <!-- ═══ 常用功能 ═══ -->
    <div class="w-full max-w-[560px] mb-8">
      <div class="mb-3 flex items-center gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-fg-tertiary">常用功能</h2>
        <div class="h-px flex-1 bg-line-subtle" />
      </div>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="action in quickActions"
          :key="action.label"
          type="button"
          class="group flex flex-col items-center gap-2 rounded-lg border border-transparent px-3 py-3 transition-all hover:border-line-default hover:bg-surface-1"
          @click="onQuickAction(action)"
        >
          <div
            class="flex size-10 items-center justify-center rounded-lg bg-surface-2 text-fg-tertiary transition-all group-hover:bg-brand-500/10 group-hover:text-fg-brand"
          >
            <AppIcon :icon="action.icon" :size="18" />
          </div>
          <span class="text-xs font-medium text-fg-secondary group-hover:text-fg-primary">{{
            action.label
          }}</span>
        </button>
      </div>
    </div>

    <!-- ═══ 最近使用 ═══ -->
    <div v-if="recent.length > 0" class="w-full max-w-[560px] mb-8">
      <div class="mb-3 flex items-center gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-fg-tertiary">最近使用</h2>
        <div class="h-px flex-1 bg-line-subtle" />
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in recent"
          :key="`recent-${m.id}`"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-line-subtle bg-surface-1 px-3 py-1.5 text-sm text-fg-secondary transition-all hover:border-brand-500/40 hover:text-fg-brand"
          @click="navigate(m)"
        >
          <AppIcon :icon="m.icon" :size="14" />
          <span>{{ m.label }}</span>
        </button>
      </div>
    </div>

    <!-- ═══ 底部快捷入口 ═══ -->
    <div class="flex items-center gap-4 text-xs text-fg-tertiary">
      <button
        class="inline-flex items-center gap-1.5 hover:text-fg-brand"
        @click="router.push('/settings')"
      >
        <AppIcon icon="settings-3-line" :size="14" />
        <span>设置</span>
      </button>
      <span class="text-line-subtle">·</span>
      <button
        class="inline-flex items-center gap-1.5 hover:text-fg-brand"
        @click="router.push('/launcher')"
      >
        <AppIcon icon="plug-2-line" :size="14" />
        <span>插件管理</span>
      </button>
      <span class="text-line-subtle">·</span>
      <button
        class="inline-flex items-center gap-1.5 hover:text-fg-brand"
        @click="router.push('/about')"
      >
        <AppIcon icon="information-line" :size="14" />
        <span>关于</span>
      </button>
    </div>
  </div>
</template>

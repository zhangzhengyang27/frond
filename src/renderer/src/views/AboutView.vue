<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UBadge from '@components/ui/UBadge.vue'

const appName = 'Frond'
const tagline = 'Tools that breathe with your day.'
const description =
  'Frond 是一款常驻 macOS 与 Windows 工作流的轻量桌面工具集，让创作、专注与娱乐在同一片"叶"上自然生长。'

const modules = [
  { icon: 'camera', label: '截图' },
  { icon: 'record-circle', label: '屏幕录制' },
  { icon: 'timer', label: '番茄钟' },
  { icon: 'search', label: '启动器' }
]

const links = [
  { icon: 'github-line', label: 'GitHub 仓库', href: '#' },
  { icon: 'question-line', label: '使用文档', href: '#' },
  { icon: 'shield-keyhole-line', label: '隐私政策', href: '#' },
  { icon: 'file-text-line', label: '用户协议', href: '#' }
]

const stack = ['Electron', 'Vue 3', 'TypeScript', 'Tailwind CSS', 'better-sqlite3', 'electron-vite']

// 版本号动态获取（主进程 electron-updater 元数据），加载完成前不展示
const appVersion = ref('')
onMounted(async () => {
  try {
    appVersion.value = await window.api.update.getCurrentVersion()
  } catch {
    /* ignore */
  }
})
</script>

<template>
  <div class="FrondAbout mx-auto w-full max-w-[760px] px-10 py-12">
    <!-- Hero 卡：Logo + 版本徽标 -->
    <div
      class="relative mb-10 overflow-hidden rounded-lg border border-line-subtle bg-surface-1 p-8 shadow-sm"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_200px_at_20%_0%,var(--brand-glow),transparent_60%)] opacity-40"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-px bg-glass-highlight"
        aria-hidden="true"
      />
      <div class="relative">
        <div class="mb-3 flex items-center gap-4">
          <div
            class="flex size-16 items-center justify-center rounded-lg border border-line-subtle bg-surface-2 text-4xl shadow-xs"
          >
            🌿
          </div>
          <div>
            <div class="flex items-center gap-2.5">
              <h1 class="text-xl font-semibold tracking-tight text-fg-primary">{{ appName }}</h1>
              <UBadge v-if="appVersion" variant="brand">v{{ appVersion }}</UBadge>
            </div>
            <p class="mt-0.5 text-sm text-fg-tertiary">{{ tagline }}</p>
          </div>
        </div>
        <p class="text-sm leading-relaxed text-fg-secondary">{{ description }}</p>
      </div>
    </div>

    <!-- 模块一览 -->
    <section class="mb-10">
      <h2 class="mb-3 text-xs font-medium tracking-wider text-fg-muted uppercase">1.0 模块（4）</h2>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <div
          v-for="m in modules"
          :key="m.label"
          class="flex items-center gap-2 rounded-md border border-line-subtle bg-surface-1 px-3 py-2 text-xs text-fg-secondary"
        >
          <AppIcon :icon="m.icon" :size="14" class="text-fg-tertiary" />
          <span>{{ m.label }}</span>
        </div>
      </div>
    </section>

    <!-- 链接 -->
    <section class="mb-10">
      <h2 class="mb-3 text-xs font-medium tracking-wider text-fg-muted uppercase">相关</h2>
      <div
        class="overflow-hidden divide-y divide-line-subtle rounded-md border border-line-subtle bg-surface-1"
      >
        <a
          v-for="l in links"
          :key="l.label"
          :href="l.href"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-3 p-4 transition-colors duration-fast hover:bg-surface-hover"
        >
          <AppIcon :icon="l.icon" :size="18" class="text-fg-tertiary" />
          <span class="flex-1 text-sm text-fg-primary">{{ l.label }}</span>
          <AppIcon icon="external-link-line" :size="14" class="text-fg-muted" />
        </a>
      </div>
    </section>

    <!-- 技术栈 -->
    <section class="mb-10">
      <h2 class="mb-3 text-xs font-medium tracking-wider text-fg-muted uppercase">技术栈</h2>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="s in stack"
          :key="s"
          class="rounded-md border border-line-subtle bg-surface-hover px-2.5 py-1 font-mono text-xs text-fg-secondary"
          >{{ s }}</span
        >
      </div>
    </section>

    <p class="text-center text-xs text-fg-muted">
      v{{ appVersion }} · MIT License · Made with care.
    </p>
  </div>
</template>

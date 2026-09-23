<script setup lang="ts">
/**
 * 截图主页 · Hub
 *
 * 旧版只有一个标题 + 一个硬编码蓝按钮（demo 级）。现提供：
 * - 主 CTA：开始截图（⌘⇧A / Ctrl+Shift+A）
 * - 最近截图（screenshot.history.recent）
 * - 存储用量 + 保存目录设置（history.storageUsage / getSaveDirectory / setSaveDirectory）
 * - 从最近项直接打开 / 在访达中显示
 */

import { onMounted, onUnmounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UBadge from '@components/ui/UBadge.vue'
import UButton from '@components/ui/UButton.vue'
import UEmpty from '@components/ui/UEmpty.vue'
import USkeleton from '@components/ui/USkeleton.vue'
import { useToast } from '@composables/useToast'

interface RecentItem {
  id: string
  filePath: string
  fileName: string
  capturedAt: number
}

const toast = useToast()

const starting = ref(false)
const loading = ref(false)
const recents = ref<RecentItem[]>([])
const usage = ref<{ totalSize: number; count: number } | null>(null)
const saveDir = ref('')

function fmtSize(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const startCapture = async (): Promise<void> => {
  starting.value = true
  try {
    const result = await window.api.screenshot.startCapture()
    if (!result.success) {
      toast.error('启动截图失败', { description: result.error })
    }
  } catch (error) {
    toast.error('启动截图失败', { description: (error as Error).message })
  } finally {
    starting.value = false
  }
}

const refresh = async (): Promise<void> => {
  loading.value = true
  try {
    const [recentRes, usageRes, dirRes] = await Promise.all([
      window.api.screenshot.history.recent(8),
      window.api.screenshot.history.storageUsage(),
      window.api.screenshot.history.getSaveDirectory()
    ])
    recents.value = recentRes.success ? recentRes.items : []
    usage.value = usageRes.success ? { totalSize: usageRes.totalSize, count: usageRes.count } : null
    saveDir.value = dirRes.success ? (dirRes.directory ?? '') : ''
  } catch (error) {
    console.error('读取截图信息失败:', error)
  } finally {
    loading.value = false
  }
}

const openFile = async (item: RecentItem): Promise<void> => {
  const r = await window.api.screenshot.history.openFile(item.filePath)
  if (!r.success) toast.error('打开失败', { description: r.error })
}

const showInFolder = async (item: RecentItem): Promise<void> => {
  const r = await window.api.screenshot.history.showInFolder(item.filePath)
  if (!r.success) toast.error('打开目录失败', { description: r.error })
}

const changeSaveDir = async (): Promise<void> => {
  const r = await window.api.screenshot.history.setSaveDirectory()
  if (r.success && r.directory) {
    saveDir.value = r.directory
    toast.success('保存目录已更新')
  } else if (!r.canceled && r.error) {
    toast.error('设置失败', { description: r.error })
  }
}

// 截图完成后主进程会推送 SCREENSHOT:capture → 刷新列表
let unsubCapture: (() => void) | null = null

onMounted(() => {
  void refresh()
  // onCapture 现返回退订函数：按组件生命周期注册/退订（此前用模块级标记
  // 只注册一次，代价是卸载后回调闭包被常驻监听持有、对死 ref 刷新）
  unsubCapture = window.api.screenshot.onCapture(() => {
    // 截图结束，稍作延迟后刷新列表（等落盘完成）
    window.setTimeout(() => void refresh(), 800)
  })
})

onUnmounted(() => {
  unsubCapture?.()
  unsubCapture = null
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1000px] px-10 py-10">
    <!-- Hero -->
    <section
      class="relative mb-8 overflow-hidden rounded-lg border border-line-subtle bg-surface-1 p-8 shadow-sm"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_200px_at_15%_0%,var(--brand-glow),transparent_60%)] opacity-40"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-px bg-glass-highlight"
        aria-hidden="true"
      />
      <div class="relative flex items-center gap-6">
        <div
          class="flex size-14 shrink-0 items-center justify-center rounded-lg border border-brand-500/20 bg-brand-500/10 text-fg-brand"
        >
          <AppIcon icon="camera" :size="26" />
        </div>
        <div class="min-w-0 flex-1">
          <h1 class="mb-1 text-xl font-semibold tracking-tight text-fg-primary">截图工具</h1>
          <p class="text-sm text-fg-tertiary">
            使用快捷键
            <kbd
              class="mx-0.5 rounded border border-line-subtle bg-surface-hover px-1.5 py-0.5 font-mono text-[11px]"
              >⌘⇧A</kbd
            >
            随时唤起，或点击右侧按钮立即开始
          </p>
        </div>
        <UButton variant="primary" size="lg" :loading="starting" @click="startCapture">
          <AppIcon icon="camera" :size="17" />
          <span>开始截图</span>
        </UButton>
      </div>
    </section>

    <!-- 概览 -->
    <section class="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="rounded-md border border-line-subtle bg-surface-1 p-4 shadow-sm">
        <p class="mb-1 text-xs tracking-wider text-fg-muted uppercase">截图总数</p>
        <p class="text-lg font-semibold text-fg-primary">
          {{ usage ? usage.count : '—' }}
        </p>
      </div>
      <div class="rounded-md border border-line-subtle bg-surface-1 p-4 shadow-sm">
        <p class="mb-1 text-xs tracking-wider text-fg-muted uppercase">占用空间</p>
        <p class="text-lg font-semibold text-fg-primary">
          {{ usage ? fmtSize(usage.totalSize) : '—' }}
        </p>
      </div>
      <div class="rounded-md border border-line-subtle bg-surface-1 p-4 shadow-sm">
        <p class="mb-1 text-xs tracking-wider text-fg-muted uppercase">保存目录</p>
        <p class="truncate font-mono text-xs text-fg-secondary" :title="saveDir || '未设置'">
          {{ saveDir || '未设置' }}
        </p>
        <UButton variant="ghost" size="sm" class="mt-1.5" @click="changeSaveDir">更改</UButton>
      </div>
    </section>

    <!-- 最近截图 -->
    <section>
      <div class="mb-3 flex items-center gap-2">
        <h2 class="text-sm font-semibold text-fg-primary">最近截图</h2>
        <UBadge v-if="recents.length" variant="neutral">{{ recents.length }}</UBadge>
        <div class="h-px flex-1 bg-gradient-to-r from-line-default to-transparent" />
        <UButton variant="ghost" size="sm" :loading="loading" @click="refresh">刷新</UButton>
      </div>

      <div class="rounded-md border border-line-subtle bg-surface-1 p-4 shadow-sm">
        <div v-if="loading && recents.length === 0" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <USkeleton v-for="i in 8" :key="i" variant="rect" h="h-24" />
        </div>

        <UEmpty
          v-else-if="recents.length === 0"
          title="还没有截图"
          description="点击「开始截图」或按 ⌘⇧A 截取第一张"
        >
          <template #icon>
            <AppIcon icon="image-2-line" :size="22" />
          </template>
          <template #action>
            <UButton variant="primary" size="sm" @click="startCapture">开始截图</UButton>
          </template>
        </UEmpty>

        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="item in recents"
            :key="item.id"
            class="group relative overflow-hidden rounded-md border border-line-subtle bg-surface-0"
          >
            <img
              :src="`image://${item.filePath}`"
              :alt="item.fileName"
              class="h-24 w-full bg-surface-2 object-cover"
              loading="lazy"
            />
            <!-- 悬浮操作 -->
            <div
              class="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity duration-normal group-hover:opacity-100"
            >
              <span class="truncate text-[11px] text-white">{{ fmtTime(item.capturedAt) }}</span>
              <div class="flex shrink-0 gap-1">
                <button
                  type="button"
                  title="打开"
                  class="flex size-6 items-center justify-center rounded-sm border border-white/20 bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  @click="openFile(item)"
                >
                  <AppIcon icon="eye-line" :size="13" />
                </button>
                <button
                  type="button"
                  title="在访达中显示"
                  class="flex size-6 items-center justify-center rounded-sm border border-white/20 bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  @click="showInFolder(item)"
                >
                  <AppIcon icon="folder-open-line" :size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

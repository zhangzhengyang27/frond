<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@components/AppIcon.vue'
import { useCommandPalette } from '../../composables/useCommandPalette'
import { searchEntries, type ScoredEntry } from '@shared/search'
import { evaluateExpression } from '@shared/calculator'
import { useUsageBoost } from '@renderer/composables/useUsageBoost'
import { useCommandSources } from '@renderer/launcher/composables/useCommandSources'
import { builtinStaticRows } from '@renderer/commands/BuiltinCommandProvider'
import { executeCommand } from '@renderer/utils/commandRunner'

const router = useRouter()
const palette = useCommandPalette()

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const activeIdx = ref(0)

/**
 * P-7②：命令源与胶囊共用同一个 composable。
 *
 * 之前这里自己拼了四份清单（静态 / 插件 / 应用 / 系统命令+Quicklinks），胶囊走
 * Registry + `mergeCommandEntries`——于是两个界面的行**已经开始不一样**：
 * 面板看不到只在 provider 里的行（如 `ai:chat`「AI 对话」），也没有去重守卫。
 */
const {
  entries: allEntries,
  loadRegistryCommands,
  loadDynamicCommands,
  loadPluginCommands,
  loadPluginSearchItems,
  enrichAliases
} = useCommandSources()

let loadedOnce = false

async function loadCommands(): Promise<void> {
  if (!loadedOnce) {
    loadedOnce = true
    await Promise.all([
      loadRegistryCommands(),
      loadDynamicCommands(),
      loadPluginSearchItems(),
      loadPluginCommands()
    ])
  } else {
    // 之后每次打开只跟插件走（管理页装/停插件后立即生效）；应用扫描与系统命令不重复扫
    await loadPluginCommands()
  }
  try {
    await refreshUsage()
  } catch {
    /* 使用记录读取失败不参与加权 */
  }
  await enrichAliases()
}

/**
 * 空 query 那一屏 = 内置静态行（模块 / 系统页 / 第一方动作）。
 * 按 **key 集合**筛而不是按徽标猜：徽标是给人看的文案，`ai:pomodoroReport` 的徽标是
 * 'AI'，用集合筛的第一版漏了它——那一行直接从首屏消失，而没人会报错。
 */
const STATIC_KEYS = new Set(builtinStaticRows().map((e) => e.key))

const filtered = computed<ScoredEntry[]>(() => {
  const q = query.value.trim()
  // 空query → 内置静态行；有 query → 全量命令统一搜索引擎
  if (!q) {
    return allEntries.value
      .filter((e) => STATIC_KEYS.has(e.key))
      .map((entry) => ({ entry, highlight: null, score: 0 }))
  }
  const rows = searchEntries(allEntries.value, q, 12, usageBoost)
  // 计算器兜底（与胶囊同款）：结果置顶，回车复制
  const calc = evaluateExpression(q)
  if (calc) {
    rows.unshift({
      entry: {
        key: 'calc:result',
        icon: 'function-line',
        title: `= ${calc.formatted}`,
        subtitle: calc.expr,
        badge: '计算',
        action: { type: 'copyText', text: calc.formatted }
      },
      highlight: null,
      score: Number.MAX_SAFE_INTEGER
    })
  }
  return rows
})

/** 使用统计（排序自学习）：与胶囊同一加权策略（频次 × 新近） */
const { refresh: refreshUsage, boost: usageBoost } = useUsageBoost()

watch(filtered, () => {
  activeIdx.value = 0
})

const run = async (item: ScoredEntry): Promise<void> => {
  await executeCommand(item.entry, {
    router,
    inMainWindow: true,
    close: () => {
      palette.close()
      query.value = ''
    }
  })
}

const onKeyDown = (e: KeyboardEvent): void => {
  // ⌘K / Ctrl+K 唤起（在 AppShell mount 时注册）
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K') && !e.altKey && !e.shiftKey) {
    e.preventDefault()
    palette.toggle()
    return
  }

  // 面板内：↑↓ Enter Esc
  if (!palette.isOpen.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    palette.close()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = Math.max(activeIdx.value - 1, 0)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const item = filtered.value[activeIdx.value]
    if (item) void run(item)
  }
}

watch(
  () => palette.isOpen.value,
  async (open) => {
    if (open) {
      void loadCommands()
      await nextTick()
      inputRef.value?.focus()
    } else {
      query.value = ''
    }
  }
)

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="palette.isOpen.value"
      data-testid="command-palette"
      class="fixed inset-0 z-[1200] flex items-start justify-center bg-overlay pt-[14vh] backdrop-blur-[6px]"
      @click.self="palette.close()"
    >
      <div
        class="relative w-[600px] max-w-[92vw] overflow-hidden rounded-lg border border-glass-border bg-glass-bg-strong shadow-lg backdrop-blur-[var(--glass-blur)]"
      >
        <!-- 顶部 1px 内高光 -->
        <div
          class="pointer-events-none absolute inset-x-0 top-0 h-px bg-glass-highlight"
          aria-hidden="true"
        />

        <!-- 搜索框 -->
        <div class="flex h-12 items-center gap-3 border-b border-line-subtle px-4">
          <AppIcon icon="search" :size="18" class="shrink-0 text-fg-muted" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="搜索功能 / 页面 / 动作 / 插件 / 应用…"
            class="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none"
          />
          <kbd
            class="rounded border border-line-subtle bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-fg-tertiary"
            >ESC</kbd
          >
        </div>

        <!-- 结果列表 -->
        <div class="max-h-[400px] overflow-y-auto py-2">
          <p v-if="filtered.length === 0" class="px-4 py-10 text-center text-sm text-fg-muted">
            没有匹配「{{ query }}」的命令
          </p>
          <button
            v-for="(it, idx) in filtered"
            :key="it.entry.key"
            type="button"
            :data-palette-key="it.entry.key"
            class="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-instant"
            :class="
              idx === activeIdx
                ? 'bg-brand-500/10 text-fg-brand'
                : 'text-fg-secondary hover:bg-surface-hover'
            "
            @mouseenter="activeIdx = idx"
            @click="run(it)"
          >
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors"
              :class="
                idx === activeIdx
                  ? 'border-brand-500/20 bg-brand-500/15 text-fg-brand'
                  : 'border-line-subtle bg-surface-2 text-fg-tertiary'
              "
            >
              <AppIcon :icon="it.entry.icon" :size="18" />
            </div>
            <div class="min-w-0 flex-1">
              <div
                class="text-sm font-medium"
                :class="idx === activeIdx ? 'text-fg-brand' : 'text-fg-primary'"
              >
                {{ it.entry.title }}
              </div>
              <div class="truncate text-xs text-fg-muted">
                {{ it.entry.subtitle }}
              </div>
            </div>
            <span
              class="shrink-0 rounded-full border border-line-subtle px-2 py-0.5 text-[10px] text-fg-muted"
              >{{ it.entry.badge }}</span
            >
            <AppIcon
              v-if="idx === activeIdx"
              icon="corner-down-left"
              :size="14"
              class="shrink-0 text-fg-muted"
            />
          </button>
        </div>

        <!-- 底部提示 -->
        <div
          class="flex h-8 items-center gap-3 border-t border-line-subtle px-4 text-[11px] text-fg-muted"
        >
          <span class="inline-flex items-center gap-1">
            <kbd class="rounded bg-surface-hover px-1 py-0.5 font-mono">↑</kbd>
            <kbd class="rounded bg-surface-hover px-1 py-0.5 font-mono">↓</kbd>
            导航
          </span>
          <span class="inline-flex items-center gap-1">
            <kbd class="rounded bg-surface-hover px-1 py-0.5 font-mono">↵</kbd>
            执行
          </span>
          <span class="ml-auto">与启动台共用同一命令注册表</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

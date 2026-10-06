<template>
  <div class="plugins-center">
    <div v-if="loading" class="pc-loading">
      <AppIcon icon="loader-4" :size="18" class="spin" />
      <span>读取插件列表…</span>
    </div>
    <div v-else-if="rows.length === 0" class="pc-empty">还没有安装任何插件</div>
    <div v-else-if="filtered.length === 0" class="pc-empty">没有匹配「{{ query }}」的插件</div>
    <div v-else class="pc-list" data-testid="plugins-center-list" @mousemove="onMouseMove">
      <div
        v-for="(row, index) in filtered"
        :key="row.id"
        class="pc-item"
        :class="{ selected: index === selectedIndex, armed: armedId === row.id }"
        @mouseenter="onMouseEnter(index)"
        @click="openPlugin(row)"
      >
        <div class="pc-icon">
          <AppIcon :icon="row.icon || 'plug-2'" :size="16" />
        </div>
        <div class="pc-info">
          <div class="pc-name">
            {{ row.name }}
            <span class="pc-version">v{{ row.version }}</span>
            <span v-if="!row.enabled" class="pc-badge pc-badge--off">已停用</span>
          </div>
          <div class="pc-desc">{{ row.description || row.id }}</div>
          <div v-if="armedId === row.id" class="pc-confirm">
            再按 ⌘U 确认卸载（ESC 取消）——插件数据与设置将一并删除
          </div>
        </div>
        <button
          class="pc-action"
          :title="row.enabled ? '停用（⌘E）' : '启用（⌘E）'"
          @click.stop="toggleEnabled(row)"
        >
          <AppIcon :icon="row.enabled ? 'pause-circle-line' : 'play-circle-line'" :size="15" />
          <span>{{ row.enabled ? '停用' : '启用' }}</span>
        </button>
        <button class="pc-action pc-action--danger" title="卸载（⌘U）" @click.stop="armOrRemove(row)">
          <AppIcon icon="delete-bin-line" :size="15" />
          <span>卸载</span>
        </button>
      </div>
    </div>
    <PageFooterBar
      :hints="[
        { keys: '↵', label: '打开' },
        { keys: '⌘E', label: '启停' },
        { keys: '⌘U', label: '卸载' },
        { keys: 'ESC', label: armedId ? '取消确认' : '返回' }
      ]"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Frond · 胶囊内嵌插件中心页（2026-10-06，Raycast 式内联页）
 *
 * 搜索「插件 / plugin」进入：列表展示全部已装插件（启用的在前），
 * 胶囊搜索框接管为过滤输入。动作：↵/点击 打开插件、⌘E 启停、⌘U 卸载
 * （二次确认状态机，pluginsCenterLogic.nextUninstallArmed）。
 * 启停/卸载后主进程推 command-table-changed，本页监听重拉列表，
 * 胶囊命令表的刷新由 LauncherApp 既有监听完成。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import PageFooterBar from './PageFooterBar.vue'
import { filterRows, nextUninstallArmed, sortRows, toRows, type PluginRow } from './pluginsCenterLogic'

interface InstalledPluginLike {
  id: string
  name: string
  version: string
  description?: string
  enabled: boolean
  icon?: string
}

const props = defineProps<{ query?: string }>()

const emit = defineEmits<{ closed: [] }>()

const loading = ref(true)
const plugins = ref<InstalledPluginLike[]>([])
const selectedIndex = ref(0)
const armedId = ref<string | null>(null)
const actionError = ref('')

const rows = computed<Array<PluginRow & { icon?: string }>>(() =>
  sortRows(toRows(plugins.value)).map((r) => {
    const icon = plugins.value.find((p) => p.id === r.id)?.icon
    return { ...r, ...(icon !== undefined && { icon }) }
  })
)
const filtered = computed(() => filterRows(rows.value, props.query ?? ''))

watch(filtered, () => {
  selectedIndex.value = 0
})

/**
 * 键盘导航抑制（2026-10-06 用户实测 bug）：鼠标悬停在某行时按 ↓/↑，高亮移动一步后
 * 浏览器会对鼠标下方行重新派发 mouseenter，把选中抢回鼠标所在行——表现为
 * 「按下键，列表不随着变动」。键盘导航后抑制 mouseenter，直到鼠标真实移动（mousemove）。
 */
const keyboardNav = ref(false)

function onMouseEnter(index: number): void {
  if (keyboardNav.value) return
  selectedIndex.value = index
}

function onMouseMove(): void {
  keyboardNav.value = false
}

function moveSelection(delta: number): void {
  keyboardNav.value = true
  const n = filtered.value.length
  selectedIndex.value = (selectedIndex.value + delta + n) % Math.max(1, n)
}

async function refresh(): Promise<void> {
  try {
    plugins.value = (await window.api.launcher.listPlugins()) as InstalledPluginLike[]
  } catch (err) {
    console.warn('PluginsCenterPage: list failed', err)
    actionError.value = '插件列表读取失败'
  } finally {
    loading.value = false
  }
}

const unsubscribe = ref<(() => void) | null>(null)
onMounted(() => {
  void refresh()
  unsubscribe.value = window.api.launcher.onCommandTableChanged(() => {
    void refresh()
  })
})
onBeforeUnmount(() => {
  unsubscribe.value?.()
})

function openPlugin(row: PluginRow): void {
  if (!row.enabled) {
    actionError.value = '插件已停用，先按 ⌘E 启用'
    return
  }
  armedId.value = null
  emit('closed')
  window.api.launcher.openPlugin(row.id)
}

async function toggleEnabled(row: PluginRow): Promise<void> {
  armedId.value = null
  try {
    await window.api.launcher.setPluginEnabled(row.id, !row.enabled)
  } catch (err) {
    console.warn('PluginsCenterPage: toggle failed', err)
    actionError.value = '启停失败'
  }
}

function armOrRemove(row: PluginRow): void {
  const next = nextUninstallArmed(armedId.value, row.id)
  armedId.value = next
  if (next === null) void remove(row)
}

async function remove(row: PluginRow): Promise<void> {
  try {
    await window.api.launcher.removePlugin(row.id)
  } catch (err) {
    console.warn('PluginsCenterPage: remove failed', err)
    actionError.value = '卸载失败'
  }
}

defineExpose({
  handleKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      if (armedId.value) {
        armedId.value = null
        return true
      }
      return false // 让 LauncherApp 走 popPage
    }
    // Math.max(1, …) 在 moveSelection 内：空列表不移动（MenuBarPage 同款守卫，B41）
    if (e.key === 'ArrowDown') {
      moveSelection(1)
      return true
    }
    if (e.key === 'ArrowUp') {
      moveSelection(-1)
      return true
    }
    if (e.key === 'Enter') {
      const row = filtered.value[selectedIndex.value]
      if (row) openPlugin(row)
      return true
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'e' || e.key === 'E')) {
      const row = filtered.value[selectedIndex.value]
      if (row) void toggleEnabled(row)
      return true
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'u' || e.key === 'U')) {
      const row = filtered.value[selectedIndex.value]
      if (row) armOrRemove(row)
      return true
    }
    return false
  }
})
</script>

<style scoped>
.plugins-center {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.pc-loading,
.pc-empty {
  padding: 24px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--launcher-text-muted);
}

.pc-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  min-height: 0;
  padding: 4px 2px;
}

.pc-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 9px;
  cursor: pointer;
}

.pc-item.selected {
  background: var(--launcher-accent-soft);
}

.pc-item.armed {
  background: color-mix(in srgb, var(--launcher-danger) 12%, transparent);
}

.pc-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text-dim);
  flex-shrink: 0;
}

.pc-item.selected .pc-icon {
  color: var(--launcher-accent);
}

.pc-info {
  flex: 1;
  min-width: 0;
}

.pc-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pc-version {
  font-size: 10px;
  color: var(--launcher-text-muted);
  font-weight: 400;
}

.pc-badge--off {
  font-size: 10px;
  color: var(--launcher-text-muted);
  border: 1px solid var(--launcher-border);
  border-radius: 999px;
  padding: 0 6px;
}

.pc-desc {
  font-size: 11px;
  color: var(--launcher-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.pc-confirm {
  font-size: 11px;
  color: var(--launcher-danger);
  margin-top: 2px;
}

.pc-action {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--launcher-border);
  background: transparent;
  color: var(--launcher-text-muted);
  font-size: 10px;
  border-radius: 999px;
  padding: 3px 9px;
  cursor: pointer;
  flex-shrink: 0;
}

.pc-item.selected .pc-action {
  color: var(--launcher-text);
}

.pc-action--danger:hover,
.pc-item.armed .pc-action--danger {
  color: var(--launcher-danger);
  border-color: var(--launcher-danger);
}

.spin {
  animation: pc-spin 0.9s linear infinite;
}

@keyframes pc-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

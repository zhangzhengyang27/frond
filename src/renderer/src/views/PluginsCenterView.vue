<template>
  <div class="plugins-center">
    <header class="pc-head">
      <div>
        <h1 class="pc-title">插件中心</h1>
        <p class="pc-sub">
          已装 {{ stats.total }} · 启用 {{ stats.enabled }}——开关启停、卸载需确认
        </p>
      </div>
      <UInput
        v-model="query"
        size="md"
        placeholder="搜索插件名称 / 描述 / 版本…"
        class="pc-search"
        autofocus
      />
    </header>

    <div class="pc-body">
      <div v-if="loading" class="pc-loading">
        <AppIcon icon="loader-4" :size="18" class="pc-spin" />
        <span>读取插件列表…</span>
      </div>
      <UEmpty
        v-else-if="plugins.length === 0"
        title="还没有安装插件"
        description="去「设置 → 启动器」从市场安装，或从本地文件夹导入"
      />
      <UEmpty
        v-else-if="filtered.length === 0"
        title="没有匹配的插件"
        :description="`「${query}」没有命中任何插件，换个关键词试试`"
      />
      <ul v-else class="pc-list" data-testid="plugins-center-list">
        <li v-for="row in filtered" :key="row.id" class="pc-item">
          <div class="pc-icon">
            <AppIcon :icon="row.icon || 'plug-2'" :size="18" />
          </div>
          <div class="pc-info">
            <div class="pc-name">
              {{ row.name }}
              <span class="pc-version">v{{ row.version }}</span>
              <span v-if="!row.enabled" class="pc-badge-off">已停用</span>
            </div>
            <div class="pc-desc">{{ row.description || row.id }}</div>
          </div>
          <div class="pc-actions">
            <UButton size="sm" :disabled="!row.enabled" @click="openPlugin(row)">打开</UButton>
            <USwitch
              :model-value="row.enabled"
              size="md"
              :label="row.enabled ? '已启用' : '已停用'"
              @update:model-value="toggleEnabled(row)"
            />
            <UButton size="sm" variant="ghost" danger @click="removePlugin(row)">卸载</UButton>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Frond · 插件中心（独立弹窗页，2026-10-06 重设计）
 *
 * 胶囊搜「插件中心」回车 → 独立沉浸窗（?immersive=1 去壳直落）。
 * 宽窗管理界面：搜索过滤、打开插件、USwitch 启停、卸载走全局 confirm 二次确认。
 * 启停/卸载后主进程推 command-table-changed：本页监听重拉列表，胶囊命令表由
 * LauncherApp 既有监听刷新。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UButton from '@components/ui/UButton.vue'
import UInput from '@components/ui/UInput.vue'
import USwitch from '@components/ui/USwitch.vue'
import UEmpty from '@components/ui/UEmpty.vue'
import { confirm } from '@composables/useConfirm'
import { filterRows, sortRows, statsOf, toRows, type PluginRow } from './pluginsCenterLogic'

interface InstalledPluginLike {
  id: string
  name: string
  version: string
  description?: string
  enabled: boolean
  icon?: string
}

const query = ref('')
const loading = ref(true)
const plugins = ref<InstalledPluginLike[]>([])

const rows = computed<Array<PluginRow & { icon?: string }>>(() =>
  sortRows(toRows(plugins.value)).map((r) => {
    const icon = plugins.value.find((p) => p.id === r.id)?.icon
    return { ...r, ...(icon !== undefined && { icon }) }
  })
)
const filtered = computed(() => filterRows(rows.value, query.value))
const stats = computed(() => statsOf(rows.value))

async function refresh(): Promise<void> {
  try {
    plugins.value = (await window.api.launcher.listPlugins()) as InstalledPluginLike[]
  } catch (err) {
    console.warn('PluginsCenterView: list failed', err)
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
  if (!row.enabled) return
  void window.api.launcher.openPlugin(row.id)
  window.close()
}

async function toggleEnabled(row: PluginRow): Promise<void> {
  try {
    await window.api.launcher.setPluginEnabled(row.id, !row.enabled)
  } catch (err) {
    console.warn('PluginsCenterView: toggle failed', err)
  }
}

async function removePlugin(row: PluginRow): Promise<void> {
  const ok = await confirm({
    title: `卸载「${row.name}」？`,
    message: '插件的运行副本与偏好数据将一并删除，市场里仍可重新安装。',
    confirmText: '卸载',
    danger: true
  })
  if (!ok) return
  try {
    await window.api.launcher.removePlugin(row.id)
  } catch (err) {
    console.warn('PluginsCenterView: remove failed', err)
  }
}
</script>

<style scoped>
/* 弹窗布局（2026-10-06 用户反馈）：头部/搜索框固定，仅列表区滚动；
   窗口尺寸由 HEAVY_MODULE_WINDOW_SIZES['plugins-center'] = 640×640 决定 */
.plugins-center {
  height: 100vh;
  padding: 22px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
  overflow: hidden;
}

.pc-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.pc-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary, var(--text-primary, inherit));
}

.pc-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-secondary, var(--text-secondary, inherit));
}

.pc-search {
  width: 100%;
}

.pc-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.pc-loading {
  padding: 40px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary, var(--text-secondary, inherit));
}

.pc-spin {
  animation: pc-spin 0.9s linear infinite;
}

@keyframes pc-spin {
  to {
    transform: rotate(360deg);
  }
}

.pc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pc-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--color-border-default, var(--border-default, transparent));
  border-radius: 12px;
  background: var(--color-surface-1, var(--surface-1, transparent));
  transition: border-color 0.15s ease;
}

.pc-item:hover {
  border-color: var(
    --color-border-strong,
    var(--border-strong, var(--color-border-default, transparent))
  );
}

.pc-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--color-surface-2, var(--surface-2, transparent));
  color: var(--color-text-secondary, var(--text-secondary, inherit));
  flex-shrink: 0;
}

.pc-info {
  flex: 1;
  min-width: 0;
}

.pc-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, var(--text-primary, inherit));
}

.pc-version {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-text-tertiary, var(--text-tertiary, inherit));
}

.pc-badge-off {
  font-size: 10px;
  color: var(--color-text-tertiary, var(--text-tertiary, inherit));
  border: 1px solid var(--color-border-default, var(--border-default, transparent));
  border-radius: 999px;
  padding: 1px 8px;
}

.pc-desc {
  font-size: 12px;
  color: var(--color-text-secondary, var(--text-secondary, inherit));
  margin-top: 3px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pc-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
</style>

<template>
  <div class="kill-process">
    <div v-if="killError" class="kp-error">{{ killError }}</div>
    <div v-bind="containerProps" class="kp-scroll">
      <div v-if="loading" class="kp-loading">
        <AppIcon icon="loader-4" :size="18" class="spin" />
        <span>读取进程列表…</span>
      </div>
      <div v-else-if="filteredProcesses.length === 0" class="kp-empty">没有匹配的进程</div>
      <div v-else v-bind="wrapperProps" class="kp-list">
        <div
          v-for="{ data: proc, index } in list"
          :key="proc.pid"
          class="kp-item"
          :class="{ selected: index === selectedIndex }"
          @mouseenter="selectedIndex = index"
          @mousedown.prevent="kill(proc)"
        >
          <div class="kp-icon">
            <AppIcon icon="file-reduce-line" :size="15" />
          </div>
          <div class="kp-info">
            <div class="kp-name">{{ proc.displayName }}</div>
            <div class="kp-cmd">{{ proc.command }}</div>
          </div>
          <span class="kp-stat cpu">{{ proc.cpu.toFixed(1) }}%</span>
          <span class="kp-stat mem">{{ proc.mem.toFixed(1) }}%</span>
          <span class="kp-pid">{{ proc.pid }}</span>
          <span class="kp-shortcut">↵</span>
        </div>
      </div>
    </div>
    <PageFooterBar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useVirtualList } from '@vueuse/core'
import PageFooterBar from './PageFooterBar.vue'
import AppIcon from '@components/AppIcon.vue'

interface ProcessRow {
  pid: number
  cpu: number
  mem: number
  command: string
  displayName: string
}

const props = defineProps<{ query?: string }>()

const loading = ref(true)
const processes = ref<ProcessRow[]>([])
const selectedIndex = ref(0)
const killError = ref('')

const filteredProcesses = computed(() => {
  if (!props.query?.trim()) return processes.value
  const q = props.query.toLowerCase()
  return processes.value.filter(
    (p) => p.displayName.toLowerCase().includes(q) || p.command.toLowerCase().includes(q)
  )
})

// 虚拟滚动：行高固定 50px（.kp-item 含内边距）；键盘选中联动滚动到可视区
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(filteredProcesses, {
  itemHeight: 50,
  overscan: 8
})

watch(filteredProcesses, () => {
  selectedIndex.value = 0
})

watch(selectedIndex, (i) => {
  scrollTo(i)
})

async function refresh(): Promise<void> {
  try {
    processes.value = (await window.api.process.list()) as ProcessRow[]
  } catch (err) {
    console.warn('KillProcessPage: list failed', err)
  } finally {
    loading.value = false
  }
}

async function kill(proc: ProcessRow): Promise<void> {
  killError.value = ''
  try {
    const res = (await window.api.process.kill(proc.pid)) as { success: boolean; error?: string }
    if (!res.success) {
      killError.value = res.error ?? '结束进程失败'
      return
    }
    processes.value = processes.value.filter((p) => p.pid !== proc.pid)
    void refresh()
  } catch (err) {
    killError.value = (err as Error).message
  }
}

onMounted(refresh)

defineExpose({
  handleKey(e: KeyboardEvent): boolean {
    // Math.max(1, …)：空列表取模 0 得 NaN（MenuBarPage 同款守卫，B41）
    if (e.key === 'ArrowDown') {
      selectedIndex.value = (selectedIndex.value + 1) % Math.max(1, filteredProcesses.value.length)
      return true
    }
    if (e.key === 'ArrowUp') {
      selectedIndex.value =
        (selectedIndex.value - 1 + Math.max(1, filteredProcesses.value.length)) %
        Math.max(1, filteredProcesses.value.length)
      return true
    }
    if (e.key === 'Enter') {
      const proc = filteredProcesses.value[selectedIndex.value]
      if (proc) void kill(proc)
      return true
    }
    return false
  }
})
</script>

<style scoped>
.kill-process {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.kp-list {
  display: flex;
  flex-direction: column;
}

.kp-error {
  padding: 6px 16px;
  font-size: 12px;
  color: var(--launcher-danger);
  background: rgba(255, 69, 58, 0.1);
}

.kp-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 0;
}

.kp-loading,
.kp-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--launcher-text-muted);
  font-size: 13px;
  gap: 8px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.kp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 50px;
  box-sizing: border-box;
  padding: 7px 16px;
  cursor: pointer;
}

.kp-item.selected {
  background: var(--launcher-bg-elevated);
}

.kp-icon {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--launcher-text-muted);
  flex-shrink: 0;
}

.kp-item.selected .kp-icon {
  color: var(--launcher-text);
}

.kp-info {
  flex: 1;
  min-width: 0;
}

.kp-name {
  font-size: 13px;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kp-cmd {
  font-size: 11px;
  color: var(--launcher-text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.kp-stat {
  width: 52px;
  text-align: right;
  font-size: 12px;
  color: var(--launcher-text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.kp-stat.cpu {
  color: var(--launcher-text);
}

.kp-pid {
  width: 64px;
  text-align: right;
  font-size: 11px;
  color: var(--launcher-text-faint);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.kp-shortcut {
  font-size: 13px;
  color: var(--launcher-text-faint);
  flex-shrink: 0;
}
</style>

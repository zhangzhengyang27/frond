<template>
  <CapsulePage :hints="hints">
    <div class="settings-page">
      <div class="settings-title">快捷设置</div>
      <div
        v-for="(item, i) in items"
        :key="item.key"
        class="settings-row"
        :class="{ selected: i === selectedIndex }"
        @mouseenter="selectedIndex = i"
      >
        <span class="settings-icon">{{ item.icon }}</span>
        <span class="settings-label">{{ item.label }}</span>
        <span class="settings-value">{{ item.valueText() }}</span>
      </div>
      <div class="settings-footnote">↵ 切换 · ←→ 调节 · esc 返回</div>
    </div>
  </CapsulePage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CapsulePage from './CapsulePage.vue'
import { useTheme } from '@composables/useTheme'

/**
 * 快捷设置（胶囊内联页）：主题 / 片段文本扩展 / 剪贴板历史。
 * 只放胶囊内可即时生效的核心开关；完整设置仍在主窗口 SettingsView。
 */

const { theme, setTheme } = useTheme()
const hints = [
  { keys: '↑↓', label: '选择' },
  { keys: '↵', label: '切换' },
  { keys: '←→', label: '调节' },
  { keys: 'ESC', label: '返回' }
]

const expansionEnabled = ref(true)
const clipboardEnabled = ref(true)
const clipboardSupported = ref(true)

const selectedIndex = ref(0)

const themeLabel = computed(
  () => ({ light: '浅色', dark: '深色', auto: '跟随系统' })[theme.value] ?? theme.value
)

const items = computed(() => [
  {
    key: 'theme',
    icon: '🎨',
    label: '主题',
    valueText: () => themeLabel.value
  },
  {
    key: 'expansion',
    icon: '✂️',
    label: '片段文本扩展',
    valueText: () => (expansionEnabled.value ? '已开启' : '已关闭')
  },
  {
    key: 'clipboard',
    icon: '📋',
    label: '剪贴板历史',
    valueText: () =>
      clipboardSupported.value ? (clipboardEnabled.value ? '已开启' : '已关闭') : '当前平台不支持'
  }
])

async function cycleTheme(step: number): Promise<void> {
  const order: Array<'light' | 'dark' | 'auto'> = ['light', 'dark', 'auto']
  const idx = order.indexOf(theme.value)
  const next =
    order[((((idx === -1 ? 0 : idx) + step) % order.length) + order.length) % order.length]
  if (next) await setTheme(next)
}

async function activate(): Promise<void> {
  const key = items.value[selectedIndex.value]?.key
  if (key === 'theme') await cycleTheme(1)
  else if (key === 'expansion') {
    const next = !expansionEnabled.value
    try {
      await window.api.launcher.expansionSetConfig({ enabled: next })
      expansionEnabled.value = next
    } catch {
      /* 设置失败静默 */
    }
  } else if (key === 'clipboard') {
    if (!clipboardSupported.value) return
    const next = !clipboardEnabled.value
    try {
      await window.api.clipHist.setEnabled(next)
      clipboardEnabled.value = next
    } catch {
      /* 设置失败静默 */
    }
  }
}

async function adjust(step: number): Promise<void> {
  const key = items.value[selectedIndex.value]?.key
  if (key === 'theme') await cycleTheme(step)
}

/** 键盘分发（LauncherApp 集中转发）；返回 true 表示已消费 */
function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'ArrowDown') {
    selectedIndex.value = (selectedIndex.value + 1) % items.value.length
    return true
  }
  if (e.key === 'ArrowUp') {
    selectedIndex.value = (selectedIndex.value - 1 + items.value.length) % items.value.length
    return true
  }
  if (e.key === 'Enter') {
    void activate()
    return true
  }
  if (e.key === 'ArrowRight') {
    void adjust(1)
    return true
  }
  if (e.key === 'ArrowLeft') {
    void adjust(-1)
    return true
  }
  return false
}

defineExpose({ handleKey })

onMounted(async () => {
  try {
    const config = await window.api.launcher.expansionGetConfig()
    expansionEnabled.value = config.enabled !== false
  } catch {
    /* 默认开启 */
  }
  try {
    const state = await window.api.clipHist.getEnabled()
    clipboardEnabled.value = state.enabled
    clipboardSupported.value = state.supported
  } catch {
    clipboardSupported.value = false
  }
})
</script>

<style scoped>
.settings-page {
  padding: 4px 6px 8px;
}

.settings-title {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.5;
  margin: 2px 4px 8px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: default;
}

.settings-row.selected {
  background: color-mix(in srgb, var(--brand, #4f8ef7) 18%, transparent);
}

.settings-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
}

.settings-label {
  flex: 1;
  font-size: 13px;
}

.settings-value {
  font-size: 12px;
  opacity: 0.6;
}

.settings-footnote {
  margin-top: 8px;
  padding: 0 10px;
  font-size: 10px;
  opacity: 0.4;
}
</style>

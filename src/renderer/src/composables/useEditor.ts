import { reactive, watch, onMounted } from 'vue'
import type { EditorSettings } from '../../../preload/index.d'

const cursorPosition = reactive({
  row: 0,
  column: 0
})

const settings = reactive<EditorSettings>({
  fontSize: 14,
  fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
  wrap: false,
  tabSize: 2,
  matchBrackets: true,
  highlightLine: true,
  // Prettier 默认设置
  semi: true,
  singleQuote: true,
  trailingComma: 'es5'
})

// 加载保存的设置
async function loadSettings(): Promise<void> {
  try {
    const savedSettings = await window.api.preferences.getEditorSettings()
    Object.assign(settings, savedSettings)
  } catch (error) {
    console.error('加载编辑器设置失败:', error)
  }
}

// 保存设置（防抖）
let saveTimer: ReturnType<typeof setTimeout> | null = null
function saveSettings(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(async () => {
    try {
      await window.api.preferences.updateEditorSettings(settings)
    } catch (error) {
      console.error('保存编辑器设置失败:', error)
    }
  }, 500)
}

// 监听设置变化并自动保存
watch(
  () => settings.fontSize,
  () => {
    saveSettings()
  }
)

watch(
  () => settings.fontFamily,
  () => {
    saveSettings()
  }
)

watch(
  () => settings.wrap,
  () => {
    saveSettings()
  }
)

watch(
  () => settings.tabSize,
  () => {
    saveSettings()
  }
)

watch(
  () => settings.matchBrackets,
  () => {
    saveSettings()
  }
)

watch(
  () => settings.highlightLine,
  () => {
    saveSettings()
  }
)

watch(
  () => settings.semi,
  () => {
    saveSettings()
  }
)

watch(
  () => settings.singleQuote,
  () => {
    saveSettings()
  }
)

watch(
  () => settings.trailingComma,
  () => {
    saveSettings()
  }
)

export function useEditor() {
  onMounted(() => {
    loadSettings()
  })

  return {
    cursorPosition,
    settings
  }
}


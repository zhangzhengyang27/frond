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
// B50c：加载期的 Object.assign 会触发全部 9 个 watch，防抖后把刚读到的值原样
// 写回——挂闸跳过，只有用户真实改动才落盘
let loadingSettings = false
async function loadSettings(): Promise<void> {
  loadingSettings = true
  try {
    const savedSettings = await window.api.preferences.getEditorSettings()
    Object.assign(settings, savedSettings)
  } catch (error) {
    console.error('加载编辑器设置失败:', error)
  } finally {
    // 防抖 500ms 落在下一轮宏任务，闸必须等防抖窗口过了再抬
    setTimeout(() => {
      loadingSettings = false
    }, 600)
  }
}

// 保存设置（防抖）
let saveTimer: ReturnType<typeof setTimeout> | null = null
function saveSettings(): void {
  if (loadingSettings) return
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    void (async () => {
      try {
        await window.api.preferences.updateEditorSettings(settings)
      } catch (error) {
        console.error('保存编辑器设置失败:', error)
      }
    })()
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
    void loadSettings()
  })

  return {
    cursorPosition,
    settings
  }
}

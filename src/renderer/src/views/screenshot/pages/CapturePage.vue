<template>
  <div class="screenshot-capture">
    <!-- 截图模式切换栏 -->
    <CaptureModeBar
      v-if="!windowPickerVisible && !countdownVisible && !imageUrl && !historyVisible"
      :mode="captureMode"
      @mode-change="handleModeChange"
      @delay-screenshot="handleDelayScreenshot"
      @toggle-history="handleToggleHistory"
    />

    <!-- 历史记录面板 -->
    <HistoryPanel
      :visible="historyVisible"
      @close="historyVisible = false"
      @open="handleOpenHistoryItem"
    />

    <!-- 延时选择器 -->
    <DelaySelector
      v-if="delaySelectorVisible"
      @start="handleDelayStart"
      @cancel="handleDelayCancel"
    />

    <!-- 倒计时显示 -->
    <CountdownDisplay
      v-if="countdownVisible"
      :seconds="countdownSeconds"
      @cancel="handleCountdownCancel"
    />

    <!-- 窗口选择器 -->
    <WindowPicker
      v-if="windowPickerVisible"
      @select="handleWindowSelect"
      @close="handleWindowPickerClose"
    />

    <!-- OCR 结果展示 -->
    <OcrResult
      v-if="ocrImageSrc"
      :image-src="ocrImageSrc"
      @close="ocrImageSrc = null"
      @result="handleOcrResult"
    />

    <!-- 截图编辑器 -->
    <Screenshots
      v-if="imageUrl && display"
      ref="screenshotsRef"
      :url="imageUrl"
      :width="display.width"
      :height="display.height"
      :scale-factor="display.scaleFactor"
      @ok="handleOk"
      @cancel="handleCancel"
      @save="handleSave"
      @ocr="handleOcr"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import Screenshots from '../components/Screenshots.vue'
import CaptureModeBar from '../components/CaptureModeBar.vue'
import WindowPicker from '../components/WindowPicker.vue'
import DelaySelector from '../components/DelaySelector.vue'
import CountdownDisplay from '../components/CountdownDisplay.vue'
import HistoryPanel from '../components/HistoryPanel.vue'
// 关键：把 OcrResult 改为异步组件，防止它的子模块（如 OcrService）出错时
// 阻塞整个 CapturePage.vue 的解析，从而导致 onMounted 无法触发、
// SCREENSHOT:ready 永远发不出去。
const OcrResult = defineAsyncComponent(() => import('../components/OcrResult.vue'))
import type { Bounds } from '../types'

interface Display {
  id: number
  x: number
  y: number
  width: number
  height: number
  scaleFactor: number
}

interface WindowInfo {
  id: string
  name: string
  thumbnail: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

const imageUrl = ref<string | null>(null)
const display = ref<Display | null>(null)
const captureMode = ref<'screen' | 'window'>('screen')
const windowPickerVisible = ref(false)
const delaySelectorVisible = ref(false)
const countdownVisible = ref(false)
const countdownSeconds = ref(0)
const historyVisible = ref(false)
const ocrImageSrc = ref<string | null>(null)
const currentSourceInfo = ref<{
  sourceType: 'screen' | 'window'
  sourceId?: string
  sourceName?: string
} | null>(null)
const screenshotsRef = ref<InstanceType<typeof Screenshots> | null>(null)

let countdownInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // 监听截图事件
  window.api.screenshot.onCapture((displayData: Display, url: string) => {
    // 重置所有 UI 状态（复用窗口时不会重新 onMounted，需手动重置）
    stopCountdown()
    windowPickerVisible.value = false
    delaySelectorVisible.value = false
    historyVisible.value = false
    ocrImageSrc.value = null

    display.value = displayData
    imageUrl.value = url
    captureMode.value = 'screen'
    currentSourceInfo.value = { sourceType: 'screen' }
  })

  // 监听重置事件
  window.api.screenshot.onReset(() => {
    stopCountdown()
    imageUrl.value = null
    display.value = null
    windowPickerVisible.value = false
    currentSourceInfo.value = null
  })

  // 键盘快捷键支持
  window.addEventListener('keydown', handleKeyDown)

  // 通知主进程准备完成
  window.api.screenshot.ready()
})

onUnmounted(() => {
  window.api.screenshot.removeListeners()
  window.removeEventListener('keydown', handleKeyDown)
  stopCountdown()
})

/** ESC 取消 / Enter 确认 */
const handleKeyDown = (e: KeyboardEvent): void => {
  // 文本输入中的按键不拦截（文本标注换行、历史搜索等）
  const target = e.target as HTMLElement | null
  if (
    target &&
    (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
  ) {
    return
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    // 优先级：关闭弹窗 > 取消倒计时 > 取消截图
    if (ocrImageSrc.value) {
      ocrImageSrc.value = null
    } else if (historyVisible.value) {
      historyVisible.value = false
    } else if (windowPickerVisible.value) {
      windowPickerVisible.value = false
    } else if (delaySelectorVisible.value) {
      delaySelectorVisible.value = false
    } else if (countdownVisible.value) {
      handleCountdownCancel()
    } else {
      handleCancel()
    }
  } else if (e.key === 'Enter') {
    // 仅在截图编辑器活动且无弹层时触发确认（OCR 浮层打开时 Enter 交给浮层）
    if (
      imageUrl.value &&
      display.value &&
      !ocrImageSrc.value &&
      !windowPickerVisible.value &&
      !historyVisible.value
    ) {
      e.preventDefault()
      screenshotsRef.value?.confirm()
    }
  }
}

const handleModeChange = async (mode: 'screen' | 'window'): Promise<void> => {
  if (mode === 'window') {
    windowPickerVisible.value = true
  } else {
    // 切换回屏幕截图模式，需要重新开始截图
    windowPickerVisible.value = false
    try {
      await window.api.screenshot.endCapture()
      await window.api.screenshot.startCapture()
    } catch (error) {
      console.error('[CapturePage] Failed to switch to screen mode:', error)
    }
  }
}

const handleDelayScreenshot = (): void => {
  delaySelectorVisible.value = true
}

const handleToggleHistory = (): void => {
  historyVisible.value = !historyVisible.value
}

const handleOpenHistoryItem = async (item: { filePath: string }): Promise<void> => {
  historyVisible.value = false
  try {
    // 用系统默认查看器打开截图
    await window.api.screenshot.history.openFile(item.filePath)
  } catch (error) {
    console.error('[CapturePage] Failed to open history item:', error)
  }
}

const handleDelayStart = async (seconds: number): Promise<void> => {
  delaySelectorVisible.value = false
  // 开始倒计时
  stopCountdown()
  countdownSeconds.value = seconds
  countdownVisible.value = true

  countdownInterval = setInterval(() => {
    // 复用窗口场景：倒计时期间可能被新截图/重置打断，仅存活时生效
    if (!countdownVisible.value) {
      stopCountdown()
      return
    }
    countdownSeconds.value--
    if (countdownSeconds.value <= 0) {
      stopCountdown()
      // 倒计时结束，开始截图
      startScreenCapture()
    }
  }, 1000)
}

const handleDelayCancel = (): void => {
  delaySelectorVisible.value = false
}

/** 统一清理倒计时（onCapture / onReset / 卸载 / 正常结束共用） */
const stopCountdown = (): void => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  countdownVisible.value = false
  countdownSeconds.value = 0
}

const handleCountdownCancel = (): void => {
  stopCountdown()
}

const startScreenCapture = async (): Promise<void> => {
  try {
    await window.api.screenshot.endCapture()
    await window.api.screenshot.startCapture()
  } catch (error) {
    console.error('[CapturePage] Failed to start screen capture:', error)
  }
}

const handleWindowSelect = async (win: WindowInfo): Promise<void> => {
  windowPickerVisible.value = false

  try {
    // 捕获指定窗口（传当前 overlay 所在显示器的缩放系数，主进程据此换算逻辑尺寸）
    const result = await window.api.screenshot.captureWindow(win.id, display.value?.scaleFactor)
    if (result.success && result.imageUrl && result.bounds) {
      // 窗口图像作为独立来源：逻辑尺寸由主进程按 scaleFactor 换算，
      // 保证 Retina 下编辑器尺寸与鼠标坐标和图像内容一致
      const fakeDisplay: Display = {
        id: -1,
        x: result.bounds.x,
        y: result.bounds.y,
        width: result.bounds.width,
        height: result.bounds.height,
        scaleFactor: result.scaleFactor ?? display.value?.scaleFactor ?? 1
      }
      display.value = fakeDisplay
      imageUrl.value = result.imageUrl
      currentSourceInfo.value = { sourceType: 'window', sourceId: win.id, sourceName: win.name }
    } else {
      console.error('[CapturePage] Failed to capture window:', result.error)
    }
  } catch (error) {
    console.error('[CapturePage] handleWindowSelect error:', error)
  }
}

const handleWindowPickerClose = (): void => {
  windowPickerVisible.value = false
}

const handleOk = async (blob: Blob | null, bounds: Bounds): Promise<void> => {
  if (!blob || !display.value) return
  try {
    const arrayBuffer = await blob.arrayBuffer()
    window.api.screenshot.ok(arrayBuffer, {
      bounds,
      display: display.value,
      ...currentSourceInfo.value
    })
  } catch (error) {
    console.error('[CapturePage] handleOk error:', error)
  }
}

const handleSave = async (blob: Blob | null, bounds: Bounds): Promise<void> => {
  if (!blob || !display.value) return
  try {
    const arrayBuffer = await blob.arrayBuffer()
    window.api.screenshot.save(arrayBuffer, {
      bounds,
      display: display.value,
      ...currentSourceInfo.value
    })
  } catch (error) {
    console.error('[CapturePage] handleSave error:', error)
  }
}

const handleOcr = (imageDataUrl: string): void => {
  ocrImageSrc.value = imageDataUrl
}

const handleOcrResult = (text: string): void => {
  console.log('[CapturePage] OCR result:', text)
  // 可以在这里将识别结果复制到剪贴板或其他处理
}

const handleCancel = (): void => {
  try {
    window.api.screenshot.cancel()
  } catch (error) {
    console.error('[CapturePage] handleCancel error:', error)
  }
}
</script>

<style scoped>
.screenshot-capture {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>

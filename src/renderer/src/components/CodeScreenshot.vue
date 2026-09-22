<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useDark, useCssVar } from '@vueuse/core'
import CodeMirror from 'codemirror'
import domToImage from 'dom-to-image'
import interact from 'interactjs'
import type { SnippetContent } from '../../../preload/index.d'
import { useEditor } from '../composables/useEditor'
import BackgroundSwitch from './BackgroundSwitch.vue'
import AppIcon from './AppIcon.vue'
import 'codemirror/theme/neo.css'
import 'codemirror/theme/oceanic-next.css'

interface Props {
  content: SnippetContent | null
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { settings } = useEditor()
// useDark() 调用本身承担 dark class 全局同步副作用，变量在本组件未使用
const _isDark = useDark()
const isDarkPreview = ref(true)
const isBackground = ref(true)
const activeBackground = ref<'disco' | 'salad' | 'cucumber' | 'aqua' | 'lovely'>('disco')

const editorRef = ref<HTMLDivElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const backgroundRef = ref<HTMLDivElement | null>(null)

const MIN_WIDTH = 520
const MAX_WIDTH = 920
const width = ref(MIN_WIDTH)
const isDragging = ref(false)
const showDimensions = ref(false)

let editor: CodeMirror.Editor | null = null

const colorBg = useCssVar('--color-code-bg-preview', backgroundRef.value, {
  initialValue: isDarkPreview.value ? 'oklch(24.78% 0 0)' : 'oklch(100% 0 0)'
})

const colorBorder = useCssVar('--color-code-bg-border', backgroundRef.value, {
  initialValue: isDarkPreview.value ? 'oklch(30% 0 0)' : 'oklch(90% 0 0)'
})

function init(): void {
  if (!editorRef.value) return

  editor = CodeMirror(editorRef.value, {
    value: props.content?.value || ' ',
    mode: props.content?.language || 'plaintext',
    theme: isDarkPreview.value ? 'oceanic-next' : 'neo',
    lineWrapping: settings.wrap,
    lineNumbers: true,
    matchBrackets: settings.matchBrackets,
    scrollbarStyle: 'null',
    readOnly: true
  })

  // 禁用文本选择
  editor.on('mousedown', (e) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(e as any).preventDefault()
  })

  watch(
    () => props.content,
    (v) => {
      nextTick(() => {
        if (editor) {
          editor.setValue(v?.value || '')
        }
      })
    }
  )

  watch(
    () => props.content,
    (v) => {
      nextTick(() => {
        if (editor && v) {
          editor.setOption('mode', v.language || 'plaintext')
        }
      })
    }
  )

  watch(isDarkPreview, (v) => {
    if (editor) {
      editor.setOption('theme', v ? 'oceanic-next' : 'neo')
    }
    colorBg.value = v ? 'oklch(24.78% 0 0)' : 'oklch(100% 0 0)'
    colorBorder.value = v ? 'oklch(30% 0 0)' : 'oklch(90% 0 0)'
  })

  nextTick(() => {
    initInteract()
  })
}

function initInteract(): void {
  if (!backgroundRef.value) return

  let containerMaxWidth = MAX_WIDTH

  width.value = MIN_WIDTH

  if (containerRef.value) {
    containerMaxWidth = Math.min(MAX_WIDTH, containerRef.value.clientWidth - 56)
  }

  // interact 在全局元素注册表持有 DOM 引用与监听：组件卸载时 unset，
  // 否则随「截图导出」反复挂载/卸载逐次泄漏
  interact(backgroundRef.value).resizable({
    edges: { left: true, right: true, bottom: false, top: false },
    invert: 'reposition',
    inertia: false,
    modifiers: [
      interact.modifiers.restrictSize({
        min: { width: MIN_WIDTH, height: 0 },
        max: { width: containerMaxWidth, height: 5000 }
      })
    ],
    listeners: {
      start() {
        isDragging.value = true
        showDimensions.value = true
      },
      move(event) {
        // 考虑居中效果，宽度变化要翻倍
        let newWidth = width.value + event.deltaRect.width * 2
        newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, containerMaxWidth))
        width.value = newWidth
      },
      end() {
        isDragging.value = false
        showDimensions.value = false
      }
    }
  })
}

async function onSave(format: 'png' | 'svg'): Promise<void> {
  if (!backgroundRef.value) return

  const filter = (node: Node): boolean => {
    const el = node as HTMLElement
    return el.dataset?.controls !== 'resize' && el.dataset?.background !== 'transparent'
  }

  let data = ''

  if (format === 'png') {
    data = await domToImage.toPng(backgroundRef.value, { filter })
  }

  if (format === 'svg') {
    data = await domToImage.toSvg(backgroundRef.value)
  }

  const a = document.createElement('a')
  a.href = data
  a.download = `code-screenshot.${format}`
  a.click()

  URL.revokeObjectURL(data)
}

onMounted(() => {
  init()
})

onBeforeUnmount(() => {
  if (backgroundRef.value) {
    interact(backgroundRef.value).unset()
  }
})
</script>

<template>
  <div ref="containerRef" class="code-screenshot-container">
    <div class="screenshot-header">
      <div class="screenshot-header-left">
        <div class="switch-group">
          <label class="switch-label">
            <input v-model="isDarkPreview" type="checkbox" class="switch-input" />
            <span class="switch-slider"></span>
            <span class="switch-text">暗色模式</span>
          </label>
        </div>
        <div class="switch-group">
          <label class="switch-label">
            <input v-model="isBackground" type="checkbox" class="switch-input" />
            <span class="switch-slider"></span>
            <span class="switch-text">背景</span>
          </label>
        </div>
        <BackgroundSwitch v-if="isBackground" v-model:active="activeBackground" />
      </div>
      <div class="screenshot-header-right">
        <button
          class="screenshot-btn screenshot-btn-primary"
          title="保存为 PNG"
          @click="onSave('png')"
        >
          <AppIcon icon="ri-download-line" />
          <span>PNG</span>
        </button>
        <button
          class="screenshot-btn screenshot-btn-primary"
          title="保存为 SVG"
          @click="onSave('svg')"
        >
          <AppIcon icon="ri-download-line" />
          <span>SVG</span>
        </button>
        <button
          class="screenshot-btn screenshot-btn-close"
          title="返回编辑器"
          @click="emit('close')"
        >
          <AppIcon icon="ri-close-line" />
        </button>
      </div>
    </div>
    <div class="screenshot-content">
      <div class="screenshot-wrapper">
        <div
          ref="backgroundRef"
          data-background="main"
          class="screenshot-background"
          :class="{
            'bg-transparent': !isBackground,
            'gradient-disco': isBackground && activeBackground === 'disco',
            'gradient-salad': isBackground && activeBackground === 'salad',
            'gradient-cucumber': isBackground && activeBackground === 'cucumber',
            'gradient-aqua': isBackground && activeBackground === 'aqua',
            'gradient-lovely': isBackground && activeBackground === 'lovely'
          }"
          :style="{ width: `${width}px` }"
        >
          <div
            data-frame
            class="screenshot-frame"
            :style="{
              backgroundColor: colorBg,
              borderColor: colorBorder
            }"
          >
            <div data-controls="traffic-light" class="traffic-lights">
              <svg xmlns="http://www.w3.org/2000/svg" width="54" height="14" viewBox="0 0 54 14">
                <g fill="none" fill-rule="evenodd" transform="translate(1 1)">
                  <circle cx="6" cy="6" r="6" fill="#FF5F56" stroke="#E0443E" stroke-width=".5" />
                  <circle cx="26" cy="6" r="6" fill="#FFBD2E" stroke="#DEA123" stroke-width=".5" />
                  <circle cx="46" cy="6" r="6" fill="#27C93F" stroke="#1AAB29" stroke-width=".5" />
                </g>
              </svg>
            </div>
            <div ref="editorRef" class="screenshot-editor" />
          </div>
          <div data-controls="resize" class="resize-handle resize-handle-left" />
          <div data-controls="resize" class="resize-handle resize-handle-right" />
          <div
            v-if="showDimensions"
            class="dimensions-display"
            :class="{ 'opacity-0': !showDimensions }"
          >
            <div class="dimensions-border" :style="{ width: `${width}px` }" />
            <div class="dimensions-text">{{ Math.round(width) }}px</div>
          </div>
          <div v-if="!isBackground" data-background="transparent" class="transparent-grid" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-screenshot-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-0);
}

.screenshot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-1);
}

.screenshot-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.screenshot-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-group {
  display: flex;
  align-items: center;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.switch-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: relative;
  width: 36px;
  height: 20px;
  background-color: var(--gray-300);
  border-radius: 20px;
  transition: background-color 0.3s;
}

.switch-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  top: 2px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.3s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.switch-input:checked + .switch-slider {
  background-color: var(--brand-500);
}

.switch-input:checked + .switch-slider::before {
  transform: translateX(16px);
}

.switch-text {
  font-size: 13px;
  color: var(--text-primary);
}

.screenshot-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--surface-1);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.screenshot-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.screenshot-btn-primary {
  background: var(--brand-500);
  color: white;
  border-color: var(--brand-500);
}

.screenshot-btn-primary:hover {
  background: var(--brand-600);
  border-color: var(--brand-600);
}

.screenshot-btn-close {
  padding: 6px;
  margin-left: 8px;
}

.screenshot-btn-close:hover {
  background: rgba(255, 59, 48, 0.08);
  color: var(--text-danger);
  border-color: var(--text-danger);
}

.screenshot-content {
  flex: 1;
  overflow: auto;
  padding: 36px;
  background-color: transparent;
  background-image:
    linear-gradient(var(--border-default) 2px, transparent 2px),
    linear-gradient(90deg, var(--border-default) 2px, transparent 2px),
    linear-gradient(var(--border-default) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-default) 1px, transparent 1px);
  background-size:
    50px 50px,
    50px 50px,
    10px 10px,
    10px 10px;
  background-position:
    -2px -2px,
    -2px -2px,
    -1px -1px,
    -1px -1px;
}

.screenshot-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
}

.screenshot-background {
  position: relative;
  padding: 20px;
  border-radius: 8px;
}

.screenshot-frame {
  position: relative;
  z-index: 10;
  border-radius: 12px;
  border: 1px solid;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.traffic-lights {
  margin-bottom: 8px;
}

.screenshot-editor {
  user-select: none;
}

.resize-handle {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: white;
  border: 2px solid var(--gray-400);
  border-radius: 50%;
  cursor: ew-resize;
  z-index: 20;
  transform: translateY(-50%);
  transition: all 0.2s;
}

.resize-handle:hover {
  border-color: var(--brand-500);
  background: var(--brand-50);
  transform: translateY(-50%) scale(1.2);
}

.resize-handle-left {
  left: 0;
  transform: translateX(-50%) translateY(-50%);
}

.resize-handle-left:hover {
  transform: translateX(-50%) translateY(-50%) scale(1.2);
}

.resize-handle-right {
  right: 0;
  transform: translateX(50%) translateY(-50%);
}

.resize-handle-right:hover {
  transform: translateX(50%) translateY(-50%) scale(1.2);
}

.dimensions-display {
  position: absolute;
  right: 0;
  bottom: -48px;
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: opacity 0.2s;
}

.dimensions-border {
  position: relative;
  margin-bottom: 8px;
  height: 2px;
  border-top: 1px solid var(--text-secondary);
}

.dimensions-border::before,
.dimensions-border::after {
  content: '';
  position: absolute;
  top: -4px;
  height: 8px;
  border-left: 1px solid var(--text-secondary);
}

.dimensions-border::before {
  left: 0;
}

.dimensions-border::after {
  right: 0;
}

.dimensions-text {
  position: relative;
  top: -5px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--surface-inverse);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-inverse);
  font-variant-numeric: tabular-nums;
}

.transparent-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(45deg, var(--gray-300) 25%, transparent 0),
    linear-gradient(-45deg, var(--gray-300) 25%, transparent 0),
    linear-gradient(45deg, transparent 75%, var(--gray-300) 0),
    linear-gradient(-45deg, transparent 75%, var(--gray-300) 0);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
  z-index: 1;
  pointer-events: none;
}

.gradient-disco {
  background: linear-gradient(90deg, #fc466b 0%, #3f5efb 100%);
}

.gradient-salad {
  background: linear-gradient(90deg, #00c9ff 0%, #92fe9d 100%);
}

.gradient-cucumber {
  background: linear-gradient(90deg, #e3ffe7 0%, #d9e7ff 100%);
}

.gradient-aqua {
  background: linear-gradient(90deg, #00d2ff 0%, #3a47d5 100%);
}

.gradient-lovely {
  background: linear-gradient(90deg, #efd5ff 0%, #515ada 100%);
}

:deep(.CodeMirror),
:deep(.CodeMirror-gutters) {
  background-color: var(--color-code-bg-preview) !important;
}

:deep(.CodeMirror) {
  height: auto;
}

:deep(.CodeMirror-scroll) {
  overflow: visible !important;
}

:deep(.CodeMirror-gutters) {
  border: none;
}
</style>

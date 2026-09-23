<script setup lang="ts">
import { ref, computed, watch, nextTick, watchEffect } from 'vue'
import { useDark, useFullscreen, useMagicKeys } from '@vueuse/core'
import { marked } from 'marked'
import sanitizeHtml from '../utils/sanitize-html-wrapper'
import CodeMirror from 'codemirror'
import type { Snippet } from '../../../preload/index.d'
import { useMarkdown } from '../composables/useMarkdown'
import LaserPointer from './LaserPointer.vue'
import AppIcon from './AppIcon.vue'
import 'codemirror/addon/runmode/runmode'
import 'codemirror/theme/neo.css'
import 'codemirror/theme/oceanic-next.css'

interface Props {
  currentSnippet: Snippet | null
  allSnippets: Snippet[]
}

interface Emits {
  (e: 'close'): void
  (e: 'selectSnippet', snippetId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { scaleToShow, onZoom, scale } = useMarkdown()
const { isFullscreen, toggle } = useFullscreen()
const { left, right, escape, meta, ctrl, l } = useMagicKeys()

const isDark = useDark()
const isLaserPointerActive = ref(false)
const renderedContent = ref('')
const codeEditors = ref<CodeMirror.Editor[]>([])
const codeBlocksData = ref<{ id: string; value: string; language?: string }[]>([])
const markdownRef = ref<HTMLDivElement | null>(null)

// 获取所有 Markdown 代码片段
const mdSnippetIds = computed(() => {
  return props.allSnippets
    .filter((s) => s.contents && s.contents.length > 0 && s.contents[0].language === 'markdown')
    .map((s) => s.id)
})

const currentIndex = computed(() => {
  if (!props.currentSnippet) return 0
  return mdSnippetIds.value.findIndex((id) => id === props.currentSnippet?.id) || 0
})

// 是否显示导航按钮（只有在有多个 Markdown 片段时才显示）
const showNavigation = computed(() => {
  return mdSnippetIds.value.length > 1
})

const currentSnippetContent = computed(() => {
  if (!props.currentSnippet?.contents || props.currentSnippet.contents.length === 0) {
    return null
  }
  return props.currentSnippet.contents[0]
})

// marked 的自定义 renderer 是全局的，parse 期间持续向「当前渲染」的收集器 push。
// 用局部收集器 + 渲染序号隔离并发：快速切换片段时旧渲染不会污染新渲染的块数据
let activeBlockSink: { id: string; value: string; language?: string }[] | null = null
let renderSeq = 0

marked.use({
  renderer: {
    code({ text, lang }) {
      const id = Math.random().toString(36).substring(2, 15)
      activeBlockSink?.push({ id, value: text, language: lang })
      return `<div id="${id}" class="code-block"></div>`
    },
    link({ href, text }) {
      return `<a href="${href}" class="external" target="_blank" rel="noopener noreferrer">${text}</a>`
    }
  }
})

async function renderMarkdown(): Promise<void> {
  const seq = ++renderSeq
  codeBlocksData.value = []
  const blocks: { id: string; value: string; language?: string }[] = []
  activeBlockSink = blocks
  codeEditors.value.forEach((editor) => {
    const wrapper = editor.getWrapperElement()
    wrapper.remove()
  })
  codeEditors.value = []

  if (currentSnippetContent.value?.value) {
    const markdownHtml = await marked.parse(currentSnippetContent.value.value)
    activeBlockSink = null
    if (seq !== renderSeq) return // 已有更新的渲染启动，丢弃本次结果

    const sanitizedHtml = sanitizeHtml(markdownHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'del']),
      allowedAttributes: {
        '*': [
          'align',
          'alt',
          'height',
          'href',
          'name',
          'src',
          'target',
          'width',
          'class',
          'type',
          'checked',
          'disabled',
          'id'
        ]
      },
      allowedSchemes: ['http', 'https']
    })

    codeBlocksData.value = blocks
    renderedContent.value = sanitizedHtml
  } else {
    renderedContent.value = ''
  }
}

function renderCodeBlockEditors(): void {
  codeEditors.value = []

  codeBlocksData.value.forEach((blockData) => {
    const container = document.getElementById(blockData.id)

    if (container) {
      const editor = CodeMirror(container as HTMLElement, {
        value: blockData.value,
        mode: blockData.language || 'plaintext',
        theme: isDark.value ? 'oceanic-next' : 'neo',
        readOnly: true,
        lineNumbers: false,
        lineWrapping: true,
        scrollbarStyle: 'null'
      })
      codeEditors.value.push(editor)
    }
  })
}

function onLinkClick(event: MouseEvent): void {
  const target = event.target as HTMLElement

  if (target.tagName === 'A') {
    const href = target.getAttribute('href')
    if (href && target.classList.contains('external')) {
      if (window.api && window.api.system) {
        void window.api.system.openExternal(href)
      } else {
        window.open(href, '_blank')
      }
      event.preventDefault()
    }
  }
}

function onClose(): void {
  emit('close')
}

function onPrevNext(direction: 'prev' | 'next'): void {
  let id: string | undefined

  if (direction === 'prev') {
    id = mdSnippetIds.value[currentIndex.value - 1]
  } else {
    id = mdSnippetIds.value[currentIndex.value + 1]
  }

  if (id) {
    emit('selectSnippet', id)
  }
}

function onFullscreen(): void {
  toggle()
}

function toggleLaserPointer(): void {
  isLaserPointerActive.value = !isLaserPointerActive.value
}

// 键盘快捷键（只有在有多个片段时才启用）
watch(left, (v) => {
  if (v && showNavigation.value) onPrevNext('prev')
})

watch(right, (v) => {
  if (v && showNavigation.value) onPrevNext('next')
})

watch(escape, (v) => {
  if (v) onClose()
})

watchEffect(() => {
  if ((meta.value || ctrl.value) && l.value) {
    toggleLaserPointer()
  }
})

// 监听当前代码片段变化
watch(
  () => props.currentSnippet?.id,
  () => {
    renderMarkdown()
  },
  { immediate: true }
)

watch(renderedContent, () => {
  nextTick(() => {
    renderCodeBlockEditors()
    markdownRef.value?.removeEventListener('click', onLinkClick)
    markdownRef.value?.addEventListener('click', onLinkClick)
  })
})

watch(isDark, (value) => {
  const theme = value ? 'oceanic-next' : 'neo'
  codeEditors.value.forEach((editor) => {
    editor.setOption('theme', theme)
  })
})
</script>

<template>
  <div class="markdown-presentation-container">
    <button class="close-btn" @click="onClose">
      <AppIcon icon="ri-close-line" />
    </button>

    <div class="presentation-content">
      <div ref="markdownRef" class="markdown-wrapper">
        <!-- eslint-disable vue/no-v-html -- 内容已经过 sanitize-html 白名单过滤（见 renderMarkdown 中 sanitizedHtml） -->
        <div
          class="markdown-content"
          :style="{ fontSize: `calc(1rem * ${scale})` }"
          v-html="renderedContent"
        />
        <!-- eslint-enable vue/no-v-html -->
      </div>
    </div>

    <div class="presentation-controls">
      <div class="controls-left">
        <button
          class="control-btn"
          :title="isFullscreen ? '退出全屏' : '全屏'"
          @click="onFullscreen"
        >
          <AppIcon :icon="isFullscreen ? 'ri-contract-line' : 'ri-expand-line'" />
        </button>
        <button
          v-if="showNavigation"
          class="control-btn"
          title="上一页"
          @click="onPrevNext('prev')"
        >
          <AppIcon icon="ri-arrow-left-line" />
        </button>
        <button
          v-if="showNavigation"
          class="control-btn"
          title="下一页"
          @click="onPrevNext('next')"
        >
          <AppIcon icon="ri-arrow-right-line" />
        </button>
        <span v-if="showNavigation" class="page-indicator">
          {{ currentIndex + 1 }} / {{ mdSnippetIds.length }}
        </span>
      </div>

      <div class="controls-right">
        <button
          class="control-btn"
          :class="{ active: isLaserPointerActive }"
          title="激光笔（⌘/Ctrl + L）"
          @click="toggleLaserPointer"
        >
          <AppIcon icon="ri-focus-2-line" />
        </button>
        <button class="control-btn" title="缩小" @click="onZoom('out')">
          <AppIcon icon="ri-subtract-line" />
        </button>
        <span class="scale-display">{{ scaleToShow }}</span>
        <button class="control-btn" title="放大" @click="onZoom('in')">
          <AppIcon icon="ri-add-line" />
        </button>
      </div>
    </div>

    <!-- 待核：控制条右半与激光笔挂载点为重建（原件此处起丢失） -->
    <LaserPointer :is-active="isLaserPointerActive" :offset-bottom="56" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useDark } from '@vueuse/core'
import { marked } from 'marked'
import sanitizeHtml from '../utils/sanitize-html-wrapper'
import CodeMirror from 'codemirror'
import type { SnippetContent } from '../../../preload/index.d'
import AppIcon from './AppIcon.vue'
import 'codemirror/addon/runmode/runmode'
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

const isDark = useDark()
const renderedContent = ref('')
const codeEditors = ref<CodeMirror.Editor[]>([])
const codeBlocksData = ref<{ id: string; value: string; language?: string }[]>([])
const markdownRef = ref<HTMLDivElement | null>(null)
const scale = ref(1)

marked.use({
  renderer: {
    code({ text, lang }) {
      const id = Math.random().toString(36).substring(2, 15)
      codeBlocksData.value.push({ id, value: text, language: lang })
      return `<div id="${id}" class="code-block"></div>`
    },
    link({ href, text }) {
      return `<a href="${href}" class="external" target="_blank" rel="noopener noreferrer">${text}</a>`
    }
  }
})

async function renderMarkdown(): Promise<void> {
  if (props.content?.value) {
    const markdownHtml = await marked.parse(props.content.value)

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

    renderedContent.value = sanitizedHtml
  } else {
    renderedContent.value = ''
    codeEditors.value = []
    codeBlocksData.value = []
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
      // 使用 Electron shell 打开外部链接
      if (window.api && window.api.system) {
        void window.api.system.openExternal(href)
      } else {
        window.open(href, '_blank')
      }
      event.preventDefault()
    }
  }
}

function zoomIn(): void {
  if (scale.value < 2) {
    scale.value += 0.1
  }
}

function zoomOut(): void {
  if (scale.value > 0.5) {
    scale.value -= 0.1
  }
}

watch(
  () => props.content,
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
  <div class="markdown-preview-container">
    <div class="preview-header">
      <div class="preview-header-left">
        <button class="preview-btn" title="缩小" @click="zoomOut">
          <AppIcon icon="ri-subtract-line" />
        </button>
        <span class="scale-display">{{ Math.round(scale * 100) }}%</span>
        <button class="preview-btn" title="放大" @click="zoomIn">
          <AppIcon icon="ri-add-line" />
        </button>
      </div>
      <div class="preview-header-right">
        <button class="preview-btn preview-btn-close" title="返回编辑器" @click="emit('close')">
          <AppIcon icon="ri-close-line" />
          <span>关闭</span>
        </button>
      </div>
    </div>
    <div ref="markdownRef" class="preview-content">
      <!-- eslint-disable-next-line vue/no-v-html -- 内容已经过 sanitize-html 白名单过滤（见 renderMarkdown 中 sanitizedHtml） -->
      <div class="markdown-content" :style="{ fontSize: `${scale}rem` }" v-html="renderedContent" />
    </div>
  </div>
</template>

<style scoped>
.markdown-preview-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-0);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-1);
}

.preview-header-left,
.preview-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

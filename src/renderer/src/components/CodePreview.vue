<script setup lang="ts">
/*
 * 2026-09-23 重建件：CodePreview.vue 随事故丢失且全盘无副本。
 * 契约来源：views/snippets/components/Editor.vue 的 `<CodePreview :snippet="snippet" @close />`
 * 与它的 hasPreviewContent（只把 html / css / javascript 三种块算作可预览）。
 *
 * 预览走 sandbox="allow-scripts" 的 iframe：片段里的脚本要能跑，但**不给同源**，
 * 于是不碰宿主的 cookie / localStorage / window.api。
 */
import { computed } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import type { Snippet } from '@preload/index.d'

const props = defineProps<{ snippet: Snippet }>()
const emit = defineEmits<{ close: [] }>()

const PREVIEWABLE = new Set(['html', 'htm', 'css', 'javascript', 'js', 'typescript', 'ts'])

const blocks = computed(() =>
  (props.snippet?.contents ?? []).filter((c) => PREVIEWABLE.has((c.language || '').toLowerCase()))
)

function valuesOf(langs: string[]): string[] {
  return blocks.value
    .filter((b) => langs.includes((b.language || '').toLowerCase()))
    .map((b) => b.value ?? '')
}

const srcdoc = computed(() => {
  const html = valuesOf(['html', 'htm']).join('\n')
  const css = valuesOf(['css']).join('\n')
  const js = valuesOf(['javascript', 'js', 'typescript', 'ts']).join('\n')
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<style>body{margin:12px;font:13px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}</style>',
    css ? `<style>${css}</style>` : '',
    '</head><body>',
    html,
    js ? `<script>${js.replace(/<\/script>/gi, '<\\/script>')}<\/script>` : '',
    '</body></html>'
  ].join('')
})

const empty = computed(() => blocks.value.length === 0)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex items-center gap-2 border-b border-line-subtle bg-surface-0 px-4 py-2">
      <AppIcon icon="code-s-slash-line" :size="14" class="shrink-0 text-fg-muted" />
      <span class="text-xs font-medium text-fg-primary">代码预览</span>
      <span class="truncate text-[11px] text-fg-faint">
        {{ blocks.map((b) => b.label || b.language).join(' · ') }}
      </span>
      <button
        type="button"
        class="ml-auto shrink-0 rounded-md px-2 py-1 text-xs text-fg-secondary hover:bg-surface-hover"
        @click="emit('close')"
      >
        返回编辑器
      </button>
    </div>

    <div v-if="empty" class="flex flex-1 items-center justify-center text-xs text-fg-faint">
      这条片段没有可预览的 HTML / CSS / JS 代码块
    </div>
    <iframe
      v-else
      :srcdoc="srcdoc"
      class="min-h-0 flex-1 border-0 bg-white"
      sandbox="allow-scripts"
      title="代码片段预览"
    />
  </div>
</template>

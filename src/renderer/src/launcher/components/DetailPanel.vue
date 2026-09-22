<template>
  <!-- 内容已由 sanitizeHtml 白名单过滤（或 escapeHtml 转义），无原始插值 -->
  <!-- eslint-disable-next-line vue/no-v-html -- renderedContent 三条路径均先经 sanitize-html 白名单过滤/HTML 转义 -->
  <div class="detail-panel" v-html="renderedContent" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import sanitizeHtml from '@renderer/utils/sanitize-html-wrapper'

interface Props {
  title?: string
  content: string
  format?: 'text' | 'markdown'
}

const props = withDefaults(defineProps<Props>(), {
  format: 'markdown'
})

const renderedContent = computed(() => {
  if (props.format === 'text') {
    return `<pre>${escapeHtml(props.content)}</pre>`
  }
  try {
    const html = marked.parse(props.content, { async: false }) as string
    // 白名单过滤（与 PluginListPage 一致）：手写正则可被 <svg/onload=、
    // 实体化 javascript: 等形态绕过，胶囊窗持全量 window.api 不能冒险
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'del']),
      allowedAttributes: {
        a: ['href', 'title', 'target', 'rel'],
        img: ['src', 'alt', 'width', 'height'],
        code: ['class'],
        span: ['class']
      },
      transformTags: {
        a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener' })
      }
    })
  } catch {
    return escapeHtml(props.content)
  }
})

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
</script>

<style scoped>
.detail-panel {
  height: 100%;
  overflow-y: auto;
  padding: 16px 18px;
  font-size: 13px;
  line-height: 1.6;

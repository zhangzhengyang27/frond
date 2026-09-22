<script setup lang="ts">
import { ref, computed, watch, h, type VNode } from 'vue'
import { useDark } from '@vueuse/core'
import type { SnippetContent } from '../../../preload/index.d'
import domToImage from 'dom-to-image'
import AppIcon from './AppIcon.vue'

interface Props {
  content: SnippetContent | null
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// useDark() 调用本身承担 dark class 全局同步副作用（样式依赖 html.dark），变量在本组件未使用
const _isDark = useDark()
const jsonData = ref<unknown>(null)
const error = ref<string | null>(null)
const expandedKeys = ref<Set<string>>(new Set())
const visualizerRef = ref<HTMLDivElement | null>(null)

function parseJson(): void {
  if (!props.content?.value) {
    jsonData.value = null
    error.value = null
    return
  }

  try {
    jsonData.value = JSON.parse(props.content.value)
    error.value = null
    // 默认展开前两层
    expandedKeys.value = new Set()
    expandToLevel(jsonData.value, '', 2)
  } catch {
    error.value = '无效的 JSON 格式'
    jsonData.value = null
  }
}

function expandToLevel(obj: unknown, prefix: string, level: number): void {
  if (level <= 0) return

  if (typeof obj === 'object' && obj !== null) {
    const record = obj as Record<string, unknown>
    Object.keys(record).forEach((key) => {
      const fullKey = prefix ? `${prefix}.${key}` : key
      expandedKeys.value.add(fullKey)
      expandToLevel(record[key], fullKey, level - 1)
    })
  }
}

function toggleExpand(key: string): void {
  if (expandedKeys.value.has(key)) {
    expandedKeys.value.delete(key)
    // 同时收起所有子节点
    const keysToRemove: string[] = []
    expandedKeys.value.forEach((k) => {
      if (k.startsWith(key + '.')) {
        keysToRemove.push(k)
      }
    })
    keysToRemove.forEach((k) => expandedKeys.value.delete(k))
  } else {
    expandedKeys.value.add(key)
  }
}

function isExpanded(key: string): boolean {
  return expandedKeys.value.has(key)
}

function getType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function renderValue(value: unknown, key: string = ''): VNode {
  const type = getType(value)

  if (type === 'null') {
    return h('span', { class: 'json-null' }, 'null')
  }

  if (type === 'boolean') {
    return h('span', { class: 'json-boolean' }, String(value))
  }

  if (type === 'number') {
    return h('span', { class: 'json-number' }, String(value))
  }

  if (type === 'string') {
    return h('span', { class: 'json-string' }, `"${value}"`)
  }

  if (type === 'array') {
    const arr = value as unknown[]
    const items: VNode[] = []
    const isExp = isExpanded(key)

    items.push(
      h(
        'span',
        {
          class: 'json-bracket',
          onClick: () => toggleExpand(key)
        },
        isExp ? '▼' : '▶'
      ),
      h('span', { class: 'json-bracket' }, '['),
      h('span', { class: 'json-meta' }, ` ${arr.length} 项`)
    )

    if (isExp) {
      items.push(
        h(
          'div',
          { class: 'json-children' },
          arr.map((item, index) => {
            const itemKey = key ? `${key}.${index}` : String(index)
            return h('div', { class: 'json-item' }, [
              h('span', { class: 'json-key' }, `${index}:`),
              renderValue(item, itemKey)
            ])
          })
        )
      )
    }

    items.push(h('span', { class: 'json-bracket' }, ']'))

    return h('div', { class: 'json-array' }, items)
  }

  if (type === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    const isExp = isExpanded(key)

    const items: VNode[] = []
    items.push(
      h(
        'span',
        {
          class: 'json-bracket',
          onClick: () => toggleExpand(key)
        },
        isExp ? '▼' : '▶'
      ),
      h('span', { class: 'json-bracket' }, '{'),
      h('span', { class: 'json-meta' }, ` ${entries.length} 项`)
    )

    if (isExp) {
      items.push(
        h(
          'div',
          { class: 'json-children' },
          entries.map(([k, v]) => {
            const itemKey = key ? `${key}.${k}` : k
            return h('div', { class: 'json-item' }, [
              h('span', { class: 'json-key' }, `"${k}":`),
              renderValue(v, itemKey)
            ])
          })
        )
      )
    }

    items.push(h('span', { class: 'json-bracket' }, '}'))

    return h('div', { class: 'json-object' }, items)
  }

  return h('span', String(value))
}

const jsonTree = computed(() => {
  if (!jsonData.value) return null
  return renderValue(jsonData.value, 'root')
})

async function onSave(format: 'png' | 'svg'): Promise<void> {
  if (!visualizerRef.value) return

  let data = ''

  if (format === 'png') {
    data = await domToImage.toPng(visualizerRef.value, {
      width: visualizerRef.value.offsetWidth * 2,
      height: visualizerRef.value.offsetHeight * 2,
      style: {
        transform: 'scale(2)',
        transformOrigin: 'top left'
      }
    })
  }

  if (format === 'svg') {
    data = await domToImage.toSvg(visualizerRef.value)
  }

  const a = document.createElement('a')
  a.href = data
  a.download = `json-visualization.${format}`
  a.click()

  URL.revokeObjectURL(data)
}

watch(
  () => props.content,
  () => {
    parseJson()
  },
  { immediate: true }
)
</script>

<template>
  <div class="json-visualizer-container">
    <div class="visualizer-header">
      <div class="visualizer-header-right">
        <button class="visualizer-btn" title="保存为 PNG" @click="onSave('png')">
          <AppIcon icon="ri-download-line" />
          <span>保存 PNG</span>
        </button>
        <button class="visualizer-btn" title="保存为 SVG" @click="onSave('svg')">
          <AppIcon icon="ri-download-line" />
          <span>保存 SVG</span>
        </button>
        <button
          class="visualizer-btn visualizer-btn-close"
          title="返回编辑器"
          @click="emit('close')"
        >
          <AppIcon icon="ri-close-line" />
          <span>关闭</span>
        </button>
      </div>
    </div>
    <div ref="visualizerRef" class="visualizer-content">
      <div v-if="error" class="json-error">{{ error }}</div>
      <component :is="jsonTree" v-else-if="jsonTree" class="json-tree" />
      <div v-else class="json-empty">暂无数据</div>
    </div>
  </div>
</template>

<style scoped>
.json-visualizer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-0);
  /* JSON 语法色：亮暗两套，跟随主题（v4） */
  --json-key: #881391;
  --json-string: #0b6125;
  --json-number: #1c00cf;
  --json-null: #808080;
  --json-meta: #808080;
}

html.dark .json-visualizer-container {
  --json-key: #ce9ce8;
  --json-string: #7ec97e;
  --json-number: #79b8ff;
  --json-null: #8a909c;
  --json-meta: #8a909c;
}

.visualizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-1);
}

.visualizer-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.visualizer-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  background: var(--surface-1);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.visualizer-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.visualizer-btn-close {
  margin-left: 8px;
  border-left: 1px solid var(--border-default);
  padding-left: 12px;
}

.visualizer-btn-close:hover {
  background: rgba(255, 59, 48, 0.08);
  color: var(--text-danger);
}

.visualizer-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 14px;
  line-height: 1.6;
}

.json-error {
  color: var(--text-danger);
  padding: 20px;
  background: rgba(255, 59, 48, 0.1);
  border-radius: 4px;
}

.json-empty {
  color: var(--text-muted);
  padding: 20px;
  text-align: center;
}

:deep(.json-tree) {
  color: var(--text-primary);
}

:deep(.json-bracket) {
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  margin-right: 4px;
}

:deep(.json-bracket:hover) {
  color: var(--text-brand);
}

:deep(.json-key) {
  color: var(--json-key);
  margin-right: 8px;
}

:deep(.json-string) {
  color: var(--json-string);
}

:deep(.json-number) {
  color: var(--json-number);
}

:deep(.json-boolean) {
  color: var(--json-string);
}

:deep(.json-null) {
  color: var(--json-null);
}

:deep(.json-meta) {
  color: var(--json-meta);
  font-size: 12px;
  margin-left: 4px;
}

:deep(.json-children) {
  margin-left: 20px;
  margin-top: 4px;
}

:deep(.json-item) {
  margin: 4px 0;
}

:deep(.json-object),
:deep(.json-array) {
  display: inline-block;
  vertical-align: top;
}
</style>

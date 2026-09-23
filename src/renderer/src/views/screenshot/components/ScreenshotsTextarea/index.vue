<template>
  <Teleport to="body">
    <textarea
      ref="textareaRef"
      class="screenshots-textarea"
      :style="{
        color,
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: `${maxWidth}px`,
        maxHeight: `${maxHeight}px`,
        fontSize: `${size}px`,
        lineHeight: `${size}px`,
        transform: `translate(${x}px, ${y}px)`
      }"
      :value="value"
      @input="handleChange"
      @blur="handleBlur"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import calculateNodeSize from './calculateNodeSize'

const props = defineProps<{
  x: number
  y: number
  maxWidth: number
  maxHeight: number
  size: number
  color: string
  value: string
}>()

const emit = defineEmits<{
  change: [value: string]
  blur: []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const width = ref(0)
const height = ref(0)

const handleChange = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  emit('change', target.value)
}

const handleBlur = () => {
  emit('blur')
}

watch(
  () => [props.value, props.maxWidth, props.maxHeight],
  () => {
    if (!textareaRef.value) {
      return
    }
    const { width: w, height: h } = calculateNodeSize(
      textareaRef.value,
      props.value,
      props.maxWidth,
      props.maxHeight
    )
    width.value = w
    height.value = h
  },
  { immediate: true }
)

onMounted(() => {
  nextTick(() => {
    textareaRef.value?.focus()
  })
})
</script>

<style scoped>
.screenshots-textarea {
  box-sizing: border-box;
  position: absolute;
  left: 0;
  top: 0;
  margin: 0;
  padding: 0;
  background-color: transparent;
  border: 2px solid var(--shot-accent);
  resize: none;
  outline: none;
  white-space: nowrap;
  word-break: break-all;
  overflow: hidden;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans',
    sans-serif;
  text-align: left;
  z-index: 10001;
}
</style>

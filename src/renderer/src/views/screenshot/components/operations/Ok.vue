<template>
  <ScreenshotsButton title="确定" icon="icon-ok" @click="handleClick" />
</template>

<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import { useStore, getValue } from '../../composables/useScreenshotsContext'
import composeImage from '../../utils/composeImage'
import type { Bounds } from '../../types'
import ScreenshotsButton from '../ScreenshotsButton.vue'

const store = useStore()
const image = computed(() => getValue(store.image))
const width = computed(() => store.width)
const height = computed(() => store.height)
const scaleFactor = computed(() => store.scaleFactor)
const history = computed(() => getValue(store.history))
const bounds = computed(() => getValue(store.bounds))

const emit = defineEmits<{
  ok: [blob: Blob | null, bounds: Bounds]
}>()

// Bug#9: 保存 setTimeout 引用以便组件卸载时清除
let composeTimer: ReturnType<typeof setTimeout> | null = null

const handleClick = async (): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyDispatcher = (store as any).dispatcher?.setHistory
  if (historyDispatcher) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    historyDispatcher((prev: any) => {
      const newHistory = { ...prev }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newHistory.stack.forEach((item: any) => {
        if (item.type === 1) {
          item.isSelected = false
        }
      })
      return newHistory
    })
  }

  // Bug#9: 明确延迟时间 + try-catch 错误处理
  composeTimer = setTimeout(async () => {
    try {
      if (!image.value || !bounds.value) {
        return
      }
      const blob = await composeImage({
        image: image.value,
        width: width.value,
        height: height.value,
        history: history.value,
        scaleFactor: scaleFactor.value,
        bounds: bounds.value
      })
      emit('ok', blob, bounds.value)
    } catch (error) {
      console.error('[Ok] 生成截图失败:', error)
    }
  }, 50)
}

// Bug#9: 组件卸载时清除定时器
onUnmounted(() => {
  if (composeTimer) {
    clearTimeout(composeTimer)
    composeTimer = null
  }
})
</script>

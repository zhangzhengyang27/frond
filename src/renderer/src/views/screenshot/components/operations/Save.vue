<template>
  <ScreenshotsButton title="保存" icon="icon-save" @click="handleClick" />
</template>

<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import { useStore, useDispatcher, getValue } from '../../composables/useScreenshotsContext'
import composeImage from '../../utils/composeImage'
import { HistoryItemType, type Bounds } from '../../types'
import ScreenshotsButton from '../ScreenshotsButton.vue'

const store = useStore()
const dispatcher = useDispatcher()
const image = computed(() => getValue(store.image))
const width = computed(() => store.width)
const height = computed(() => store.height)
const scaleFactor = computed(() => store.scaleFactor)
const history = computed(() => getValue(store.history))
const bounds = computed(() => getValue(store.bounds))

const emit = defineEmits<{
  save: [blob: Blob | null, bounds: Bounds]
}>()

// Bug#9: 保存 setTimeout 引用以便组件卸载时清除
let composeTimer: ReturnType<typeof setTimeout> | null = null

const handleClick = async (): Promise<void> => {
  // 落盘前取消所有图形的选中态，否则存进去的图带着控制点
  dispatcher.setHistory?.((prev) => {
    prev.stack.forEach((item) => {
      if (item.type === HistoryItemType.Source) {
        item.isSelected = false
      }
    })
    return { ...prev }
  })

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
      emit('save', blob, bounds.value)
    } catch (error) {
      console.error('[Save] 生成截图失败:', error)
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

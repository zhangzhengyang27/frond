<template>
  <div class="flex h-full flex-col p-4">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl font-semibold text-white/90 m-0">标记</h2>
      <div class="flex items-center gap-2">
        <button
          v-if="markers.length > 0"
          class="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-white/60 hover:text-white/90 hover:bg-white/[0.06] rounded-lg transition-colors"
          title="导出 CSV"
          @click="handleExportCSV"
        >
          <AppIcon icon="ri-download-line" :size="16" />
          <span>导出</span>
        </button>
        <button
          v-if="markers.length > 0"
          class="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          title="清空所有标记"
          @click="handleClearAll"
        >
          <AppIcon icon="ri-delete-bin-line" :size="16" />
          <span>清空</span>
        </button>
      </div>
    </div>

    <!-- 时间轴上的标记点 -->
    <div
      v-if="duration > 0"
      class="relative w-full h-16 mb-5 bg-white/[0.04] rounded-xl overflow-hidden border border-white/10"
    >
      <!-- 时间轴背景 -->
      <div class="absolute inset-0 flex items-center">
        <div class="w-full h-1 bg-gray-200/60 rounded-full"></div>
      </div>

      <!-- 标记点 -->
      <div
        v-for="marker in markers"
        :key="marker.id"
        class="absolute top-0 bottom-0 flex flex-col items-center cursor-pointer group z-10"
        :style="{ left: `${(marker.timestamp / duration) * 100}%` }"
        @click="handleJumpToMarker(marker)"
      >
        <!-- 竖线 -->
        <div
          class="w-0.5 h-full bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-60 group-hover:opacity-100 transition-opacity"
          :style="{
            background: `linear-gradient(to bottom, transparent, ${marker.color || 'var(--color-marker-default)'}, transparent)`,
            opacity: '0.6'
          }"
        ></div>

        <!-- 标记点图标 -->
        <div
          class="absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 bg-white/[0.06] rounded-full shadow-lg border-2 transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl group-hover:-translate-y-1/2"
          :style="{
            borderColor: marker.color || 'var(--color-marker-default)',
            boxShadow: `0 4px 12px ${marker.color || 'var(--color-marker-default)'}40, 0 0 0 1px ${marker.color || 'var(--color-marker-default)'}20`
          }"
        >
          <!-- 内部图标 -->
          <div class="relative">
            <div
              class="w-3 h-3 rounded-full transition-all duration-200 group-hover:scale-110"
              :style="{ backgroundColor: marker.color || 'var(--color-marker-default)' }"
            ></div>
            <!-- 光晕效果 -->
            <div
              class="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 animate-ping"
              :style="{ backgroundColor: marker.color || 'var(--color-marker-default)' }"
            ></div>
          </div>
        </div>

        <!-- 悬停提示 -->
        <div
          class="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 bg-gray-900/95 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-20 shadow-lg backdrop-blur-sm"
          style="transform: translateX(-50%) translateY(0)"
        >
          <div class="font-medium">{{ marker.label }}</div>
          <div class="text-gray-300 text-[10px] mt-0.5">{{ formatTime(marker.timestamp) }}</div>
          <!-- 小三角 -->
          <div
            class="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-900/95 rotate-45"
          ></div>
        </div>
      </div>
    </div>

    <!-- 标记列表 -->
    <div class="flex-1 overflow-y-auto min-h-[200px] max-h-[400px]">
      <div
        v-if="markers.length === 0"
        class="flex flex-col items-center justify-center h-full text-gray-400"
      >
        <AppIcon icon="ri-bookmark-line" :size="48" />
        <p class="mt-4 text-sm">暂无标记</p>
        <p class="mt-2 text-xs text-gray-400">在录制过程中点击"添加标记"按钮添加标记点</p>
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="marker in markers"
          :key="marker.id"
          class="flex items-center gap-3 p-4 bg-white/[0.06] border border-white/10 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
        >
          <!-- 标记点指示器 -->
          <div class="relative flex-shrink-0">
            <div
              class="w-4 h-4 rounded-full flex items-center justify-center"
              :style="{ backgroundColor: `${marker.color || 'var(--color-marker-default)'}20` }"
            >
              <div
                class="w-2.5 h-2.5 rounded-full"
                :style="{ backgroundColor: marker.color || 'var(--color-marker-default)' }"
              ></div>
            </div>
            <!-- 连接线（仅在非最后一个标记时显示） -->
            <div
              v-if="markers.indexOf(marker) < markers.length - 1"
              class="absolute left-1/2 top-4 w-0.5 h-6 -translate-x-1/2 opacity-30"
              :style="{ backgroundColor: marker.color || 'var(--color-marker-default)' }"
            ></div>
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <div class="font-mono text-sm font-semibold text-white/90">
                {{ formatTime(marker.timestamp) }}
              </div>
              <div
                class="px-2 py-0.5 text-xs font-medium rounded-full"
                :style="{
                  backgroundColor: `${marker.color || 'var(--color-marker-default)'}15`,
                  color: marker.color || 'var(--color-marker-default)'
                }"
              >
                {{ marker.label }}
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <!-- 录制中无可跳转目标（实时流），不渲染跳转入口（B57-10b） -->
            <button
              v-if="!isRecording"
              class="p-2 text-white/45 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110"
              title="跳转到标记时间点"
              @click="handleJumpToMarker(marker)"
            >
              <AppIcon icon="ri-play-line" :size="16" />
            </button>
            <button
              class="p-2 text-white/45 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110"
              title="编辑标记"
              @click="handleEditMarker(marker)"
            >
              <AppIcon icon="ri-edit-line" :size="16" />
            </button>
            <button
              class="p-2 text-white/45 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110"
              title="删除标记"
              @click="handleRemoveMarker(marker.id)"
            >
              <AppIcon icon="ri-delete-bin-line" :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加标记按钮 -->
    <button
      v-if="isRecording"
      class="mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-primary text-white border-none rounded-lg font-semibold cursor-pointer transition-all duration-200 text-[15px] shadow-md hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,122,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:transform-none"
      :disabled="!isRecording || loading"
      @click="showAddMarkerDialog = true"
    >
      <AppIcon icon="ri-bookmark-add-line" />
      <span>添加标记</span>
      <span class="text-xs opacity-75">(快捷键: M)</span>
    </button>

    <!-- 添加/编辑标记对话框 -->
    <UModal
      :model-value="showAddMarkerDialog || showEditMarkerDialog"
      :title="editingMarker ? '编辑标记' : '添加标记'"
      size="sm"
      @update:model-value="closeMarkerDialog"
    >
      <input
        ref="markerLabelInput"
        v-model="markerLabel"
        type="text"
        class="w-full px-3 py-2.5 border border-gray-300 rounded text-sm mb-4 box-border focus:outline-none focus:border-blue-500"
        placeholder="请输入标记名称（可选）"
        @keyup.enter="confirmSaveMarker"
      />
      <template #footer>
        <UButton variant="ghost" @click="closeMarkerDialog">取消</UButton>
        <UButton variant="primary" @click="confirmSaveMarker">确定</UButton>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UModal from '@components/ui/UModal.vue'
import UButton from '@components/ui/UButton.vue'
import { confirm } from '@composables/useConfirm'
import { useToast } from '@composables/useToast'
import { useMarkers } from '@composables/useMarkers'
import type { Marker } from '@preload/index.d'

interface Props {
  recordingId: string | null
  isRecording: boolean
  recordingTime: number
  duration?: number // 视频总时长（用于回放时显示时间轴）
  videoRef?: HTMLVideoElement | null // 视频元素引用（用于回放时跳转）
}

const props = withDefaults(defineProps<Props>(), {
  duration: 0
})

const emit = defineEmits<{
  jumpToMarker: [timestamp: number]
  markerAdded: [marker: Marker]
}>()

// 使用 computed 来创建响应式的 recordingId ref
const recordingIdRef = computed(() => props.recordingId)
const {
  markers,
  loading,
  addMarker,
  removeMarker,
  updateMarker,
  clearMarkers,
  exportToCSV,
  formatTime,
  loadMarkers
} = useMarkers(recordingIdRef)

// 对话框状态
const showAddMarkerDialog = ref(false)
const showEditMarkerDialog = ref(false)
const markerLabel = ref('标记')
const markerLabelInput = ref<HTMLInputElement | null>(null)
const editingMarker = ref<Marker | null>(null)

// 监听 recordingId 变化，重新加载标记
watch(
  () => props.recordingId,
  async (newId) => {
    if (newId) {
      await loadMarkers(newId)
    } else {
      // 清空标记列表 - 通过重新加载空列表来实现
      await loadMarkers('')
    }
  },
  { immediate: true }
)

// 监听对话框显示，自动聚焦输入框
watch([showAddMarkerDialog, showEditMarkerDialog], async ([showAdd, showEdit]) => {
  if (showAdd || showEdit) {
    if (!editingMarker.value) {
      markerLabel.value = '标记'
    }
    await nextTick()
    markerLabelInput.value?.focus()
    markerLabelInput.value?.select()
  }
})

// 关闭标记对话框
const closeMarkerDialog = (): void => {
  showAddMarkerDialog.value = false
  showEditMarkerDialog.value = false
  editingMarker.value = null
  markerLabel.value = '标记'
}

// 确认保存标记（添加或编辑）
const confirmSaveMarker = async (): Promise<void> => {
  if (editingMarker.value) {
    // 编辑模式
    if (!props.recordingId) {
      return
    }
    const label = markerLabel.value.trim() || '标记'
    const updated = await updateMarker(editingMarker.value.id, { label })
    if (updated) {
      emit('markerAdded', updated)
    }
  } else {
    // 添加模式
    if (!props.isRecording || !props.recordingId) {
      return
    }
    const label = markerLabel.value.trim() || '标记'
    const marker = await addMarker(props.recordingTime, label)
    if (marker) {
      emit('markerAdded', marker)
    }
  }
  closeMarkerDialog()
}

// 添加标记（打开对话框）
const handleAddMarker = (): void => {
  if (!props.isRecording || !props.recordingId) {
    return
  }
  editingMarker.value = null
  markerLabel.value = '标记'
  showAddMarkerDialog.value = true
}

// 编辑标记（打开对话框）
const handleEditMarker = (marker: Marker): void => {
  editingMarker.value = marker
  markerLabel.value = marker.label
  showEditMarkerDialog.value = true
}

// 删除标记（useConfirm 二次确认后执行）
const handleRemoveMarker = async (markerId: string): Promise<void> => {
  const ok = await confirm({ title: '删除这个标记？', confirmText: '删除', danger: true })
  if (!ok) return
  await removeMarker(markerId)
}

// 跳转到标记时间点
const toast = useToast()
const handleJumpToMarker = (marker: Marker): void => {
  // 如果有视频元素且不在录制状态（回放模式），直接跳转
  if (props.videoRef && !props.isRecording && props.duration > 0) {
    if (marker.timestamp >= 0 && marker.timestamp <= props.duration) {
      // 使用事件通知父组件进行跳转，而不是直接修改 prop
      emit('jumpToMarker', marker.timestamp)
      // 如果父组件传递了 videoRef，也可以直接操作
      const video = props.videoRef
      if (video) {
        video.currentTime = marker.timestamp
        // 如果视频暂停，自动播放
        if (video.paused) {
          video.play().catch((error) => {
            console.error('播放视频失败:', error)
          })
        }
      }
      return
    }
  }
  // 无视频可跳（录制页场景）：旧实现 emit 给只 console.log 的父 handler，
  // 点击无任何可见结果（B57-10b）。给出指引且不再发无效事件
  toast.warning('录制结束后可在回放页跳转到标记')
}

// 清空所有标记（useConfirm 二次确认后执行）
const handleClearAll = async (): Promise<void> => {
  const ok = await confirm({
    title: '清空所有标记？',
    message: '此操作不可撤销。',
    confirmText: '清空',
    danger: true
  })
  if (!ok) return
  await clearMarkers()
}

// 导出 CSV
const handleExportCSV = async (): Promise<void> => {
  const csv = await exportToCSV()
  if (!csv) {
    // 使用简单的通知代替 alert
    console.error('导出失败')
    return
  }

  // 创建下载链接
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `markers-${Date.now()}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 快捷键支持：按 M 键添加标记
const handleKeyPress = (event: KeyboardEvent): void => {
  // 只在录制时且焦点不在输入框时响应
  if (
    props.isRecording &&
    event.key.toLowerCase() === 'm' &&
    // B57-19：带修饰键的 M（⌘M 最小化 / ⌃M / ⌥M）不是添加标记，劫持会破坏系统操作
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !(event.target instanceof HTMLInputElement) &&
    !(event.target instanceof HTMLTextAreaElement)
  ) {
    event.preventDefault()
    handleAddMarker()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyPress)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyPress)
})
</script>

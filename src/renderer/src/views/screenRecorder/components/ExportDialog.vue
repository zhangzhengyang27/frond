<script setup lang="ts">
import { ref } from 'vue'
import UModal from '@components/ui/UModal.vue'
import UButton from '@components/ui/UButton.vue'
import TransitionSelector from '@views/screenRecorder/components/TransitionSelector.vue'
import { useToast } from '@composables/useToast'
import type { Clip, ExportOptions } from '@composables/useVideoClip'

interface Props {
  clips: Clip[]
  exporting?: boolean
  exportProgress?: {
    percent: number
    currentClip: number
    totalClips: number
    message: string
  } | null
}

withDefaults(defineProps<Props>(), {
  exporting: false,
  exportProgress: null
})

const emit = defineEmits<{
  close: []
  export: [options: ExportOptions]
}>()

const exportOptions = ref<Omit<ExportOptions, 'clips'>>({
  resolution: 1080,
  fps: 30,
  transition: 'cut',
  outputPath: ''
})

const toast = useToast()

// 选择片头
const handleSelectIntro = async (): Promise<void> => {
  const path = await window.api.clip.selectVideoFile()
  if (path) {
    exportOptions.value.intro = path
  }
}

// 选择片尾
const handleSelectOutro = async (): Promise<void> => {
  const path = await window.api.clip.selectVideoFile()
  if (path) {
    exportOptions.value.outro = path
  }
}

// 选择背景音乐
const handleSelectMusic = async (): Promise<void> => {
  const path = await window.api.clip.selectAudioFile()
  if (path) {
    exportOptions.value.backgroundMusic = {
      path,
      volume: 0.5
    }
  }
}

// 处理背景音乐路径变化
const handleBackgroundMusicPathChange = (value: string): void => {
  if (value) {
    if (!exportOptions.value.backgroundMusic) {
      exportOptions.value.backgroundMusic = {
        path: value,
        volume: 0.5
      }
    } else {
      exportOptions.value.backgroundMusic.path = value
    }
  } else {
    exportOptions.value.backgroundMusic = undefined
  }
}

// 选择输出路径
const handleSelectOutputPath = async (): Promise<void> => {
  const path = await window.api.clip.selectSavePath()
  if (path) {
    exportOptions.value.outputPath = path
  }
}

// 导出
const handleExport = (): void => {
  if (!exportOptions.value.outputPath) {
    toast.warning('请选择保存路径')
    return
  }
  emit('export', exportOptions.value as ExportOptions)
}
</script>

<!--
  2026-09-23 重建：这个 SFC 的整个 <template> 块随事故丢失（盘上只剩 script），
  以下按 script 里既有的 props / handler 反推：每个 handleSelect* 都对应一个按钮，
  handleBackgroundMusicPathChange 对应一个可手填的路径输入框，exporting / exportProgress
  对应底部进度条。布局沿用 ClipEditor 的弹窗壳（遮罩 + 卡片）。
-->
<template>
  <UModal :model-value="true" title="导出剪辑" size="md" @update:model-value="emit('close')">
    <p class="mb-4 text-xs text-fg-muted">{{ clips.length }} 个片段</p>
    <div class="space-y-4">
        <div class="flex items-center gap-6">
          <label class="flex items-center gap-2 text-xs text-fg-muted">
            分辨率
            <select
              v-model.number="exportOptions.resolution"
              class="rounded-md border border-line-subtle bg-surface-1 px-2 py-1 text-xs text-fg-primary"
            >
              <option :value="720">1280 × 720</option>
              <option :value="1080">1920 × 1080</option>
              <option :value="1440">2560 × 1440</option>
              <option :value="2160">3840 × 2160</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-xs text-fg-muted">
            帧率
            <select
              v-model.number="exportOptions.fps"
              class="rounded-md border border-line-subtle bg-surface-1 px-2 py-1 text-xs text-fg-primary"
            >
              <option :value="30">30 fps</option>
              <option :value="60">60 fps</option>
            </select>
          </label>
        </div>

        <TransitionSelector v-model="exportOptions.transition" />

        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            class="rounded-md border border-line-subtle px-3 py-2 text-xs text-fg-secondary hover:bg-surface-hover"
            @click="handleSelectIntro"
          >
            {{ exportOptions.intro ? '换片头' : '选片头' }}
          </button>
          <button
            type="button"
            class="rounded-md border border-line-subtle px-3 py-2 text-xs text-fg-secondary hover:bg-surface-hover"
            @click="handleSelectOutro"
          >
            {{ exportOptions.outro ? '换片尾' : '选片尾' }}
          </button>
          <button
            type="button"
            class="rounded-md border border-line-subtle px-3 py-2 text-xs text-fg-secondary hover:bg-surface-hover"
            @click="handleSelectMusic"
          >
            {{ exportOptions.backgroundMusic ? '换背景音乐' : '选背景音乐' }}
          </button>
        </div>

        <p v-if="exportOptions.intro" class="truncate text-[11px] text-fg-tertiary">
          片头：{{ exportOptions.intro }}
        </p>
        <p v-if="exportOptions.outro" class="truncate text-[11px] text-fg-tertiary">
          片尾：{{ exportOptions.outro }}
        </p>

        <div class="flex items-center gap-2">
          <input
            :value="exportOptions.backgroundMusic?.path ?? ''"
            type="text"
            class="min-w-0 flex-1 rounded-md border border-line-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-fg-primary outline-none focus:border-brand-500/40"
            placeholder="背景音乐路径（留空则不加）"
            spellcheck="false"
            @change="
              (e) => handleBackgroundMusicPathChange((e.target as HTMLInputElement).value.trim())
            "
          />
          <label
            v-if="exportOptions.backgroundMusic"
            class="flex shrink-0 items-center gap-1.5 text-[11px] text-fg-muted"
          >
            音量
            <input
              v-model.number="exportOptions.backgroundMusic.volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="w-20"
            />
            {{ Math.round((exportOptions.backgroundMusic.volume ?? 0) * 100) }}%
          </label>
        </div>

        <!-- B27（2026-09-28 审计）：main 的 clip:exportClips 只认 selectSavePath
             对话框签发的路径（白名单），重建模板的手填框点导出必被拒——去掉手填，
             路径只能来自「浏览…」 -->
        <div class="flex items-center gap-2">
          <span
            class="min-w-0 flex-1 truncate rounded-md border border-line-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-fg-secondary"
            :title="exportOptions.outputPath || undefined"
          >
            {{ exportOptions.outputPath || '未选择输出位置（点「浏览…」选择）' }}
          </span>
          <button
            type="button"
            class="shrink-0 rounded-md border border-line-subtle px-3 py-1.5 text-xs text-fg-secondary hover:bg-surface-hover"
            @click="handleSelectOutputPath"
          >
            浏览…
          </button>
        </div>

        <div v-if="exporting" class="space-y-1">
          <div class="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              class="h-full rounded-full bg-brand-500 transition-[width]"
              :style="{ width: `${Math.min(100, Math.max(0, exportProgress?.percent ?? 0))}%` }"
            />
          </div>
          <p class="text-[11px] text-fg-muted">
            {{ exportProgress?.message ?? '准备中…' }}
            <span v-if="exportProgress && exportProgress.totalClips > 1">
              （第 {{ exportProgress.currentClip }} / {{ exportProgress.totalClips }} 段）
            </span>
          </p>
        </div>
      </div>

      <template #footer>
        <UButton variant="ghost" :disabled="exporting" @click="emit('close')">取消</UButton>
        <UButton
          variant="primary"
          :disabled="exporting || clips.length === 0"
          @click="handleExport"
        >
          {{ exporting ? '导出中…' : '开始导出' }}
        </UButton>
      </template>
  </UModal>
</template>

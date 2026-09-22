
<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import TransitionSelector from '@views/screenRecorder/components/TransitionSelector.vue'
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
    alert('请选择保存路径')
    return
  }
  emit('export', exportOptions.value as ExportOptions)
}
</script>

<script setup lang="ts">
/**
 * ClipPage · 剪辑页（screenRecorder 路由页，主窗口内沉浸式覆盖层）
 * 2026-09-23 重建：原文件被截断，仅存脚本尾 9 行，头部与模板为重建
 */
// 待核：三个 prop 名由 Layout.vue 传给 router-view 的属性反推
import { useRouter } from 'vue-router'
import ClipEditor from '@views/screenRecorder/components/ClipEditor.vue'

interface Props {
  playbackVideoPath: string | null
  playbackRecordingId: string | null
  playbackVideoInfo: {
    filename: string
    duration: number
    filePath: string
  } | null
}

defineProps<Props>()

const router = useRouter()

const handleGoBack = (): void => {
  // 剪辑的入口在历史页（handleClipVideo），返回应回到来源页
  router.push({ name: 'screenRecorderHistory' })
}
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <ClipEditor
      :video-id="playbackRecordingId ?? undefined"
      :video-path="playbackVideoPath ?? ''"
      @go-back="handleGoBack"
    />
  </div>
</template>

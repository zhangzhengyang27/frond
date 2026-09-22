<template>
  <div class="flex-1 overflow-hidden">
    <PlaybackPanel
      :video-path="playbackVideoPath"
      :recording-id="playbackRecordingId"
      :video-info="playbackVideoInfo"
      @close="handleClose"
    />
  </div>
</template>

<script setup lang="ts">
import PlaybackPanel from '@views/screenRecorder/components/PlaybackPanel.vue'

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

const emit = defineEmits<{
  closePlayback: []
}>()

const handleClose = (): void => {
  emit('closePlayback')
}
</script>

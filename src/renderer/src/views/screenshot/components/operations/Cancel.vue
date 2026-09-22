<template>
  <ScreenshotsButton title="取消" icon="icon-cancel" @click="handleClick" />
</template>

<script setup lang="ts">
import ScreenshotsButton from '../ScreenshotsButton.vue'

const emit = defineEmits<{
  cancel: []
}>()

const handleClick = (): void => {
  emit('cancel')
}
</script>

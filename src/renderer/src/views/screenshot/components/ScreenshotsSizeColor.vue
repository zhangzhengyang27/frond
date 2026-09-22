<template>
  <div class="screenshots-sizecolor">
    <ScreenshotsSize :value="size" @change="handleSizeChange" />
    <ScreenshotsColor :value="color" @change="handleColorChange" />
  </div>
</template>

<script setup lang="ts">
import ScreenshotsSize from './ScreenshotsSize.vue'
import ScreenshotsColor from './ScreenshotsColor.vue'

defineProps<{
  size: number
  color: string
}>()

const emit = defineEmits<{
  sizeChange: [value: number]
  colorChange: [value: string]
}>()

const handleSizeChange = (value: number): void => {
  emit('sizeChange', value)
}

const handleColorChange = (value: string): void => {
  emit('colorChange', value)
}
</script>

<style scoped>
.screenshots-sizecolor {
  display: flex;
  align-items: center;
  padding: 3px;
  background-color: var(--shot-panel);
  border-radius: 2px;
  border: 1px solid var(--shot-border);
}
</style>

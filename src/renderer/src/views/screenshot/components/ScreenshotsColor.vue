<template>
  <div class="screenshots-color">
    <div
      v-for="color in colors"
      :key="color"
      :class="['screenshots-color-item', { 'screenshots-color-active': color === value }]"
      :style="{ backgroundColor: color }"
      @click="handleChange(color)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string
}>()

const emit = defineEmits<{
  change: [value: string]
}>()

const colors = ['#ee5126', '#fceb4d', '#90e746', '#51c0fa', '#7a7a7a', '#ffffff']

const handleChange = (color: string): void => {
  emit('change', color)
}
</script>

<style scoped>
.screenshots-color {
  height: 28px;
  padding: 0 2px;
  display: flex;
  align-items: center;
}

.screenshots-color-item {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  margin: 0 4px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  transition:
    transform 0.12s,
    box-shadow 0.15s;
}

.screenshots-color-item:hover {
  transform: scale(1.15);
}

.screenshots-color-item:active {
  transform: scale(0.95);
}

.screenshots-color-active {
  box-shadow:
    0 0 0 2px var(--shot-glass-strong),
    0 0 0 4px var(--shot-accent);
}

.screenshots-color-active:hover {
  transform: scale(1.15);
}
</style>

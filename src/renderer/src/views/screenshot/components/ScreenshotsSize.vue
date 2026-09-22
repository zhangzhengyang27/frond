<template>
  <div class="screenshots-size">
    <div
      v-for="size in sizes"
      :key="size"
      :class="['screenshots-size-item', { 'screenshots-size-active': size === value }]"
      @click="handleChange(size)"
    >
      <div
        class="screenshots-size-pointer"
        :style="{
          width: `${size * 1.8}px`,
          height: `${size * 1.8}px`
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: number
}>()

const emit = defineEmits<{
  change: [value: number]
}>()

const sizes = [3, 6, 9]

const handleChange = (size: number): void => {
  emit('change', size)
}
</script>

<style scoped>
.screenshots-size {
  height: 28px;
  padding: 0 2px;
  display: flex;
  align-items: center;
}

.screenshots-size-item {
  width: 24px;
  height: 24px;
  position: relative;
  margin: 0 3px;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.15s;
}

.screenshots-size-item:hover {
  background-color: rgba(255, 255, 255, 0.09);
}

.screenshots-size-pointer {
  background-color: var(--shot-text-dim);
  border-radius: 50%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: background-color 0.15s;
}

.screenshots-size-active .screenshots-size-pointer {
  background-color: var(--shot-accent);
  box-shadow: 0 0 6px var(--shot-accent-soft);
}
</style>

<template>
  <button class="pin-button" title="贴图" @click="handlePin">
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
    </svg>
  </button>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  pin: []
}>()

const handlePin = (): void => {
  emit('pin')
}
</script>

<style scoped>
.pin-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  color: var(--shot-text-muted);
  transition: all 0.2s;
}

.pin-button:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--shot-accent);
}

.pin-button svg {
  flex-shrink: 0;
}
</style>

<template>
  <button class="ocr-button" title="文字识别" @click="$emit('ocr')">
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z" />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineEmits<{
  ocr: []
}>()
</script>

<style scoped>
.ocr-button {
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

.ocr-button:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--shot-accent);
}

.ocr-button svg {
  flex-shrink: 0;
}
</style>

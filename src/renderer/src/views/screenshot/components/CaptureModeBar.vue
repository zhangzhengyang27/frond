<template>
  <div class="capture-mode-bar">
    <button
      class="mode-btn"
      :class="{ active: mode === 'screen' }"
      @click="$emit('mode-change', 'screen')"
    >
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path
          fill="currentColor"
          d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"
        />
      </svg>
      <span>屏幕</span>
    </button>
    <button
      class="mode-btn"
      :class="{ active: mode === 'window' }"
      @click="$emit('mode-change', 'window')"
    >
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path
          fill="currentColor"
          d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h6v2H7v-2z"
        />
      </svg>
      <span>窗口</span>
    </button>
    <div class="separator"></div>
    <button class="mode-btn delay-btn" @click="$emit('delay-screenshot')">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path
          fill="currentColor"
          d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
        />
      </svg>
      <span>延时</span>
    </button>
    <button class="mode-btn history-btn" @click="$emit('toggle-history')">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path
          fill="currentColor"
          d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"
        />
      </svg>
      <span>历史</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  mode: 'screen' | 'window'
}>()

defineEmits<{
  'mode-change': [mode: 'screen' | 'window']
  'delay-screenshot': []
  'toggle-history': []
}>()
</script>

<style scoped>
.capture-mode-bar {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--shot-glass);
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border: 1px solid var(--shot-hairline);
  border-radius: 10px;
  box-shadow: var(--shot-shadow);
  z-index: 9999;
  animation: mode-bar-in 0.2s ease-out;
}

@keyframes mode-bar-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--shot-text-dim);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  color: var(--shot-text);
  background: rgba(255, 255, 255, 0.1);
}

.mode-btn.active {
  color: var(--shot-accent);
  background: var(--shot-accent-soft);
}

.mode-btn svg {
  flex-shrink: 0;
}

.separator {
  width: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 4px 4px;
}

.delay-btn {
  color: var(--color-warning);
}

.delay-btn:hover {
  background: rgba(240, 165, 0, 0.2);
}

.history-btn {
  color: var(--color-info);
}

.history-btn:hover {
  background: rgba(79, 195, 247, 0.2);
}
</style>

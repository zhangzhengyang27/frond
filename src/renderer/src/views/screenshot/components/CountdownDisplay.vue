<template>
  <div class="countdown-overlay">
    <div class="countdown-display">
      <div class="countdown-number">{{ seconds }}</div>
      <div class="countdown-hint">准备截取屏幕...</div>
      <button class="cancel-btn" @click="$emit('cancel')">取消</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  seconds: number
}>()

defineEmits<{
  cancel: []
}>()
</script>

<style scoped>
.countdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--shot-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
}

.countdown-display {
  text-align: center;
}

.countdown-number {
  font-size: 120px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.countdown-hint {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 16px;
}

.cancel-btn {
  margin-top: 32px;
  padding: 10px 24px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>

<template>
  <div class="delay-overlay">
    <div class="delay-panel">
      <div class="delay-title">延时截图</div>
      <div class="delay-options">
        <button
          v-for="sec in options"
          :key="sec"
          class="delay-option"
          :class="{ active: selected === sec && !useCustom }"
          @click="select(sec)"
        >
          {{ sec }}秒
        </button>
      </div>
      <div class="delay-custom">
        <label class="custom-label">自定义：</label>
        <input
          v-model.number="customSeconds"
          type="number"
          class="custom-input"
          :class="{ active: useCustom }"
          min="1"
          max="60"
          placeholder="1-60"
          @focus="useCustom = true"
          @input="useCustom = true"
        />
        <span class="custom-unit">秒</span>
      </div>
      <div class="delay-actions">
        <button class="cancel-btn" @click="$emit('cancel')">取消</button>
        <button class="start-btn" :disabled="finalSeconds <= 0" @click="start">开始</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    defaultSeconds?: number
  }>(),
  {
    defaultSeconds: 3
  }
)

const emit = defineEmits<{
  start: [seconds: number]
  cancel: []
}>()

const options = [3, 5, 10]
const selected = ref(props.defaultSeconds)
const customSeconds = ref<number | null>(null)
const useCustom = ref(false)

const finalSeconds = computed(() => {
  if (useCustom.value && customSeconds.value && customSeconds.value > 0) {
    return Math.min(Math.max(Math.round(customSeconds.value), 1), 60)
  }
  return selected.value
})

const select = (sec: number) => {
  selected.value = sec
  useCustom.value = false
}

const start = () => {
  emit('start', finalSeconds.value)
}
</script>

<style scoped>
.delay-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--shot-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.delay-panel {
  background: var(--shot-panel);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shot-shadow);
  min-width: 280px;
}

.delay-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--shot-text);
  text-align: center;
  margin-bottom: 20px;
}

.delay-options {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.delay-option {
  flex: 1;
  padding: 12px 16px;
  background: var(--shot-panel-raised);
  border: 2px solid transparent;
  border-radius: 8px;
  color: var(--shot-text-dim);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.delay-option:hover {
  background: var(--shot-panel-hover);
  color: var(--shot-text);
}

.delay-option.active {
  border-color: var(--shot-accent);
  background: var(--shot-accent-soft);
  color: var(--shot-text);
}

.delay-custom {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.custom-label {
  font-size: 13px;
  color: var(--shot-text-muted);
  white-space: nowrap;
}

.custom-input {
  flex: 1;
  background: var(--shot-panel-raised);
  border: 2px solid transparent;
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--shot-text);
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.custom-input:focus,
.custom-input.active {
  border-color: var(--shot-accent);
  background: var(--shot-accent-softer);
}

.custom-input::placeholder {
  color: var(--shot-text-faint);
}

.custom-unit {
  font-size: 13px;
  color: var(--shot-text-muted);
}

.delay-actions {
  display: flex;
  gap: 12px;
}

.delay-actions button {
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: var(--shot-panel-raised);
  border: none;
  color: var(--shot-text-dim);
}

.cancel-btn:hover {
  background: var(--shot-panel-hover);
  color: var(--shot-text);
}

.start-btn {
  background: var(--shot-accent);
  border: none;
  color: var(--shot-text);
}

.start-btn:hover:not(:disabled) {
  background: var(--shot-accent-hover);
}

.start-btn:disabled {
  background: var(--shot-panel-raised);
  color: var(--shot-text-faint);
  cursor: not-allowed;
}
</style>

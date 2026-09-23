<template>
  <div v-if="show" class="settings-mask" @click.self="emit('close')">
    <div class="settings-dialog" role="dialog" aria-modal="true" aria-label="番茄钟设置">
      <header class="dialog-head">
        <h3>番茄钟设置</h3>
        <button type="button" class="dialog-close" title="关闭" @click="emit('close')">
          <AppIcon icon="close" />
        </button>
      </header>

      <div class="dialog-body">
        <section class="group">
          <h4 class="group-title">时长（分钟）</h4>
          <div class="number-grid">
            <label class="number-field">
              <span>专注</span>
              <input v-model.number="form.workDuration" type="number" min="1" max="180" />
            </label>
            <label class="number-field">
              <span>短休</span>
              <input v-model.number="form.shortBreakDuration" type="number" min="1" max="60" />
            </label>
            <label class="number-field">
              <span>长休</span>
              <input v-model.number="form.longBreakDuration" type="number" min="1" max="120" />
            </label>
            <label class="number-field">
              <span>长休间隔（番茄）</span>
              <input v-model.number="form.longBreakInterval" type="number" min="1" max="12" />
            </label>
          </div>
        </section>

        <section class="group">
          <h4 class="group-title">节奏与行为</h4>
          <div class="switch-list">
            <label v-for="item in switchItems" :key="item.key" class="switch-row">
              <span class="switch-text">
                <strong>{{ item.label }}</strong>
                <small>{{ item.hint }}</small>
              </span>
              <span class="switch">
                <input
                  type="checkbox"
                  :checked="switchValue(item.key)"
                  @change="onSwitch(item.key, $event)"
                />
                <span class="slider" aria-hidden="true" />
              </span>
            </label>
          </div>
        </section>

        <section class="group">
          <h4 class="group-title">计时风格</h4>
          <div class="segmented">
            <button
              v-for="opt in timerStyleOptions"
              :key="opt.value"
              type="button"
              class="segment"
              :class="{ active: form.timerStyle === opt.value }"
              @click="form.timerStyle = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </section>

        <section class="group">
          <h4 class="group-title">声音</h4>
          <div class="select-row">
            <label class="select-field">
              <span>完成铃声</span>
              <select v-model="form.ringtone">
                <option v-for="opt in ringtoneOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </label>
            <label class="select-field">
              <span>声景白噪音</span>
              <select v-model="form.soundscape">
                <option v-for="sc in soundscapeOptions" :key="sc.id" :value="sc.id">
                  {{ sc.label }}
                </option>
              </select>
            </label>
          </div>
        </section>
      </div>

      <footer class="dialog-foot">
        <span v-if="dirtyCount > 0" class="dirty-hint">{{ dirtyCount }} 项改动</span>
        <button type="button" class="btn btn--ghost" @click="emit('close')">取消</button>
        <button type="button" class="btn btn--primary" @click="save">保存</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 2026-09-23 重建件（原件全盘无副本，按 index.vue 的用法与 props/emits 契约重建）。 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import { usePomodoroStore, type PomodoroSettings } from '../../../stores/pomodoro'
import { SOUNDSCAPES } from '../composables/useSoundscapes'

const props = defineProps<{ show: boolean }>()

const emit = defineEmits<{
  close: []
  save: [newSettings: Partial<PomodoroSettings>]
}>()

const store = usePomodoroStore()

// 只列这里渲染的字段：未在表单里的设置项（如 soundscapeVolume）不参与 diff，
// 保存时不会被顺手写回。
const DEFAULTS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  soundEnabled: true,
  notificationEnabled: true,
  autoStartBreak: false,
  autoStartWork: false,
  ringtone: 'bell',
  timerStyle: 'pomodoro',
  strictMode: false,
  voiceEnabled: false,
  soundscape: 'none'
}

type FormKey = keyof typeof DEFAULTS

type SwitchKey =
  | 'soundEnabled'
  | 'notificationEnabled'
  | 'autoStartBreak'
  | 'autoStartWork'
  | 'voiceEnabled'
  | 'strictMode'

const NUMERIC_LIMITS: Partial<Record<FormKey, [number, number]>> = {
  workDuration: [1, 180],
  shortBreakDuration: [1, 60],
  longBreakDuration: [1, 120],
  longBreakInterval: [1, 12]
}

const switchItems: Array<{ key: SwitchKey; label: string; hint: string }> = [
  { key: 'soundEnabled', label: '提示音', hint: '阶段结束时播放铃声' },
  { key: 'notificationEnabled', label: '系统通知', hint: '切换到系统通知中心提醒' },
  { key: 'autoStartBreak', label: '自动开始休息', hint: '专注结束后直接进入休息' },
  { key: 'autoStartWork', label: '自动开始专注', hint: '休息结束后自动开始下一个番茄' },
  { key: 'voiceEnabled', label: '语音播报', hint: '用朗读声播报完成与休息提醒' },
  { key: 'strictMode', label: '严格模式', hint: '专注计时中禁止暂停与跳过' }
]

const timerStyleOptions: Array<{ value: 'pomodoro' | 'flowtime'; label: string }> = [
  { value: 'pomodoro', label: '番茄倒计时' },
  { value: 'flowtime', label: '正计时（Flowtime）' }
]

const ringtoneOptions: Array<{ value: string; label: string }> = [
  { value: 'bell', label: '经典铃' },
  { value: 'chime', label: '风铃' },
  { value: 'ding', label: '清脆叮' },
  { value: 'silent', label: '静音' }
]

const soundscapeOptions = SOUNDSCAPES

const KEYS = Object.keys(DEFAULTS) as FormKey[]

function normalize(source: PomodoroSettings | null): PomodoroSettings {
  const next: PomodoroSettings = { ...DEFAULTS }
  if (!source) return next
  for (const key of KEYS) {
    const value = source[key]
    if (value !== undefined) Object.assign(next, { [key]: value })
  }
  return next
}

const base = ref<PomodoroSettings>(normalize(store.settings))
const form = ref<PomodoroSettings>({ ...base.value })

const dirtyCount = computed(() => {
  return KEYS.filter((key) => form.value[key] !== base.value[key]).length
})

watch(
  () => props.show,
  (visible) => {
    if (!visible) {
      document.removeEventListener('keydown', onKeydown)
      return
    }
    base.value = normalize(store.settings)
    form.value = { ...base.value }
    document.addEventListener('keydown', onKeydown)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})

function clampNumbers(target: PomodoroSettings): void {
  for (const key of Object.keys(NUMERIC_LIMITS) as FormKey[]) {
    const limit = NUMERIC_LIMITS[key]
    if (!limit) continue
    const parsed = Math.round(Number(target[key]))
    const safe = Number.isFinite(parsed) ? parsed : DEFAULTS[key]
    Object.assign(target, { [key]: Math.min(limit[1], Math.max(limit[0], Number(safe))) })
  }
}

function switchValue(key: SwitchKey): boolean {
  return form.value[key] === true
}

function onSwitch(key: SwitchKey, event: Event): void {
  const target = event.target as HTMLInputElement | null
  Object.assign(form.value, { [key]: target?.checked === true })
}

function save(): void {
  const next = { ...form.value }
  clampNumbers(next)
  const patch: Partial<PomodoroSettings> = {}
  for (const key of KEYS) {
    if (next[key] !== base.value[key]) Object.assign(patch, { [key]: next[key] })
  }
  if (Object.keys(patch).length > 0) emit('save', patch)
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}
</script>

<style scoped>
.settings-mask {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: mask-fade 0.2s ease-out;
}

.settings-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(520px, 100%);
  max-height: 88vh;
  overflow: hidden;
  padding: 18px 20px;
  background: var(--pomo-dialog-bg);
  border: 1px solid var(--pomo-dialog-border);
  border-radius: 18px;
  box-shadow: var(--pomo-shadow-elevated);
  color: var(--pomo-dialog-text);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.dialog-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.dialog-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  color: var(--pomo-dialog-muted);
  transition:
    background 0.16s,
    color 0.16s;
}

.dialog-close:hover {
  background: var(--pomo-input-bg);
  color: var(--pomo-dialog-text);
}

.dialog-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pomo-dialog-muted);
}

.number-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.number-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--pomo-dialog-muted);
}

.number-field input,
.select-field select {
  padding: 8px 10px;
  background: var(--pomo-input-bg);
  border: 1px solid var(--pomo-input-border);
  border-radius: 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--pomo-dialog-text);
}

.number-field input:focus,
.select-field select:focus {
  outline: none;
  border-color: var(--pomo-work);
}

.switch-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--pomo-dialog-border);
  cursor: pointer;
}

.switch-row:last-child {
  border-bottom: none;
}

.switch-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.switch-text strong {
  font-size: 13px;
  font-weight: 600;
}

.switch-text small {
  font-size: 11px;
  color: var(--pomo-dialog-muted);
}

.switch {
  position: relative;
  flex: 0 0 auto;
  width: 38px;
  height: 22px;
}

.switch input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.slider {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--pomo-outline-variant);
  transition: background 0.2s;
  pointer-events: none;
}

.slider::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--pomo-panel-inverse);
  transition: transform 0.2s;
}

.switch input:checked + .slider {
  background: var(--pomo-work);
}

.switch input:checked + .slider::after {
  transform: translateX(16px);
}

.segmented {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--pomo-input-bg);
  border: 1px solid var(--pomo-input-border);
  border-radius: 999px;
}

.segment {
  flex: 1;
  padding: 7px 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--pomo-dialog-muted);
  transition:
    background 0.2s,
    color 0.2s;
}

.segment.active {
  background: var(--pomo-work);
  color: var(--pomo-on-accent);
}

.select-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.select-field {
  flex: 1 1 200px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--pomo-dialog-muted);
}

.dialog-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.dirty-hint {
  margin-right: auto;
  font-size: 11px;
  color: var(--pomo-priority-med);
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--pomo-dialog-border);
  border-radius: 999px;
  background: var(--pomo-input-bg);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--pomo-dialog-text);
  transition: opacity 0.16s;
}

.btn--ghost {
  background: transparent;
  color: var(--pomo-dialog-muted);
}

.btn--primary {
  background: var(--pomo-work);
  border-color: var(--pomo-work);
  color: var(--pomo-on-accent);
}

.btn:hover {
  opacity: 0.9;
}

@keyframes mask-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>

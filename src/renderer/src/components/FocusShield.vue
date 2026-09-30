<template>
  <div class="shield">
    <div class="shield-card">
      <div class="shield-icon">🍅</div>
      <div class="shield-title">专注时间</div>
      <p class="shield-text">
        「<span class="shield-app">{{ appName }}</span
        >」在专注屏蔽清单中。
      </p>
      <p class="shield-sub">切回其他应用遮罩会自动消失；也可以短暂放行。</p>
      <div class="shield-actions">
        <button type="button" class="shield-btn primary" @click="allow">放行 60 秒</button>
      </div>
      <div class="shield-hint">按 Esc 同样放行</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const appName = ref('此应用')

function allow(): void {
  void window.api.focusShield.temporaryAllow()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') allow()
}

function onInfo(payload: { appName: string; pattern: string }): void {
  if (payload?.appName) appName.value = payload.appName
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  window.api.focusShield.onInfo(onInfo)
  // 兜底：事件早于监听注册时主动查一次
  try {
    const state = await window.api.focusShield.currentState()
    if (state?.appName) appName.value = state.appName
  } catch {
    /* 忽略 */
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.shield {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(1200px 600px at 50% 40%, var(--shield-bg-core) 0%, var(--shield-bg-edge) 70%);
  color: var(--shield-text);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  user-select: none;
}

.shield-card {
  text-align: center;
  padding: 48px 64px;
}

/* ── B39 样式重建：护盾内层（原样式在 0922 事故中随组件样式族丢失）──
   本组件是恒定深色遮罩（B24 同口径豁免，不随主题），沿用 .shield 的
   自持色板；品牌色用 v4 token 加同值兜底 */

.shield-icon {
  font-size: 56px;
  line-height: 1;
  margin-bottom: 16px;
}

.shield-title {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin: 0 0 12px;
}

.shield-text {
  font-size: 15px;
  color: var(--shield-text-secondary);
  margin: 0 0 8px;
}

.shield-app {
  font-weight: 600;
  color: var(--shield-text-inverse);
}

.shield-sub {
  font-size: 13px;
  color: var(--shield-text-faint);
  margin: 0 0 28px;
}

.shield-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.shield-btn {
  padding: 8px 24px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: var(--shield-text);
  font-size: 14px;
  cursor: pointer;
  transition:
    background 120ms ease,
    transform 120ms ease;
}

.shield-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.shield-btn:active {
  transform: scale(0.97);
}

.shield-btn.primary {
  background: var(--brand-500);
  border-color: transparent;
  color: var(--shield-text-inverse);
}

.shield-btn.primary:hover {
  background: var(--brand-600);
}

.shield-hint {
  font-size: 12px;
  color: var(--shield-text-dim);
}
</style>

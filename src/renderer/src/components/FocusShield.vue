<template>
  <div class="shield">
    <div class="shield-card">
      <div class="shield-icon">🍅</div>
      <div class="shield-title">专注时间</div>
      <p class="shield-text">
        「<span class="shield-app">{{ appName }}</span>」在专注屏蔽清单中。
      </p>
      <p class="shield-sub">切回其他应用遮罩会自动消失；也可以短暂放行。</p>
      <div class="shield-actions">
        <button type="button" class="shield-btn primary" @click="allow">
          放行 60 秒
        </button>
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
  background: radial-gradient(1200px 600px at 50% 40%, #1b2530 0%, #101418 70%);
  color: #e8edf2;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  user-select: none;
}

.shield-card {
  text-align: center;
  padding: 48px 64px;

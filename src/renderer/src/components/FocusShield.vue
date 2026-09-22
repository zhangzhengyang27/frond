function allow(): void {
  void window.api.focusShield.temporaryAllow()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') allow()
}

function onInfo(payload: { appName: string; pattern: string }): void {
  if (payload?.appName) appName.value = payload.appName
}

let unsubscribeInfo: (() => void) | null = null

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  unsubscribeInfo = window.api.focusShield.onInfo(onInfo)
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
  unsubscribeInfo?.()
  unsubscribeInfo = null
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

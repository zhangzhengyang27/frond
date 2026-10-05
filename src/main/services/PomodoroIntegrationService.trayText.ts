/**
 * Frond · tray/dock 菜单的番茄钟状态行文案（纯函数，无 electron 依赖，可单测）
 *
 * 从 PomodoroIntegrationService.describeTraySnapshot 提取：service 构造依赖
 * electron/DB，node 测试环境拉不起来；文案规则又值得钉测试（暂停态漏标、
 * 剩余时间空段都是这里出过的）。
 */
import type { PomodoroTraySnapshot } from '../../shared/pomodoroIntegration'

/** utility: seconds → `M:SS`；非正数返回空（调用方据此省略「剩余」段） */
function formatMinutes(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** 推出一份适合直接展示的简短文本：模式（+暂停标记）+ 项目/任务；剩余 + 今日计数 */
export function trayDescribe(snapshot: PomodoroTraySnapshot): {
  primary: string
  secondary: string
} {
  if (!snapshot.isRunning && !snapshot.currentMode) {
    return { primary: '番茄钟空闲', secondary: '尚未开始' }
  }
  const modeLabel =
    snapshot.currentMode === 'work'
      ? '专注中'
      : snapshot.currentMode === 'shortBreak'
        ? '短休息'
        : snapshot.currentMode === 'longBreak'
          ? '长休息'
          : '空闲'
  // 暂停时 currentMode 保留但 isRunning=false：不标出来就是「专注中」却没有倒计时，
  // 用户分不清是暂停还是计时不走（菜单状态行只读，只能靠文案区分）
  const pausedTag = snapshot.isRunning ? '' : '（已暂停）'
  const projectTag = snapshot.projectName ? ` · ${snapshot.projectName}` : ''
  const task = snapshot.taskTitle?.trim() ? ` · ${snapshot.taskTitle.trim()}` : ''
  const time = formatMinutes(snapshot.timeLeftSeconds)
  const bgCount = snapshot.backgroundProjects.length
  const bgTail = bgCount > 0 ? ` · +${bgCount} 后台` : ''
  const primary = `${modeLabel}${pausedTag}${projectTag}${task}`
  const focusPrefix = snapshot.focusMode ? '🔕 专注中 · ' : ''
  return {
    primary: `${focusPrefix}${primary}`,
    secondary: time
      ? `剩余 ${time} · 今日 ${snapshot.todayCompleted} 番茄${bgTail}`
      : `今日 ${snapshot.todayCompleted} 番茄${bgTail}`
  }
}

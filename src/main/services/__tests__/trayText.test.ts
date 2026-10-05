import { describe, it, expect } from 'vitest'

/**
 * describeTraySnapshot（tray/dock 菜单状态行文案）纯逻辑测试。
 * 不 import service（其构造依赖 electron/DB）：复制最小上下文走真实导出。
 * 为避免拉起 electron 依赖，这里直接验证 service 文件的导出是否可用——
 * describeTraySnapshot 是实例方法，经 pomodoroIntegrationService() 单例访问。
 * service 顶层 import electron —— node 测试环境跑不动，因此这里用源内联等价断言
 * 的策略不可取（双份事实源）。改走「提取纯函数」路径：见 PomodoroIntegrationService.ts
 * 顶部的 trayDescribe 纯函数导出。
 */
import { trayDescribe } from '../PomodoroIntegrationService.trayText'

const base = {
  isRunning: false,
  currentMode: null as 'work' | 'shortBreak' | 'longBreak' | null,
  taskTitle: '',
  timeLeftSeconds: 0,
  todayCompleted: 0,
  projectId: null,
  projectName: '',
  backgroundProjects: [] as Array<{
    id: string
    name: string
    timeLeftSeconds: number
    mode: 'work' | 'shortBreak' | 'longBreak'
  }>,
  updatedAt: 0
}

describe('trayDescribe（番茄钟菜单状态行）', () => {
  it('未开始：番茄钟空闲 / 尚未开始', () => {
    expect(trayDescribe(base)).toEqual({ primary: '番茄钟空闲', secondary: '尚未开始' })
  })

  it('专注运行：模式 + 剩余 + 今日计数', () => {
    const out = trayDescribe({
      ...base,
      isRunning: true,
      currentMode: 'work',
      timeLeftSeconds: 1500,
      todayCompleted: 3
    })
    expect(out.primary).toBe('专注中')
    expect(out.secondary).toBe('剩余 25:00 · 今日 3 番茄')
  })

  it('暂停态必须标出（否则「专注中」没有倒计时分不清停没停）', () => {
    const out = trayDescribe({
      ...base,
      isRunning: false,
      currentMode: 'work',
      timeLeftSeconds: 600,
      todayCompleted: 0
    })
    expect(out.primary).toBe('专注中（已暂停）')
    expect(out.secondary).toContain('剩余 10:00')
  })

  it('任务与项目拼接 + 专注模式前缀 + 后台计数', () => {
    const out = trayDescribe({
      ...base,
      isRunning: true,
      currentMode: 'work',
      timeLeftSeconds: 60,
      taskTitle: '写周报',
      projectName: '工作',
      focusMode: true,
      todayCompleted: 1,
      backgroundProjects: [{ id: 'p2', name: '副业', timeLeftSeconds: 30, mode: 'work' }]
    })
    expect(out.primary).toBe('🔕 专注中 · 专注中 · 工作 · 写周报')
    expect(out.secondary).toBe('剩余 1:00 · 今日 1 番茄 · +1 后台')
  })

  it('timeLeftSeconds 非正时不显示「剩余」段', () => {
    const out = trayDescribe({ ...base, isRunning: true, currentMode: 'work' })
    expect(out.secondary).toBe('今日 0 番茄')
  })
})

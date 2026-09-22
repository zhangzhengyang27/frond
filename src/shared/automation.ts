/**
 * Leaf · Automations 的数据形状（P-4④）
 *
 * 放在 shared 是因为设置页要读写它，而主进程与渲染端都只依赖 shared 这一层。
 *
 * 动作面**刻意收窄**：只留无人值守时说得通的几类。
 * clipboardItem / snippetItem / file 这类需要人看着结果的动作不在这里——
 * 凌晨三点往剪贴板塞东西或者打开一个文件，不是「自动化」而是事故。
 */

/** 定时要做的一件事（纯数据，可 JSON 持久化） */
export type AutomationAction =
  | { type: 'ai'; prompt: string }
  | { type: 'copyText'; text: string }
  | { type: 'openUrl'; url: string }
  | { type: 'app'; path: string }
  | { type: 'system'; cmdId: string }

export const AUTOMATION_ACTION_TYPES = ['ai', 'copyText', 'openUrl', 'app', 'system'] as const

export interface AutomationTask {
  id: string
  label: string
  /** 标准 5 字段 cron（本机本地时间） */
  cron: string
  enabled: boolean
  action: AutomationAction
  /** 上次真正触发的时间（毫秒）；引擎按「同一分钟只跑一次」用它去重 */
  lastFiredAt: number | null
  lastOk: boolean | null
  lastError?: string
}

/** 给界面看的形态：多加一条「表达式是否合法」，不合法当场说明 */
export interface AutomationTaskView extends AutomationTask {
  cronValid: boolean
  cronError?: string
}

export const MAX_AUTOMATION_TASKS = 20
export const AUTOMATION_ID_MAX = 32

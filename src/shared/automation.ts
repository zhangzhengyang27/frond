/**
 * Frond · Automations 的数据形状（P-4④）
 *
 * 放在 shared 是因为设置页要读写它，而主进程与渲染端都只依赖 shared 这一层。
 *
 * 动作面**刻意收窄**：只留无人值守时说得通的几类。
 * clipboardItem / snippetItem / file 这类需要人看着结果的动作不在这里——
 * 凌晨三点往剪贴板塞东西或者打开一个文件，不是「自动化」而是事故。
 *
 * `'plugin'` 这一条是**插件专用**的（P-2③「生命周期外执行」）：只有 owner 为
 * `plugin:<id>` 的任务能用它，用户在设置页的 JSON 编辑器里写不出来——那样等于
 * 让任何人冒充某个插件去触发它的命令。反过来，插件也只能给自己登记。
 */

/** 定时要做的一件事（纯数据，可 JSON 持久化） */
export type AutomationAction =
  | { type: 'ai'; prompt: string }
  /**
   * 跑**本插件自己**的一条命令（`cmd` = plugin.json 里 commands[].code）。
   * 执行侧还有两道闸：只能是指明 `mode: 'action'` 的命令（视图命令会在无人时弹出界面），
   * 且插件此刻没有别的活跃视图。它的「成功」只代表「投递到了插件」——
   * 插件自己跑成没成宿主看不到（AI / 系统命令那几条才拿得到真实成败）。
   */
  | { type: 'plugin'; cmd: string; arguments?: Record<string, string> }
  | { type: 'copyText'; text: string }
  | { type: 'openUrl'; url: string }
  | { type: 'app'; path: string }
  | { type: 'system'; cmdId: string }

export const AUTOMATION_ACTION_TYPES = [
  'ai',
  'copyText',
  'openUrl',
  'app',
  'system',
  'plugin'
] as const

/** 任务归属：缺省 = 用户在设置页手工建的；`plugin:<id>` = 由该插件登记的（只有它能改） */
export type AutomationOwner = string

export function ownerPluginId(owner: AutomationOwner | undefined): string | null {
  return owner && owner.startsWith('plugin:') ? owner.slice('plugin:'.length) : null
}

export interface AutomationTask {
  id: string
  label: string
  /** 标准 5 字段 cron（本机本地时间） */
  cron: string
  enabled: boolean
  action: AutomationAction
  /** 谁的任务（见 `ownerPluginId`）。界面要显示出来：后台会跑的东西必须看得见是谁安排的 */
  owner?: AutomationOwner
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
/**
 * 一个插件最多登记几条。总量 20 条是留给用户的，不能被某个插件占满；
 * 上限存在的理由不是抠资源，是让「插件偷偷排 20 条定时任务」在结构上不可能。
 */
export const MAX_AUTOMATION_TASKS_PER_PLUGIN = 3
/**
 * 最密允许多久跑一次：一天最多 96 次（= 每 15 分钟）。
 * 比这更密就不是「自动化」而是轮询——第三方代码每几分钟被唤一次去联网/读写，
 * 代价与用户能感知的价值不成比例。判据见 cron.ts 的 firesPerDay。
 */
export const AUTOMATION_MAX_FIRES_PER_DAY = 96

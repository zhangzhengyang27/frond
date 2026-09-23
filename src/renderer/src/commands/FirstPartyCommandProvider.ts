/**
 * Frond · 第一方命令提供者（阶段1.1）
 *
 * 内置功能命令：AI、剪贴板历史、片段、录屏、番茄钟、设置、文件搜索等。
 * 迁移自 shared/commands.ts 的 FIRST_PARTY_COMMANDS / ACTION_COMMANDS。
 */
import type { Command, CommandProvider } from '@shared/commandRegistry'

export function createFirstPartyCommandProvider(): CommandProvider {
  return {
    id: 'first-party',
    categories: ['ai', 'clipboard', 'snippet', 'recording', 'pomodoro', 'settings', 'file'],
    reactive: false,
    async getCommands(): Promise<Command[]> {
      const commands: Command[] = []

      // ── AI ──
      commands.push(
        {
          id: 'ai:chat',
          title: 'AI 对话',
          subtitle: 'Ask anything',
          icon: 'sparkling-2',
          category: 'ai',
          badge: 'AI',
          keywords: ['ai', 'chat', '对话', 'duihua', 'gpt', 'chatgpt'],
          actions: [{ type: 'firstParty', page: 'ai' }]
        },
        {
          id: 'ai:translate',
          title: '翻译为中文',
          subtitle: '把剪贴板文本交给 AI 处理',
          icon: 'translate-2',
          category: 'ai',
          badge: 'AI',
          keywords: ['translate', '翻译', 'fanyi', '中译英', '英译中'],
          actions: [{ type: 'firstParty', page: 'ai' }]
        },
        {
          id: 'ai:summarize',
          title: '总结文本',
          subtitle: '把剪贴板文本交给 AI 处理',
          icon: 'text-wrap',
          category: 'ai',
          badge: 'AI',
          keywords: ['summarize', '总结', 'zongjie', '摘要', 'zhaiyao'],
          actions: [{ type: 'firstParty', page: 'ai' }]
        },
        {
          id: 'ai:rewrite',
          title: '润色改写',
          subtitle: '把剪贴板文本交给 AI 处理',
          icon: 'edit-line',
          category: 'ai',
          badge: 'AI',
          keywords: ['rewrite', '润色', 'runse', '改写', 'gaixie', 'polish'],
          actions: [{ type: 'firstParty', page: 'ai' }]
        }
      )

      // ── 剪贴板历史 ──
      commands.push({
        id: 'clipboard:history',
        title: '剪贴板历史',
        subtitle: '最近 200 条',
        icon: 'clipboard',
        category: 'clipboard',
        badge: '剪贴板',
        keywords: [
          'clipboard',
          '剪贴板',
          'jian tieban',
          'history',
          '历史',
          'lishi',
          'paste',
          '粘贴'
        ],
        actions: [{ type: 'firstParty', page: 'clips' }]
      })

      // ── 代码片段 ──
      commands.push({
        id: 'snippets:search',
        title: '代码片段',
        subtitle: '搜索并复制',
        icon: 'code',
        category: 'snippet',
        badge: '片段',
        keywords: ['snippet', '片段', 'pianduan', 'code', '代码', 'daima'],
        actions: [{ type: 'firstParty', page: 'snippets' }]
      })

      // ── 番茄钟 ──
      commands.push(
        {
          id: 'pomodoro:start',
          title: '番茄钟',
          subtitle: '开始专注',
          icon: 'timer',
          category: 'pomodoro',
          badge: '番茄钟',
          keywords: ['pomodoro', '番茄', 'fanqie', 'focus', '专注', 'zhuanzhu', 'timer', '计时'],
          actions: [
            { type: 'firstParty', page: 'focus' },
            { type: 'firstParty', page: 'focusStats' }
          ]
        },
        {
          id: 'pomodoro:stats',
          title: '番茄钟统计',
          subtitle: '查看专注记录',
          icon: 'bar-chart',
          category: 'pomodoro',
          badge: '番茄钟',
          keywords: ['stats', '统计', 'tongji', 'pomodoro', '番茄', 'fanqie'],
          actions: [{ type: 'firstParty', page: 'focusStats' }]
        }
      )

      // ── 文件搜索 ──
      commands.push({
        id: 'files:search',
        title: '搜索文件',
        subtitle: 'Spotlight 搜索',
        icon: 'folder',
        category: 'file',
        badge: '文件',
        keywords: ['file', '文件', 'wenjian', 'search', '搜索', 'sousuo', 'find', '查找'],
        actions: [{ type: 'firstParty', page: 'files' }]
      })

      // ── 浏览器标签 ──
      commands.push({
        id: 'browser:tabs',
        title: '浏览器标签',
        subtitle: 'Chrome / Safari',
        icon: 'global',
        category: 'extension',
        badge: '扩展',
        keywords: ['browser', '浏览器', 'liulanqi', 'tab', '标签', 'biaoqian', 'chrome', 'safari'],
        actions: [{ type: 'firstParty', page: 'browserTabs' }]
      })

      // ── 系统信息 ──
      commands.push({
        id: 'system:info',
        title: '系统信息',
        subtitle: 'CPU / 内存 / 磁盘',
        icon: 'cpu',
        category: 'system',
        badge: '系统',
        keywords: [
          'system',
          '系统',
          'xitong',
          'info',
          '信息',
          'xinxi',
          'cpu',
          '内存',
          'neicun',
          '磁盘',
          'cipan',
          '硬件',
          'yingjian'
        ],
        actions: [{ type: 'firstParty', page: 'systemInfo' }]
      })

      // ── 窗口切换 ──
      commands.push({
        id: 'window:switch',
        title: '切换窗口',
        subtitle: '搜索并激活窗口',
        icon: 'window-2',
        category: 'window',
        badge: '窗口',
        keywords: [
          'window',
          '窗口',
          'chuangkou',
          'switch',
          '切换',
          'qiehuan',
          'alt-tab',
          'app',
          '应用'
        ],
        actions: [{ type: 'firstParty', page: 'windowSwitcher' }]
      })

      // ── 回收站 ──
      commands.push({
        id: 'trash:open',
        title: '回收站',
        subtitle: '查看 / 清空 / 恢复',
        icon: 'delete-bin',
        category: 'system',
        badge: '系统',
        keywords: [
          'trash',
          '回收站',
          'huishouzhan',
          'recycle',
          '回收',
          'huishou',
          'empty',
          '清空',
          'qingkong',
          'restore',
          '恢复',
          'huifu'
        ],
        actions: [
          { type: 'firstParty', page: 'trash' },
          { type: 'system', cmdId: 'system.emptyTrash' }
        ]
      })

      // ── 词典 ──
      commands.push({
        id: 'dictionary:lookup',
        title: '词典',
        subtitle: '查询英文单词释义',
        icon: 'book-2',
        category: 'extension',
        badge: '工具',
        keywords: [
          'dictionary',
          '词典',
          'cidian',
          'define',
          '查询',
          'chaxun',
          'word',
          '单词',
          'danci',
          'translation',
          '翻译',
          'fanyi',
          'meaning',
          '释义',
          'shiyi'
        ],
        actions: [{ type: 'firstParty', page: 'dictionary' }]
      })

      // ── 设置 ──
      commands.push({
        id: 'settings:open',
        title: '设置',
        subtitle: '偏好设置',
        icon: 'settings',
        category: 'settings',
        badge: '设置',
        keywords: [
          'settings',
          '设置',
          'shezhi',
          'preferences',
          '偏好',
          'pianhao',
          'config',
          '配置'
        ],
        actions: [{ type: 'firstParty', page: 'settings' }]
      })

      // ── 提醒事项 ──
      commands.push({
        id: 'reminders:list',
        title: '提醒事项',
        subtitle: '查看和创建提醒',
        icon: 'alarm',
        category: 'reminder',
        badge: '提醒',
        keywords: [
          'reminder',
          '提醒',
          'tixing',
          'todo',
          '待办',
          'daiban',
          'task',
          '任务',
          'renwu',
          'alarm',
          '闹钟',
          'naozhong'
        ],
        actions: [{ type: 'firstParty', page: 'reminders' }]
      })

      // ── 浮动笔记 ──
      commands.push({
        id: 'notes:floating',
        title: '浮动笔记',
        subtitle: '置顶快速记录',
        icon: 'sticky-note',
        category: 'note',
        badge: '笔记',
        keywords: [
          'floating',
          '浮动',
          'fudong',
          'note',
          '笔记',
          'biji',
          'quick note',
          '快速记录',
          'kuaisujilu'
        ],
        actions: [{ type: 'floatingNote' }]
      })

      // ── 日历 ──
      commands.push({
        id: 'calendar:view',
        title: '日历',
        subtitle: '查看日程与提醒',
        icon: 'calendar',
        category: 'calendar',
        badge: '日历',
        keywords: [
          'calendar',
          '日历',
          'rili',
          'schedule',
          '日程',
          'richeng',
          'date',
          '日期',
          'month',
          '月'
        ],
        actions: [{ type: 'firstParty', page: 'calendar' }]
      })

      return commands
    }
  }
}

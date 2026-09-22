/**
 * Leaf · 命令执行器（IA v2「统一命令层」）
 *
 * 启动台胶囊与 ⌘K 命令面板共用的 CommandEntry 执行逻辑：
 * 同一个命令，从哪个入口触发，行为语义都一致——
 * - module：主窗口内直接路由跳转；胶囊中则经主进程唤起主窗口再跳转
 * - page：系统管理页，同上
 * - plugin：唤起胶囊窗承载插件交互（门管进入）
 * - app：交给系统启动
 */
import type { Router } from 'vue-router'
import type { CommandEntry, FirstPartyPage } from '@shared/commands'
import { buildQuicklinkUrl, quicklinkFieldNames, WINDOW_MODULES } from '@shared/commands'

export interface CommandRunOptions {
  /** 主窗口内的入口（⌘K）必传；胶囊窗无 router，可不传 */
  router?: Router
  /** true = 已在主窗口（⌘K）；false = 胶囊窗中执行 */
  inMainWindow: boolean
  /** 执行后的收尾（胶囊 hide / ⌘K 关面板）；plugin / firstParty 分支不收尾 */
  close: () => void
  /** 胶囊窗内打开第一方内联页（仅胶囊入口提供；⌘K 走 IPC 唤起胶囊） */
  openFirstParty?: (page: FirstPartyPage) => void
  /** 参数化 Quicklink（URL 含 {query}）需要参数输入时回调（胶囊表单）；缺省退化为打开基础链接 */
  openQuicklinkArg?: (entry: CommandEntry) => void
  /** 带参数声明的插件命令需要参数输入时回调（胶囊 pluginarg 表单）；缺省退化为无参直接打开 */
  openPluginArg?: (entry: CommandEntry) => void
}

export async function executeCommand(entry: CommandEntry, opts: CommandRunOptions): Promise<void> {
  const { router, inMainWindow, close } = opts
  const a = entry.action

  switch (a.type) {
    case 'module': {
      // module 记录裸 moduleId（与 useAppMenu / Sidebar / Home 的路由入口记录格式一致）
      void window.api.usage.recordUse(a.moduleId)
      // 阶段C「主窗口降级」：
      // - 胶囊入口：一律开沉浸式独立窗口（无侧栏 / 顶栏，?immersive=1），
      //   搜什么就只看什么，主窗口保持当前状态
      // - ⌘K 入口：轻型模块在主窗口内导航（用户本就在工作台）；
      //   重型模块（片段 / 录屏，WINDOW_MODULES）开沉浸式独立窗口
      if (!inMainWindow || WINDOW_MODULES.has(a.moduleId) || !router) {
        void window.api.createNewWindow(`${a.path}?immersive=1`)
        close()
        break
      }
      await router.push(a.path)
      close()
      break
    }
    case 'page': {
      // 以下各类型统一按 entry.key 记录使用（frecency 全类型加权，V4 P0-3）
      void window.api.usage.recordUse(entry.key)
      if (!inMainWindow || !router) {
        // 胶囊打开系统页（设置 / 迁移 / 关于）同样走沉浸式独立窗口
        void window.api.createNewWindow(`${a.path}?immersive=1`)
        close()
        break
      }
      await router.push(a.path)
      close()
      break
    }
    case 'plugin': {
      void window.api.usage.recordUse(entry.key)
      // 带参数声明的插件命令（多参数命令，对标 Raycast argument1-3）：
      // 先进胶囊参数表单逐参数收集，回车后带参打开插件
      if (a.arguments && a.arguments.length > 0) {
        if (opts.openPluginArg) {
          opts.openPluginArg(entry)
          break
        }
        // ⌘K 等无表单入口：退化为无参直接打开（与 Quicklink 缺参打开基础链接同理）
      }
      // 唤起胶囊窗并打开插件；胶囊保持可见进入插件交互，不执行 close
      window.api.launcher.openPlugin(a.pluginId, a.cmd)
      break
    }
    case 'app': {
      void window.api.usage.recordUse(entry.key)
      // #4：与窗口无关的动作统一走主进程执行端（全入口同一语义）
      await window.api.action.invoke({ type: 'app', path: a.path })
      close()
      break
    }
    case 'copyText': {
      // 计算器兜底等场景：复制文本后收起（Raycast 的 copy-then-close；统一执行端 #4）
      await window.api.action.invoke({ type: 'copyText', text: a.text })
      close()
      break
    }
    case 'system': {
      void window.api.usage.recordUse(entry.key)
      // 系统命令 / 窗口管理（M2）：统一执行端（#4）
      await window.api.action.invoke({ type: 'system', cmdId: a.cmdId })
      close()
      break
    }
    case 'quicklink': {
      void window.api.usage.recordUse(entry.key)
      // Quicklinks（M2.3）：系统默认浏览器打开；含 {query} 占位符的参数化链接
      // 在胶囊内先弹参数表单（Raycast 的 Required Argument），⌘K 无输入机制则打开基础链接
      if (quicklinkFieldNames(a.url).length > 0) {
        // 单参数（{query}）与多参数（{name}…）统一进胶囊参数表单
        if (opts.openQuicklinkArg) {
          opts.openQuicklinkArg(entry)
          break
        }
        void window.api.system.openExternal(buildQuicklinkUrl(a.url, ''))
        close()
        break
      }
      // 无占位符：统一执行端打开（#4，与热键同语义：优先复用浏览器标签）
      await window.api.action.invoke({ type: 'quicklink', url: a.url })
      close()
      break
    }
    case 'firstParty': {
      void window.api.usage.recordUse(entry.key)
      // Raycast 化：设置页打开独立的完整设置窗口（而非胶囊内联快捷设置）
      if (a.page === 'settings') {
        await window.api.createNewWindow('/settings')
        close()
        break
      }
      if (opts.openFirstParty) {
        // 胶囊入口：就地打开内联页
        opts.openFirstParty(a.page)
      } else {
        // ⌘K 等外部入口：唤起胶囊窗并打开对应页（门管进入）
        window.api.launcher.openFirstParty(a.page)
      }
      break
    }
    case 'file': {
      // 文件 / 剪贴板 / 片段结果不做使用记录：它们由搜索词驱动出现，
      // 不进空态建议与 frecency 排序（与 Raycast 的行为差异文档化接受）
      // 统一混合搜索：文件结果，回车用系统默认程序打开（统一执行端 #4）
      await window.api.action.invoke({ type: 'file', path: a.path })
      close()
      break
    }
    case 'clipboardItem': {
      // 统一混合搜索：剪贴板历史条目，回车再复制到剪贴板（统一执行端 #4）
      await window.api.action.invoke({ type: 'clipboardItem', id: a.id })
      close()
      break
    }
    case 'snippetItem': {
      // 统一混合搜索：代码片段，回车取首个内容块复制（统一执行端 #4）
      await window.api.action.invoke({ type: 'snippetItem', id: a.id })
      close()
      break
    }
    case 'pluginSearch': {
      // #5 插件双通道：searchable 插件持久化条目（搜索词驱动出现，不进 frecency）。
      // 动作语义与声明式 List 条目一致（PluginListPage.runItem）：
      // copy=复制后收起；open=http(s) 走浏览器 / 否则按路径打开；callback=打开插件继续交互
      const pa = a.action
      if (pa.type === 'copy') {
        await window.api.action.invoke({ type: 'copyText', text: pa.payload ?? '' })
        close()
        break
      }
      if (pa.type === 'open' && pa.payload) {
        if (/^https?:\/\//.test(pa.payload)) {
          void window.api.system.openExternal(pa.payload)
        } else {
          void window.api.system.openPath(pa.payload)
        }
        close()
        break
      }
      // callback：打开插件（胶囊保持可见进入插件交互，与 plugin 动作一致）
      window.api.launcher.openPlugin(a.pluginId)
      break
    }
    case 'pluginSearch': {
      // #5 插件双通道：searchable 插件持久化条目（搜索词驱动出现，不进 frecency）。
      // 动作语义与声明式 List 条目一致（PluginListPage.runItem）：
      // copy=复制后收起；open=http(s) 走浏览器 / 否则按路径打开；callback=打开插件继续交互
      const pa = a.action
      if (pa.type === 'copy') {
        await window.api.action.invoke({ type: 'copyText', text: pa.payload ?? '' })
        close()
        break
      }
      if (pa.type === 'open' && pa.payload) {
        if (/^https?:\/\//.test(pa.payload)) {
          void window.api.system.openExternal(pa.payload)
        } else {
          void window.api.system.openPath(pa.payload)
        }
        close()
        break
      }
      // callback：打开插件（胶囊保持可见进入插件交互，与 plugin 动作一致）
      window.api.launcher.openPlugin(a.pluginId)
      break
    }
    case 'openUrl': {
      // 会议入会链接：scheme 白名单（zoommtg 等客户端 scheme，审查 I-diff2）——白名单在执行端内
      await window.api.action.invoke({ type: 'openUrl', url: a.url })
      close()
      break
    }
    case 'shotPaste': {
      // 粘贴最近截图（V4 P1-10）：主进程写剪贴板 → 收起胶囊 → ⌘V 注入前台
      void window.api.shotIndex.pasteLatest()
      close()
      break
    }
    case 'floatingNote': {
      void window.api.usage.recordUse(entry.key)
      // 打开浮动笔记窗口
      void window.api.floatingNote.toggle()
      close()
      break
    }
  }
}

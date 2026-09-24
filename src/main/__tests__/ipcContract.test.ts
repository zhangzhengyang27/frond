/**
 * Frond · IPC Contract E2E 烟雾测试
 *
 * 目标：在不启动 Electron GUI 的前提下，验证主进程 / preload 之间
 * 的 IPC 通道对齐——这是 E2E 烟雾测试的「轻量版」。
 *
 * 检测的「气味」：
 * 1. 主进程声明了某 channel 但 preload 从未调用 → dead handler
 * 2. preload 调用了某 channel 但主进程未注册 → 静默丢消息
 * 3. preload 暴露 window.api.X 但内部不实现 → 渲染端调用 crash
 *
 * 静态扫描（正则 + 逐行注释剥离）提取 channel 列表，覆盖主进程的两类注册：
 * - 裸 ipcMain.handle('ch', h) / ipcMain.on('ch', h)
 * - typedHandle / typedHandleLogged('ch', h)（单对象约定的接线点）
 * 曾经的 registerHandlers / registerPrefixedHandlers 两个 object-literal 注册助手
 * 已随 IPC 全量迁移删除，故这里不再认识它们。
 *
 * 来源：docs/ENGINEERING.md §5（IPC contract 验证）
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execSync } from 'node:child_process'

const REPO_ROOT = join(__dirname, '../../..')

/**
 * 扫描结果缓存（2026-09-23）。
 *
 * 本文件有 7 个用例各自遍历一遍 `src/main` 全树并逐个 readFileSync。全量跑时
 * 本文件耗时 106.7s（solo 14.4s，慢 7.4 倍），超过 vitest 默认 5s 用例超时后报
 * `STACK_TRACE_ERROR`（vitest 的超时占位错误）——8 条红全是超时，不是契约不符。
 *
 * 测试运行期没有任何用例会写这些源文件，故进程内缓存安全。缓存的是「磁盘内容」
 * 而不是「判定结果」：每个用例仍然各自跑正则与断言，判别性不变。
 */
const dirCache = new Map<string, string[]>()
const srcCache = new Map<string, string>()

/** 读源文件（进程内缓存：避免 7 个用例重复读同一批文件） */
function readSource(filePath: string): string {
  const hit = srcCache.get(filePath)
  if (hit !== undefined) return hit
  const src = readFileSync(filePath, 'utf-8')
  srcCache.set(filePath, src)
  return src
}

/**
 * 提取文件里主进程注册的所有 channel，分离请求频道与推送频道：
 * - request：ipcMain.handle/on + typedHandle(typedHandleLogged) 展开
 * - push：webContents.send（主进程 → 渲染端推事件）
 */
function extractMainChannelsDetailed(filePath: string): {
  request: string[]
  push: string[]
} {
  const src = readSource(filePath)
  // 先剥离整行注释：防止文档注释里的示例文本被当作注册
  // （历史案例：index.ts 注释里的 "ipcMain.on('ping') 已删除" 曾被抓成注册）
  const code = src
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !(t.startsWith('//') || t.startsWith('/*') || t.startsWith('*'))
    })
    .join('\n')
  const request: string[] = []
  const push: string[] = []
  // 直接 ipcMain.handle('ch', ...) / ipcMain.on('ch', ...)
  const re1 = /ipcMain\.(?:handle|on)\(\s*['"`]([^'"`]+)['"`]/g
  let m: RegExpExecArray | null
  while ((m = re1.exec(code))) request.push(m[1])
  // typedHandle('ch', ...) —— 单对象约定的类型化注册（通道仍是字面量，才可静态检查）
  const reTyped = /typedHandle(?:Logged)?\(\s*['"`]([^'"`]+)['"`]/g
  while ((m = reTyped.exec(code))) request.push(m[1])
  // webContents.send('ch', ...) —— 主进程向渲染端推事件（push channel）
  const reSend = /webContents\.send\(\s*['"`]([^'"`]+)['"`]/g
  while ((m = reSend.exec(code))) push.push(m[1])
  return { request, push }
}

/** 提取文件里所有 ipcMain.handle('channel', ...) 的 channel 名（含推送，向后兼容旧用例） */
function extractMainChannels(filePath: string): string[] {
  const { request, push } = extractMainChannelsDetailed(filePath)
  return [...request, ...push]
}

/**
 * 提取文件里所有 ipcRenderer.invoke('channel', ...) 的 channel 名
 */
function extractPreloadInvokes(filePath: string): string[] {
  const src = readSource(filePath)
  const re = /(?:ipcRenderer\.invoke|typedInvoke)\(\s*['"`]([^'"`]+)['"`]/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) out.push(m[1])
  return out
}

/**
 * 提取文件里所有 ipcRenderer.on('channel', ...) 的 channel 名
 */
function extractPreloadOns(filePath: string): string[] {
  const src = readSource(filePath)
  const re = /ipcRenderer\.on\(\s*['"`]([^'"`]+)['"`]/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) out.push(m[1])
  return out
}

/**
 * 提取文件里所有 ipcRenderer.send('channel', ...) 的 channel 名
 * （ipcMain.on 的对端）
 */
function extractPreloadSends(filePath: string): string[] {
  const src = readSource(filePath)
  const re = /ipcRenderer\.send\(\s*['"`]([^'"`]+)['"`]/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) out.push(m[1])
  return out
}

/** 收集所有 preload 入口（应用 preload + 插件 preload）中被引用的 channel */
function collectPreloadUsedChannels(): Set<string> {
  const used = new Set<string>()
  for (const f of ['src/preload/index.ts', 'src/preload/plugin.ts']) {
    const file = join(REPO_ROOT, f)
    for (const ch of extractPreloadInvokes(file)) used.add(ch)
    for (const ch of extractPreloadOns(file)) used.add(ch)
    for (const ch of extractPreloadSends(file)) used.add(ch)
  }
  return used
}

/** 收集目录下所有 .ts 文件（进程内缓存：7 个用例复用同一份目录树） */
function walkTsFiles(dir: string): string[] {
  const hit = dirCache.get(dir)
  if (hit) return hit
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__' || e.name === 'dist') continue
      out.push(...walkTsFiles(full))
    } else if (
      e.isFile() &&
      /\.ts$/.test(e.name) &&
      !/\.test\.ts$/.test(e.name) &&
      !/\.d\.ts$/.test(e.name)
    ) {
      out.push(full)
    }
  }
  dirCache.set(dir, out)
  return out
}

/**
 * 提取 preload 暴露的所有 window.api.X.Y / X.Y / X 等方法名 + 字段名。
 * 简化：用 ts compiler 跑一次导出；这里用更简 regex。
 *
 * 实际不依赖这个，主入口 ipc 对照已经够用。
 */

/**
 * shared/ipc-contract.ts 是「已核对过真实签名的通道登记册」（不是编译闸口，
 * 见该文件头）。它最大的风险是长出不存在的通道或悄悄漂移 —— 下面这条就是防这个：
 * 历史上曾有 11 条 key（screenRecorder.start / recording.markers.* / updater.check /
 * feedback.exportLog）在代码里根本不存在，而且 preferences.getTheme 的 res 写成了
 * 'system'（实际 'auto'）、setTheme 写成了对象入参（实际位置参数）。
 */
describe('IPC 登记册（shared/ipc-contract.ts）不得含虚构通道', { timeout: 120_000 }, () => {
  const CONTRACT_FILE = join(REPO_ROOT, 'src/shared/ipc-contract.ts')

  function contractKeys(): string[] {
    const src = readSource(CONTRACT_FILE)
    const body = src.slice(
      src.indexOf('export interface IpcContract'),
      src.indexOf('\nexport type IpcKey')
    )
    return [...body.matchAll(/^ {2}'([^']+)':\s*\{/gm)].map((m) => m[1])
  }

  let realChannelsCache: Set<string> | null = null
  function realChannels(): Set<string> {
    if (realChannelsCache) return realChannelsCache
    const all = new Set<string>(collectPreloadUsedChannels())
    for (const f of walkTsFiles(join(REPO_ROOT, 'src/main'))) {
      for (const ch of extractMainChannels(f)) all.add(ch)
    }
    realChannelsCache = all
    return all
  }

  it('每条 key 都是真实存在的通道（主进程注册或 preload 调用）', () => {
    const keys = contractKeys()
    expect(keys.length).toBeGreaterThan(20)
    const real = realChannels()
    const ghost = keys.filter((k) => !real.has(k))
    expect(ghost, `登记册里这些通道不存在：${ghost.join(', ')}`).toEqual([])
  })

  it('没有重复 key', () => {
    const keys = contractKeys()
    expect(new Set(keys).size).toBe(keys.length)
  })

  /** 主进程通过 typedHandle(typedHandleLogged 同理) 注册的通道 = 已按单对象入参改造 */
  let typedRegisteredCache: Set<string> | null = null
  function typedRegistered(): Set<string> {
    if (typedRegisteredCache) return typedRegisteredCache
    const out = new Set<string>()
    for (const f of walkTsFiles(join(REPO_ROOT, 'src/main'))) {
      const src = readSource(f)
      for (const m of src.matchAll(/typedHandle(?:Logged)?\(\s*['"`]([^'"`]+)['"`]/g)) {
        if (m[1]) out.add(m[1])
      }
    }
    typedRegisteredCache = out
    return out
  }

  it('已登记通道在 preload 侧必须走 typedInvoke', () => {
    // 编译期查不出来：main 与 preload 各自对着 IpcContract 校验，但
    // ipcRenderer.invoke('ch', a, b) 绕过登记册，req 会拿到 a（不是对象），
    // handler 解构出 undefined —— 不报错，只是功能静默失灵。
    const typed = typedRegistered()
    const skewed: string[] = []
    for (const f of ['src/preload/index.ts', 'src/preload/plugin.ts']) {
      const src = readSource(join(REPO_ROOT, f))
      for (const m of src.matchAll(/ipcRenderer\.invoke\(\s*['"`]([^'"`]+)['"`]/g)) {
        const ch = m[1]
        if (ch && typed.has(ch)) skewed.push(`${f} → ${ch}`)
      }
    }
    expect(
      skewed,
      `这些通道已进登记册，preload 仍用裸 ipcRenderer.invoke 调用（req/res 不受编译约束）：\n  ${skewed.join('\n  ')}`
    ).toEqual([])
  })

  it('登记册覆盖只增不减', () => {
    // 迁移是逐家族推进的（415 个通道里已接 391 个）。没有下界的话，
    // 一次「先删掉登记不确定的条目」的重构就能悄悄把约定退回成文档。
    expect(contractKeys().length).toBeGreaterThanOrEqual(391)
  })
})

describe('IPC contract (E2E 烟雾测试)', { timeout: 120_000 }, () => {
  it('主进程 IPC handler channel 列表', () => {
    const files = walkTsFiles(join(REPO_ROOT, 'src/main'))
    const all = new Set<string>()
    for (const f of files) {
      for (const ch of extractMainChannels(f)) all.add(ch)
    }
    // sanity: 至少 N 个 channel
    expect(all.size).toBeGreaterThan(20)
    // 已知关键 channel 必须存在
    expect(all.has('system:info')).toBe(true)
    expect(all.has('system:openPath')).toBe(true)
    expect(all.has('log:export')).toBe(true)
    expect(all.has('log:getMode')).toBe(true)
    expect(all.has('log:setMode')).toBe(true)
  })

  it('preload 调用的「静态可达」channel 都在主进程注册', () => {
    // 设计：100% 静态覆盖 IPC handler 不可能（很多 channel 是动态
    // 生成 / 间接经由 sendToRenderer / buildAppMenuTemplate 等辅助
    // 函数）。本测试只覆盖「直接字面量出现在主进程代码」的部分：
    // 1. ipcMain.handle('ch', h) / ipcMain.on('ch', h)
    // 2. typedHandle / typedHandleLogged('ch', h)（单对象约定注册点）
    // 3. webContents.send('ch', payload) push 通道
    //
    // 动态 / 间接通道（sendToRenderer('ch') 等）不在本测试覆盖，
    // 否则会因为字面量不出现在 main 端而误报 missing。
    const preloadFile = join(REPO_ROOT, 'src/preload/index.ts')
    const usedInvokes = new Set(extractPreloadInvokes(preloadFile))
    const usedOns = new Set(extractPreloadOns(preloadFile))
    const used = new Set<string>([...usedInvokes, ...usedOns])

    const mainFiles = walkTsFiles(join(REPO_ROOT, 'src/main'))
    const registered = new Set<string>()
    for (const f of mainFiles) {
      for (const ch of extractMainChannels(f)) registered.add(ch)
    }

    const missing: string[] = []
    for (const ch of used) {
      if (!registered.has(ch)) missing.push(ch)
    }

    // 已核实为动态 / 间接注册的 channel 白名单（主进程经变量/辅助函数 send，
    // 字面量不在 main 静态可达范围内）：
    // - ai:stream-chunk / clip:exportProgress / recording:export:* /
    //   recording:countdown:* / cursor:position / pomodoro:integration:traySnapshot
    //   → 各 service 持 target.webContents 按需推送
    // - app:refresh-applications / app:openCommandPalette / app:openSettings /
    //   app:openAbout → appMenu/全局快捷键经 sendToRenderer 转发
    const DYNAMIC_CHANNELS = new Set([
      'app:refresh-applications',
      'pomodoro:integration:traySnapshot',
      'app:openCommandPalette',
      'app:openSettings',
      'app:openAbout',
      // 这两条同样经 appMenu 的 sendToRenderer 转发（静态扫不到 send 的字面量）
      'app:goHome',
      'pomodoro:focusProject',
      'ai:stream-chunk',
      'clip:exportProgress',
      'cursor:position',
      'recording:export:progress',
      'recording:export:done',
      'recording:countdown:tick',
      'recording:countdown:begun',
      'recording:countdown:cancel'
    ])
    const unexpected = missing.filter((ch) => !DYNAMIC_CHANNELS.has(ch))

    if (unexpected.length > 0) {
      console.warn(
        `[ipcContract] 静态扫描未找到 ${unexpected.length} 个 channel（可能是动态 / 间接注册的；如确认 dead code 请清理）：\n` +
          `  ${unexpected.slice(0, 20).join(', ')}${unexpected.length > 20 ? ', ...' : ''}`
      )
    }
    // 白名单外的 missing 视为疑似 dead code，硬失败防止漂移
    expect(unexpected.length).toBe(0)
  })

  it('preload invoke 的 channel 在主进程全部注册（硬契约）', () => {
    // invoke 是 request/response 模式：preload 调 invoke 必有一个
    // 主进程 ipcMain.handle 响应；如果没有，调用永远 reject。
    // 这条契约必须硬 throw。
    //
    // 注意：只查 invoke，不查 ipcRenderer.on。on 是 push 通道，preload
    // 监听主进程主动 send 的事件，不存在 = 永远不响，不算 dead code。
    const preloadFile = join(REPO_ROOT, 'src/preload/index.ts')
    const usedInvokes = new Set(extractPreloadInvokes(preloadFile))
    const mainFiles = walkTsFiles(join(REPO_ROOT, 'src/main'))
    const registered = new Set<string>()
    for (const f of mainFiles) {
      for (const ch of extractMainChannels(f)) registered.add(ch)
    }
    const missing: string[] = []
    for (const ch of usedInvokes) {
      if (!registered.has(ch)) missing.push(ch)
    }
    if (missing.length > 0) {
      throw new Error(
        `preload invoke 调用了主进程未注册的 channel（共 ${missing.length} 个，渲染端永远 reject）：\n` +
          `  ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ', ...' : ''}\n` +
          `（要么补主进程 handler，要么从 preload 删除该 API）`
      )
    }
    expect(missing).toEqual([])
  })

  it('主进程注册的核心 channel 至少被 preload 引用一次', () => {
    // 关键 module 的 IPC 不应完全 dead
    const required = ['system:info', 'log:getMode']
    const preloadFile = join(REPO_ROOT, 'src/preload/index.ts')
    const usedInvokes = new Set(extractPreloadInvokes(preloadFile))
    const usedOns = new Set(extractPreloadOns(preloadFile))
    const used = new Set<string>([...usedInvokes, ...usedOns])
    for (const ch of required) {
      expect(used.has(ch)).toBe(true)
    }
  })

  it('主进程注册的请求频道都被 preload 引用（dead handler 契约）', () => {
    // 反向契约：ipcMain.handle/on 注册的频道，必须有 preload 端调用方
    // （invoke / send / on，含插件 preload）。主进程孤儿 handler 意味着
    // 死代码或断链的入口——要么删 handler，要么补 preload API。
    const mainFiles = walkTsFiles(join(REPO_ROOT, 'src/main'))
    const registered = new Set<string>()
    for (const f of mainFiles) {
      for (const ch of extractMainChannelsDetailed(f).request) registered.add(ch)
    }
    const used = collectPreloadUsedChannels()

    // 主进程内部互相调用的注册形式（main 直接 invoke 自己的 handler 等罕见模式）
    // 与渲染端 window.api 之外的调用方（如 BrowserWindow 菜单直接 webContents.executeJavaScript）
    const DYNAMIC_OR_INTERNAL = new Set<string>([])
    const dead = [...registered].filter((ch) => !used.has(ch) && !DYNAMIC_OR_INTERNAL.has(ch))
    expect(
      dead,
      `主进程注册但 preload 从不引用的频道（共 ${dead.length} 个）:\n  ${dead.join('\n  ')}`
    ).toEqual([])
  })

  it('主进程推送的频道都被 preload 监听（push 契约）', () => {
    // webContents.send('ch') 的静态字面量频道，preload 必须有 ipcRenderer.on('ch')
    // 对应监听（或列入动态白名单——经变量名推送的频道不会出现在本扫描中）。
    const mainFiles = walkTsFiles(join(REPO_ROOT, 'src/main'))
    const push = new Set<string>()
    for (const f of mainFiles) {
      for (const ch of extractMainChannelsDetailed(f).push) push.add(ch)
    }
    const preloadFile = join(REPO_ROOT, 'src/preload/index.ts')
    const ons = new Set(extractPreloadOns(preloadFile))

    // 经变量构造频道名推送（字面量不在 webContents.send 第一参数位）的白名单
    const DYNAMIC_PUSH = new Set<string>([])
    const unheard = [...push].filter((ch) => !ons.has(ch) && !DYNAMIC_PUSH.has(ch))
    expect(
      unheard,
      `主进程推送但 preload 无监听的频道（共 ${unheard.length} 个）:\n  ${unheard.join('\n  ')}`
    ).toEqual([])
  })
})

/**
 * 路由组件文件存在性（防止 router 里写了 path 但组件没创建）
 *
 * 静态读 src/renderer/src/router/index.ts，提取每个
 * `component: () => import('xxx')` 的路径，验证文件存在。
 */
describe('路由表组件完整性', () => {
  it('router/index.ts 里所有 lazy import 都对应真实文件', () => {
    const routerFile = join(REPO_ROOT, 'src/renderer/src/router/index.ts')
    const src = readSource(routerFile)
    const re = /import\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    const imports: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) imports.push(m[1])

    const missing: string[] = []
    for (const p of imports) {
      // 只校验相对路径
      if (!p.startsWith('.')) continue
      // 路径相对 router/index.ts
      const resolved = join(REPO_ROOT, 'src/renderer/src/router', p)
      try {
        readFileSync(resolved)
      } catch {
        missing.push(p)
      }
    }
    if (missing.length > 0) {
      throw new Error(`路由表 lazy import 路径不存在:\n  ${missing.join('\n  ')}`)
    }
    expect(missing).toEqual([])
  })
})

/**
 * shared/modules.ts 的 MODULES 数组与 router 中已注册的 path 必须 1:1 对应
 * —— 保证 Hub 上 9 张卡都能跳进。
 */
describe('shared/modules.ts 与 router 路径一致', () => {
  it('shared/modules.ts 的每条 path 都能在 router 中跳到（非严格）', () => {
    const modFile = join(REPO_ROOT, 'src/shared/modules.ts')
    const routerFile = join(REPO_ROOT, 'src/renderer/src/router/index.ts')

    const modSrc = readSource(modFile)
    // 抓 path: '/xxx' 字面量
    const pathRe = /path:\s*['"`]([^'"`]+)['"`]/g
    const paths = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = pathRe.exec(modSrc))) paths.add(m[1])

    const routerSrc = readSource(routerFile)
    // 收集 router 里出现的所有 path / redirect 目标 / children path
    // - path: 'xxx' 或 '/xxx'
    // - redirect: '/xxx' 或 redirect: 'xxx'
    // 注意 children path 是相对父路径的（'record' 而不是 '/screenRecorder/record'）
    const allRouterPaths = new Set<string>()

    const reProp = /(?:path|redirect|to):\s*['"`]([^'"`]+)['"`]/g
    while ((m = reProp.exec(routerSrc))) allRouterPaths.add(m[1])

    // 额外扫描：找 router 里有没有 screenRecorder / xxx 这种父 path，
    // 与模块 path 的前缀匹配（嵌套路由）
    const parentRe = /path:\s*['"`](\/[a-zA-Z][\w-]*)['"`]/g
    while ((m = parentRe.exec(routerSrc))) allRouterPaths.add(m[1])

    const missing: string[] = []
    for (const p of paths) {
      // 匹配规则：
      // 1. 完全相等（/photos）
      // 2. 父路径前缀（/screenRecorder/record 命中 path /screenRecorder）
      // 3. 子路径前缀（/screenRecorder 命中 path screenRecorder + children record）
      const matches = [...allRouterPaths].some((rp) => {
        if (rp === p) return true
        if (p.startsWith(rp + '/')) return true
        if (rp.startsWith('/') && p.startsWith(rp + '/')) return true
        return false
      })
      if (!matches) missing.push(p)
    }

    if (missing.length > 0) {
      throw new Error(
        `shared/modules.ts 的 path 在 router 中找不到:\n  ${missing.join('\n  ')}\n` +
          `（Hub 上这些卡片跳进去会 404）`
      )
    }
    expect(missing).toEqual([])
  })
})

/**
 * git tag sanity（CI 环境必跑，本地无 git 时跳过）
 * —— 让 CI 失败第一时间告知「没 tag 怎么发版」
 */
describe('环境 / 仓库 sanity', () => {
  it('git 可用', () => {
    try {
      const out = execSync('git rev-parse --is-inside-work-tree', {
        cwd: REPO_ROOT,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      expect(out.toString().trim()).toBe('true')
    } catch {
      throw new Error('当前目录不在 git 仓库内（CI 异常？）')
    }
  })
})

/**
 * 单对象入参门禁（2026-09-24）
 *
 * 契约里 req 非 void 的通道，注册点**必须**是 typedHandle —— 只有这样 handler 的
 * 入参形状才受 IpcContract 约束。
 *
 * 为什么需要这条：裸 ipcMain.handle 的 handler 形参不受任何检查。2026-09-24 查出
 * 39 条通道错位：preload 早已按单对象约定发 `{ x }`，handler 却按位置参数读 `x` ——
 * 拿到的是整个对象，于是 `typeof x === 'string'` 判非、`String(x)` 得到
 * "[object Object]"，功能**静默失效**（不报错、不留日志）。受害面覆盖：
 * 打开外链 / 在访达中显示、回收站恢复与删除、词典、命令别名、AI 会话与预设、
 * 云备份、录屏分片写盘与保存、旧录制历史、迁移中心「还原备份 / 删除备份」等。
 *
 * 例外（有意为之，不在本门禁范围）：
 * - 契约里 req 为 void 的通道：handler 本来就忽略入参，形状无从错位。
 * - 不在契约里的通道（screenshot:* / platform:* / video:readFile）：preload 侧用
 *   裸 ipcRenderer.invoke + 位置参数，两端形状一致、行为正确；把它们收进契约
 *   是另一件事（要同时改 preload 与 req/res 定义）。
 */
describe('IPC 单对象入参门禁（req 非 void ⇒ 必须 typedHandle）', { timeout: 120_000 }, () => {
  /** channel → req 是否为 void（只解析登记册里的条目） */
  function contractReqVoidFlags(): Map<string, boolean> {
    const src = readSource(join(REPO_ROOT, 'src/shared/ipc-contract.ts'))
    const out = new Map<string, boolean>()
    const keyRe = /'([^']+)'\s*:\s*\{/g
    let m: RegExpExecArray | null
    while ((m = keyRe.exec(src))) {
      const channel = m[1]
      const open = m.index + m[0].length - 1
      // 找配平的 '}'
      let depth = 0
      let end = open
      for (; end < src.length; end++) {
        const c = src[end]
        if (c === '{') depth++
        else if (c === '}') {
          depth--
          if (depth === 0) break
        }
      }
      const body = src.slice(open + 1, end)
      const reqMatch = /(?:^|[\s{,])req\s*:/.exec(body)
      if (!reqMatch) {
        out.set(channel, false)
        continue
      }
      const afterReq = body.slice(reqMatch.index + reqMatch[0].length)
      // 截到顶层 ';' 或顶层 'res:'（有些条目 req 后没有分号）
      let d = 0
      let cut = afterReq.length
      for (let i = 0; i < afterReq.length; i++) {
        const c = afterReq[i]
        if ('{(['.includes(c)) d++
        else if ('})]'.includes(c)) d--
        else if (d === 0) {
          if (c === ';') {
            cut = i
            break
          }
          if (afterReq.startsWith('res', i) && /^res\s*:/.test(afterReq.slice(i))) {
            cut = i
            break
          }
        }
      }
      out.set(channel, afterReq.slice(0, cut).trim() === 'void')
    }
    return out
  }

  /** 用裸 ipcMain.handle('ch', …) 注册的通道（channel → 文件） */
  function bareHandleChannels(): Map<string, string> {
    const out = new Map<string, string>()
    for (const f of walkTsFiles(join(REPO_ROOT, 'src/main'))) {
      const code = readSource(f)
        .split('\n')
        .filter((l) => {
          const t = l.trimStart()
          return !(t.startsWith('//') || t.startsWith('/*') || t.startsWith('*'))
        })
        .join('\n')
      const re = /ipcMain\.handle\(\s*['"`]([^'"`]+)['"`]/g
      let m: RegExpExecArray | null
      while ((m = re.exec(code))) out.set(m[1], f)
    }
    return out
  }

  it('登记册解析没有退化（体量哨兵：解析空掉会让下一条门禁空转）', () => {
    const flags = contractReqVoidFlags()
    expect(flags.size).toBeGreaterThan(300)
    const nonVoid = [...flags.values()].filter((v) => v === false).length
    // 实测约 200 条 req 非 void；门槛留足余量，只拦「解析全废」这种情况
    expect(nonVoid).toBeGreaterThan(120)
  })

  it('契约 req 非 void 的通道没有一条用裸 ipcMain.handle 注册', () => {
    const flags = contractReqVoidFlags()
    const bare = bareHandleChannels()
    expect(bare.size).toBeGreaterThan(0) // 哨兵：扫描没退化

    const violations: string[] = []
    for (const [ch, file] of bare) {
      const isVoid = flags.get(ch)
      if (isVoid === undefined) continue // 不在契约里 —— 见 describe 注释的例外
      if (isVoid) continue
      violations.push(`${ch}  (${relative(REPO_ROOT, file)})`)
    }

    expect(
      violations,
      '这些通道契约里 req 非 void，却用裸 ipcMain.handle 注册 —— handler 形参不受约束，' +
        '极易出现「preload 发对象 / handler 读位置参数」的静默失效。请改注册点为 typedHandle：\n  ' +
        violations.join('\n  ')
    ).toEqual([])
  })

  it('门禁有判别力：已知的例外通道不在违规清单里（避免把合法用法误报）', () => {
    const flags = contractReqVoidFlags()
    const bare = bareHandleChannels()
    // 这 8 条不在契约里，应当被跳过而不是报错
    const knownOutsideContract = [
      'screenshot:getWindowList',
      'screenshot:captureWindow',
      'screenshot:startCapture',
      'screenshot:endCapture',
      'platform:setDockBadge',
      'platform:setProgressBar',
      'platform:requestUserAttention',
      'video:readFile'
    ]
    for (const ch of knownOutsideContract) {
      expect(flags.has(ch), `${ch} 不该出现在登记册里（若已收编请更新本用例）`).toBe(false)
    }
    const stillBare = [...bare.keys()].filter((ch) => knownOutsideContract.includes(ch))
    expect(stillBare.sort()).toEqual([...knownOutsideContract].sort())
  })
})

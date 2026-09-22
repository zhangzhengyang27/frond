/**
 * 宿主能力桥（P-2.3）
 *
 * 插件页里宿主已注入 `launcherApi`（notify / copyText / readText / db…），
 * 但 React SDK 过去只导出 6 个视图组件 + useNavigation，这些能力对 React 插件不可达，
 * `@leaf/raycast-api` 只能把它们降级成 notSupported。本模块做的是纯接线：
 * 把宿主已有能力包成 Raycast 的形状，**宿主没有的一律不假装**
 * （只剩 getSelectedText 仍不提供，见 leaf-raycast-api 里那条 notSupported）。
 */

interface PluginHostApi {
  notify?: (body: unknown) => Promise<unknown> | unknown
  copyText?: (text: unknown) => Promise<unknown> | unknown
  readText?: () => Promise<string> | string
  getContext?: () => Promise<PluginContext | null> | PluginContext | null
  close?: () => Promise<unknown> | unknown
  db?: {
    put?: (id: string, data: unknown) => Promise<unknown> | unknown
    get?: (id: string) => Promise<{ id: string; data: unknown } | null>
    remove?: (id: string) => Promise<unknown> | unknown
  }
  openUrl?: (url: string) => Promise<boolean> | boolean
  alert?: (input: {
    title?: string
    message: string
    actions?: unknown[]
  }) => Promise<string | null>
  preferences?: {
    all?: () => Promise<{ ok?: boolean; values?: Record<string, unknown> } | undefined>
  }
}

/** Alert 的一个动作按钮。style 只影响呈现（destructive 走警告框样式），不影响语义 */
export interface AlertAction {
  id: string
  title: string
  style?: 'destructive' | 'cancel' | 'default'
}

/** 宿主下发的插件上下文（字段名与 plugapi:getContext 一致：pluginId / name / cmd / args） */
export interface PluginContext {
  pluginId?: string
  name?: string
  cmd?: string | null
  args?: Record<string, string> | null
}

/** 取宿主 API；非插件环境（单测未 stub / 纯 node）返回 undefined，调用方按 no-op 处理 */
function host(): PluginHostApi | undefined {
  return (globalThis as { launcherApi?: PluginHostApi }).launcherApi
}

/** Raycast `Toast.show(style, message)` / `Toast.show({ style, title, message })` 两种形态都收 */
export function showToast(styleOrInput: unknown, message?: string): void {
  const api = host()
  if (!api?.notify) return
  let body: string
  if (typeof styleOrInput === 'string') {
    body = message ? `${styleOrInput}：${message}` : styleOrInput
  } else {
    const input = (styleOrInput ?? {}) as { title?: unknown; message?: unknown }
    body = [input.title, input.message]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .join('：')
  }
  if (body) void api.notify(body)
}

export async function copyToClipboard(text: string): Promise<void> {
  await host()?.copyText?.(text)
}

/**
 * 取本次打开的上下文。Action 命令（manifest mode:'action'）靠它在开工前分辨
 * 「这次是要界面还是不要界面」——模块顶层就得分支，所以是 async 而不是 hook。
 */
export async function getPluginContext(): Promise<PluginContext | null> {
  const api = host()
  if (!api?.getContext) return null
  return (await api.getContext()) ?? null
}

/** 结束并关闭插件（Action 命令跑完必须自己调，否则等宿主 20s 兜底回收） */
export async function closePlugin(): Promise<void> {
  await host()?.close?.()
}

export async function getClipboardText(): Promise<string> {
  const text = await host()?.readText?.()
  return typeof text === 'string' ? text : ''
}

/** LocalStorage / Cache 各自的前缀：两套键互不覆盖，也便于按前缀清理 */
const LS_PREFIX = 'ls:'
const CACHE_PREFIX = 'cache:'

async function readRecord(
  key: string
): Promise<{ value?: unknown; expiresAt?: number } | undefined> {
  const got = await host()?.db?.get?.(key)
  const data = got?.data
  return data && typeof data === 'object'
    ? (data as { value?: unknown; expiresAt?: number })
    : undefined
}

export async function getLocalStorageItem(key: string): Promise<string | undefined> {
  const rec = await readRecord(LS_PREFIX + key)
  return typeof rec?.value === 'string' ? rec.value : undefined
}

export async function setLocalStorageItem(key: string, value: string): Promise<void> {
  await host()?.db?.put?.(LS_PREFIX + key, { value })
}

export async function removeLocalStorageItem(key: string): Promise<void> {
  await host()?.db?.remove?.(LS_PREFIX + key)
}

/**
 * Cache：与 LocalStorage 同一 KV 命名空间，但记录里带 expiresAt，
 * 读到即过期就顺手删掉（Raycast 的 ttl 是秒；缺省不过期）。
 */
export async function getCacheItem(key: string): Promise<string | undefined> {
  const rec = await readRecord(CACHE_PREFIX + key)
  if (!rec || typeof rec.value !== 'string') return undefined
  if (typeof rec.expiresAt === 'number' && rec.expiresAt <= Date.now()) {
    await removeCacheItem(key)
    return undefined
  }
  return rec.value
}

export async function setCacheItem(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const expiresAt =
    typeof ttlSeconds === 'number' && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined
  await host()?.db?.put?.(CACHE_PREFIX + key, expiresAt ? { value, expiresAt } : { value })
}

export async function removeCacheItem(key: string): Promise<void> {
  await host()?.db?.remove?.(CACHE_PREFIX + key)
}

/**
 * Alert（P-2.5）：宿主原生模态框。返回被按下的动作 id；
 * 没声明动作的确认框（只有一个「好」）返回 null。
 * 主进程侧会把标题拼成「插件名 · 标题」——用户得知道是谁在弹这个框。
 */
export async function showAlert(input: {
  title?: string
  message: string
  actions?: AlertAction[]
}): Promise<string | null> {
  const api = host()
  if (!api?.alert) return null
  const pressed = await api.alert({
    title: input.title,
    message: input.message,
    actions: input.actions ?? []
  })
  return typeof pressed === 'string' ? pressed : null
}

/**
 * open(url)：把链接交给系统浏览器。需 manifest.permissions 里有 'net'，
 * 且协议只在 http/https/mailto 白名单内（file: 与自定义 scheme 一律拒）。
 * 返回「宿主是否接受这次打开」——不返回浏览器加载结果。
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  const api = host()
  if (!api?.openUrl) return false
  return (await api.openUrl(url)) === true
}

/**
 * 一次取回 manifest.preferences 声明过的全部偏好（没设过的落默认值）。
 * **与 Raycast 的差别**：那边是同步的，这里跨进程必须 await。
 */
export async function getPreferenceValues<T = Record<string, unknown>>(): Promise<T> {
  const res = await host()?.preferences?.all?.()
  return ((res?.ok ? res.values : undefined) ?? {}) as T
}

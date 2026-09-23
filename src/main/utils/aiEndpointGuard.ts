/**
 * Frond · AI 端点守卫
 *
 * AI baseUrl 由用户在设置中自配（渲染端可写），主进程请求时会携带
 * Authorization 头——必须防止被攻陷的渲染端把带凭据的请求打到
 * 云元数据等高危地址（SSRF）。
 *
 * 信任模型与插件 fetch（netGuard + proxyPluginFetch，全内网封锁）不同：
 * Ollama / LM Studio 等本地模型端点是本产品的明确支持场景（回环与局域网
 * 放行），因此只硬阻断元数据 / 链路本地 / 保留段，并限制协议与凭据。
 */
import { lookup as dnsLookup } from 'dns/promises'
import { classifyIpRisk } from '../launcher/netGuard'

export type LookupFn = (host: string) => Promise<{ address: string; family: number }[]>

const defaultLookup: LookupFn = async (host) => {
  const addrs = await dnsLookup(host, { all: true })
  return addrs.map((a) => ({ address: a.address, family: a.family }))
}

export type AiEndpointCheck = { ok: true } | { ok: false; reason: string }

/**
 * 校验 AI baseUrl 是否允许作为请求目标。
 * @param rawBaseUrl 用户配置的 baseUrl（如 https://api.openai.com/v1）
 * @param lookup DNS 解析函数（可注入便于测试）
 */
export async function assertAiEndpointAllowed(
  rawBaseUrl: string,
  lookup: LookupFn = defaultLookup
): Promise<AiEndpointCheck> {
  let url: URL
  try {
    url = new URL(rawBaseUrl)
  } catch {
    return { ok: false, reason: 'AI baseUrl 不是合法 URL' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `仅允许 http(s) 端点（当前 ${url.protocol}）` }
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'AI baseUrl 不允许内嵌凭据' }
  }

  const checkAddr = (addr: string): AiEndpointCheck | null =>
    classifyIpRisk(addr) === 'blocked'
      ? { ok: false, reason: `AI baseUrl 指向受限地址 ${addr}（元数据/链路本地/保留段）` }
      : null

  const host = url.hostname.replace(/^\[|\]$/g, '')
  // 字面量地址：直接分级判定
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    const hit = checkAddr(host)
    if (hit) return hit
    return { ok: true }
  }
  // localhost 快速路径：本地模型端点，无需解析
  if (host === 'localhost' || host.endsWith('.localhost')) return { ok: true }
  // 域名：解析后逐地址复核（防 DNS rebinding），解析失败 fail closed
  let addrs: { address: string; family: number }[]
  try {
    addrs = await lookup(host)
  } catch {
    return { ok: false, reason: `AI baseUrl 域名解析失败：${host}` }
  }
  if (!addrs || addrs.length === 0) {
    return { ok: false, reason: `AI baseUrl 域名解析失败：${host}` }
  }
  for (const { address } of addrs) {
    const hit = checkAddr(address)
    if (hit) return hit
  }
  return { ok: true }
}

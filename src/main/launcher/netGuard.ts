/**
 * Frond · 网络地址守卫（纯函数，SSRF 防护的判定核心）
 *
 * 从 runtime.ts 抽出为独立模块：无任何依赖，可脱离 electron 直接单测。
 */

/** IPv4/IPv6/localhost 字面量是否为本地/内网/链路本地地址 */
export function isLocalAddressLiteral(value: string): boolean {
  const v = value.toLowerCase().replace(/^\[|\]$/g, '')
  if (v === 'localhost' || v.endsWith('.localhost')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    const parts = v.split('.').map(Number)
    const [a, b, c] = parts
    if (a === 127 || a === 10 || a === 0) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true // 198.18.0.0/15 benchmark
    if (a === 192 && b === 0 && c === 2) return true // TEST-NET-1
    if (a === 198 && b === 51 && c === 100) return true // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true // TEST-NET-3
    if (a >= 224 && a <= 239) return true // 组播
    if (a >= 240) return true // 保留 / 广播
    return false
  }
  // IPv4-mapped IPv6。WHATWG URL 会把 [::ffff:127.0.0.1] 规范化成十六进制
  // 形态 ::ffff:7f00:1（而非点分十进制），必须把十六进制尾段还原成 IPv4 再判；
  // 识别不了的 mapped 形态一律按本地处理（fail closed）
  if (v.startsWith('::ffff:')) {
    const mapped = mappedIpv6ToIpv4(v)
    return mapped ? isLocalAddressLiteral(mapped) : true
  }
  if (v === '::' || v === '::1') return true
  if (v.startsWith('fe80:')) return true // link-local
  if (v.startsWith('fc') || v.startsWith('fd')) return true // unique local fc00::/7
  if (v.startsWith('2001:db8:')) return true // 文档段
  if (v.startsWith('ff0')) return true // 组播 ff00::/8
  return false
}

/** ::ffff:XXXX:YYYY（IPv4-mapped 十六进制形态）→ 点分十进制；非 mapped 形态返回 null */
export function mappedIpv6ToIpv4(v: string): string | null {
  const tail = v.slice('::ffff:'.length)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(tail)) return tail
  const groups = tail.split(':').filter(Boolean)
  // mapped 地址显式部分固定为 2 组 16-bit（前 5 组被 :: 压缩）
  if (groups.length !== 2) return null
  const nums = groups.map((g) => parseInt(g.padStart(4, '0'), 16))
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null
  const [hi, lo] = nums
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`
}

/**
 * 地址风险分级（AI 端点守卫等需要比 isLocalAddressLiteral 更细粒度的场景）：
 * - loopback：本机回环（Ollama / LM Studio 等本地模型端点）
 * - lan：私有网段（局域网内的自建服务）
 * - blocked：高危段——云元数据 / 链路本地 / CGNAT / 保留 / 组播 / 文档段，
 *   即使是用户自配场景也不允许作为请求目标
 * - public：公网地址
 * 无法识别的输入一律 blocked（fail closed）。
 */
export type IpRiskLevel = 'loopback' | 'lan' | 'blocked' | 'public'

export function classifyIpRisk(value: string): IpRiskLevel {
  const v = value.toLowerCase().replace(/^\[|\]$/g, '')
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    const [a, b, c] = v.split('.').map(Number)
    if (a === 127) return 'loopback'
    if (a === 10 || a === 192 || a === 172) {
      // 10/8、192.168/16、172.16/12（172 的后两段仅 16-31 是私网）
      if (a === 10) return 'lan'
      if (a === 192 && b === 168) return 'lan'
      if (a === 172 && b >= 16 && b <= 31) return 'lan'
    }
    if (a === 0) return 'blocked'
    if (a === 169 && b === 254) return 'blocked' // link-local / 云元数据
    if (a === 100 && b >= 64 && b <= 127) return 'blocked' // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return 'blocked' // benchmark
    if (a === 192 && b === 0 && c === 2) return 'blocked' // TEST-NET-1
    if (a === 198 && b === 51 && c === 100) return 'blocked' // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return 'blocked' // TEST-NET-3
    if (a >= 224) return 'blocked' // 组播 224-239 + 保留/广播 240+
    return 'public'
  }
  if (v.startsWith('::ffff:')) {
    const mapped = mappedIpv6ToIpv4(v)
    return mapped ? classifyIpRisk(mapped) : 'blocked'
  }
  if (v === '::1') return 'loopback'
  if (v === '::') return 'blocked'
  if (v.startsWith('fe80:')) return 'blocked' // link-local
  if (v.startsWith('fc') || v.startsWith('fd')) return 'lan' // unique local fc00::/7
  if (v.startsWith('2001:db8:')) return 'blocked' // 文档段
  if (v.startsWith('ff0')) return 'blocked' // 组播
  if (v.includes(':')) return 'public' // 其余可解析的 IPv6 形态
  return 'blocked' // 空串 / 垃圾输入 fail closed
}

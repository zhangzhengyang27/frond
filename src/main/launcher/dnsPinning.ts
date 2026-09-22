export type DnsResolver = (hostname: string, family?: number) => Promise<DnsRecord[]>

/** 直接对齐 net.LookupFunction 签名（审查修复：与 Agent lookup 类型兼容） */
export type PinningLookup = LookupFunction

/** 默认解析器：系统 DNS（all + verbatim，拿全量记录逐个判定） */
export const systemResolver: DnsResolver = async (hostname, family) => {
  const res = await dnsPromises.lookup(hostname.replace(/^\[|\]$/g, ''), {
    all: true,
    verbatim: true,
    ...(family === 4 || family === 6 ? { family } : {})
  })
  return res as DnsRecord[]
}

/**
 * 创建钉住 lookup（注入 resolver 便于单测）。语义：
 * - 全部命中内网 → err.code = 'ELEAF_BLOCKED_LOCAL'
 * - 混合记录 → 只把公网记录交给连接层（攻击者多记录投毒时剔除内网项）
 * - family 过滤：options.family = 4/6 时只返回匹配族的安全记录
 */
export function createPinningLookup(resolver: DnsResolver = systemResolver): PinningLookup {
  return (hostname, options, callback) => {
    resolver(hostname, options?.family)
      .then((records) => {
        const safe = records.filter(
          (r) =>
            !isLocalAddressLiteral(r.address) &&
            (!options?.family || options.family === 0 || r.family === options.family)
        )
        if (safe.length === 0) {
          const err = new Error(`blocked: DNS 解析命中本地/内网地址（${hostname}）`) as NodeJS.ErrnoException
          err.code = 'ELEAF_BLOCKED_LOCAL'
          callback(err)
          return
        }
        callback(null, safe as unknown as LookupAddress[])
      })
      .catch((err) => callback(err as NodeJS.ErrnoException))
  }
}

let pinnedHttpsAgent: https.Agent | null = null
let pinnedHttpAgent: http.Agent | null = null

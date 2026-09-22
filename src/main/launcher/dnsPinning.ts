/**
 * Leaf · DNS 钉住 lookup（V4 审查 I3：重绑定防御的连接层）
 *
 * 插件 fetch 代理与市场下载在发起前都校验过目标不是内网，但 DNS 可以投毒成
 * 「第一次解析公网、真正连接时第二次解析到 127.0.0.1」。这里把连接层 lookup 换成
 * 逐地址复判：内网项剔除，全内网直接报错（fail closed）。
 *
 * ⚠ 恢复说明：本文件随 2026-09-22 删除事故丢了头部与尾部，中间主体为找回原文。
 * 头部按 runtime.ts:19/market.ts 的实际引用补回（isLocalAddressLiteral 属 netGuard，
 * 不在本模块），尾部 pinningAgentSelector 按两个调用点的用法重建
 * （都写作 `agent: pinningAgentSelector()` 并带 `as Parameters<typeof fetch>[1]` 断言，
 * 故它是「返回 selector 的工厂」，与模块级那两个 agent 缓存变量对得上）。
 */

import * as http from 'node:http'
import * as https from 'node:https'
import { promises as dnsPromises, type LookupAddress } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { isLocalAddressLiteral } from './netGuard'

/** DNS 记录的最小形状：注入 resolver 时测试只需给 address/family */
export interface DnsRecord {
  address: string
  family: number
}

export type DnsResolver = (hostname: string, family?: number) => Promise<DnsRecord[]>

/** 直接对齐 net.LookupFunction 签名（审查修复：与 Agent lookup 类型兼容） */
export type PinningLookup = LookupFunction

export type { LookupAddress }

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

/** 一套 lookup 复用，别每次 new Agent 都造一个 */
let sharedLookup: PinningLookup | null = null

function pinningLookup(): PinningLookup {
  sharedLookup ??= createPinningLookup()
  return sharedLookup
}

/**
 * 给 node-fetch 的 `agent` 选项用：返回一个按请求协议挑 Agent 的 selector。
 * keepAlive 与原生默认一致；两个 Agent 都缓存，避免每次抓取新建连接池。
 */
export function pinningAgentSelector(): (
  request: { protocol?: string }
) => http.Agent | https.Agent {
  return (request) => {
    if (request.protocol === 'https:') {
      pinnedHttpsAgent ??= new https.Agent({ lookup: pinningLookup(), keepAlive: true })
      return pinnedHttpsAgent
    }
    pinnedHttpAgent ??= new http.Agent({ lookup: pinningLookup(), keepAlive: true })
    return pinnedHttpAgent
  }
}

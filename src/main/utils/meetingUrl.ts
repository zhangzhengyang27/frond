/**
 * Leaf · 会议链接提取（V4 P0-1 批次4，纯函数可单测）
 *
 * 对齐 Raycast 的会议服务商识别（一期常用子集）：从事件的 URL / 位置 / 备注
 * 字段里提取「可一键入会」的链接。服务商按优先级取第一个命中；全部未命中但
 * 存在任意 http(s) 链接时按通用链接返回（用户手动判断）。
 */

export interface MeetingLink {
  url: string
  provider:
    | 'zoom'
    | 'teams'
    | 'meet'
    | 'webex'
    | 'facetime'
    | 'whereby'
    | 'jitsi'
    | 'skype'
    | 'generic'
}

/** 服务商匹配规则（按优先级；正则只做域名特征识别，不做 URL 规范化） */
const PROVIDERS: Array<{ provider: MeetingLink['provider']; re: RegExp }> = [
  { provider: 'zoom', re: /(?:zoom\.us\/|zoommtg:\/?\/?)/i },
  { provider: 'teams', re: /teams\.microsoft\.com\/|teams\.live\.com\//i },
  { provider: 'meet', re: /meet\.google\.com\//i },
  { provider: 'webex', re: /(?:webex\.com\/|\.webex\.com\/)/i },
  { provider: 'facetime', re: /facetimeapple\.com\/|facetime:\/?\/?/i },
  { provider: 'whereby', re: /whereby\.com\//i },
  { provider: 'jitsi', re: /meet\.jit\.si\//i },
  { provider: 'skype', re: /skype:\/?\/?/i }
]

/** URL 抓取：http(s) / 已注册会议 scheme；排除结尾标点与全角括号 */
const URL_RE = /(?:https?:\/\/|zoommtg:\/\/)[^\s<>"'）)】】]+/g

/** 从事件字段提取会议链接；找不到返回 null */
export function extractMeetingLink(fields: {
  url?: string | null
  location?: string | null
  notes?: string | null
}): MeetingLink | null {
  // 字段优先级：URL > 位置 > 备注（Raycast 同序）
  const haystacks = [fields.url, fields.location, fields.notes]
  for (const haystack of haystacks) {
    if (!haystack) continue
    const urls = haystack.match(URL_RE)
    if (!urls) continue
    for (const raw of urls) {
      const url = raw.replace(/[.,;:!?'"]+$/g, '')
      for (const { provider, re } of PROVIDERS) {
        if (re.test(url)) return { url, provider }
      }
    }
  }
  // 服务商全未命中：回退第一个通用 http(s) 链接（zoommtg:// 无 http 变体时不回退）
  for (const haystack of haystacks) {
    if (!haystack) continue
    const urls = haystack.match(/https?:\/\/[^\s<>"'）)】]+/g)
    if (urls && urls.length > 0)
      return { url: urls[0].replace(/[.,;:!?'"]+$/g, ''), provider: 'generic' }
  }
  return null
}

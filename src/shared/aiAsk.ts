/**
 * Leaf · 「问 AI：解释这条结果」的提示词拼装（P-4③）
 *
 * 放在 shared 是因为它是**唯一的产品判断**：一条搜索结果要变成什么问题，
 * 决定多少上下文会离开本机去模型。所以这里刻意做三件事：
 * ① 每种类型只带上它自己那份必要信息（文件带路径、剪贴板带正文片段），
 *    不把整条 entry 的字段一股脑塞进去；
 * ② 正文类内容截断（剪贴板里可能是一整篇文档，默认不该全发出去）；
 * ③ 输出是给用户**看得见**的一句话——它会在 AI 页里作为自己发出去的消息出现，
 *    不是藏在系统提示里的隐式上下文。
 */

export interface AiAskSource {
  title: string
  subtitle?: string
  badge?: string
  action?: { type?: string; path?: string; url?: string; content?: string }
}

/** 正文片段上限：够模型判断「这是什么」，不够把整篇文档寄出去 */
export const AI_ASK_BODY_MAX = 1200

export function buildEntryAsk(entry: AiAskSource): string {
  const title = (entry.title ?? '').trim() || '(无标题)'
  const a = entry.action
  const body = (v: string | undefined): string => {
    const t = (v ?? '').replace(/\s+$/g, '')
    if (!t) return ''
    return t.length > AI_ASK_BODY_MAX ? `${t.slice(0, AI_ASK_BODY_MAX)}…（已截断）` : t
  }

  switch (a?.type) {
    case 'file':
      return `解释这个本地文件是什么、通常用来做什么：${body(a.path) || title}`
    case 'app':
      return `解释这个本机应用是做什么的：${title}${a.path ? `（${a.path}）` : ''}`
    case 'openUrl':
      return `解释这个链接指向什么、能做什么：${body(a.url) || title}`
    case 'clipboardItem':
    case 'snippetItem': {
      const text = body(a.content) || body(entry.subtitle) || title
      return `总结下面这段内容，并指出它是什么类型的东西：\n${text}`
    }
    case 'module':
    case 'page':
      return `介绍 Leaf 的这个功能能做什么：${title}${entry.subtitle ? `（${entry.subtitle}）` : ''}`
    default:
      return `解释这条搜索结果是什么、怎么用：${title}${entry.subtitle ? `（${entry.subtitle}）` : ''}`
  }
}

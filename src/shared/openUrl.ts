/**
 * Leaf · openUrl 白名单（V4 批次4 审查 I-diff2）
 *
 * 背景：主进程 `system:openExternal` 仅放行 http(s)，而会议链接提取会产生
 * zoommtg:// 等客户端 scheme——手动入会（openUrl 动作）会静默失败，
 * 与自动入会（主进程直开）不一致。此白名单两条入会路径共用。
 */

/** 允许 openUrl 动作打开的 scheme（会议客户端 scheme 子集 + 网页） */
export const OPEN_URL_SCHEMES = ['http:', 'https:', 'zoommtg:', 'facetime:', 'skype:'] as const

/** 校验 URL 的 scheme 在白名单内；畸形 URL（无法解析）返回 false */
export function isOpenUrlAllowed(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return (OPEN_URL_SCHEMES as readonly string[]).includes(url.protocol)
  } catch {
    return false
  }
}

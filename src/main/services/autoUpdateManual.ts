/**
 * Frond · mac 未签名期间的手动更新逻辑（决策 D2 的兜底路径）
 *
 * 为什么存在：mac 未签名/未公证时 electron-updater 的静默安装信任链不完整
 * （AutoUpdateService 头注释），照 MelodyAir（同作者、已跑通 5 次发布）的方案：
 * 检查 = GitHub releases/latest 比版本，安装 = 引导用户打开下载页手动替换。
 * 本文件只放**纯逻辑与常量**（可单测），Electron 侧接线在 AutoUpdateService。
 *
 * 仓库常量与 electron-builder.yml 的 publish 配置由
 * autoUpdateManual.test.ts 互相钉住：换仓库时两边必须同改。
 */

export const REPO = 'zhangzhengyang27/frond'
export const GITHUB_LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`
export const GITHUB_RELEASES_URL = `https://github.com/${REPO}/releases/latest`

export interface ReleaseAsset {
  name: string
  browser_download_url: string
}

/** 语义化版本比较：a > b 返回 true。缺段补 0、带 v 前缀可比、段按数值不按字典序 */
export function isNewerVersion(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na !== nb) return na > nb
  }
  return false
}

/** 按当前架构挑 mac dmg 资产：先挑带架构后缀的，没有则回退任意 dmg；没有 dmg 返回 null */
export function pickMacDownloadUrl(
  assets: ReleaseAsset[] | undefined,
  arch: string
): string | null {
  const dmgs = (assets ?? []).filter(
    (a) => a.name.toLowerCase().endsWith('.dmg') && !a.name.toLowerCase().endsWith('.dmg.zip')
  )
  const archHit = dmgs.find((a) => a.name.includes(arch))
  return (archHit ?? dmgs[0])?.browser_download_url ?? null
}

export interface ManualUpdateInfo {
  version: string
  downloadUrl: string
  releasesUrl: string
}

/** 把 GitHub releases/latest 的 JSON 载荷解析成手动更新信息；无更新或载荷异常返回 null */
export function parseLatestRelease(
  payload: unknown,
  currentVersion: string,
  arch: string
): ManualUpdateInfo | null {
  if (typeof payload !== 'object' || payload === null) return null
  const tag = (payload as { tag_name?: unknown }).tag_name
  if (typeof tag !== 'string' || !tag) return null
  const latestVersion = tag.replace(/^v/, '')
  if (!isNewerVersion(latestVersion, currentVersion)) return null
  const assets = (payload as { assets?: unknown }).assets
  const safeAssets = Array.isArray(assets)
    ? assets.filter(
        (a): a is ReleaseAsset =>
          typeof a === 'object' &&
          a !== null &&
          typeof (a as ReleaseAsset).name === 'string' &&
          typeof (a as ReleaseAsset).browser_download_url === 'string'
      )
    : undefined
  return {
    version: latestVersion,
    downloadUrl: pickMacDownloadUrl(safeAssets, arch) ?? GITHUB_RELEASES_URL,
    releasesUrl: GITHUB_RELEASES_URL
  }
}

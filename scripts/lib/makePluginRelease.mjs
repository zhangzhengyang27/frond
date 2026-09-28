/**
 * make-plugin-release 的纯逻辑：市场索引条目构造。
 *
 * 校验规则与主进程 `src/main/launcher/market.ts` 的静默剔除规则**同源**
 * （isValidPluginId 的正则/前缀、sha256 64 位十六进制、远程条目 https-only），
 * 但作者侧**给原因**而不是静默丢弃——静默剔除是面向恶意索引的，作者自查时
 * 看不到原因只会困惑（PLUGIN_DEVELOPMENT.md §5 警告过的坑）。
 */

/**
 * 与 src/main/launcher/pluginStore.ts isValidPluginId 保持同源：
 * 词字符首尾、不含 `..`、不以 `sys.` 开头。
 */
export function isValidPluginId(id) {
  return /^[\w](?:[\w.-]*[\w])?$/.test(id) && !id.includes('..') && !id.toLowerCase().startsWith('sys.')
}

const SHA256_RE = /^[0-9a-f]{64}$/

/**
 * @param {{id,name,version?,description?,author?,download,sha256?}} fields
 * @returns {{entry:object}|{error:string}} error 给原因；entry 为可入索引的条目
 */
export function buildIndexEntry(fields) {
  const { id, name, download, sha256 } = fields
  if (typeof id !== 'string' || !isValidPluginId(id)) {
    return { error: `id 不合法（"${id}"）：需词字符首尾、不含 ".."、不以 "sys." 开头（与市场校验同源）` }
  }
  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'name 缺失：市场条目必须有 name（与 plugin.json 一致）' }
  }
  if (typeof download !== 'string' || !download.trim()) {
    return { error: 'download 缺失：https zip 直链（远程索引不接受本地路径）' }
  }
  if (!download.startsWith('https://')) {
    return { error: `download 必须 https（远程索引只收 https 直链）：${download}` }
  }
  const entry = { id, name }
  if (fields.version) entry.version = fields.version
  if (fields.description) entry.description = fields.description
  if (fields.author) entry.author = fields.author
  entry.download = download
  if (sha256 != null) {
    if (typeof sha256 !== 'string' || !SHA256_RE.test(sha256.toLowerCase())) {
      return { error: `sha256 不是 64 位十六进制：市场会静默剔除该条目（"${String(sha256).slice(0, 12)}…"）` }
    }
    entry.sha256 = sha256.toLowerCase()
  }
  return { entry }
}

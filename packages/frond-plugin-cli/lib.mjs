/**
 * frond-plugin CLI 的纯逻辑（可单测）：
 * - 脚手架清单/页面渲染（init）
 * - 市场索引条目 upsert（publish）——条目校验复用 scripts/lib/makePluginRelease.mjs
 *   （与主进程 market.ts 静默剔除规则同源的那份）
 * 校验在作者侧给原因，不在发布时静默丢条目。
 */
import { buildIndexEntry, isValidPluginId } from '../../scripts/lib/makePluginRelease.mjs'

export { buildIndexEntry, isValidPluginId }

/** 目录名 → 反向域名缺省 id：`my tool` → `com.author.my-tool`（author 由 --author 给，缺 author 用占位） */
export function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * init 参数归一：目录名缺省用 name slug；id 缺省 `com.<author>.<slug>`；
 * 归一后过 isValidPluginId（不过就是错误，返回 {error}）。
 */
export function normalizeInit({ dir, name, author, id }) {
  const cleanName = String(name ?? '').trim()
  if (!cleanName) return { error: '插件名缺失（--name 或第一个位置参数）' }
  const explicitId = String(id ?? '').trim()
  const slug = slugify(cleanName)
  // 纯中文等非 ASCII 名派生不出 slug：显式给 id 就放行（目录名用 id 尾段），
  // 没给才报错并指路——name 本身可以继续是中文
  if (!slug && !explicitId) {
    return {
      error: `插件名 "${cleanName}" 不含 ASCII 词字符，无法自动生成 id——name 可继续用中文，但请用 --id com.<你>.<英文slug> 显式指定`
    }
  }
  const cleanAuthor = String(author ?? 'myname').trim()
  const finalId = explicitId || `com.${slugify(cleanAuthor) || 'myname'}.${slug}`
  if (!isValidPluginId(finalId)) {
    return { error: `id 不合法："${finalId}"（词字符首尾、不含 ".."、不以 "sys." 开头）` }
  }
  const fallbackDir = slug || finalId.split('.').pop() || 'plugin'
  return {
    dir: String(dir ?? fallbackDir).trim() || fallbackDir,
    id: finalId,
    name: cleanName,
    author: cleanAuthor
  }
}

/** init 的三份文件内容（与宿主清洗规则同形：permissions 只声明真实用到的） */
export function renderScaffold({ id, name, author, commandTitle }) {
  const manifest = {
    id,
    name,
    version: '0.1.0',
    description: `${name} — 由 frond-plugin init 生成`,
    author,
    main: 'index.html',
    commands: [
      {
        code: 'list',
        title: commandTitle ?? name,
        description: '声明式列表：renderList 交给宿主渲染'
      }
    ],
    permissions: []
  }
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${name}</title>
    <style>
      body { font: 13px -apple-system, sans-serif; padding: 12px; color: inherit; }
      code { background: rgba(127, 127, 127, 0.15); padding: 1px 5px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h3>${name}</h3>
    <p>Search "<code>${name}</code>" in the launcher and press Enter to see the list.</p>
    <p>Full API: <code>window.launcherApi</code> (see PLUGIN_DEV.md).</p>
    <script>
      // 声明式列表最小示例：宿主加载页面后调用 onEnter，渲染走 renderList
      if (window.frondPluginHooks?.onEnter) {
        window.frondPluginHooks.onEnter(() => {
          window.launcherApi.renderList([
            {
              title: 'Hello from ${name}',
              subtitle: 'Edit index.html and reload the plugin',
              actions: [{ title: 'Copy greeting', type: 'copy', payload: 'Hello from ${name}!' }]
            }
          ])
        })
      }
    </script>
  </body>
</html>
`
  const readme = `# ${name}

Scaffolded by \`frond-plugin init\`. See the package README for the full 0→1 flow.
`
  return { manifest, html, readme }
}

/**
 * publish 的索引 upsert（纯函数）：按 id 替换或追加，保留索引里未知字段
 * （version/plugins 之外的键原样透传），返回新 JSON 文本（2 空格缩进 + 尾换行）。
 */
export function upsertEntry(rawIndexText, entry) {
  let parsed
  try {
    parsed = JSON.parse(rawIndexText)
  } catch {
    parsed = null
  }
  const base = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  const plugins = Array.isArray(base.plugins) ? base.plugins.filter((p) => p && typeof p === 'object') : []
  const at = plugins.findIndex((p) => p.id === entry.id)
  if (at >= 0) plugins[at] = entry
  else plugins.push(entry)
  const next = { ...base, version: typeof base.version === 'number' ? base.version : 1, plugins }
  return `${JSON.stringify(next, null, 2)}\n`
}

/** publish 参数归一：download 必须是 https（远程索引只收直链，与 buildIndexEntry 同口径） */
export function normalizePublish({ download }) {
  const url = String(download ?? '').trim()
  if (!url.startsWith('https://')) {
    return { error: `--download 必须 https 直链（远程索引不接受本地路径）："${url || '（缺）'}"` }
  }
  return { download: url.replace(/<zipname>/g, zipNameOf(url)) }
}

function zipNameOf(url) {
  return url.split('/').pop() || 'plugin.zip'
}

/**
 * com.third.hn · 核心逻辑（lib.js）
 *
 * UMD 双导出：插件页挂 globalThis.FrondHnLib，vitest（node）走 module.exports。
 * 网络与渲染留在 index.html（走宿主 api.fetch 代理），这里只做纯变换。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondHnLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var HN_ITEM_URL = 'https://hacker-news.firebaseio.com/v0/item/'

  /** topstories 响应（id 数组）→ 前 n 个 id；坏响应返回 [] */
  function parseTopIds(body, n) {
    var ids = []
    try {
      var parsed = typeof body === 'string' ? JSON.parse(body) : body
      if (!Array.isArray(parsed)) return []
      for (var i = 0; i < parsed.length && ids.length < n; i++) {
        var id = Number(parsed[i])
        if (Number.isInteger(id) && id > 0) ids.push(id)
      }
    } catch (e) {
      void e
    }
    return ids
  }

  /** 单条 story 响应 → 列表行 | null（job/坏数据跳过） */
  function toRow(story) {
    if (!story || typeof story !== 'object') return null
    if (!story.title || (!story.url && !story.text)) return null
    if (story.type && story.type !== 'story') return null
    var score = Number(story.score)
    var comments = story.descendants != null ? Number(story.descendants) : null
    var tags = []
    if (Number.isFinite(score)) tags.push('▲ ' + score)
    if (comments != null && Number.isFinite(comments)) tags.push('💬 ' + comments)
    return {
      title: String(story.title),
      subtitle: story.by ? 'by ' + story.by : '',
      accessories: tags.map(function (t) {
        return { tag: t }
      }),
      output: story.url || '',
      actions: story.url
        ? [
            { label: '打开原文', type: 'open', payload: story.url, hint: '↵' },
            { label: '复制链接', type: 'copy', payload: story.url },
            {
              label: 'HN 讨论页',
              type: 'open',
              payload: 'https://news.ycombinator.com/item?id=' + story.id
            }
          ]
        : [{ label: '复制标题', type: 'copy', payload: String(story.title) }]
    }
  }

  /** 过滤：title/by 子串，大小写不敏感；空查全量 */
  function filterRows(rows, query) {
    var q = String(query || '')
      .trim()
      .toLowerCase()
    if (!q) return rows
    return rows.filter(function (r) {
      return (
        r.title.toLowerCase().indexOf(q) >= 0 ||
        String(r.subtitle || '').toLowerCase().indexOf(q) >= 0
      )
    })
  }

  return {
    HN_ITEM_URL: HN_ITEM_URL,
    parseTopIds: parseTopIds,
    toRow: toRow,
    filterRows: filterRows
  }
})

/**
 * Frond · 常用目录插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondQuickfoldersLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondQuickfoldersLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /** 旧数据（string 数组）→ 新结构 [{path, pinned, openCount}] */
  function migrate(raw) {
    if (!Array.isArray(raw)) return []
    return raw.map(function (item) {
      if (typeof item === 'string') return { path: item, pinned: false, openCount: 0 }
      return {
        path: String(item && item.path ? item.path : ''),
        pinned: item && item.pinned === true,
        openCount: item && typeof item.openCount === 'number' ? item.openCount : 0
      }
    }).filter(function (f) {
      return f.path !== ''
    })
  }

  /** 排序：置顶优先，再按打开次数降序，最后按路径字典序 */
  function sortFolders(list) {
    return migrate(list).slice().sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (b.openCount !== a.openCount) return b.openCount - a.openCount
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    })
  }

  /** 取路径尾段为展示名；根路径 '/' 原样 */
  function normalizeName(path) {
    var p = String(path)
    if (p === '/' || p === '') return p === '/' ? '/' : p
    var segs = p.split('/')
    for (var i = segs.length - 1; i >= 0; i--) {
      if (segs[i] !== '') return segs[i]
    }
    return '/'
  }

  /** 以某路径为前缀的同级子目录（基于已存清单，不读 fs） */
  function childrenOf(folders, path) {
    var prefix = String(path).replace(/\/+$/, '') + '/'
    return sortFolders(folders).filter(function (f) {
      return f.path.indexOf(prefix) === 0 && f.path.slice(prefix.length) !== ''
    })
  }

  return { migrate: migrate, sortFolders: sortFolders, normalizeName: normalizeName, childrenOf: childrenOf }
})

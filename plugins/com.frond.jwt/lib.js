/**
 * Frond · JWT 解码插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondJwtLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondJwtLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /** base64url 解码（- _、缺省 padding 都兼容） */
  function b64urlDecode(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/')
    while (s.length % 4 !== 0) s += '='
    if (typeof Buffer === 'function') return Buffer.from(s, 'base64').toString('utf-8')
    return decodeURIComponent(
      escape(atob(s))
    )
  }

  /** 解析三段 JWT → { header, payload, signature }；结构/JSON 非法 → null */
  function decode(token) {
    var parts = String(token).trim().split('.')
    if (parts.length !== 3) return null
    try {
      var header = JSON.parse(b64urlDecode(parts[0]))
      var payload = JSON.parse(b64urlDecode(parts[1]))
      if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') return null
      return { header: header, payload: payload, signature: parts[2] }
    } catch (e) {
      void e
      return null
    }
  }

  var TS_CLAIMS = { exp: 1, iat: 1, nbf: 1, auth_time: 1 }

  /** claims → 条目数组（时间戳类 claim 自动可读化 + 有效/过期徽章） */
  function claimsToItems(payload) {
    var out = []
    for (var key in payload) {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) continue
      var val = payload[key]
      var item = { title: key + ': ' + String(val), subtitle: '', output: String(val), section: 'Payload' }
      if (TS_CLAIMS[key] && typeof val === 'number') {
        var d = new Date(val * 1000)
        var expired = key === 'exp' && d.getTime() * 1 < Date.now()
        item.subtitle = key + '（' + d.toISOString() + '）'
        item.accessories = [{ tag: key === 'exp' ? (expired ? '已过期' : '有效') : '时间', tone: key === 'exp' ? (expired ? 'danger' : 'success') : 'default' }]
      }
      out.push(item)
    }
    return out
  }

  /** 摘要条目（算法 tag + 过期 tag）+ Header 组 + Payload 组；token 非法 → null */
  function convert(token) {
    var d = decode(token)
    if (!d) return null
    var items = [
      {
        title: d.header.alg ? '算法: ' + d.header.alg : '未知算法',
        subtitle: '⚠ 仅解码展示，不校验签名',
        output: token,
        accessories: [
          { tag: String(d.header.alg || '?'), tone: 'default' },
          { tag: TS_CLAIMS && typeof d.payload.exp === 'number' && d.payload.exp * 1000 < Date.now() ? '已过期' : '未过期', tone: typeof d.payload.exp === 'number' && d.payload.exp * 1000 < Date.now() ? 'danger' : 'success' }
        ]
      }
    ]
    for (var k in d.header) {
      if (Object.prototype.hasOwnProperty.call(d.header, k)) {
        items.push({ title: k + ': ' + String(d.header[k]), subtitle: '', output: String(d.header[k]), section: 'Header' })
      }
    }
    return items.concat(claimsToItems(d.payload))
  }

  return { decode: decode, claimsToItems: claimsToItems, convert: convert }
})

/**
 * com.third.myip · 核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondMyIpLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondMyIpLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /** ipapi.co/json 响应 → 列表行 | null；IP 缺失即视为坏响应 */
  function toRow(body) {
    try {
      var d = typeof body === 'string' ? JSON.parse(body) : body
      if (!d || typeof d !== 'object' || !d.ip) return null
      var where = [d.city, d.country_name].filter(Boolean).join(', ')
      return {
        title: d.ip,
        subtitle: where ? where + ' · ' + (d.org || '未知运营商') : String(d.org || ''),
        accessories: d.version
          ? [
              {
                tag: /^IPv/.test(String(d.version))
                  ? String(d.version)
                  : 'IPv' + String(d.version).slice(0, 1)
              }
            ]
          : [],
        output: d.ip,
        actions: [
          { label: '复制 IP', type: 'copy', payload: d.ip, hint: '↵' },
          { label: '复制位置', type: 'copy', payload: where }
        ].filter(function (a) {
          return a.payload
        })
      }
    } catch (e) {
      void e
      return null
    }
  }

  return { toRow: toRow }
})

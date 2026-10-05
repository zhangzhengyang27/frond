/**
 * Frond · URL 编解码插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondUrlcodecLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondUrlcodecLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function encodeComponent(text) {
    return encodeURIComponent(String(text))
  }

  function decodeComponent(text) {
    return decodeURIComponent(String(text))
  }

  /** encodeURI：整体编码（保留 : / ? & = 等结构字符），用于对比展示 */
  function encodeURI_(text) {
    return encodeURI(String(text))
  }

  function decodeURI_(text) {
    return decodeURI(String(text))
  }

  /**
   * 双向检测入口：encode → [组件编码, 整体编码] 并列（标题注明差异）；
   * decode → decodeURIComponent 成功即单条；失败 → null。条目 { title, output }。
   */
  function convert(text, cmd) {
    var str = String(text).trim()
    if (str === '') return null
    if (cmd === 'decode') {
      try {
        var out = decodeComponent(str)
        return [{ title: '解码完成（' + out.length + ' 字符）', output: out }]
      } catch (e) {
        void e
        return null
      }
    }
    var component = encodeComponent(str)
    var whole = encodeURI_(str)
    var items = [{ title: '组件编码（encodeURIComponent）', output: component }]
    if (whole !== component) {
      items.push({ title: '整体编码（encodeURI，保留 : / ? & =）', output: whole })
    }
    return items
  }

  return {
    encodeComponent: encodeComponent,
    decodeComponent: decodeComponent,
    encodeURI_: encodeURI_,
    decodeURI_: decodeURI_,
    convert: convert
  }
})

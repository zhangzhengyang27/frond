/**
 * Frond · Base64 插件核心逻辑（lib.js）
 *
 * 插件测试基建样板（2026-10-05 重塑计划 Task 5）：
 * UMD 双导出——插件页（<script src="lib.js">）挂 globalThis.FrondBase64Lib，
 * vitest（node）走 module.exports。同一份代码两端行为一致。
 * 自实现 base64（不依赖 btoa/atob），UTF-8 经 TextEncoder/decodeURIComponent 处理。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondBase64Lib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  function utf8Bytes(str) {
    // TextEncoder 在 BrowserView 与 node 均可用；兜底 encodeURIComponent 方案
    if (typeof TextEncoder === 'function') {
      return new TextEncoder().encode(str)
    }
    var s = encodeURIComponent(str)
    var bytes = []
    for (var i = 0; i < s.length; i++) {
      if (s[i] === '%') {
        bytes.push(parseInt(s.slice(i + 1, i + 3), 16))
        i += 2
      } else {
        bytes.push(s.charCodeAt(i))
      }
    }
    return bytes
  }

  function bytesToUtf8(bytes) {
    if (typeof TextDecoder === 'function') {
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
    }
    var s = ''
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
    try {
      return decodeURIComponent(escape(s))
    } catch (e) {
      void e
      throw new Error('Invalid UTF-8 sequence')
    }
  }

  /** 文本 → Base64（UTF-8 安全） */
  function encode(text) {
    var bytes = utf8Bytes(String(text))
    var out = []
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i]
      var b1 = i + 1 < bytes.length ? bytes[i + 1] : null
      var b2 = i + 2 < bytes.length ? bytes[i + 2] : null
      out.push(CHARSET[b0 >> 2])
      out.push(CHARSET[((b0 & 3) << 4) | (b1 === null ? 0 : b1 >> 4)])
      out.push(b1 === null ? '=' : CHARSET[((b1 & 15) << 2) | (b2 === null ? 0 : b2 >> 6)])
      out.push(b2 === null ? '=' : CHARSET[b2 & 63])
    }
    return out.join('')
  }

  function base64CharValue(ch) {
    if (ch === '=') return -2 // padding
    var idx = CHARSET.indexOf(ch)
    if (idx < 0 && ch === '-') return 62 // URL-safe
    if (idx < 0 && ch === '_') return 63 // URL-safe
    return idx
  }

  /**
   * Base64 → 文本；非法输入返回 null（不抛错，插件层据此渲染错误态）。
   * 兼容 URL-safe 变体（- _）与缺省 padding。
   */
  function decode(text) {
    var str = String(text).trim()
    if (str === '') return null
    if (/[^A-Za-z0-9+/=\-_]/.test(str)) return null
    // 去掉 padding 后长度必须是 4 的倍数（补齐后）
    var clean = str.replace(/=+$/, '')
    var padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
    if (padded.length % 4 !== 0) return null
    var bytes = []
    for (var i = 0; i < padded.length; i += 4) {
      var c0 = base64CharValue(padded[i])
      var c1 = base64CharValue(padded[i + 1])
      var c2 = base64CharValue(padded[i + 2])
      var c3 = base64CharValue(padded[i + 3])
      if (c0 < 0 || c1 < 0 || c2 === -1 || c3 === -1) return null
      var b0 = (c0 << 2) | (c1 >> 4)
      bytes.push(b0)
      if (c2 >= 0 && c2 !== -2) {
        bytes.push(((c1 & 15) << 4) | (c2 >> 2))
        if (c3 >= 0 && c3 !== -2) {
          bytes.push(((c2 & 3) << 6) | c3)
        }
      }
    }
    try {
      return bytesToUtf8(bytes)
    } catch (e) {
      void e
      return null
    }
  }

  /** URL-safe 变体：+/ → -_，去 padding */
  function toUrlSafe(text) {
    return String(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  /** 标准 base64：-_ → +/，补 padding */
  function fromUrlSafe(text) {
    var s = String(text).replace(/-/g, '+').replace(/_/g, '/')
    return s + '='.repeat((4 - (s.length % 4)) % 4)
  }

  /** 启发式判定：非空、字符集合法、长度合法且可解码 */
  function isProbablyBase64(text) {
    var str = String(text).trim()
    if (str === '') return false
    if (/[^A-Za-z0-9+/=\-_]/.test(str)) return false
    if (str.length % 4 !== 0) return false
    return decode(str) !== null
  }

  return {
    encode: encode,
    decode: decode,
    toUrlSafe: toUrlSafe,
    fromUrlSafe: fromUrlSafe,
    isProbablyBase64: isProbablyBase64
  }
})

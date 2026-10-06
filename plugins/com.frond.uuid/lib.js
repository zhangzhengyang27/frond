/**
 * Frond · UUID 生成器插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondUuidLib，vitest（node）走 module.exports。
 * 随机源 crypto.getRandomValues（BrowserView 与 node 18+ 均有）。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondUuidLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function randomBytes(n) {
    var buf = new Uint8Array(n)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buf)
    } else {
      for (var i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256)
    }
    return buf
  }

  function hex(bytes) {
    var out = ''
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16)
    return out
  }

  /** RFC 4122 v4 */
  function uuidv4() {
    var b = randomBytes(16)
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    var h = hex(b)
    return (
      h.slice(0, 8) +
      '-' +
      h.slice(8, 12) +
      '-' +
      h.slice(12, 16) +
      '-' +
      h.slice(16, 20) +
      '-' +
      h.slice(20)
    )
  }

  /** RFC 9562 v7：48bit ms 时间戳大端 + 版本 7 + 变体 10xx + 31bit 随机 */
  function uuidv7(nowMs) {
    var ms = typeof nowMs === 'number' ? nowMs : Date.now()
    var b = randomBytes(16)
    // 48bit 大端时间戳
    for (var i = 5; i >= 0; i--) {
      b[i] = Number(ms % 256)
      ms = Math.floor(ms / 256)
    }
    b[6] = (b[6] & 0x0f) | 0x70
    b[8] = (b[8] & 0x3f) | 0x80
    var h = hex(b)
    return (
      h.slice(0, 8) +
      '-' +
      h.slice(8, 12) +
      '-' +
      h.slice(12, 16) +
      '-' +
      h.slice(16, 20) +
      '-' +
      h.slice(20)
    )
  }

  /** fmt：'std' | 'upper' | 'compact'（无连字符） | 'urn' */
  function formatUuid(uuid, fmt) {
    var u = String(uuid)
    if (fmt === 'upper') return u.toUpperCase()
    if (fmt === 'compact') return u.replace(/-/g, '')
    if (fmt === 'urn') return 'urn:uuid:' + u
    return u
  }

  /** 批量生成（count 封顶 100）；fmt 同 formatUuid */
  function generate(count, fmt) {
    var n = Math.max(1, Math.min(100, Math.floor(Number(count) || 1)))
    var out = []
    for (var i = 0; i < n; i++) out.push(formatUuid(uuidv4(), fmt || 'std'))
    return out
  }

  return { uuidv4: uuidv4, uuidv7: uuidv7, formatUuid: formatUuid, generate: generate }
})

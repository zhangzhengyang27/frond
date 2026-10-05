/**
 * Frond · 密码生成器插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondPasswordgenLib，vitest（node）走 module.exports。
 * 取数用拒绝采样避免模偏差；length 合法区间 4..128。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondPasswordgenLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var LOWER = 'abcdefghijkmnopqrstuvwxyz' // 无 l
  var LOWER_FULL = 'abcdefghijklmnopqrstuvwxyz'
  var UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // 无 I O
  var UPPER_FULL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  var DIGITS = '0123456789' // 无 0 的可读版单独给
  var DIGITS_READABLE = '23456789' // 易读方案去掉 0 1
  var SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?'

  var PRESETS = {
    strong: { label: '强', length: 20, sets: [LOWER_FULL, UPPER_FULL, DIGITS, SYMBOLS] },
    medium: { label: '中', length: 16, sets: [LOWER_FULL, UPPER_FULL, DIGITS] },
    readable: { label: '易读', length: 16, sets: [LOWER, UPPER, DIGITS_READABLE] },
    pin: { label: 'PIN', length: 6, sets: [DIGITS] }
  }

  function randomInt(maxExclusive) {
    var buf = new Uint8Array(1)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var limit = 256 - (256 % maxExclusive)
      var v
      do {
        crypto.getRandomValues(buf)
        v = buf[0]
      } while (v >= limit)
      return v % maxExclusive
    }
    return Math.floor(Math.random() * maxExclusive)
  }

  function pick(set) {
    return set[randomInt(set.length)]
  }

  /** 每套至少一个字符保证覆盖，其余均匀取自全集并洗牌 */
  function makePassword(preset, length) {
    var sets = preset.sets
    var all = sets.join('')
    var chars = []
    for (var s = 0; s < sets.length && chars.length < length; s++) chars.push(pick(sets[s]))
    while (chars.length < length) chars.push(pick(all))
    // Fisher–Yates 洗牌（随机源复用）
    for (var i = chars.length - 1; i > 0; i--) {
      var j = randomInt(i + 1)
      var t = chars[i]
      chars[i] = chars[j]
      chars[j] = t
    }
    return chars.join('')
  }

  /**
   * 生成单条：返回 { password, entropyBits }；preset 非法 / length 越界（4..128）→ null。
   * entropyBits = length * log2(全集大小)。
   */
  function generate(presetName, length) {
    var preset = PRESETS[presetName]
    if (!preset) return null
    var len = Math.floor(Number(length) || preset.length)
    if (len < 4 || len > 128) return null
    var setSize = preset.sets.join('').length
    return {
      password: makePassword(preset, len),
      entropyBits: Math.round(len * Math.log2(setSize))
    }
  }

  function batch(presetName, length, count) {
    var n = Math.max(1, Math.min(100, Math.floor(Number(count) || 1)))
    var out = []
    for (var i = 0; i < n; i++) {
      var r = generate(presetName, length)
      if (!r) return []
      out.push(r.password)
    }
    return out
  }

  return { PRESETS: PRESETS, generate: generate, batch: batch }
})

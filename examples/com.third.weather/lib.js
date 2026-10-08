/**
 * com.third.weather · 核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondWeatherLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondWeatherLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var WMO = {
    0: '晴 ☀️',
    1: '基本晴 🌤',
    2: '多云 ⛅',
    3: '阴 ☁️',
    45: '雾 🌫',
    48: '雾凇 🌫',
    51: '小毛毛雨 🌦',
    53: '毛毛雨 🌦',
    55: '大毛毛雨 🌧',
    61: '小雨 🌦',
    63: '中雨 🌧',
    65: '大雨 🌧',
    71: '小雪 🌨',
    73: '中雪 🌨',
    75: '大雪 ❄️',
    80: '阵雨 🌦',
    81: '阵雨 🌧',
    82: '强阵雨 ⛈',
    95: '雷雨 ⛈',
    96: '雷雨伴冰雹 ⛈',
    99: '强雷雨伴冰雹 ⛈'
  }

  function wmoLabel(code) {
    return WMO[Number(code)] || '未知'
  }

  /** 偏好 → 请求 URL；纬度/经度不是有限数字返回 null（含范围闸 [-90,90]/[-180,180]） */
  function buildForecastUrl(prefs) {
    // prefs 缺失或非对象直接拒：Number(null)=0 会把「没有坐标」洗成原点(0,0)
    if (!prefs || typeof prefs !== 'object') return null
    var lat = Number(prefs.latitude)
    var lon = Number(prefs.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
    var unit = prefs && prefs.units === '华氏度' ? 'fahrenheit' : 'celsius'
    return (
      'https://api.open-meteo.com/v1/forecast?latitude=' +
      encodeURIComponent(String(lat)) +
      '&longitude=' +
      encodeURIComponent(String(lon)) +
      '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min' +
      '&forecast_days=4&timezone=auto&temperature_unit=' +
      unit
    )
  }

  /** Open-Meteo 响应 → [当前行, …三日行]；结构不完整 → null */
  function toRows(body) {
    try {
      var d = typeof body === 'string' ? JSON.parse(body) : body
      var cur = d && d.current
      var daily = d && d.daily
      if (!cur || !daily || !Array.isArray(daily.time) || daily.time.length === 0) return null
      var rows = [
        {
          title: '当前 ' + cur.temperature_2m + ' · ' + wmoLabel(cur.weather_code),
          subtitle: '实时（时区 ' + (d.timezone || 'auto') + '）',
          icon: 'sun-line',
          section: '当前',
          output: String(cur.temperature_2m),
          actions: [
            { label: '复制温度', type: 'copy', payload: String(cur.temperature_2m) },
            { label: '刷新', type: 'callback', payload: 'refresh', hint: '⌘R' }
          ]
        }
      ]
      var names = ['今天', '明天']
      for (var i = 0; i < daily.time.length && i < 4; i++) {
        rows.push({
          title:
            wmoLabel(daily.weather_code[i]) +
            ' ' +
            (daily.temperature_2m_min[i] != null ? Math.round(daily.temperature_2m_min[i]) : '?') +
            '–' +
            (daily.temperature_2m_max[i] != null ? Math.round(daily.temperature_2m_max[i]) : '?') +
            '°',
          subtitle: (names[i] || daily.time[i]) + '（' + daily.time[i] + '）',
          icon: 'calendar-line',
          section: '预报',
          output: daily.time[i],
          accessories: i === 0 ? [{ tag: '今天' }] : []
        })
      }
      return rows
    } catch (e) {
      void e
      return null
    }
  }

  return { buildForecastUrl: buildForecastUrl, toRows: toRows, wmoLabel: wmoLabel }
})

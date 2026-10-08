import { describe, expect, it } from 'vitest'
import lib from './lib.js'

describe('buildForecastUrl', () => {
  it('合法坐标 + 单位偏好 → URL（纬经度/单位进 query）', () => {
    const url = lib.buildForecastUrl({ latitude: '31.23', longitude: '121.47', units: '华氏度' })
    expect(url).toContain('latitude=31.23')
    expect(url).toContain('longitude=121.47')
    expect(url).toContain('temperature_unit=fahrenheit')
    expect(url).toContain('forecast_days=4')
  })

  it('缺省单位 = 摄氏度；坏坐标/越界 → null', () => {
    expect(lib.buildForecastUrl({ latitude: '31', longitude: '121' })).toContain('celsius')
    expect(lib.buildForecastUrl({ latitude: 'abc', longitude: '121' })).toBeNull()
    expect(lib.buildForecastUrl({ latitude: '91', longitude: '121' })).toBeNull()
    expect(lib.buildForecastUrl({ latitude: '31', longitude: '181' })).toBeNull()
    expect(lib.buildForecastUrl({})).toBeNull()
    expect(lib.buildForecastUrl(null)).toBeNull()
  })
})

describe('wmoLabel', () => {
  it('已知码映射，未知码兜底', () => {
    expect(lib.wmoLabel(0)).toContain('晴')
    expect(lib.wmoLabel('95')).toContain('雷')
    expect(lib.wmoLabel(1234)).toBe('未知')
  })
})

describe('toRows', () => {
  const BODY = {
    timezone: 'Asia/Shanghai',
    current: { temperature_2m: 21.4, weather_code: 2 },
    daily: {
      time: ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'],
      weather_code: [2, 61, 0, 3],
      temperature_2m_max: [25.1, 22, 26, 24],
      temperature_2m_min: [18, 17, 19, 16]
    }
  }

  it('当前行 + 四日预报，分 section、今天带徽章', () => {
    const rows = lib.toRows(BODY)
    expect(rows).toHaveLength(5)
    expect(rows[0].section).toBe('当前')
    expect(rows[0].title).toContain('21.4')
    expect(rows[0].title).toContain('多云')
    expect(rows[0].actions.map((a) => a.type)).toEqual(['copy', 'callback'])
    expect(rows[1].section).toBe('预报')
    expect(rows[1].subtitle).toContain('今天')
    expect(rows[2].title).toContain('小雨')
  })

  it('字符串响应体可解；结构缺失/坏 JSON → null', () => {
    expect(lib.toRows(JSON.stringify(BODY))).toHaveLength(5)
    expect(lib.toRows({ current: null })).toBeNull()
    expect(lib.toRows('nope')).toBeNull()
    expect(lib.toRows(null)).toBeNull()
  })
})

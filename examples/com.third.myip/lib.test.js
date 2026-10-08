import { expect, test } from 'vitest'
import lib from './lib.js'

test('标准响应 → 行（IP/位置/运营商/IPv 徽章/两个复制动作）', () => {
  const row = lib.toRow(
    JSON.stringify({
      ip: '1.2.3.4',
      city: 'Shanghai',
      country_name: 'China',
      org: 'AS4134 Chinanet',
      version: 'IPv4'
    })
  )
  expect(row.title).toBe('1.2.3.4')
  expect(row.subtitle).toContain('Shanghai, China')
  expect(row.accessories[0].tag).toBe('IPv4')
  expect(row.actions.map((a) => a.payload)).toEqual(['1.2.3.4', 'Shanghai, China'])
})

test('缺城市/运营商：字段收缩而非报错；缺 IP → null；坏 JSON → null', () => {
  const sparse = lib.toRow(JSON.stringify({ ip: '5.6.7.8' }))
  expect(sparse.subtitle).toBe('')
  expect(sparse.actions).toHaveLength(1)
  expect(lib.toRow(JSON.stringify({ city: 'nowhere' }))).toBeNull()
  expect(lib.toRow('not json')).toBeNull()
  expect(lib.toRow(null)).toBeNull()
})

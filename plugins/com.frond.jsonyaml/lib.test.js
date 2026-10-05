import { describe, it, expect } from 'vitest'
import { jsonToYaml, yamlToJson, convert } from './lib.js'

describe('jsonyaml lib', () => {
  it('往返', () => {
    const y = jsonToYaml('{"a":1,"b":["x"]}', 2)
    expect(y).toContain('a: 1')
    expect(y).toContain('b:')
    expect(JSON.parse(yamlToJson(y))).toEqual({ a: 1, b: ['x'] })
  })
  it('convert 自动检测方向', () => {
    expect(convert('{"a":1}', 'auto')[0].title).toContain('YAML')
    expect(convert('a: 1', 'auto')[0].title).toContain('JSON')
  })
})

import { describe, it, expect } from 'vitest'
import { format, minify, validate, convert } from './lib.js'

describe('jsonfmt lib', () => {
  it('format/minify 基础', () => {
    expect(format('{"a":1}', 2)).toBe('{\n  "a": 1\n}')
    expect(minify('{ "a": 1 }')).toBe('{"a":1}')
  })
  it('validate 定位到行:列', () => {
    const v = validate('{\n  "a": ,\n}')
    expect(v.ok).toBe(false)
    expect(v.line).toBe(2)
  })
  it('convert：format 命令四条输出（indent2/indent4/minify/sortKeys）', () => {
    expect(convert('{"b":1,"a":2}', 'format')).toHaveLength(4)
    expect(convert('not json', 'format')).toBeNull()
  })
})

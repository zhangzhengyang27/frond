import { describe, it, expect } from 'vitest'
import { csvToJson, jsonToCsv, convert } from './lib.js'

describe('csvjson lib', () => {
  it('csv→json 含引号转义与表头（数字自动转换是原插件语义）', () => {
    const j = csvToJson('name,age\n"x,1",2', ',')
    expect(JSON.parse(j)).toEqual([{ name: 'x,1', age: 2 }])
  })
  it('json→csv 数组对象', () => {
    expect(jsonToCsv('[{"a":1,"b":"x,y"}]', ',', true)).toBe('a,b\n1,"x,y"')
  })
  it('convert 自动检测 + 分隔符变体', () => {
    expect(convert('a;b\n1;2', 'auto')).toHaveLength(1)
    expect(convert('a,b\n1,2', 'csv-semicolon')).toHaveLength(1)
    expect(convert('[{"a":1}]', 'auto')[0].title).toContain('CSV')
  })
})

import { describe, it, expect } from 'vitest'
import {
  parseEspansoYaml,
  espansoItemsToSnippets,
  strftimeToFrondFormat
} from '../EspansoImportService'

describe('strftimeToFrondFormat', () => {
  it('常用 token 映射；未知 token 原样保留并标 lossy', () => {
    expect(strftimeToFrondFormat('%Y-%m-%d')).toEqual({ format: 'YYYY-MM-DD', lossy: false })
    expect(strftimeToFrondFormat('%H:%M:%S %p')).toEqual({
      format: 'HH:mm:ss A',
      lossy: false
    })
    const lossy = strftimeToFrondFormat('%A %B %d')
    expect(lossy.lossy).toBe(true)
    expect(lossy.format).toContain('%A')
    expect(lossy.format).toContain('DD')
  })
})

describe('parseEspansoYaml', () => {
  it('纯文本 matches：trigger/replace 一对一映射', () => {
    const { items, warnings } = parseEspansoYaml(
      ['matches:', '  - trigger: ":hi"', '    replace: "Hello!"', '  - trigger: ";brb"', '    replace: "be right back"'].join('\n')
    )
    expect(warnings).toEqual([])
    expect(items).toEqual([
      { name: ':hi', trigger: ':hi', content: 'Hello!' },
      { name: ';brb', trigger: ';brb', content: 'be right back' }
    ])
  })

  it('date var：strftime 转换为 {date:Frond 格式}', () => {
    const { items, warnings } = parseEspansoYaml(
      [
        'matches:',
        '  - trigger: ":date"',
        '    replace: "today {{d}}"',
        '    vars:',
        '      - name: d',
        '        type: date',
        '        params: { format: "%Y-%m-%d" }'
      ].join('\n')
    )
    expect(warnings).toEqual([])
    expect(items[0]?.content).toBe('today {date:YYYY-MM-DD}')
  })

  it('clipboard var → {clipboard}；未知 var 类型降级为手动输入参数并警告', () => {
    const { items, warnings } = parseEspansoYaml(
      [
        'matches:',
        '  - trigger: ":paste"',
        '    replace: "{{c}} / {{who}}"',
        '    vars:',
        '      - name: c',
        '        type: clipboard',
        '      - name: who',
        '        type: script',
        '        params: { script: "x.sh" }'
      ].join('\n')
    )
    expect(items[0]?.content).toBe('{clipboard} / {{who}}')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('"script"')
  })

  it('无 trigger / 空 replace 跳过并警告；非对象条目跳过', () => {
    const { items, warnings } = parseEspansoYaml(
      [
        'matches:',
        '  - replace: "no trigger"',
        '  - trigger: ":empty"',
        '  - trigger: ":ok"',
        '    replace: "fine"',
        '  - "just a string"'
      ].join('\n')
    )
    expect(items).toEqual([{ name: ':ok', trigger: ':ok', content: 'fine' }])
    expect(warnings).toHaveLength(3)
  })

  it('非 Espanso 结构（缺 matches）抛错；顶层裸数组也可接受', () => {
    expect(() => parseEspansoYaml('foo: bar')).toThrow('matches')
    const { items } = parseEspansoYaml('- trigger: ":a"\n  replace: "b"')
    expect(items).toHaveLength(1)
  })
})

describe('espansoItemsToSnippets', () => {
  it('转换为 ExportedSnippet 形状（id 新生成、plaintext 单内容块、无文件夹）', () => {
    const snippets = espansoItemsToSnippets([{ name: ':hi', trigger: ':hi', content: 'Hello' }], 123)
    expect(snippets).toHaveLength(1)
    const s = snippets[0]!
    expect(s.name).toBe(':hi')
    expect(s.trigger).toBe(':hi')
    expect(s.contents).toHaveLength(1)
    expect(s.contents[0]?.value).toBe('Hello')
    expect(s.contents[0]?.language).toBe('plaintext')
    expect(s.folderId).toBeNull()
    expect(s.createdAt).toBe(123)
  })
})

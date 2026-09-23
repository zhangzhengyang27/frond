import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * readManifest 的 permissions 归一化：未知权限值剔除（fail-closed——
 * 拼错权限名等于没声明），合法值保留。
 */
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/frond-manifest-test',
    getVersion: () => '0.0.0-test',
    isReady: () => true
  }
}))

import { readManifest } from '../pluginStore'

describe('readManifest permissions 归一化', () => {
  let dir: string

  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'frond-manifest-')), 'plugin')
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(join(dir, '..'), { recursive: true, force: true })
  })

  function writeManifest(permissions: unknown): void {
    writeFileSync(
      join(dir, 'plugin.json'),
      JSON.stringify({ id: 'com.test.demo', name: 'demo', permissions })
    )
  }

  it('合法权限保留', () => {
    writeManifest(['clipboard.read', 'net'])
    expect(readManifest(dir).permissions).toEqual(['clipboard.read', 'net'])
  })

  it('未知权限值剔除（拼错 = 没声明）', () => {
    writeManifest(['clipboard.read', 'clipboard.readAll', 'root', 42, null])
    expect(readManifest(dir).permissions).toEqual(['clipboard.read'])
  })

  it('非数组 permissions 视为未声明', () => {
    writeManifest('clipboard.read')
    expect(readManifest(dir).permissions).toBeUndefined()
  })

  it('缺省 permissions 保持 undefined', () => {
    writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ id: 'com.test.demo', name: 'demo' }))
    expect(readManifest(dir).permissions).toBeUndefined()
  })
})

describe('readManifest commands arguments 清洗（多参数命令）', () => {
  let dir: string

  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'frond-manifest-')), 'plugin')
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(join(dir, '..'), { recursive: true, force: true })
  })

  function writeCommands(commands: unknown): void {
    writeFileSync(
      join(dir, 'plugin.json'),
      JSON.stringify({ id: 'com.test.demo', name: 'demo', commands })
    )
  }

  it('合法 arguments 透传到命令上', () => {
    writeCommands([
      {
        code: 'search',
        title: 'Search',
        arguments: [
          { name: 'query', type: 'text', required: true },
          { name: 'mode', type: 'dropdown', data: [{ title: '全部', value: 'all' }] }
        ]
      }
    ])
    const manifest = readManifest(dir)
    expect(manifest.commands?.[0]?.arguments).toEqual([
      { name: 'query', type: 'text', required: true },
      { name: 'mode', type: 'dropdown', data: [{ title: '全部', value: 'all' }] }
    ])
  })

  it('非法 arguments 按声明制清洗（非法项剔除 / dropdown 无候选降级 text）', () => {
    writeCommands([
      {
        code: 'search',
        title: 'Search',
        arguments: [
          'bad',
          { name: '', type: 'text' },
          { name: 'mode', type: 'dropdown' },
          { name: 'q', type: 'text' }
        ]
      }
    ])
    const manifest = readManifest(dir)
    // 非法项（'bad'、空 name）剔除；无候选 dropdown 降级为 text
    expect(manifest.commands?.[0]?.arguments).toEqual([
      { name: 'mode', type: 'text' },
      { name: 'q', type: 'text' }
    ])
  })

  it('arguments 非数组时剔除字段', () => {
    writeCommands([{ code: 'hello', title: 'Hello', arguments: 'query' }])
    const manifest = readManifest(dir)
    expect(manifest.commands?.[0]?.arguments).toBeUndefined()
  })
})

describe('readManifest commands[].mode 清洗（View / Action 命令，P-2.1）', () => {
  let dir: string

  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'frond-manifest-')), 'plugin')
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(join(dir, '..'), { recursive: true, force: true })
  })

  function writeCommands(commands: unknown): void {
    writeFileSync(
      join(dir, 'plugin.json'),
      JSON.stringify({ id: 'com.test.demo', name: 'demo', commands })
    )
  }

  it('action 保留、拼错的值被剔除（不得让命令偷偷变无界面）', () => {
    writeCommands([
      { code: 'paste', title: 'P', mode: 'action' },
      { code: 'repos', title: 'R', mode: 'Action' },
      { code: 'x', title: 'X', mode: true }
    ])
    const commands = readManifest(dir).commands ?? []
    expect(commands.map((c) => c.mode)).toEqual(['action', undefined, undefined])
  })
})

describe('readManifest commands arguments 清洗（多参数命令）', () => {
  let dir: string

  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'frond-manifest-')), 'plugin')
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(join(dir, '..'), { recursive: true, force: true })
  })

  function writeCommands(commands: unknown): void {
    writeFileSync(
      join(dir, 'plugin.json'),
      JSON.stringify({ id: 'com.test.demo', name: 'demo', commands })
    )
  }

  it('合法 arguments 透传到命令上', () => {
    writeCommands([
      {
        code: 'search',
        title: 'Search',
        arguments: [
          { name: 'query', type: 'text', required: true },
          { name: 'mode', type: 'dropdown', data: [{ title: '全部', value: 'all' }] }
        ]
      }
    ])
    const manifest = readManifest(dir)
    expect(manifest.commands?.[0]?.arguments).toEqual([
      { name: 'query', type: 'text', required: true },
      { name: 'mode', type: 'dropdown', data: [{ title: '全部', value: 'all' }] }
    ])
  })

  it('非法 arguments 按声明制清洗（非法项剔除 / dropdown 无候选降级 text）', () => {
    writeCommands([
      {
        code: 'search',
        title: 'Search',
        arguments: [
          'bad',
          { name: '', type: 'text' },
          { name: 'mode', type: 'dropdown' },
          { name: 'q', type: 'text' }
        ]
      }
    ])
    const manifest = readManifest(dir)
    // 非法项（'bad'、空 name）剔除；无候选 dropdown 降级为 text
    expect(manifest.commands?.[0]?.arguments).toEqual([
      { name: 'mode', type: 'text' },
      { name: 'q', type: 'text' }
    ])
  })

  it('arguments 非数组时剔除字段', () => {
    writeCommands([{ code: 'hello', title: 'Hello', arguments: 'query' }])
    const manifest = readManifest(dir)
    expect(manifest.commands?.[0]?.arguments).toBeUndefined()
  })
})

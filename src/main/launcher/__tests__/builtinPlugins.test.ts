import { describe, it, expect, beforeEach, vi } from 'vitest'
import { join, resolve } from 'path'

/**
 * 内置插件目录解析（dev/e2e 启动形态差异）：
 * - 打包态 → resources/plugins
 * - dev（electron .）→ 仓库根 plugins（getAppPath 即仓库根）
 * - e2e / electron-vite preview（electron out/main/index.js）→ getAppPath 是
 *   out/main，仓库根 plugins 在两级之上——需要候选回退，否则内置插件静默缺失
 */
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/repo/out/main',
    getPath: () => '/tmp/leaf-userdata',
    getResourcesPath: () => '/repo/resources'
  }
}))

const existsCalls: string[] = []
vi.mock('fs', () => ({
  existsSync: (p: string) => {
    existsCalls.push(String(p))
    // 候选一（appPath/plugins）不存在；候选二（仓库根 plugins）存在
    return String(p) === resolve('/repo/out/main', '../../plugins')
  },
  readdirSync: () => [],
  readFileSync: () => ''
}))

import { builtinPluginsDir } from '../builtinPlugins'

describe('builtinPluginsDir 候选回退', () => {
  beforeEach(() => {
    existsCalls.length = 0
  })

  it('构建产物入口启动（appPath=out/main）回退到仓库根 plugins', () => {
    const dir = builtinPluginsDir()
    expect(dir).toBe(resolve('/repo/out/main', '../../plugins'))
  })

  it('依次尝试候选目录', () => {
    builtinPluginsDir()
    expect(existsCalls[0]).toBe(join('/repo/out/main', 'plugins'))
    expect(existsCalls[1]).toBe(resolve('/repo/out/main', '../../plugins'))
  })
})

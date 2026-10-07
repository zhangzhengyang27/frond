import { describe, it, expect, vi } from 'vitest'

// decideBuiltinInstall 是纯函数，但模块链上挂着 electron（builtinPlugins → market →
// prefRepository）；给个最小 app 桩让模块能加载即可，函数本身不碰 electron。
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/frond-builtin-decision-test',
    getAppPath: () => '/tmp/frond-builtin-decision-test',
    isPackaged: false,
    getVersion: () => '0.0.0-test',
    isReady: () => true
  }
}))

import { decideBuiltinInstall } from '../builtinPlugins'

describe('decideBuiltinInstall（P-3.2：内置链不再降级覆盖）', () => {
  it('未安装 → install', () => {
    expect(decideBuiltinInstall(undefined, { version: '1.0.0' })).toBe('install')
    expect(decideBuiltinInstall(undefined, {})).toBe('install')
  })

  it('内置件无版本号 → 永远 skip', () => {
    expect(decideBuiltinInstall({ version: '0.9.0' }, {})).toBe('skip')
    expect(decideBuiltinInstall({ version: undefined }, {})).toBe('skip')
  })

  it('已装无版本 → 内置有版本即更新', () => {
    expect(decideBuiltinInstall({ version: undefined }, { version: '1.0.0' })).toBe('update')
  })

  it('内置版本确实更新 → update（逐段比较，10 > 9）', () => {
    expect(decideBuiltinInstall({ version: '1.9.0' }, { version: '1.10.0' })).toBe('update')
    expect(decideBuiltinInstall({ version: '1.0.0' }, { version: '1.0.1' })).toBe('update')
    expect(decideBuiltinInstall({ version: '1.0.0' }, { version: '2.0.0' })).toBe('update')
  })

  it('同版本或内置更旧 → skip（旧逻辑「不等即重装」会降级市场装的新版，此处修掉）', () => {
    expect(decideBuiltinInstall({ version: '1.1.0' }, { version: '1.1.0' })).toBe('skip')
    expect(decideBuiltinInstall({ version: '2.0.0' }, { version: '1.9.9' })).toBe('skip')
  })

  it('任一侧解析不出 semver → 退回「不等即更新」', () => {
    expect(decideBuiltinInstall({ version: 'not-semver' }, { version: '1.0.0' })).toBe('update')
    expect(decideBuiltinInstall({ version: '1.0.0' }, { version: 'beta' })).toBe('update')
    expect(decideBuiltinInstall({ version: 'beta' }, { version: 'beta' })).toBe('skip')
  })

  it('prerelease：正式版大于同号预发布', () => {
    expect(decideBuiltinInstall({ version: '1.0.0-beta' }, { version: '1.0.0' })).toBe('update')
    expect(decideBuiltinInstall({ version: '1.0.0' }, { version: '1.0.0-beta' })).toBe('skip')
  })
})

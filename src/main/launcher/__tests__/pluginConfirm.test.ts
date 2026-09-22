import { describe, it, expect } from 'vitest'
import { diffPermissions } from '../pluginConfirm'

/**
 * 更新时的权限差分（P-3.4，纯函数部分）。
 *
 * 拦的是这个场景：用户装过 v1（只要 clipboard.write），市场推来 v2 悄悄多要 net，
 * 旧的确认框把两版一视同仁地列个清单就放行——那几条新权限等于从没被确认过。
 * 差分给出的判据要能被上面那个分支用上，所以 added / removed / fresh 三项都得准。
 */
describe('diffPermissions', () => {
  it('更新多要权限：added 只含新出现的那几条', () => {
    const diff = diffPermissions(['clipboard.write'], ['clipboard.write', 'net'])
    expect(diff).toEqual({ added: ['net'], removed: [], fresh: false })
  })

  it('更新放掉权限：added 为空，removed 如实列出（不需要换重档问法）', () => {
    const diff = diffPermissions(['clipboard.read', 'fs.open'], ['clipboard.read'])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual(['fs.open'])
    expect(diff.fresh).toBe(false)
  })

  it('权限没变 → 差分全空（更新弹窗不该因此吓用户）', () => {
    const diff = diffPermissions(['net', 'clipboard.read'], ['clipboard.read', 'net'])
    expect(diff).toEqual({ added: [], removed: [], fresh: false })
  })

  it('首次安装：fresh=true，added 不拿来当「变更」用', () => {
    const diff = diffPermissions(undefined, ['net'], false)
    expect(diff.fresh).toBe(true)
    expect(diff.added).toEqual(['net'])
  })

  it('未知权限名两边都忽略，去重也不重复计', () => {
    expect(diffPermissions(['whatever'], ['whatever', 'net']).added).toEqual(['net'])
    expect(diffPermissions(['whatever'], ['whatever']).added).toEqual([])
    expect(diffPermissions(['net'], ['net', 'net']).added).toEqual([])
    expect(diffPermissions(undefined, ['net', 'net']).added).toEqual(['net'])
  })

  it('两侧都缺省 → 空差分，fresh 由调用方决定', () => {
    expect(diffPermissions(undefined, undefined)).toEqual({
      added: [],
      removed: [],
      fresh: false
    })
  })
})

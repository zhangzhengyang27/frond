import { describe, it, expect } from 'vitest'
import {
  alertPressedAction,
  beginPluginAlert,
  buildAlertDialogOptions,
  endPluginAlert
} from '../pluginAlert'
import type { SanitizedAlert } from '../../../shared/plugin-protocol'

/**
 * 插件 Alert 的装配（P-2.5）。
 *
 * 原生模态框在自动化里没人点按钮，所以「按钮怎么摆、按下回什么」必须在这一层钉住；
 * 宿主 handler 那边只剩「把装配结果交给 dialog」。
 */
const alert = (over: Partial<SanitizedAlert> = {}): SanitizedAlert => ({
  title: '删除',
  message: '这条记录会消失',
  actions: [
    { id: 'delete', title: '删除', style: 'destructive' },
    { id: 'cancel', title: '取消', style: 'cancel' }
  ],
  ...over
})

describe('buildAlertDialogOptions', () => {
  it('标题一律带插件名（不能让人以为这是系统弹的）', () => {
    expect(buildAlertDialogOptions('正则测试', alert()).title).toBe('正则测试 · 删除')
    expect(buildAlertDialogOptions('正则测试', alert({ title: '' })).title).toBe('正则测试')
  })

  it('按钮顺序照搬动作顺序，default 取第一个非 cancel、cancel 供 Escape', () => {
    const options = buildAlertDialogOptions('p', alert())
    expect(options.buttons).toEqual(['删除', '取消'])
    expect(options.defaultId).toBe(0)
    expect(options.cancelId).toBe(1)
    expect(options.type).toBe('warning') // 有 destructive 动作
  })

  it('cancel 在最前时主操作跳过它（否则回车会落在「取消」上）', () => {
    const options = buildAlertDialogOptions(
      'p',
      alert({
        actions: [
          { id: 'cancel', title: '取消', style: 'cancel' },
          { id: 'ok', title: '好', style: 'default' }
        ]
      })
    )
    expect(options.defaultId).toBe(1)
    expect(options.cancelId).toBe(0)
  })

  it('没有任何动作时是一个「好」确认框，且 type 是 info', () => {
    const options = buildAlertDialogOptions('p', alert({ actions: [] }))
    expect(options.buttons).toEqual(['好'])
    expect(options.defaultId).toBe(0)
    expect(options.cancelId).toBe(0)
    expect(options.type).toBe('info')
  })

  it('正文与按钮文字原样传（清洗已在 sanitizeAlertRequest 那一步做完）', () => {
    const options = buildAlertDialogOptions('p', alert({ message: '多行\n正文' }))
    expect(options.message).toBe('多行\n正文')
  })

  /**
   * 插件没给 cancel 样式动作时（Raycast 的 view.tsx 里很常见，只摆一条「删除」），
   * 旧写法把 cancelId 落到 0 —— 按下 Esc 就是替用户按了那颗 destructive 按钮。
   * 现在补一颗「取消」，并保证它映射回 null。
   */
  it('没有 cancel 动作时补一颗「取消」，Esc 不许等于第一个动作', () => {
    const only = alert({
      actions: [{ id: 'delete', title: '删除', style: 'destructive' }]
    })
    const options = buildAlertDialogOptions('p', only)
    expect(options.buttons).toEqual(['删除', '取消'])
    expect(options.defaultId).toBe(0)
    expect(options.cancelId).toBe(1)
    expect(
      alertPressedAction(only, options.cancelId),
      'Esc 回了一个动作 = 按 Esc 就删了'
    ).toBeNull()
    // 三个动作全非 cancel 也一样补在最后
    const three = alert({
      actions: [
        { id: 'a', title: '甲', style: 'default' },
        { id: 'b', title: '乙', style: 'default' },
        { id: 'c', title: '丙', style: 'destructive' }
      ]
    })
    const o3 = buildAlertDialogOptions('p', three)
    expect(o3.buttons).toEqual(['甲', '乙', '丙', '取消'])
    expect(alertPressedAction(three, o3.cancelId)).toBeNull()
  })
})

describe('同插件同时只一条模态框', () => {
  it('第二条拿不到名额；框关掉后又能拿', () => {
    expect(beginPluginAlert('com.x.a')).toBe(true)
    expect(beginPluginAlert('com.x.a')).toBe(false)
    expect(beginPluginAlert('com.x.b'), '另一个插件不受影响').toBe(true)
    endPluginAlert('com.x.a')
    expect(beginPluginAlert('com.x.a')).toBe(true)
    endPluginAlert('com.x.a')
    endPluginAlert('com.x.b')
  })
})

describe('alertPressedAction', () => {
  it('按下第 N 个动作回它的 id', () => {
    expect(alertPressedAction(alert(), 0)).toBe('delete')
    expect(alertPressedAction(alert(), 1)).toBe('cancel')
  })

  it('确认框（没有动作）任意按下都回 null，不假造一个 id', () => {
    expect(alertPressedAction(alert({ actions: [] }), 0)).toBeNull()
  })

  it('越界索引回 null（宿主给的 response 不该被当数组下标盲用）', () => {
    expect(alertPressedAction(alert(), 9)).toBeNull()
  })
})

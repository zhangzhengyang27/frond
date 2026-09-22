import { describe, it, expect } from 'vitest'
import {
  PLUGIN_MAX_ALERT_ACTIONS,
  PLUGIN_MAX_PREFERENCES,
  sanitizeAlertRequest,
  sanitizePluginOpenableUrl,
  sanitizePluginPreferences
} from '../plugin-protocol'

/**
 * 插件平台 API 的三道清洗（P-2.5）。
 *
 * 这三个函数都是「第三方给什么」与「宿主做什么」之间唯一的闸，
 * 所以钉的是**坏输入的形状**：拼错、超长、越权协议、非数组——
 * 每种都必须落到一个明确的拒绝或降级，不能悄悄流到下游。
 */
describe('sanitizePluginPreferences', () => {
  const ok = { name: 'apiKey', label: 'API Key', type: 'text', default: 'k' }

  it('合法项原样收下（含 select 的候选与默认值）', () => {
    const out = sanitizePluginPreferences([
      ok,
      { name: 'mode', label: '模式', type: 'select', options: ['a', 'b'], default: 'a' }
    ])
    expect(out).toEqual([
      { name: 'apiKey', label: 'API Key', type: 'text', default: 'k' },
      { name: 'mode', label: '模式', type: 'select', default: 'a', options: ['a', 'b'] }
    ])
  })

  it('非数组 / 空数组都得到空表（清单没写偏好 = 一项都没有，不是 undefined）', () => {
    for (const raw of [undefined, null, 'x', 3, {}, []]) {
      expect(sanitizePluginPreferences(raw)).toEqual([])
    }
  })

  it('缺 label 的项整条剔除（界面上无法展示 = 等于没声明）', () => {
    expect(sanitizePluginPreferences([{ name: 'a', type: 'text' }])).toEqual([])
  })

  it('省略 type = text；写了不认识的 type 整条剔除（不许降级成文本框）', () => {
    expect(sanitizePluginPreferences([{ name: 'a', label: 'A' }])).toEqual([
      { name: 'a', label: 'A', type: 'text' }
    ])
    // password 降级成 text 就是把口令明文摆在设置页里；select 无候选降级 = 换了个控件
    for (const bad of [
      { name: 'a', label: 'A', type: 'PASSWORD' },
      { name: 'b', label: 'B', type: 'password' },
      { name: 'c', label: 'C', type: 'number' },
      { name: 'd', label: 'D', type: 'select', options: [] },
      { name: 'e', label: 'E', type: 3 }
    ]) {
      expect(sanitizePluginPreferences([bad]), JSON.stringify(bad)).toEqual([])
    }
  })

  /** 截断比剔除更坏：name 被剪短之后，存储键与插件 getPreference() 用的键就不是同一个了。 */
  it('name / default / 候选超长是整条剔除，不是悄悄剪短', () => {
    const longName = 'n'.repeat(65)
    expect(sanitizePluginPreferences([{ name: longName, label: 'L', type: 'text' }])).toEqual([])
    // 64 个字符是边界，收
    expect(
      sanitizePluginPreferences([{ name: 'n'.repeat(64), label: 'L', type: 'text' }])
    ).toHaveLength(1)
    const out = sanitizePluginPreferences([
      { name: 'a', label: 'A', type: 'text', default: 'd'.repeat(501) }
    ])
    expect(out).toEqual([{ name: 'a', label: 'A', type: 'text' }]) // 只丢这个默认值，项还在
    const sel = sanitizePluginPreferences([
      { name: 's', label: 'S', type: 'select', options: ['x', 'y'.repeat(121)], default: 'x' }
    ])
    expect(sel[0].options).toEqual(['x'])
    // label 是显示用的，超长截断即可（不改变功能）
    expect(
      sanitizePluginPreferences([{ name: 'l', label: 'L'.repeat(80), type: 'text' }])[0].label
    ).toHaveLength(60)
  })

  it('重复 name 只留第一条；总数封顶', () => {
    const dup = sanitizePluginPreferences([ok, { ...ok, default: 'other' }])
    expect(dup).toHaveLength(1)
    expect(dup[0].default).toBe('k')
    const many = Array.from({ length: PLUGIN_MAX_PREFERENCES + 30 }, (_, i) => ({
      name: `p${i}`,
      label: `P${i}`,
      type: 'text'
    }))
    expect(sanitizePluginPreferences(many)).toHaveLength(PLUGIN_MAX_PREFERENCES)
  })

  it('checkbox 只认布尔默认值；select 的默认值不在候选里就丢掉默认值', () => {
    const out = sanitizePluginPreferences([
      { name: 'c', label: 'C', type: 'checkbox', default: 'true' },
      { name: 's', label: 'S', type: 'select', options: ['x', 'y'], default: 'zzz' }
    ])
    expect(out[0]).toEqual({ name: 'c', label: 'C', type: 'checkbox' })
    expect(out[1]).toEqual({ name: 's', label: 'S', type: 'select', options: ['x', 'y'] })
  })
})

describe('sanitizePluginOpenableUrl', () => {
  it('http/https/mailto 收下并归一', () => {
    expect(sanitizePluginOpenableUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(sanitizePluginOpenableUrl('  http://example.com  ')).toBe('http://example.com/')
    expect(sanitizePluginOpenableUrl('mailto:a@b.com')).toBe('mailto:a@b.com')
  })

  it('宿主策略之外的协议一律 null：file / javascript / 自定义 scheme / data', () => {
    for (const raw of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'x-apple.systempreferences:com.apple.preference.security',
      'data:text/html,<script>1</script>',
      'obsidian://open?vault=x',
      '//example.com',
      'not a url',
      '',
      undefined,
      42
    ]) {
      expect(sanitizePluginOpenableUrl(raw), String(raw)).toBeNull()
    }
  })

  it('超长拒绝（不把它截断成一条还能打开的 URL）', () => {
    expect(sanitizePluginOpenableUrl(`https://example.com/${'a'.repeat(3000)}`)).toBeNull()
  })

  it('空 mailto（mailto: 后面什么都没有）拒绝', () => {
    expect(sanitizePluginOpenableUrl('mailto:')).toBeNull()
  })
})

describe('sanitizeAlertRequest', () => {
  it('没有 message 的弹窗直接拒（弹一个空框只会吓人）', () => {
    for (const raw of [{}, { title: 'x' }, { message: '   ' }, { message: 3 }, null, 'x']) {
      expect(sanitizeAlertRequest(raw)).toBeNull()
    }
  })

  it('动作 id 去重、缺 id/title 的剔除、style 只认三种、数量封顶', () => {
    const out = sanitizeAlertRequest({
      title: '标题',
      message: '正文',
      actions: [
        { id: 'a', title: 'A', style: 'destructive' },
        { id: 'a', title: '重复' },
        { id: 'b', title: 'B', style: 'primary' }, // 不是合法 style → default
        { title: '没有 id' },
        { id: 'c' },
        ...Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, title: `X${i}` }))
      ]
    })
    expect(out?.title).toBe('标题')
    expect(out?.actions).toHaveLength(PLUGIN_MAX_ALERT_ACTIONS)
    expect(out?.actions[0]).toEqual({ id: 'a', title: 'A', style: 'destructive' })
    expect(out?.actions[1].style).toBe('default')
    expect(out?.actions.map((a) => a.id)).toEqual(['a', 'b', 'x0', 'x1'])
  })

  it('标题与正文按上限截断（不能拿 200KB 文本刷宿主）', () => {
    const out = sanitizeAlertRequest({ title: 't'.repeat(500), message: 'm'.repeat(5000) })
    expect(out?.title).toHaveLength(80)
    expect(out?.message).toHaveLength(600)
  })
})

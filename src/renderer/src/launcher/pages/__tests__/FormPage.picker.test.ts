// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import FormPage from '../FormPage.vue'
import type { FormField } from '@shared/plugin-protocol'

/**
 * date/time 字段的自建选择面板：
 * 透明窗里原生 picker popup 渲染不出来（点击无反应的根因），↵/图标按钮打开
 * DOM 内浮层面板（Teleport 到 body + fixed 定位，不被 overflow 祖先裁剪）；
 * 面板开着时按键转发面板（↑↓←→ 移动、↵ 选中写回、ESC 关）。
 */

const fields: FormField[] = [
  { key: 'date', label: '开始日期', type: 'date' },
  { key: 'time', label: '开始时间', type: 'time' },
  { key: 'title', label: '标题' }
]

const mounted: VueWrapper[] = []

function setup(): VueWrapper {
  const w = mount(FormPage, { props: { fields }, attachTo: document.body })
  mounted.push(w)
  return w
}

function inputAt(w: VueWrapper, i: number): HTMLInputElement {
  return w.findAll('input.form-input')[i]!.element as HTMLInputElement
}

/** 面板 Teleport 到 body，VTU 的 find 够不到，走 document 查询 */
const panelInDoc = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-testid="picker-panel"]')

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
  document.body.innerHTML = ''
})

describe('FormPage date/time 自建面板', () => {
  it('date/time 渲染对应原生控件类型与自绘按钮，text 无按钮', () => {
    const w = setup()
    expect(inputAt(w, 0).getAttribute('type')).toBe('date')
    expect(inputAt(w, 1).getAttribute('type')).toBe('time')
    expect(w.findAll('.form-picker-btn')).toHaveLength(2)
  })

  it('↵ 在 date 字段打开日历面板（Teleport 挂到 body）', async () => {
    const w = setup()
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'Enter' })
    expect(panelInDoc()).not.toBeNull()
    expect(document.querySelectorAll('.picker-day')).toHaveLength(42)
    expect(panelInDoc()!.parentElement).toBe(document.body)
  })

  it('点击图标按钮打开时间面板', async () => {
    const w = setup()
    await w.findAll('.form-picker-btn')[1]!.trigger('click')
    expect(panelInDoc()).not.toBeNull()
    expect(document.querySelectorAll('.picker-cell').length).toBeGreaterThan(0)
  })

  it('面板开着时 ↑↓ 不切焦点（按键归面板），↵ 选中写回并关闭', async () => {
    const w = setup()
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'Enter' })
    const input = inputAt(w, 0)
    input.focus()
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(input)
    expect(panelInDoc()).not.toBeNull()
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'Enter' })
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(panelInDoc()).toBeNull()
  })

  it('面板内 ← 移动日期光标，↵ 写回 YYYY-MM-DD', async () => {
    const w = setup()
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'Enter' })
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.querySelector('.picker-day.cursor')).not.toBeNull()
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'Enter' })
    expect(inputAt(w, 0).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('ESC 关闭面板且不写值（面板开着时 ESC 不应把表单整个退掉）', async () => {
    const w = setup()
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'Enter' })
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'Escape' })
    expect(panelInDoc()).toBeNull()
    expect(inputAt(w, 0).value).toBe('')
    expect(w.emitted('cancel')).toBeUndefined()
  })

  it('时间面板 ↵ 写回 HH:mm 并关闭', async () => {
    const w = setup()
    await w.findAll('input.form-input')[1]!.trigger('keydown', { key: 'Enter' })
    await w.findAll('input.form-input')[1]!.trigger('keydown', { key: 'Enter' })
    expect(inputAt(w, 1).value).toMatch(/^\d{2}:\d{2}$/)
    expect(panelInDoc()).toBeNull()
  })

  it('date 字段 ↑↓ 在面板没开时归控件（不切焦点、不开面板）', async () => {
    const w = setup()
    const input = inputAt(w, 0)
    input.focus()
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(input)
    expect(panelInDoc()).toBeNull()
  })

  it('text 字段内 ↑↓ 仍切换字段', async () => {
    const w = setup()
    await w.findAll('input.form-input')[2]!.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(inputAt(w, 1))
  })

  it('Tab 在 date 字段上仍切到下一字段', async () => {
    const w = setup()
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(inputAt(w, 1))
  })

  it('面板被定位逻辑锚定（内联 top/left），不触发列表滚动条', async () => {
    const w = setup()
    await w.findAll('input.form-input')[0]!.trigger('keydown', { key: 'Enter' })
    const panel = panelInDoc()!
    // fixed 本体来自 scoped CSS（happy-dom 不加载），这里验证定位逻辑确实算出了坐标
    expect(panel.style.top).not.toBe('')
    expect(panel.style.left).not.toBe('')
    // 列表容器不因面板出现而可滚（内容不溢出）
    const list = w.find('.capsule-list').element as HTMLElement
    expect(list.scrollHeight).toBeLessThanOrEqual(list.clientHeight + 1)
  })
})

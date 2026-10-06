// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import FormPage from '../FormPage.vue'
import type { FormField } from '@shared/plugin-protocol'

/**
 * select 字段的自建下拉（PopoverSelect）：
 * 透明窗里原生 select 的选项 popup 渲染不出来（与 date/time picker 同坑）——
 * 点击毫无反应。断言不再出现原生 <select>；↵/点击开浮层，面板开着按键归面板，
 * 面板没开时 ↑↓ 仍是字段导航（表单骨架不破）。
 */

const fields: FormField[] = [
  {
    key: 'flags',
    label: '标志',
    type: 'select',
    options: ['g（全局）', 'i（忽略大小写）', 'm（多行）'],
    initial: 'i（忽略大小写）'
  },
  { key: 'title', label: '标题' }
]

const mounted: VueWrapper[] = []

async function setup(): Promise<VueWrapper> {
  const w = mount(FormPage, { props: { fields }, attachTo: document.body })
  mounted.push(w)
  // onMounted 的 initValues 触发的重渲染在 nextTick 才落 DOM
  await nextTick()
  return w
}

const triggerAt = (w: VueWrapper, i: number) => w.findAll('.popover-select-trigger')[i]!

/** 面板 Teleport 到 body，VTU 的 find 够不到，走 document 查询 */
const optionsInDoc = (): NodeListOf<HTMLElement> =>
  document.querySelectorAll<HTMLElement>('.popover-select-option')

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
  document.body.innerHTML = ''
})

describe('FormPage select 自建下拉', () => {
  it('不再渲染原生 <select>（透明窗 popup 画不出），渲染 PopoverSelect 触发器', async () => {
    const w = await setup()
    expect(w.find('select').exists()).toBe(false)
    expect(w.findAll('.popover-select-trigger')).toHaveLength(1)
    expect(triggerAt(w, 0).text()).toContain('i（忽略大小写）')
  })

  it('↵ 打开浮层（Teleport 挂到 body，选项含全部 title）', async () => {
    const w = await setup()
    await triggerAt(w, 0).trigger('keydown', { key: 'Enter' })
    expect(optionsInDoc()).toHaveLength(3)
    expect(optionsInDoc()[0]!.textContent).toContain('g（全局）')
  })

  it('点击触发器开浮层，点选项写回并关闭', async () => {
    const w = await setup()
    await triggerAt(w, 0).trigger('click')
    expect(optionsInDoc()).toHaveLength(3)
    // 面板 Teleport 到 body，是原生节点：用 DOM click 派发
    optionsInDoc()[2]!.click()
    await nextTick()
    expect(triggerAt(w, 0).text()).toContain('m（多行）')
    expect(optionsInDoc()).toHaveLength(0)
  })

  it('面板开着时按键归面板：↑↓ 移动光标不切字段，↵ 选中写回', async () => {
    const w = await setup()
    await triggerAt(w, 0).trigger('keydown', { key: 'Enter' })
    await triggerAt(w, 0).trigger('keydown', { key: 'ArrowDown' })
    // 焦点不动（若切了字段，activeElement 会离开 select 行）
    expect(optionsInDoc()).toHaveLength(3)
    await triggerAt(w, 0).trigger('keydown', { key: 'Enter' })
    expect(optionsInDoc()).toHaveLength(0)
    // ↵ 选中当前光标项（从 initial 起 ↓ 一次 → 'm（多行）'）
    expect(triggerAt(w, 0).text()).toContain('m（多行）')
  })

  it('面板没开时 ↑↓ 仍是字段导航（骨架不破）', async () => {
    const w = await setup()
    await triggerAt(w, 0).trigger('keydown', { key: 'ArrowDown' })
    expect(optionsInDoc()).toHaveLength(0)
    expect(document.activeElement).toBe(w.find('input.form-input').element)
  })

  it('面板开着时 ESC 关面板不退表单；面板没开时 ESC 退表单', async () => {
    const w = await setup()
    await triggerAt(w, 0).trigger('keydown', { key: 'Enter' })
    await triggerAt(w, 0).trigger('keydown', { key: 'Escape' })
    expect(optionsInDoc()).toHaveLength(0)
    expect(w.emitted('cancel')).toBeUndefined()
    await triggerAt(w, 0).trigger('keydown', { key: 'Escape' })
    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('⌘↵ 提交 select 当前值（title 原样上交，还原在外层做）', async () => {
    const w = await setup()
    await triggerAt(w, 0).trigger('keydown', { key: 'Enter', metaKey: true })
    expect(w.emitted('submit')?.[0]?.[0]).toEqual({ flags: 'i（忽略大小写）', title: '' })
    expect(optionsInDoc()).toHaveLength(0)
  })

  it('←→ 面板没开时仍轮转选项（键盘用户的快捷路径）', async () => {
    const w = await setup()
    await triggerAt(w, 0).trigger('keydown', { key: 'ArrowRight' })
    expect(triggerAt(w, 0).text()).toContain('m（多行）')
    await triggerAt(w, 0).trigger('keydown', { key: 'ArrowLeft' })
    expect(triggerAt(w, 0).text()).toContain('i（忽略大小写）')
  })
})

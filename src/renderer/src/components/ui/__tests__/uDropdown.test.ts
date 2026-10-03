// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UDropdown from '../UDropdown.vue'

const items = [
  { id: 'open', label: '打开', icon: 'ri-folder-line' },
  { id: 'sep', divider: true },
  { id: 'del', label: '删除', danger: true },
  { id: 'na', label: '不可用', disabled: true }
]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(UDropdown, { props: { items, ...props }, slots: { default: '菜单' } })
}

describe('UDropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('默认关闭；点击触发器展开并设置 aria', async () => {
    const w = setup()
    expect(w.find('[role=menu]').exists()).toBe(false)
    await w.get('button').trigger('click')
    expect(w.get('button').attributes('aria-expanded')).toBe('true')
    expect(w.find('[role=menu]').exists()).toBe(true)
  })

  it('divider 渲染分隔线且不渲染为 menuitem', async () => {
    const w = setup()
    await w.get('button').trigger('click')
    expect(w.find('[role=separator]').exists()).toBe(true)
    expect(w.findAll('[role=menuitem]').length).toBe(3)
  })

  it('点击菜单项发出 select 并关闭', async () => {
    const w = setup()
    await w.get('button').trigger('click')
    await w.findAll('[role=menuitem]')[1]!.trigger('click') // del
    expect(w.emitted('select')![0]).toEqual(['del'])
    expect(w.find('[role=menu]').exists()).toBe(false)
  })

  it('disabled 项点击不发事件', async () => {
    const w = setup()
    await w.get('button').trigger('click')
    await w.findAll('[role=menuitem]')[2]!.trigger('click') // na
    expect(w.emitted('select')).toBeUndefined()
  })

  it('Esc 关闭', async () => {
    const w = setup()
    await w.get('button').trigger('click')
    await w.get('[role=menu]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[role=menu]').exists()).toBe(false)
  })

  it('点击外部关闭（document pointerdown）', async () => {
    const w = setup({ attachTo: document.body })
    await w.get('button').trigger('click')
    expect(w.find('[role=menu]').exists()).toBe(true)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 0))
    expect(w.find('[role=menu]').exists()).toBe(false)
    w.unmount()
  })
})

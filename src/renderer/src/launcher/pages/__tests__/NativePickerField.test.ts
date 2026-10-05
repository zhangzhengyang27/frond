// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import NativePickerField from '../NativePickerField.vue'

/**
 * 日期/时间字段（原生 input + 自建面板一体）：
 * 点图标/↵ 开 PickerPanel（透明窗里原生 popup 弹不出），↑↓ 归控件分段调值。
 */

const mounted: VueWrapper[] = []

function setup(mode: 'date' | 'time', modelValue = ''): VueWrapper {
  const w = mount(NativePickerField, {
    props: {
      mode,
      modelValue,
      'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v })
    },
    attachTo: document.body
  })
  mounted.push(w)
  return w
}

const panel = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-testid="picker-panel"]')

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
  document.body.innerHTML = ''
})

describe('NativePickerField', () => {
  it('input 类型随 mode，点图标开面板并写回', async () => {
    // 固定时钟：「今天」随真实日期漂移会让期望值跨天翻车（2026-10-06 曾挂）
    vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00') })
    const w = setup('date')
    expect(w.find('input').attributes('type')).toBe('date')
    await w.find('.npk-btn').trigger('click')
    expect(panel()).not.toBeNull()
    ;(document.querySelector('.picker-day.today') as HTMLElement)?.click()
    await w.vm.$nextTick()
    expect(w.emitted('update:modelValue')![0]).toEqual(['2026-10-05'])
    expect(panel()).toBeNull()
    vi.useRealTimers()
  })

  it('↵ 开面板，面板开着时 ESC 收起不写值', async () => {
    const w = setup('time')
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(panel()).not.toBeNull()
    await w.find('input').trigger('keydown', { key: 'Escape' })
    expect(panel()).toBeNull()
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('↑↓ 在面板没开时不被劫持（归原生分段调值，不发值不开面板）', async () => {
    const w = setup('date')
    await w.find('input').trigger('keydown', { key: 'ArrowDown' })
    expect(panel()).toBeNull()
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('v-model 回写反映在 input 值上', async () => {
    const w = setup('date', '2026-10-05')
    expect((w.find('input').element as HTMLInputElement).value).toBe('2026-10-05')
  })
})

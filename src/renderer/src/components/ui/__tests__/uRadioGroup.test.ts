// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import URadioGroup from '../URadioGroup.vue'

const options = [
  { label: 'VP9', value: 'vp9', description: '高质量，文件较小（推荐）' },
  { label: 'VP8', value: 'vp8' },
  { label: 'H.264', value: 'h264', disabled: true }
]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(URadioGroup, { props: { modelValue: 'vp9', options, ...props } })
}

describe('URadioGroup', () => {
  it('渲染 radiogroup 与全部选项', () => {
    const w = setup()
    expect(w.find('[role=radiogroup]').exists()).toBe(true)
    expect(w.findAll('input[type=radio]').length).toBe(3)
    expect(w.text()).toContain('高质量，文件较小（推荐）')
  })

  it('选中项 checked 且切换发出对应 value', async () => {
    const w = setup()
    const radios = w.findAll('input[type=radio]')
    expect((radios[0]!.element as HTMLInputElement).checked).toBe(true)
    await radios[1]!.setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual(['vp8'])
  })

  it('option 级 disabled 不可选', async () => {
    const w = setup()
    await w.findAll('input[type=radio]')[2]!.setValue(true)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('group 级 disabled 全部不可用', async () => {
    const w = setup({ disabled: true })
    await w.findAll('input[type=radio]')[0]!.setValue(true)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('number value 原样发出（不做 string 化）', async () => {
    const w = mount(URadioGroup, {
      props: { modelValue: 30, options: [{ label: '30', value: 30 }, { label: '60', value: 60 }] }
    })
    await w.findAll('input[type=radio]')[1]!.setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([60])
  })
})

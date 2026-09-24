// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'

/**
 * ExportDialog 的渲染契约（重建件判别性断言）
 *
 * 为什么必须测这个：该 SFC 的**整个 `<template>` 块随 2026-09-22 事故丢失**
 * （盘上只剩 `<script>`），现在的模板是「按 script 里既有的 props / handler 反推」
 * 出来的（见该文件 template 上方的重建说明）。也就是说：
 * **默认参数、禁用条件、事件名全是推断值** —— 猜错一个，用户点「开始导出」就拿到
 * 一份参数不对的产物，而且不报错。
 *
 * 断言盯**发出的事件与禁用态**，不盯样式类名（类名改了不算坏，事件/参数不对就是功能断了）。
 */

const toastWarning = vi.fn()
vi.mock('@composables/useToast', () => ({
  useToast: () => ({
    warning: toastWarning,
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  })
}))

const selectSavePath = vi.fn(async (): Promise<string | null> => null)
const selectVideoFile = vi.fn(async (): Promise<string | null> => null)
const selectAudioFile = vi.fn(async (): Promise<string | null> => null)

import ExportDialog from '../ExportDialog.vue'
import type { Clip } from '@composables/useVideoClip'

const clip = (over: Partial<Clip> = {}): Clip => ({
  id: 'c1',
  startTime: 0,
  endTime: 10,
  ...over
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(ExportDialog, {
    props: { clips: [clip()], ...props },
    global: { stubs: { TransitionSelector: true } }
  })
}

const exportBtn = (w: ReturnType<typeof setup>): ReturnType<typeof w.get> =>
  w.findAll('button').find((b) => /开始导出|导出中/.test(b.text()))!
const outputInput = (w: ReturnType<typeof setup>): ReturnType<typeof w.get> =>
  w.get('input[placeholder="输出文件完整路径"]')
/** 取原生元素做值断言（`wrapper.element` 的类型是 VueNode，不含 input 的 value） */
const outputValue = (w: ReturnType<typeof setup>): string =>
  (outputInput(w).element as HTMLInputElement).value
const selects = (w: ReturnType<typeof setup>): ReturnType<typeof w.findAll> => w.findAll('select')

beforeEach(() => {
  toastWarning.mockClear()
  selectSavePath.mockClear()
  selectVideoFile.mockClear()
  selectAudioFile.mockClear()
  ;(window as unknown as { api: unknown }).api = {
    clip: { selectSavePath, selectVideoFile, selectAudioFile }
  }
})

describe('ExportDialog · 默认导出参数（模板反推出来的值，猜错用户拿到错产物）', () => {
  it('什么都不改就导出：resolution=1080 / fps=30 / transition=cut', async () => {
    const w = setup()
    await outputInput(w).setValue('/tmp/out.mp4')
    await exportBtn(w).trigger('click')

    const events = w.emitted('export')
    expect(events).toHaveLength(1)
    const opts = events![0][0] as Record<string, unknown>
    expect(opts).toMatchObject({
      resolution: 1080,
      fps: 30,
      transition: 'cut',
      outputPath: '/tmp/out.mp4'
    })
    // 没有选片头/片尾/音乐时不该凭空带上这些字段
    expect(opts.intro).toBeUndefined()
    expect(opts.outro).toBeUndefined()
    expect(opts.backgroundMusic).toBeUndefined()
  })

  it('分辨率下拉真的接到 options 上（不是只渲染了个 select）', async () => {
    const w = setup()
    await outputInput(w).setValue('/tmp/out.mp4')
    await selects(w)[0].setValue('2160')
    await exportBtn(w).trigger('click')
    expect((w.emitted('export')![0][0] as Record<string, unknown>).resolution).toBe(2160)
  })

  it('帧率下拉同理：选 60 就发 60', async () => {
    const w = setup()
    await outputInput(w).setValue('/tmp/out.mp4')
    await selects(w)[1].setValue('60')
    await exportBtn(w).trigger('click')
    expect((w.emitted('export')![0][0] as Record<string, unknown>).fps).toBe(60)
  })
})

describe('ExportDialog · 守卫与禁用态', () => {
  it('没填输出路径时点导出：不发 export，而是提示（负向断言）', async () => {
    const w = setup()
    await exportBtn(w).trigger('click')
    expect(w.emitted('export')).toBeUndefined()
    expect(toastWarning).toHaveBeenCalledTimes(1)
  })

  it('一个片段都没有时导出按钮是禁用的（clips.length === 0）', () => {
    const w = setup({ clips: [] })
    expect(exportBtn(w).attributes('disabled')).toBeDefined()
  })

  it('导出中：按钮文案变「导出中…」且禁用，取消也禁用', () => {
    const w = setup({ exporting: true })
    expect(exportBtn(w).text()).toContain('导出中')
    expect(exportBtn(w).attributes('disabled')).toBeDefined()
    const cancel = w.findAll('button').find((b) => b.text() === '取消')!
    expect(cancel.attributes('disabled')).toBeDefined()
  })
})

describe('ExportDialog · 关闭与进度', () => {
  it('取消按钮发 close', async () => {
    const w = setup()
    await w.findAll('button').find((b) => b.text() === '取消')!.trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('点遮罩空白处发 close，点卡片内部不发（click.self）', async () => {
    const w = setup()
    await w.get('div.fixed').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    await w.get('.w-\\[520px\\]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1) // 仍是 1，没被内部点击多算一次
  })

  it('片段数显示在标题栏', () => {
    const w = setup({ clips: [clip(), clip({ id: 'c2' }), clip({ id: 'c3' })] })
    expect(w.text()).toContain('3 个片段')
  })

  it('导出中但还没有进度时显示「准备中…」；有进度时按 percent 给宽度', async () => {
    const w = setup({ exporting: true, exportProgress: null })
    expect(w.text()).toContain('准备中…')

    const w2 = setup({
      exporting: true,
      exportProgress: { percent: 42, currentClip: 2, totalClips: 3, message: '合成中' }
    })
    expect(w2.text()).toContain('合成中')
    expect(w2.text()).toContain('第 2 / 3 段')
    const bar = w2.find('.bg-brand-500[style]')
    expect(bar.attributes('style')).toContain('width: 42%')
  })

  it('percent 越界时钳到 0..100（进度条不会溢出或反向）', () => {
    const hi = setup({
      exporting: true,
      exportProgress: { percent: 999, currentClip: 1, totalClips: 1, message: 'x' }
    })
    expect(hi.find('.bg-brand-500[style]').attributes('style')).toContain('width: 100%')
    const lo = setup({
      exporting: true,
      exportProgress: { percent: -5, currentClip: 1, totalClips: 1, message: 'x' }
    })
    expect(lo.find('.bg-brand-500[style]').attributes('style')).toContain('width: 0%')
  })

  it('「浏览…」把选中的路径填进输出框（选了才填，取消不动）', async () => {
    const w = setup()
    selectSavePath.mockResolvedValueOnce('/picked/a.mp4')
    await w.findAll('button').find((b) => b.text() === '浏览…')!.trigger('click')
    await w.vm.$nextTick()
    expect(outputValue(w)).toBe('/picked/a.mp4')

    selectSavePath.mockResolvedValueOnce(null)
    await w.findAll('button').find((b) => b.text() === '浏览…')!.trigger('click')
    await w.vm.$nextTick()
    expect(outputValue(w)).toBe('/picked/a.mp4') // 取消不改
  })

  it('选片头后按钮文案变「换片头」并显示路径（状态真的接上了）', async () => {
    const w = setup()
    selectVideoFile.mockResolvedValueOnce('/x/intro.mp4')
    await w.findAll('button').find((b) => b.text() === '选片头')!.trigger('click')
    await w.vm.$nextTick()
    expect(w.text()).toContain('换片头')
    expect(w.text()).toContain('/x/intro.mp4')
  })
})

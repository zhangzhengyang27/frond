// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ClipTimeline from '../ClipTimeline.vue'
import type { Clip } from '@composables/useVideoClip'

/**
 * 剪辑时间轨的交互契约（单击跳转 / 拖框新增 / 拖边界改片段）。
 *
 * 为什么在组件层测而不是 e2e：剪辑页要有一段真录像才进得去（ClipPage 由
 * Layout 带着 playbackVideoPath 挂进来），e2e 里造一段不如在这里点鼠标。
 * 断言全部盯**发出的事件**，不盯样式类名 —— 类名改了不算坏，事件不对就是功能断了。
 */

const DURATION = 100
const TRACK_WIDTH = 400

const clip = (over: Partial<Clip> = {}): Clip => ({
  id: 'c1',
  startTime: 10,
  endTime: 20,
  ...over
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  const wrapper = mount(ClipTimeline, {
    props: {
      duration: DURATION,
      clips: [] as Clip[],
      selectedClipId: null,
      currentTime: 0,
      ...props
    }
  })
  const track = wrapper.get('[data-testid="clip-track"]').element as HTMLElement
  // happy-dom 不做布局，rect 全是 0；组件按 rect 反算秒数，所以这里给一条真实宽度
  track.getBoundingClientRect = () =>
    ({ left: 0, right: TRACK_WIDTH, width: TRACK_WIDTH, top: 0, bottom: 48, height: 48 }) as DOMRect
  return { wrapper, track }
}

const x = (seconds: number): number => (seconds / DURATION) * TRACK_WIDTH

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试辅助
const drag = async (wrapper: ReturnType<typeof setup>['wrapper'], from: number, to: number) => {
  const el = wrapper.get('[data-testid="clip-track"]').element
  const fire = (type: string, clientX: number, target: Element = el): void => {
    target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }))
  }
  fire('mousedown', from)
  await wrapper.vm.$nextTick()
  fire('mousemove', to)
  await wrapper.vm.$nextTick()
  fire('mouseup', to)
  await wrapper.vm.$nextTick()
}

describe('ClipTimeline', () => {
  beforeEach(() => {
    // 每个用例独立：mount 出来的组件事件队列不跨用例
  })

  it('单击轨道 → seek 到那一时刻（不是新增片段）', async () => {
    const { wrapper } = setup()
    await drag(wrapper, x(50), x(50))
    expect(wrapper.emitted('seek')).toHaveLength(1)
    expect(wrapper.emitted('seek')![0]).toEqual([50])
    expect(wrapper.emitted('add-clip')).toBeUndefined()
  })

  it('按住拖框 → add-clip 带起止秒，且不误报 seek', async () => {
    const { wrapper } = setup()
    await drag(wrapper, x(20), x(60))
    expect(wrapper.emitted('add-clip')).toEqual([[20, 60]])
    expect(wrapper.emitted('seek')).toBeUndefined()
  })

  it('从右往左拖也能给出正确区间（start 一定小于 end）', async () => {
    const { wrapper } = setup()
    await drag(wrapper, x(70), x(35))
    expect(wrapper.emitted('add-clip')).toEqual([[35, 70]])
  })

  it('点片段条 → clip-select 带那一条（不是列表里那条，是轴上这一条）', async () => {
    const { wrapper } = setup({
      clips: [clip({ id: 'c1' }), clip({ id: 'c2', startTime: 40, endTime: 55 })]
    })
    await wrapper.get('[data-clip-id="c2"]').trigger('click')
    const selected = wrapper.emitted('clip-select')
    expect(selected).toHaveLength(1)
    expect((selected![0][0] as Clip).id).toBe('c2')
  })

  it('拖片段右边界 → update 只动 endTime，startEdge 不动', async () => {
    const { wrapper } = setup({ clips: [clip()] })
    const handle = wrapper.get('[data-testid="clip-edge-end"]').element
    const fire = (type: string, clientX: number): void => {
      handle.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }))
    }
    fire('mousedown', x(20))
    await wrapper.vm.$nextTick()
    fire('mousemove', x(35))
    await wrapper.vm.$nextTick()
    fire('mouseup', x(35))
    await wrapper.vm.$nextTick()

    const updates = wrapper.emitted('update')
    expect(updates).toHaveLength(1)
    const next = updates![0][0] as Clip
    expect(next.startTime).toBe(10)
    expect(next.endTime).toBe(35)
    // 改边界不该同时被当成「框选新增」或「跳转」
    expect(wrapper.emitted('add-clip')).toBeUndefined()
    expect(wrapper.emitted('seek')).toBeUndefined()
  })

  it('时长还没拿到（duration=0）时任何拖拽都不该发出事件', async () => {
    const { wrapper } = setup({ duration: 0 })
    await drag(wrapper, 0, TRACK_WIDTH)
    expect(wrapper.emitted('add-clip')).toBeUndefined()
    expect(wrapper.emitted('seek')).toBeUndefined()
  })
})

// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import PluginHud from '../PluginHud.vue'

afterEach(() => vi.useRealTimers())

describe('PluginHud（spec 3.3）', () => {
  it('show() 显示 title，1.5s 后自动消失', async () => {
    vi.useFakeTimers()
    const w = mount(PluginHud)
    w.vm.show('已复制')
    await nextTick() // Vue DOM patch 异步：text 赋值后必须 nextTick 才能断言 DOM
    expect(w.find('.plugin-hud').text()).toContain('已复制')
    vi.advanceTimersByTime(1500)
    await nextTick()
    expect(w.find('.plugin-hud').exists()).toBe(false)
  })
  it('同文本连发只显示一条并刷新计时（不闪烁）', async () => {
    vi.useFakeTimers()
    const w = mount(PluginHud)
    w.vm.show('已复制')
    await nextTick()
    vi.advanceTimersByTime(1200)
    w.vm.show('已复制') // 1.2s 时再来一条 → 计时重启
    vi.advanceTimersByTime(1200)
    await nextTick()
    expect(w.find('.plugin-hud').exists()).toBe(true) // 距第二次 show 只过了 1.2s
    vi.advanceTimersByTime(300)
    await nextTick()
    expect(w.find('.plugin-hud').exists()).toBe(false)
  })
})

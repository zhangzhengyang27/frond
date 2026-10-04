// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RecordingSettingsDialog from '../RecordingSettingsDialog.vue'

/**
 * RecordingSettingsDialog 的渲染契约（B44 重建件判别性断言）
 *
 * 断言盯「状态迁移与事件载荷」，不盯样式细节：
 * - 打开时从 recordingSettings.getSettings 装载（默认参数正确 = 加载路径正确）
 * - 质量预设切换可从激活态样式与保存载荷两侧观察
 * - 保存发出 save + 完整 settings；取消发出 close
 */

const getSettings = vi.fn(async () => ({
  encoder: 'vp9',
  quality: 'medium',
  bitrate: 5000,
  fps: 30,
  resolution: { width: 1920, height: 1080 },
  format: 'webm',
  audioEnabled: false,
  audioCodec: 'opus',
  audioBitrate: 128
}))

beforeEach(() => {
  getSettings.mockClear()
  ;(window as unknown as { api: unknown }).api = {
    recordingSettings: { getSettings, updateSettings: vi.fn(async () => ({})) }
  }
})

const setup = async (): Promise<ReturnType<typeof mount>> => {
  const w = mount(RecordingSettingsDialog, {
    props: { show: false },
    global: { stubs: { teleport: true } }
  })
  await w.setProps({ show: true })
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
  return w
}

const presetBtn = (w: ReturnType<typeof mount>, label: string) =>
  w.findAll('button').find((b) => b.text().includes(label))!

describe('RecordingSettingsDialog 契约（B44）', () => {
  it('打开时装载持久化设置：low 预设为激活态（默认参数 = 加载路径）', async () => {
    getSettings.mockResolvedValue({
      encoder: 'vp9',
      quality: 'low',
      bitrate: 2000,
      fps: 30,
      resolution: { width: 1280, height: 720 },
      format: 'webm',
      audioEnabled: false,
      audioCodec: 'opus',
      audioBitrate: 128
    })
    const w = await setup()
    expect(getSettings).toHaveBeenCalled()
    expect(presetBtn(w, '低质量').classes()).toContain('border-brand-500')
    expect(presetBtn(w, '中等质量').classes()).not.toContain('border-brand-500')
  })

  it('预设切换：点击高质量后激活态迁移', async () => {
    const w = await setup()
    await presetBtn(w, '高质量').trigger('click')
    expect(presetBtn(w, '高质量').classes()).toContain('border-brand-500')
    expect(presetBtn(w, '中等质量').classes()).not.toContain('border-brand-500')
  })

  it('保存：发出 save 且载荷携带切换后的预设', async () => {
    const w = await setup()
    await presetBtn(w, '高质量').trigger('click')
    const saveBtn = w.findAll('button').find((b) => b.text() === '保存')!
    await saveBtn.trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    const emitted = w.emitted('save')!
    expect(emitted.length).toBeGreaterThan(0)
    expect(emitted[0]![0]).toMatchObject({ quality: 'high', encoder: 'vp9' })
  })

  it('取消：发出 close，不发出 save', async () => {
    const w = await setup()
    const cancelBtn = w.findAll('button').find((b) => b.text() === '取消')!
    await cancelBtn.trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.emitted('save')).toBeUndefined()
  })
})

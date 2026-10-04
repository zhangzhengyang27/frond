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

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
}))
vi.mock('@composables/useToast', () => ({ useToast: () => toastMock }))

const getSettings = vi.fn(async (): Promise<Record<string, unknown>> => ({
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

const getQualityPreset = vi.fn(async (q: string) =>
  q === 'high'
    ? { bitrate: 10000, fps: 60, resolution: { width: 1920, height: 1080 } }
    : { bitrate: 2000, fps: 30, resolution: { width: 1280, height: 720 } }
)

beforeEach(() => {
  getSettings.mockClear()
  getQualityPreset.mockClear()
  toastMock.error.mockClear()
  ;(window as unknown as { api: unknown }).api = {
    recordingSettings: {
      getSettings,
      updateSettings: vi.fn(async () => ({})),
      getQualityPreset,
      resetToDefaults: vi.fn(async () => ({
        encoder: 'vp9',
        quality: 'medium',
        bitrate: 5000,
        fps: 30,
        resolution: { width: 1920, height: 1080 },
        format: 'webm',
        audioEnabled: false,
        audioCodec: 'opus',
        audioBitrate: 128,
        engine: 'mediarecorder'
      }))
    },
    recording: {
      shortcut: {
        getConfig: vi.fn(async () => ({ enabled: true, start: '', togglePause: '' })),
        setConfig: vi.fn(async () => ({}))
      }
    }
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

describe('B57-17 设置对话框健壮性', () => {
  const flush = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  }

  it('保存载荷数值钳制：负数/NaN 码率与越界分辨率不再原样落盘', async () => {
    getSettings.mockResolvedValue({
      encoder: 'vp9',
      quality: 'custom',
      bitrate: -5,
      fps: 30,
      resolution: { width: 0, height: 1e9 },
      format: 'webm',
      audioEnabled: false,
      audioCodec: 'opus',
      audioBitrate: Number.NaN,
      engine: 'mediarecorder'
    })
    const w = await setup()
    const saveBtn = w.findAll('button').find((b) => b.text() === '保存')!
    await saveBtn.trigger('click')
    await flush()
    const payload = w.emitted('save')![0]![0] as Record<string, unknown>
    expect(payload.bitrate).toBe(100) // -5 → 下限钳制（NaN 才走默认）
    expect(payload.audioBitrate).toBe(128) // NaN → 默认 128
    expect((payload.resolution as Record<string, number>).width).toBe(240) // 0 → 下限钳制
    expect((payload.resolution as Record<string, number>).height).toBe(4320) // 1e9 → 上限钳制
  })

  it('setConfig 拒绝：toast 提示且保存流程继续（不再 unhandled 卡死）', async () => {
    const w = await setup()
    const api = (
      window as unknown as {
        api: { recording: { shortcut: { setConfig: ReturnType<typeof vi.fn> } } }
      }
    ).api.recording.shortcut
    api.setConfig.mockRejectedValueOnce(new Error('accel busy'))
    const saveBtn = w.findAll('button').find((b) => b.text() === '保存')!
    await saveBtn.trigger('click')
    await flush()
    expect(toastMock.error).toHaveBeenCalled()
    expect(w.emitted('save')).toBeTruthy() // 其余设置仍正常保存
  })

  it('重置完整：倒计时/快捷键/系统音频一并回默认（点保存不再写回旧值）', async () => {
    getSettings.mockResolvedValue({
      encoder: 'vp9',
      quality: 'medium',
      bitrate: 5000,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      format: 'webm',
      audioEnabled: false,
      audioCodec: 'opus',
      audioBitrate: 128,
      engine: 'mediarecorder',
      countdownSeconds: 7,
      countdownBeep: false,
      systemAudio: { enabled: true, deviceId: 'dev-1', keepMicrophone: false }
    })
    const w = await setup()
    await flush()
    const resetBtn = w.findAll('button').find((b) => b.text().includes('重置'))!
    await resetBtn.trigger('click')
    await flush()
    const saveBtn = w.findAll('button').find((b) => b.text() === '保存')!
    await saveBtn.trigger('click')
    await flush()
    const payload = w.emitted('save')![0]![0] as Record<string, unknown>
    expect(payload.countdownSeconds).toBe(3)
    expect(payload.countdownBeep).toBe(true)
    expect((payload.systemAudio as Record<string, unknown>).enabled).toBe(false)
    expect((payload.shortcuts as Record<string, unknown>).enabled).toBe(true)
  })

  it('质量预设连点乱序：最后一次点击胜出（晚到的旧预设被丢弃）', async () => {
    let resolveHigh!: (v: unknown) => void
    getQualityPreset.mockImplementation((q: string) => {
      if (q === 'high') {
        return new Promise((r) => {
          resolveHigh = r as (v: unknown) => void
        })
      }
      return Promise.resolve({ bitrate: 2000, fps: 30, resolution: { width: 1280, height: 720 } })
    })
    const w = await setup()
    await presetBtn(w, '高质量').trigger('click') // 挂起中
    await presetBtn(w, '低质量').trigger('click') // 后点击先返回
    await flush()
    resolveHigh({ bitrate: 10000, fps: 60, resolution: { width: 1920, height: 1080 } })
    await flush()
    const saveBtn = w.findAll('button').find((b) => b.text() === '保存')!
    await saveBtn.trigger('click')
    await flush()
    const payload = w.emitted('save')![0]![0] as Record<string, unknown>
    expect(payload.bitrate).toBe(2000) // 修复前：晚到的 high 预设覆盖成 10000
  })

  it('系统音频状态回读：重开对话框不再显示关闭（保存不再静默关闭）', async () => {
    getSettings.mockResolvedValue({
      encoder: 'vp9',
      quality: 'medium',
      bitrate: 5000,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      format: 'webm',
      audioEnabled: true,
      audioCodec: 'opus',
      audioBitrate: 128,
      engine: 'mediarecorder',
      systemAudio: { enabled: true, deviceId: 'dev-9', keepMicrophone: false }
    })
    const w = await setup()
    const saveBtn = w.findAll('button').find((b) => b.text() === '保存')!
    await saveBtn.trigger('click')
    await flush()
    const payload = w.emitted('save')![0]![0] as Record<string, unknown>
    const sa = payload.systemAudio as Record<string, unknown>
    expect(sa.enabled).toBe(true) // 修复前：恒 false → 保存即静默关闭
    expect(sa.deviceId).toBe('dev-9')
    expect(sa.keepMicrophone).toBe(false)
  })
})

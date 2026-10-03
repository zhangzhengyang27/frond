import { describe, it, expect } from 'vitest'
import { claimRecordingStart, releaseRecordingStart } from '../useScreenRecorder'

/**
 * 录屏启动防重入（B50b）：启动链最长 10s（ready-wait），双击/快捷键+点击并发
 * 进入时，第二次 combineStreams 的 epoch 作废路径返回已 stop 的轨道 → 录出
 * 空/坏文件。claim 是模块级原子 test-and-set（所有组件共享同一份录制状态）。
 */
describe('useScreenRecorder 启动防重入闸', () => {
  it('并发触发只放行第一次，release 后可再次启动', () => {
    releaseRecordingStart() // 复位
    expect(claimRecordingStart()).toBe(true)
    expect(claimRecordingStart()).toBe(false) // 第二次触发被挡
    releaseRecordingStart()
    expect(claimRecordingStart()).toBe(true)
    releaseRecordingStart()
  })
})

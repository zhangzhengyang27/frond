<template>
  <UModal :model-value="show" title="录制设置" size="lg" @update:model-value="onModalVisibility">
    <!-- 质量预设 -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-fg-primary mb-4">质量预设</h3>
      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="preset in qualityPresets"
          :key="preset.value"
          :class="[
            'px-4 py-3 rounded-lg border-2 transition-all',
            localSettings.quality === preset.value
              ? 'border-brand-500 bg-brand-50 text-brand-500 font-semibold'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          ]"
          @click="selectQualityPreset(preset.value)"
        >
          <div class="font-medium">{{ preset.label }}</div>
          <div class="text-xs mt-1 opacity-70">{{ preset.description }}</div>
        </button>
      </div>
    </div>

    <!-- 编码器设置 -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-fg-primary mb-4">编码器</h3>
      <URadioGroup v-model="localSettings.encoder" :options="encoderOptions" />
    </div>

    <!-- 高级设置 -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-fg-primary">高级设置</h3>
        <UButton variant="ghost" size="sm" @click="showAdvanced = !showAdvanced">
          <AppIcon :icon="showAdvanced ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" />
          <span>{{ showAdvanced ? '收起' : '展开' }}</span>
        </UButton>
      </div>

      <div v-if="showAdvanced" class="space-y-4">
        <!-- 帧率 -->
        <div>
          <label class="mb-2 block text-sm font-medium text-fg-primary">帧率 (FPS)</label>
          <URadioGroup v-model="localSettings.fps" :options="fpsOptions" direction="horizontal" />
        </div>

        <!-- 分辨率 -->
        <div>
          <label class="mb-2 block text-sm font-medium text-fg-primary">分辨率</label>
          <div class="grid grid-cols-2 gap-3">
            <UInput
              v-model.number="localSettings.resolution.width"
              type="number"
              label="宽度"
              :disabled="localSettings.quality !== 'custom'"
            />
            <UInput
              v-model.number="localSettings.resolution.height"
              type="number"
              label="高度"
              :disabled="localSettings.quality !== 'custom'"
            />
          </div>
        </div>

        <!-- 比特率 -->
        <div v-if="localSettings.quality === 'custom'">
          <UInput v-model.number="localSettings.bitrate" type="number" label="视频比特率 (kbps)" />
          <div class="mt-1 text-xs text-fg-tertiary">
            建议值：低质量 2000，中等质量 5000，高质量 10000
          </div>
        </div>

        <!-- 音频设置 -->
        <div class="pt-4 border-t border-line-subtle">
          <UCheckbox v-model="localSettings.audioEnabled" label="启用音频录制" />
          <div v-if="localSettings.audioEnabled" class="mt-4 ml-8 space-y-3">
            <div>
              <label class="mb-2 block text-sm font-medium text-fg-primary">音频编码器</label>
              <URadioGroup
                v-model="localSettings.audioCodec"
                :options="audioCodecOptions"
                direction="horizontal"
              />
            </div>
            <UInput
              v-model.number="localSettings.audioBitrate"
              type="number"
              label="音频比特率 (kbps)"
            />
          </div>
        </div>

        <!-- 文件格式 -->
        <div>
          <label class="mb-2 block text-sm font-medium text-fg-primary">文件格式</label>
          <URadioGroup
            v-model="localSettings.format"
            :options="formatOptions"
            direction="horizontal"
          />
        </div>

        <!-- 录制引擎（B57 根因① 治理，D6 特性开关双轨） -->
        <div>
          <label class="mb-2 block text-sm font-medium text-fg-primary">录制引擎</label>
          <URadioGroup
            v-model="localSettings.engine"
            :options="engineOptions"
            direction="horizontal"
          />
          <p v-if="localSettings.engine === 'webcodecs'" class="mt-2 text-xs text-fg-secondary">
            实验性：WebCodecs 直出 MP4（免转码、崩溃可恢复）。如遇异常请切回默认引擎。
          </p>
        </div>
      </div>
    </div>

    <!-- 性能提示 -->
    <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div class="flex items-start gap-3">
        <AppIcon icon="ri-information-line" class="text-blue-600 shrink-0 mt-0.5" />
        <div class="text-sm text-blue-800">
          <div class="font-medium mb-1">性能提示</div>
          <div>高分辨率和帧率会增加 CPU 使用率。如果录制时出现卡顿，建议降低分辨率或帧率。</div>
        </div>
      </div>

      <!-- PR-5a: 系统音频 -->
      <div class="pt-4 border-t border-gray-200">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-fg-primary">系统音频（录制应用声音）</h4>
          <UButton
            variant="ghost"
            size="sm"
            :disabled="probingAudio"
            data-test="btn-probe-system-audio"
            @click="probeSystemAudio"
          >
            <AppIcon :icon="probingAudio ? 'ri-loader-4-line' : 'ri-refresh-line'" />
            <span>{{ probingAudio ? '探测中…' : '重新探测' }}</span>
          </UButton>
        </div>

        <div
          v-if="systemAudioResult?.available"
          class="space-y-3"
          data-test="system-audio-available"
        >
          <div
            class="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm"
          >
            <AppIcon icon="ri-checkbox-circle-line" :size="20" class="shrink-0 mt-0.5" />
            <div>
              <div class="font-medium">检测到系统音频设备</div>
              <div class="text-xs opacity-80 mt-1">
                启用后将录制电脑内部声音（代替/叠加麦克风）。
              </div>
            </div>
          </div>

          <UCheckbox
            v-model="systemAudioEnabled"
            label="启用系统音频"
            data-test="cb-system-audio-enabled"
          />

          <div v-if="systemAudioEnabled">
            <label class="mb-1.5 block text-sm font-medium text-fg-primary">输出设备</label>
            <USelect
              v-model="systemAudioDeviceId"
              :options="systemAudioDevices.map((d) => ({ label: d.label, value: d.deviceId }))"
              data-test="select-system-audio-device"
            />
            <div class="mt-3">
              <UCheckbox v-model="keepMicrophone" label="同时保留麦克风（双声道）" />
            </div>
          </div>
        </div>

        <div
          v-else-if="systemAudioResult && !systemAudioResult.available"
          class="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm"
          data-test="system-audio-unavailable"
        >
          <AppIcon icon="ri-information-line" :size="20" class="shrink-0 mt-0.5" />
          <div>
            <div class="font-medium">未检测到系统音频 loopback 设备</div>
            <div class="text-xs opacity-80 mt-1">
              macOS: 安装 BlackHole 2ch；Windows: 安装 VB-Cable；Linux: 使用 PulseAudio monitor
              sink。安装后点击"重新探测"。
            </div>
          </div>
        </div>
      </div>

      <!-- PR-7a/b: 快捷键 + 倒计时 -->
      <div class="space-y-4 mt-6 pt-6 border-t border-gray-200">
        <h3 class="text-base font-semibold text-fg-primary">快捷键 / 倒计时</h3>

        <!-- 启用全局快捷键 -->
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <div class="text-sm font-medium text-fg-primary">启用全局快捷键</div>
            <div class="text-xs text-fg-tertiary mt-0.5">
              启动 / 停止：<kbd class="px-1.5 py-0.5 bg-white rounded border"
                >⌘/Ctrl + Alt + Shift + R</kbd
              ><br />
              暂停 / 恢复：<kbd class="px-1.5 py-0.5 bg-white rounded border"
                >⌘/Ctrl + Alt + Shift + P</kbd
              >
            </div>
          </div>
          <USwitch v-model="shortcutsEnabled" label="启用全局快捷键" />
        </div>

        <!-- 倒计时秒数 -->
        <div class="p-3 bg-gray-50 rounded-lg">
          <div class="text-sm font-medium text-fg-primary mb-2">开始录制前倒数</div>
          <UOptionPills
            v-model="countdownSeconds"
            :options="countdownOptions"
            variant="rect"
            size="md"
          />
          <div class="mt-3">
            <UCheckbox v-model="countdownBeep" label="倒数结束播放提示音" />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <UButton variant="ghost" @click="handleReset">重置默认</UButton>
      <UButton variant="ghost" @click="$emit('close')">取消</UButton>
      <UButton variant="primary" @click="handleSave">保存</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UModal from '@components/ui/UModal.vue'
import UButton from '@components/ui/UButton.vue'
import USwitch from '@components/ui/USwitch.vue'
import UCheckbox from '@components/ui/UCheckbox.vue'
import URadioGroup from '@components/ui/URadioGroup.vue'
import UInput from '@components/ui/UInput.vue'
import USelect from '@components/ui/USelect.vue'
import UOptionPills from '@components/ui/UOptionPills.vue'
import { useToast } from '@composables/useToast'

// 录制设置类型
interface RecordingSettings {
  encoder: 'vp9' | 'vp8' | 'h264'
  quality: 'low' | 'medium' | 'high' | 'custom'
  bitrate?: number | undefined
  fps: 30 | 60
  resolution: {
    width: number
    height: number
  }
  format: 'webm' | 'mp4'
  audioEnabled: boolean
  audioCodec?: 'aac' | 'opus' | undefined
  audioBitrate?: number | undefined
  // PR-5a
  systemAudio?: {
    enabled: boolean
    deviceId?: string
    keepMicrophone?: boolean
  }
  // PR-7a: 全局快捷键
  shortcuts?: {
    enabled: boolean
    start: string
    togglePause: string
  }
  // PR-7b: 倒计时（秒；0 = 不倒计时）
  countdownSeconds?: 0 | 3 | 5 | 7
  countdownBeep?: boolean
  // 录制引擎（D6 特性开关双轨）
  engine?: 'mediarecorder' | 'webcodecs'
}

interface SystemAudioProbeResult {
  available: boolean
  matches: string[]
  recommendedDeviceId?: string
}

interface SystemAudioInputDevice {
  deviceId: string
  label: string
}

interface Props {
  show: boolean
}

const props = defineProps<Props>()

const toast = useToast()

const emit = defineEmits<{
  close: []
  save: [settings: RecordingSettings]
}>()

// UModal 显隐 ←→ close 事件转接（show 是单向 prop）
const onModalVisibility = (v: boolean): void => {
  if (!v) emit('close')
}

const showAdvanced = ref(false)

// 单选选项（value 类型对齐 RecordingSettings 字段，保 URadioGroup 泛型推断）
const encoderOptions: Array<{
  label: string
  value: RecordingSettings['encoder']
  description: string
}> = [
  { label: 'VP9', value: 'vp9', description: '高质量，文件较小（推荐）' },
  { label: 'VP8', value: 'vp8', description: '兼容性好，文件较大' },
  { label: 'H.264', value: 'h264', description: '通用格式，兼容性最好' }
]
const fpsOptions: Array<{ label: string; value: RecordingSettings['fps'] }> = [
  { label: '30 FPS', value: 30 },
  { label: '60 FPS', value: 60 }
]
const audioCodecOptions: Array<{ label: string; value: RecordingSettings['audioCodec'] }> = [
  { label: 'Opus', value: 'opus' },
  { label: 'AAC', value: 'aac' }
]
const formatOptions: Array<{ label: string; value: RecordingSettings['format'] }> = [
  { label: 'WebM', value: 'webm' },
  { label: 'MP4', value: 'mp4' }
]
const engineOptions: Array<{ label: string; value: NonNullable<RecordingSettings['engine']> }> = [
  { label: '默认（MediaRecorder）', value: 'mediarecorder' },
  { label: 'WebCodecs（实验）', value: 'webcodecs' }
]

// PR-5a: 系统音频探测与启用状态
const probingAudio = ref(false)
const systemAudioResult = ref<SystemAudioProbeResult | null>(null)
const systemAudioDevices = ref<SystemAudioInputDevice[]>([])
const systemAudioEnabled = ref(false)
const systemAudioDeviceId = ref<string>('')
const keepMicrophone = ref(true)

interface AudioDeviceLike {
  kind: string
  deviceId: string
  label: string
}

async function probeSystemAudio(): Promise<void> {
  probingAudio.value = true
  try {
    // 1. 真实枚举 renderer 端设备（label 须有权限才能拿到；首次 getUserMedia 后才显示）
    const devices = (await navigator.mediaDevices.enumerateDevices()) as AudioDeviceLike[]
    // 2. 主进程做 pattern 匹配（跨平台规则都在主进程维护）
    const api = (
      window as unknown as {
        api?: {
          recording?: {
            systemAudio?: {
              probe: (req: { devices: AudioDeviceLike[] }) => Promise<SystemAudioProbeResult>
            }
          }
        }
      }
    ).api
    const result = api?.recording?.systemAudio?.probe
      ? await api.recording.systemAudio.probe({ devices })
      : { available: false, matches: [] }
    systemAudioResult.value = result
    // 把所有含系统音频 pattern 的设备展示给用户
    systemAudioDevices.value = devices
      .filter((d) => d.kind === 'audioinput' && result.matches.includes(d.label))
      .map((d) => ({ deviceId: d.deviceId, label: d.label }))
    if (result.recommendedDeviceId && !systemAudioDeviceId.value) {
      systemAudioDeviceId.value = result.recommendedDeviceId
    }
  } catch (e) {
    console.warn('[RecordingSettingsDialog] probeSystemAudio failed:', e)
    systemAudioResult.value = { available: false, matches: [] }
  } finally {
    probingAudio.value = false
  }
}

// 暴露状态给父组件（template ref + defineExpose）
defineExpose({
  systemAudioEnabled,
  systemAudioDeviceId,
  keepMicrophone,
  systemAudioResult,
  systemAudioDevices,
  probeSystemAudio
})

// 进入对话框自动探测一次（仅在用户已授权麦克风权限时 label 才有值）
watch(
  () => props.show,
  (v) => {
    if (v && systemAudioResult.value === null) void probeSystemAudio()
  }
)

type RecordingQuality = RecordingSettings['quality']

const qualityPresets: Array<{
  value: RecordingQuality
  label: string
  description: string
}> = [
  { value: 'low', label: '低质量', description: '720p, 30fps, 2Mbps' },
  { value: 'medium', label: '中等质量', description: '1080p, 30fps, 5Mbps' },
  { value: 'high', label: '高质量', description: '1080p, 60fps, 10Mbps' },
  { value: 'custom', label: '自定义', description: '手动配置参数' }
]

const localSettings = ref<RecordingSettings>({
  encoder: 'vp9',
  quality: 'medium',
  bitrate: 5000,
  fps: 30,
  resolution: {
    width: 1920,
    height: 1080
  },
  format: 'webm',
  audioEnabled: false,
  audioCodec: 'opus',
  audioBitrate: 128,
  engine: 'mediarecorder'
})

// 加载设置
const loadSettings = async (): Promise<void> => {
  if (props.show) {
    try {
      const settings = await window.api.recordingSettings.getSettings()
      localSettings.value = { ...settings }
    } catch (error) {
      console.error('加载录制设置失败:', error)
    }
  }
}

// 选择质量预设（B57-17：连点乱序防护——IPC 晚到的旧预设不得覆盖新选择）
let presetSeq = 0
const selectQualityPreset = async (
  quality: 'low' | 'medium' | 'high' | 'custom'
): Promise<void> => {
  localSettings.value.quality = quality

  if (quality !== 'custom') {
    const seq = ++presetSeq
    const preset = await window.api.recordingSettings.getQualityPreset(quality)
    if (seq === presetSeq && preset) {
      Object.assign(localSettings.value, preset)
    }
  }
}

// PR-7a/b: 快捷键 + 倒计时本地状态
const shortcutsEnabled = ref(true)
const countdownSeconds = ref<0 | 3 | 5 | 7>(3)
const countdownBeep = ref(true)

const countdownOptions: Array<{ label: string; value: 0 | 3 | 5 | 7 }> = [
  { label: '不倒数', value: 0 },
  { label: '3 秒', value: 3 },
  { label: '5 秒', value: 5 },
  { label: '7 秒', value: 7 }
]

onMounted(() => {
  void loadShortcutAndCountdown()
})
watch(
  () => props.show,
  (v) => {
    if (v) void loadShortcutAndCountdown()
  }
)

// 加载持久化配置（从 RecordingSettingsDataStore 共享）
async function loadShortcutAndCountdown(): Promise<void> {
  const api = (
    window as unknown as {
      api?: {
        recording?: {
          shortcut?: {
            getConfig: () => Promise<{ enabled: boolean; start: string; togglePause: string }>
          }
        }
      }
    }
  ).api
  if (api?.recording?.shortcut?.getConfig) {
    try {
      const cfg = await api.recording.shortcut.getConfig()
      shortcutsEnabled.value = cfg.enabled
    } catch {
      /* 默认值 */
    }
  }
  // 倒计时 + beep：与 handleSave 写入路径一致，从 settings store 读取
  // （旧实现读 window.leaf.settings —— 不存在的 API，导致保存的倒计时读不回来）
  try {
    const settings = (await window.api.recordingSettings.getSettings()) as unknown as Record<
      string,
      unknown
    >
    const cd = settings?.countdownSeconds as 0 | 3 | 5 | 7 | undefined
    if (cd !== undefined) countdownSeconds.value = cd
    const bp = settings?.countdownBeep as boolean | undefined
    if (bp !== undefined) countdownBeep.value = bp
    // B57-17：系统音频状态同样回读——否则重开对话框显示关闭、再保存静默关闭系统音频
    const sa = settings?.systemAudio as
      { enabled?: boolean; deviceId?: string; keepMicrophone?: boolean } | undefined
    if (sa) {
      systemAudioEnabled.value = !!sa.enabled
      if (sa.deviceId) systemAudioDeviceId.value = sa.deviceId
      if (typeof sa.keepMicrophone === 'boolean') keepMicrophone.value = sa.keepMicrophone
    }
  } catch {
    /* 默认值 */
  }
}

// 数值钳制（B57-17）：输入框直填的负数/0/NaN 不再原样进保存载荷
const clampBitrate = (
  v: number | undefined,
  min: number,
  max: number,
  fallback: number
): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.round(v)))
}

// 保存设置
const handleSave = async (): Promise<void> => {
  // 保存快捷键配置（B57-17：异常不再逃逸成 unhandled rejection 卡死弹窗）
  const shortcutApi = (
    window as unknown as {
      api?: {
        recording?: { shortcut?: { setConfig: (req: { enabled?: boolean }) => Promise<unknown> } }
      }
    }
  ).api?.recording?.shortcut
  if (shortcutApi?.setConfig) {
    try {
      await shortcutApi.setConfig({ enabled: shortcutsEnabled.value })
    } catch (error) {
      console.error('保存快捷键配置失败:', error)
      toast.error('快捷键配置保存失败', { description: (error as Error).message })
    }
  }
  // 倒计时 + beep 随下方 settingsToSave 一并持久化（与 loadShortcutAndCountdown 的读取路径一致）

  // 确保只传递可序列化的纯数据对象
  const settingsToSave: RecordingSettings = {
    encoder: localSettings.value.encoder,
    quality: localSettings.value.quality,
    bitrate: clampBitrate(localSettings.value.bitrate, 100, 100_000, 2500),
    fps: localSettings.value.fps === 60 ? 60 : 30,
    resolution: {
      width: clampBitrate(localSettings.value.resolution.width, 240, 7680, 1920),
      height: clampBitrate(localSettings.value.resolution.height, 240, 4320, 1080)
    },
    format: localSettings.value.format,
    audioEnabled: localSettings.value.audioEnabled,
    audioCodec: localSettings.value.audioCodec,
    audioBitrate: clampBitrate(localSettings.value.audioBitrate, 32, 1000, 128),
    // PR-5a: 系统音频
    systemAudio: {
      enabled: systemAudioEnabled.value,
      ...(systemAudioDeviceId.value && { deviceId: systemAudioDeviceId.value }),
      keepMicrophone: keepMicrophone.value
    },
    // PR-7a/b
    shortcuts: {
      enabled: shortcutsEnabled.value,
      start: 'CommandOrControl+Alt+Shift+R',
      togglePause: 'CommandOrControl+Alt+Shift+P'
    },
    countdownSeconds: countdownSeconds.value,
    countdownBeep: countdownBeep.value,
    engine: localSettings.value.engine ?? 'mediarecorder'
  }
  emit('save', settingsToSave)
}

// 重置设置（B57-17：对话框全部状态一并回默认——旧实现只重置 localSettings，
// 系统音频/快捷键/倒计时残留旧值，点保存又写回）
const handleReset = async () => {
  try {
    const defaults = await window.api.recordingSettings.resetToDefaults()
    localSettings.value = { ...defaults }
    systemAudioEnabled.value = false
    systemAudioDeviceId.value = ''
    systemAudioResult.value = null
    keepMicrophone.value = true
    shortcutsEnabled.value = true
    countdownSeconds.value = 3
    countdownBeep.value = true
  } catch (error) {
    console.error('重置设置失败:', error)
  }
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      void loadSettings()
    }
  }
)
</script>

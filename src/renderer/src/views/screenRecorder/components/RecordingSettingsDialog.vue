<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div
      class="bg-surface-1 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
    >
      <!-- 头部 -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 class="text-2xl font-bold text-gray-800">录制设置</h2>
        <button class="p-2 rounded-lg hover:bg-gray-100 transition-colors" @click="$emit('close')">
          <AppIcon icon="ri-close-line" :size="24" />
        </button>
      </div>

      <!-- 内容 -->
      <div class="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <!-- 质量预设 -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">质量预设</h3>
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
          <h3 class="text-lg font-semibold text-gray-800 mb-4">编码器</h3>
          <div class="space-y-3">
            <label
              class="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
            >
              <input
                v-model="localSettings.encoder"
                type="radio"
                value="vp9"
                class="w-4 h-4 text-brand-500"
              />
              <div class="flex-1">
                <div class="font-medium text-gray-800">VP9</div>
                <div class="text-sm text-gray-500">高质量，文件较小（推荐）</div>
              </div>
            </label>
            <label
              class="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
            >
              <input
                v-model="localSettings.encoder"
                type="radio"
                value="vp8"
                class="w-4 h-4 text-brand-500"
              />
              <div class="flex-1">
                <div class="font-medium text-gray-800">VP8</div>
                <div class="text-sm text-gray-500">兼容性好，文件较大</div>
              </div>
            </label>
            <label
              class="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
            >
              <input
                v-model="localSettings.encoder"
                type="radio"
                value="h264"
                class="w-4 h-4 text-brand-500"
              />
              <div class="flex-1">
                <div class="font-medium text-gray-800">H.264</div>
                <div class="text-sm text-gray-500">通用格式，兼容性最好</div>
              </div>
            </label>
          </div>
        </div>

        <!-- 高级设置 -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-800">高级设置</h3>
            <button
              class="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
              @click="showAdvanced = !showAdvanced"
            >
              <AppIcon :icon="showAdvanced ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" />
              <span>{{ showAdvanced ? '收起' : '展开' }}</span>
            </button>
          </div>

          <div v-if="showAdvanced" class="space-y-4">
            <!-- 帧率 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">帧率 (FPS)</label>
              <div class="flex gap-3">
                <label
                  class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors"
                  :class="
                    localSettings.fps === 30
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  "
                >
                  <input
                    v-model="localSettings.fps"
                    type="radio"
                    :value="30"
                    class="w-4 h-4 text-brand-500"
                  />
                  <span class="font-medium">30 FPS</span>
                </label>
                <label
                  class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors"
                  :class="
                    localSettings.fps === 60
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  "
                >
                  <input
                    v-model="localSettings.fps"
                    type="radio"
                    :value="60"
                    class="w-4 h-4 text-brand-500"
                  />
                  <span class="font-medium">60 FPS</span>
                </label>
              </div>
            </div>

            <!-- 分辨率 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">分辨率</label>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-600 mb-1">宽度</label>
                  <input
                    v-model.number="localSettings.resolution.width"
                    type="number"
                    min="640"
                    max="3840"
                    step="160"
                    class="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-brand-500"
                    :disabled="localSettings.quality !== 'custom'"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-600 mb-1">高度</label>
                  <input
                    v-model.number="localSettings.resolution.height"
                    type="number"
                    min="480"
                    max="2160"
                    step="90"
                    class="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-brand-500"
                    :disabled="localSettings.quality !== 'custom'"
                  />
                </div>
              </div>
            </div>

            <!-- 比特率 -->
            <div v-if="localSettings.quality === 'custom'">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                视频比特率 (kbps)
              </label>
              <input
                v-model.number="localSettings.bitrate"
                type="number"
                min="1000"
                max="50000"
                step="500"
                class="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-brand-500"
              />
              <div class="mt-1 text-xs text-gray-500">
                建议值：低质量 2000，中等质量 5000，高质量 10000
              </div>
            </div>

            <!-- 音频设置 -->
            <div class="pt-4 border-t border-gray-200">
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  v-model="localSettings.audioEnabled"
                  type="checkbox"
                  class="w-5 h-5 text-brand-500 rounded"
                />
                <span class="font-medium text-gray-800">启用音频录制</span>
              </label>
              <div v-if="localSettings.audioEnabled" class="mt-4 ml-8 space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">音频编码器</label>
                  <div class="flex gap-3">
                    <label
                      class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors"
                      :class="
                        localSettings.audioCodec === 'opus'
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 hover:border-gray-300'
                      "
                    >
                      <input
                        v-model="localSettings.audioCodec"
                        type="radio"
                        value="opus"
                        class="w-4 h-4 text-brand-500"
                      />
                      <span class="font-medium">Opus</span>
                    </label>
                    <label
                      class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors"
                      :class="
                        localSettings.audioCodec === 'aac'
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 hover:border-gray-300'
                      "
                    >
                      <input
                        v-model="localSettings.audioCodec"
                        type="radio"
                        value="aac"
                        class="w-4 h-4 text-brand-500"
                      />
                      <span class="font-medium">AAC</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2"
                    >音频比特率 (kbps)</label
                  >
                  <input
                    v-model.number="localSettings.audioBitrate"
                    type="number"
                    min="64"
                    max="320"
                    step="32"
                    class="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            <!-- 文件格式 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">文件格式</label>
              <div class="flex gap-3">
                <label
                  class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors"
                  :class="
                    localSettings.format === 'webm'
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  "
                >
                  <input
                    v-model="localSettings.format"
                    type="radio"
                    value="webm"
                    class="w-4 h-4 text-brand-500"
                  />
                  <span class="font-medium">WebM</span>
                </label>
                <label
                  class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors"
                  :class="
                    localSettings.format === 'mp4'
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  "
                >
                  <input
                    v-model="localSettings.format"
                    type="radio"
                    value="mp4"
                    class="w-4 h-4 text-brand-500"
                  />
                  <span class="font-medium">MP4</span>
                </label>
              </div>
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
              <h4 class="text-sm font-semibold text-gray-800">系统音频（录制应用声音）</h4>
              <button
                class="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                :disabled="probingAudio"
                data-test="btn-probe-system-audio"
                @click="probeSystemAudio"
              >
                <AppIcon :icon="probingAudio ? 'ri-loader-4-line' : 'ri-refresh-line'" />
                <span>{{ probingAudio ? '探测中…' : '重新探测' }}</span>
              </button>
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

              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  v-model="systemAudioEnabled"
                  type="checkbox"
                  class="w-5 h-5 text-brand-500 rounded"
                  data-test="cb-system-audio-enabled"
                  @change="onSystemAudioToggle"
                />
                <span class="text-sm font-medium text-gray-800">启用系统音频</span>
              </label>

              <div v-if="systemAudioEnabled">
                <label class="block text-sm font-medium text-gray-700 mb-2">输出设备</label>
                <select
                  v-model="systemAudioDeviceId"
                  class="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-brand-500"
                  data-test="select-system-audio-device"
                  @change="onSystemAudioDeviceChange"
                >
                  <option
                    v-for="dev in systemAudioDevices"
                    :key="dev.deviceId"
                    :value="dev.deviceId"
                  >
                    {{ dev.label }}
                  </option>
                </select>
                <div class="mt-3">
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input
                      v-model="keepMicrophone"
                      type="checkbox"
                      class="w-4 h-4 text-brand-500 rounded"
                      @change="onKeepMicrophoneToggle"
                    />
                    <span class="text-sm text-gray-700">同时保留麦克风（双声道）</span>
                  </label>
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
            <h3 class="text-base font-semibold text-gray-800">快捷键 / 倒计时</h3>

            <!-- 启用全局快捷键 -->
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div class="text-sm font-medium text-gray-800">启用全局快捷键</div>
                <div class="text-xs text-gray-500 mt-0.5">
                  启动 / 停止：<kbd class="px-1.5 py-0.5 bg-white rounded border"
                    >⌘/Ctrl + Alt + Shift + R</kbd
                  ><br />
                  暂停 / 恢复：<kbd class="px-1.5 py-0.5 bg-white rounded border"
                    >⌘/Ctrl + Alt + Shift + P</kbd
                  >
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input v-model="shortcutsEnabled" type="checkbox" class="sr-only peer" />
                <div
                  class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 transition-colors"
                ></div>
                <div
                  class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"
                ></div>
              </label>
            </div>

            <!-- 倒计时秒数 -->
            <div class="p-3 bg-gray-50 rounded-lg">
              <div class="text-sm font-medium text-gray-800 mb-2">开始录制前倒数</div>
              <div class="flex gap-2">
                <button
                  v-for="opt in [
                    { value: 0, label: '不倒数' },
                    { value: 3, label: '3 秒' },
                    { value: 5, label: '5 秒' },
                    { value: 7, label: '7 秒' }
                  ]"
                  :key="opt.value"
                  type="button"
                  class="px-3 py-1.5 rounded-lg border text-sm transition-colors"
                  :class="
                    countdownSeconds === opt.value
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                  "
                  @click="countdownSeconds = opt.value as 0 | 3 | 5 | 7"
                >
                  {{ opt.label }}
                </button>
              </div>
              <div class="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  id="countdown-beep"
                  v-model="countdownBeep"
                  type="checkbox"
                  class="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <label for="countdown-beep">倒数结束播放提示音</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
        <button
          class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          @click="handleReset"
        >
          重置默认
        </button>
        <button
          class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          class="px-6 py-2 bg-gradient-primary text-white rounded-lg font-medium hover:shadow-lg transition-all"
          @click="handleSave"
        >
          保存
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import AppIcon from '@components/AppIcon.vue'

// 录制设置类型
interface RecordingSettings {
  encoder: 'vp9' | 'vp8' | 'h264'
  quality: 'low' | 'medium' | 'high' | 'custom'
  bitrate?: number
  fps: 30 | 60
  resolution: {
    width: number
    height: number
  }
  format: 'webm' | 'mp4'
  audioEnabled: boolean
  audioCodec?: 'aac' | 'opus'
  audioBitrate?: number
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

const emit = defineEmits<{
  close: []
  save: [settings: RecordingSettings]
}>()

const showAdvanced = ref(false)

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

function onSystemAudioToggle(): void {
  // 父组件通过 ref 暴露读取 systemAudioEnabled 状态后调用 streamManager；
  // 这里只是 UI 反馈占位（无业务逻辑）
}

function onSystemAudioDeviceChange(): void {
  /* 同样由父组件 watch */
}

function onKeepMicrophoneToggle(): void {
  /* 同样由父组件 watch */
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
  audioBitrate: 128
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

// 选择质量预设
const selectQualityPreset = async (quality: 'low' | 'medium' | 'high' | 'custom'): Promise<void> => {
  localSettings.value.quality = quality

  if (quality !== 'custom') {
    const preset = await window.api.recordingSettings.getQualityPreset(quality)
    if (preset) {
      Object.assign(localSettings.value, preset)
    }
  }
}

// PR-7a/b: 快捷键 + 倒计时本地状态
const shortcutsEnabled = ref(true)
const countdownSeconds = ref<0 | 3 | 5 | 7>(3)
const countdownBeep = ref(true)

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
  } catch {
    /* 默认值 */
  }
}

// 保存设置
const handleSave = async (): Promise<void> => {
  // 保存快捷键配置
  const shortcutApi = (
    window as unknown as {
      api?: {
        recording?: { shortcut?: { setConfig: (req: { enabled?: boolean }) => Promise<unknown> } }
      }
    }
  ).api?.recording?.shortcut
  if (shortcutApi?.setConfig) {
    await shortcutApi.setConfig({ enabled: shortcutsEnabled.value })
  }
  // 倒计时 + beep 随下方 settingsToSave 一并持久化（与 loadShortcutAndCountdown 的读取路径一致）

  // 确保只传递可序列化的纯数据对象
  const settingsToSave: RecordingSettings = {
    encoder: localSettings.value.encoder,
    quality: localSettings.value.quality,
    bitrate: localSettings.value.bitrate,
    fps: localSettings.value.fps,
    resolution: {
      width: localSettings.value.resolution.width,
      height: localSettings.value.resolution.height
    },
    format: localSettings.value.format,
    audioEnabled: localSettings.value.audioEnabled,
    audioCodec: localSettings.value.audioCodec,
    audioBitrate: localSettings.value.audioBitrate,
    // PR-5a: 系统音频
    systemAudio: {
      enabled: systemAudioEnabled.value,
      deviceId: systemAudioDeviceId.value || undefined,
      keepMicrophone: keepMicrophone.value
    },
    // PR-7a/b
    shortcuts: {
      enabled: shortcutsEnabled.value,
      start: 'CommandOrControl+Alt+Shift+R',
      togglePause: 'CommandOrControl+Alt+Shift+P'
    },
    countdownSeconds: countdownSeconds.value,
    countdownBeep: countdownBeep.value
  }
  emit('save', settingsToSave)
}

// 重置设置
const handleReset = async () => {
  try {
    const defaults = await window.api.recordingSettings.resetToDefaults()
    localSettings.value = { ...defaults }
  } catch (error) {
    console.error('重置设置失败:', error)
  }
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      loadSettings()
    }
  }
)
</script>

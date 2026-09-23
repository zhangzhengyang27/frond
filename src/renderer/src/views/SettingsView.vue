<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@components/AppIcon.vue'
import { AI_PROVIDERS, findProvider, type AIProviderPreset } from '@shared/ai'
import { DENSITY_VALUES, normalizeDensity, type Density } from '@shared/density'
import { CAPSULE_GLASS_VALUES, normalizeGlass, type CapsuleGlass } from '@shared/capsuleGlass'
import { ownerPluginId } from '@shared/automation'
import PermissionPanel from '@components/PermissionPanel.vue'
import UBadge from '@components/ui/UBadge.vue'
import UButton from '@components/ui/UButton.vue'
import UProgress from '@components/ui/UProgress.vue'
import { resetOnboardingState } from '../router'
import { useTheme, type Theme } from '../composables/useTheme'
import { useUserTheme } from '../composables/useUserTheme'
import type { UpdateStatus, UpdateEvent } from '../types/update'
import type { SystemInfo } from '../types/system'
import type { TelemetryMode } from '../types/log'

// 设置页面标题
document.title = '设置'

const { theme, setTheme, initTheme } = useTheme()
initTheme()

const router = useRouter()

// ── Raycast 风格：左侧分类边栏 ──
interface SettingsSection {
  id: string
  label: string
  icon: string
  /** 额外可搜索关键词（覆盖 label 之外的表述，Raycast 设置搜索式命中） */
  keywords: string[]
}
const sections: SettingsSection[] = [
  {
    id: 'general',
    label: '通用',
    icon: 'ri-settings-3-line',
    keywords: ['主题', '外观', '浅色', '深色', '跟随系统', 'theme', 'appearance']
  },
  {
    id: 'launcher',
    label: '启动器',
    icon: 'ri-search-eye-line',
    keywords: [
      '快捷键',
      '热键',
      'hotkey',
      'global',
      '唤醒',
      'Alt Space',
      '搜索历史',
      '别名',
      '胶囊'
    ]
  },
  {
    id: 'ai',
    label: 'AI',
    icon: 'ri-sparkling-2-line',
    keywords: [
      '模型',
      '模型预设',
      'api',
      'key',
      '接口',
      'baseurl',
      'token',
      '提示词',
      'temperature',
      '预设'
    ]
  },
  {
    id: 'focus',
    label: '专注',
    icon: 'ri-focus-3-line',
    keywords: [
      '番茄钟',
      '护盾',
      '屏蔽',
      '屏蔽应用',
      '屏蔽网站',
      'shield',
      'pomodoro',
      'focus',
      '网站'
    ]
  },
  {
    id: 'extensions',
    label: '插件',
    icon: 'ri-plug-2-line',
    keywords: ['plugin', 'market', '市场', '导入', '扩展', 'store']
  },
  {
    id: 'updates',
    label: '更新',
    icon: 'ri-refresh-line',
    keywords: ['update', '自动更新', '版本', 'changelog', 'release']
  },
  {
    id: 'data',
    label: '数据',
    icon: 'ri-database-2-line',
    keywords: ['数据库', 'database', '迁移', 'migration', '备份', '导出', '清空', 'storage']
  },
  {
    id: 'advanced',
    label: '高级',
    icon: 'ri-code-s-slash-line',
    keywords: ['日志', 'log', '遥测', 'telemetry', 'debug', '开发者', '开发模式']
  },
  {
    id: 'about',
    label: '关于',
    icon: 'ri-information-line',
    keywords: ['版本', '开源', 'license', '信息']
  }
]
const activeSection = ref('general')
const searchQuery = ref('')

const filteredSections = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return sections
  return sections.filter(
    (s) => s.label.toLowerCase().includes(q) || s.keywords.some((k) => k.toLowerCase().includes(q))
  )
})

// 搜索命中时自动定位到第一个匹配分类；无命中不打断当前停留的分类
watch(searchQuery, () => {
  const hits = filteredSections.value
  if (hits.length > 0 && !hits.some((s) => s.id === activeSection.value)) {
    activeSection.value = hits[0].id
  }
})

// 重新开始引导
const onRestartOnboarding = async (): Promise<void> => {
  try {
    await window.api.preferences.resetOnboarding()
  } catch {
    /* ignore */
  }
  resetOnboardingState()
  await router.push('/onboarding')
}

const themes: Array<{ id: Theme; label: string; description: string; icon: string }> = [
  { id: 'light', label: '浅色', description: '始终使用浅色界面', icon: 'ri-sun-line' },
  { id: 'dark', label: '深色', description: '始终使用深色界面', icon: 'ri-moon-line' },
  { id: 'auto', label: '跟随系统', description: '随 macOS / Windows 切换', icon: 'ri-macbook-line' }
]

const onSelectTheme = async (id: Theme): Promise<void> => {
  await setTheme(id)
}

// ── 用户主题文件（#12 Phase 2：userData/themes/*.json）──
const {
  options: userThemeOptions,
  activeId: activeUserTheme,
  rejected: rejectedThemes,
  setActive: setActiveUserTheme,
  install: installUserTheme,
  openThemesDir
} = useUserTheme()

const onSelectUserTheme = async (id: string): Promise<void> => {
  const target = userThemeOptions.value.find((o) => o.id === id)
  const res = await setActiveUserTheme(id)
  if (!res.ok) return
  // 主题自带 appearance：激活时把明暗一起切过去，否则深色主题配在亮底上会花
  if (target?.appearance && target.appearance !== theme.value) await setTheme(target.appearance)
}

const onInstallUserTheme = async (): Promise<void> => {
  await installUserTheme()
}

// 应用版本
const appVersion = ref('—')
const systemInfo = ref<SystemInfo | null>(null)

// ── 专注护盾 ──
const shieldEnabled = ref(false)
const shieldSupported = ref(true)
const shieldWebsiteSupported = ref(true)
const shieldAppsDraft = ref('')
const shieldWebsitesDraft = ref('')

// ── AI 配置 ──
const aiEnabled = ref(false)
const aiApiKey = ref('')
const aiBaseUrl = ref('https://api.openai.com/v1')
const aiModel = ref('gpt-4o-mini')
const aiSystemPrompt = ref('你是一个简洁高效的助手，回答尽量简短直接。')
const aiTemperature = ref(0.7)
const aiSaving = ref(false)
const aiSaveMsg = ref('')
/** BYOM（P-4①）：内置 provider 选择 + 端点探测到的模型清单 */
const aiProvider = ref<AIProviderPreset['id'] | ''>('')
const aiModels = ref<string[]>([])
const aiProbing = ref(false)
const aiProbeMsg = ref('')

const pickedProvider = computed(() => findProvider(aiProvider.value || undefined))

/** 选 provider = 把这张表填好，不自动保存：改哪个字段都还得用户自己确认 */
function pickProvider(p: AIProviderPreset): void {
  aiProvider.value = p.id
  if (p.baseUrl) aiBaseUrl.value = p.baseUrl
  if (p.model) aiModel.value = p.model
  aiProbeMsg.value = p.keyRequired ? '' : '本地端点不需要 API Key，直接保存后点「探测」'
}

async function probeModels(): Promise<void> {
  aiProbing.value = true
  aiProbeMsg.value = ''
  aiModels.value = []
  try {
    // 探测的是**已保存**的配置，所以未保存的改动要先落盘
    await saveAIConfig()
    const res = await window.api.ai.listModels()
    aiModels.value = res.models
    aiProbeMsg.value = res.ok
      ? `连上了，${res.models.length} 个模型（${res.url ?? ''}）`
      : `连不上：${res.error ?? '未知错误'}`
  } catch (error) {
    aiProbeMsg.value = `连不上：${(error as Error).message}`
  } finally {
    aiProbing.value = false
  }
}

async function loadAIConfig(): Promise<void> {
  try {
    const cfg = (await window.api.ai.getConfig()) as {
      enabled: boolean
      apiKey: string
      baseUrl: string
      model: string
      systemPrompt: string
      temperature: number
      provider?: AIProviderPreset['id']
    }
    aiProvider.value = cfg.provider ?? ''
    aiEnabled.value = cfg.enabled
    aiApiKey.value = cfg.apiKey
    aiBaseUrl.value = cfg.baseUrl
    aiModel.value = cfg.model
    aiSystemPrompt.value = cfg.systemPrompt
    aiTemperature.value = cfg.temperature
    await loadMcp()
  } catch {
    /* AI 配置读取失败 */
  }
  // MCP 与 AI 配置是两回事：上面失败也要能管服务器
  await loadMcp()
  try {
    density.value = normalizeDensity(await window.api.preferences.getDensity())
    glass.value = normalizeGlass(await window.api.preferences.getCapsuleGlass())
    compactMode.value = await window.api.preferences.getCompactMode()
  } catch {
    /* 读不到就按默认档显示 */
  }
  await loadAutomations()
}

async function saveAIConfig(): Promise<void> {
  aiSaving.value = true
  aiSaveMsg.value = ''
  try {
    await window.api.ai.setConfig({
      enabled: aiEnabled.value,
      apiKey: aiApiKey.value,
      baseUrl: aiBaseUrl.value,
      model: aiModel.value,
      systemPrompt: aiSystemPrompt.value,
      temperature: Number(aiTemperature.value),
      provider: aiProvider.value || undefined
    })
    aiSaveMsg.value = '已保存'
    setTimeout(() => {
      aiSaveMsg.value = ''
    }, 2000)
  } catch {
    aiSaveMsg.value = '保存失败'
  } finally {
    aiSaving.value = false
  }
}

// ── 紧凑模式（P-6⑤）──
const compactMode = ref(false)
async function chooseCompact(on: boolean): Promise<void> {
  compactMode.value = await window.api.preferences.setCompactMode(on)
}

// ── 胶囊玻璃档（P-6）──
const glass = ref<CapsuleGlass>('opaque')
async function chooseGlass(g: CapsuleGlass): Promise<void> {
  glass.value = await window.api.preferences.setCapsuleGlass(g)
}

// ── 列表密度（P-6）──
const density = ref<Density>('comfortable')
async function chooseDensity(d: Density): Promise<void> {
  density.value = await window.api.preferences.setDensity(d)
}

// ── MCP 客户端（P-4②）──
type McpOverviewT = Awaited<ReturnType<typeof window.api.ai.mcpOverview>>
const mcp = ref<McpOverviewT | null>(null)
/** 编辑器里是「公开形态」，所以永远不含 env 值——保存时主进程按 id 沿用本机原值 */
const mcpJson = ref('[]')
const mcpBusyId = ref<string | null>(null)
const mcpMsg = ref('')
const mcpCallResult = ref<Record<string, string>>({})

async function loadMcp(): Promise<void> {
  try {
    const view = await window.api.ai.mcpOverview()
    mcp.value = view
    mcpJson.value = JSON.stringify(
      view.servers.map((x) => ({
        id: x.id,
        label: x.label,
        command: x.command,
        args: x.args,
        enabled: x.enabled
      })),
      null,
      2
    )
  } catch {
    mcpMsg.value = '读取 MCP 配置失败'
  }
}

async function saveMcpJson(): Promise<void> {
  mcpMsg.value = ''
  let parsed: unknown
  try {
    parsed = JSON.parse(mcpJson.value)
  } catch (error) {
    mcpMsg.value = `JSON 不合法：${(error as Error).message}`
    return
  }
  const res = await window.api.ai.mcpSetServers(parsed)
  if (res.rejected.length > 0) {
    mcpMsg.value =
      `已保存 ${res.servers.length} 个，拒绝 ${res.rejected.length} 个：` +
      res.rejected.map((r) => `第 ${r.index + 1} 条 ${r.reason}`).join('；')
  } else {
    mcpMsg.value = `已保存 ${res.servers.length} 个`
  }
  await loadMcp()
}

async function mcpConnect(id: string): Promise<void> {
  mcpBusyId.value = id
  mcpMsg.value = ''
  try {
    const view = await window.api.ai.mcpConnect(id)
    mcpMsg.value =
      view.status === 'ready'
        ? `${view.serverName ?? id} 已连接，${view.tools.length} 个工具${
            view.skipped > 0 ? `（${view.skipped} 个非法条目已忽略）` : ''
          }`
        : `连不上：${view.error ?? view.status}`
    await loadMcp()
  } finally {
    mcpBusyId.value = null
  }
}

async function mcpStop(id: string): Promise<void> {
  mcpBusyId.value = id
  try {
    await window.api.ai.mcpStop(id)
    await loadMcp()
  } finally {
    mcpBusyId.value = null
  }
}

async function mcpCall(id: string, tool: string): Promise<void> {
  mcpBusyId.value = `${id}:${tool}`
  try {
    const res = await window.api.ai.mcpCallTool(id, tool, {})
    mcpCallResult.value = {
      ...mcpCallResult.value,
      [`${id}:${tool}`]: res.ok
        ? res.text +
          (res.ignoredContent > 0 ? `\n（忽略了 ${res.ignoredContent} 段非文本内容）` : '')
        : `失败：${res.error ?? '未知错误'}`
    }
  } finally {
    mcpBusyId.value = null
  }
}

// ── Automations（P-4④）──
type AutomationView = Awaited<ReturnType<typeof window.api.ai.automationList>>[number]
const autoTasks = ref<AutomationView[]>([])
const autoJson = ref('[]')
const autoMsg = ref('')
const autoBusyId = ref<string | null>(null)

async function loadAutomations(): Promise<void> {
  try {
    autoTasks.value = await window.api.ai.automationList()
    autoJson.value = JSON.stringify(
      autoTasks.value.map((t) => ({
        id: t.id,
        label: t.label,
        cron: t.cron,
        enabled: t.enabled,
        action: t.action
      })),
      null,
      2
    )
  } catch {
    autoMsg.value = '读取定时任务失败'
  }
}

async function saveAutomations(): Promise<void> {
  autoMsg.value = ''
  let parsed: unknown
  try {
    parsed = JSON.parse(autoJson.value)
  } catch (error) {
    autoMsg.value = `JSON 不合法：${(error as Error).message}`
    return
  }
  const res = await window.api.ai.automationSave(parsed)
  autoMsg.value =
    res.rejected.length > 0
      ? `已保存 ${res.tasks.length} 条，拒绝 ${res.rejected.length} 条：` +
        res.rejected.map((r) => `第 ${r.index + 1} 条 ${r.reason}`).join('；')
      : `已保存 ${res.tasks.length} 条`
  autoTasks.value = res.tasks
}

/** 任务归属（只认 `plugin:<id>` 这一种形态，认不出的不当用户的任务来标） */
function automationOwner(t: AutomationView): string {
  const id = ownerPluginId(t.owner)
  return id ? `来自插件 ${id}` : ''
}

/**
 * 动作那一栏的文案。插件命令要单独写：宿主只能看到「投递到了插件」，
 * 插件里那条命令跑成什么样看不到——写「成功」是替插件撒的谎。
 */
function automationActionLabel(t: AutomationView): string {
  const a = t.action
  if (a.type === 'plugin') return `插件命令 ${'cmd' in a ? a.cmd : ''}`.trim()
  return a.type
}

/** 上次触发的结果。只在 `lastFiredAt` 存在时渲染，所以 null 那档只会是「跑过但没记结果」 */
function automationResultLabel(t: AutomationView): string {
  if (t.lastOk) return '成功'
  return `失败：${t.lastError ?? '未知错误'}`
}

async function runAutomationNow(id: string): Promise<void> {
  autoBusyId.value = id
  autoMsg.value = ''
  try {
    const res = await window.api.ai.automationRunNow(id)
    autoMsg.value = res.ok ? '已执行一次' : `执行失败：${res.error ?? '未知错误'}`
    await loadAutomations()
  } finally {
    autoBusyId.value = null
  }
}

async function toggleAutomation(task: AutomationView): Promise<void> {
  autoBusyId.value = task.id
  try {
    autoTasks.value = await window.api.ai.automationSetEnabled(task.id, !task.enabled)
  } finally {
    autoBusyId.value = null
  }
}

async function loadShieldConfig(): Promise<void> {
  try {
    const cfg = await window.api.focusShield.getConfig()
    shieldEnabled.value = cfg.enabled
    shieldSupported.value = cfg.supported
    shieldWebsiteSupported.value = cfg.websiteBlockSupported ?? true
    shieldAppsDraft.value = cfg.apps.join(', ')
    shieldWebsitesDraft.value = (cfg.websites ?? []).join(', ')
  } catch {
    shieldSupported.value = false
  }
}

async function toggleShieldEnabled(): Promise<void> {
  const next = !shieldEnabled.value
  try {
    const cfg = await window.api.focusShield.setConfig({ enabled: next })
    shieldEnabled.value = cfg.enabled
  } catch {
    /* 设置失败保持原状态 */
  }
}

async function saveShieldApps(): Promise<void> {
  const apps = shieldAppsDraft.value
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  shieldAppsDraft.value = apps.join(', ')
  try {
    const cfg = await window.api.focusShield.setConfig({ apps })
    shieldAppsDraft.value = cfg.apps.join(', ')
  } catch {
    /* ignore */
  }
}

async function saveShieldWebsites(): Promise<void> {
  const websites = shieldWebsitesDraft.value
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  shieldWebsitesDraft.value = websites.join(', ')
  try {
    const cfg = await window.api.focusShield.setConfig({ websites })
    shieldWebsitesDraft.value = (cfg.websites ?? []).join(', ')
  } catch {
    /* ignore */
  }
}

onMounted(async () => {
  try {
    appVersion.value = await window.api.update.getCurrentVersion()
  } catch {
    /* ignore */
  }
  try {
    systemInfo.value = await window.api.system.info()
  } catch {
    /* ignore */
  }
  void loadShieldConfig()
  void loadAIConfig()
})

const onOpenDataDir = (): void => {
  if (systemInfo.value?.userDataPath) {
    void window.api.system.openPath(systemInfo.value.userDataPath)
  }
}

const onOpenLegacyDir = (): void => {
  if (systemInfo.value?.legacyArchivePath) {
    void window.api.system.openPath(systemInfo.value.legacyArchivePath)
  }
}

// ── 日志 / 反馈 ──
const telemetryMode = ref<TelemetryMode>('local')

onMounted(async () => {
  try {
    telemetryMode.value = await window.api.log.getMode()
  } catch {
    /* ignore */
  }
})

const telemetryOptions: Array<{
  id: TelemetryMode
  label: string
  description: string
}> = [
  { id: 'local', label: '本地（推荐）', description: '错误日志保存到本机 SQLite，重启可清。' },
  { id: 'off', label: '关闭', description: '只保留内存 ring buffer，重启即清零。' },
  {
    id: 'remote',
    label: '远程（1.0 暂未启用）',
    description: '在本地基础上预留远程通道；当前等同本地。'
  }
]

const onSelectTelemetry = async (id: TelemetryMode): Promise<void> => {
  const prev = telemetryMode.value
  telemetryMode.value = id
  try {
    telemetryMode.value = await window.api.log.setMode(id)
  } catch (e) {
    console.warn('[SettingsView] setMode failed:', e)
    telemetryMode.value = prev
  }
}

const onExportLogs = async (): Promise<void> => {
  try {
    await window.api.log.export()
  } catch (e) {
    console.warn('[SettingsView] export failed:', e)
  }
}

// ── 自动更新 ──
const updateStatus = ref<UpdateStatus>('idle')
const updateVersion = ref<string>('')
const updateProgress = ref<number>(0)
const updateError = ref<string>('')

let unsubscribe: (() => void) | null = null
onMounted(() => {
  unsubscribe = window.api.update.onEvent((e: UpdateEvent) => {
    updateStatus.value = e.status
    updateError.value = e.error ?? ''
    if (e.version) updateVersion.value = e.version
    if (e.progress) updateProgress.value = Math.round(e.progress.percent)
  })
  window.api.update
    .getStatus()
    .then((s) => (updateStatus.value = s))
    .catch(() => {
      /* ignore */
    })
})

onBeforeUnmount(() => {
  unsubscribe?.()
})

const onCheckUpdate = async (): Promise<void> => {
  await window.api.update.check()
}

const onDownload = async (): Promise<void> => {
  await window.api.update.download()
}

const onInstall = (): void => {
  window.api.update.install()
}

const statusText = (s: UpdateStatus): string => {
  switch (s) {
    case 'idle':
      return '未检查'
    case 'checking':
      return '检查中…'
    case 'available':
      return `有可用更新 v${updateVersion.value}`
    case 'not-available':
      return '已是最新版本'
    case 'downloading':
      return `下载中 ${updateProgress.value}%`
    case 'downloaded':
      return `已下载 v${updateVersion.value}，点击重启安装`
    case 'error':
      return `错误：${updateError.value}`
    default:
      return s
  }
}

const canCheck = (): boolean =>
  updateStatus.value === 'idle' ||
  updateStatus.value === 'not-available' ||
  updateStatus.value === 'error'
const canDownload = (): boolean => updateStatus.value === 'available'
const canInstall = (): boolean => updateStatus.value === 'downloaded'
</script>

<template>
  <div class="RaycastSettings flex h-screen overflow-hidden bg-surface-2 text-fg-primary">
    <!-- ═══ 左侧边栏（Raycast 风格）═══ -->
    <aside class="flex w-[200px] shrink-0 flex-col border-r border-line-subtle bg-surface-2">
      <!-- 搜索框 -->
      <div class="p-3">
        <div
          class="flex items-center gap-2 rounded-lg bg-surface-1/60 px-2.5 py-1.5 ring-1 ring-line-subtle"
        >
          <AppIcon icon="ri-search-line" :size="14" class="shrink-0 text-fg-tertiary" />
          <input
            v-model="searchQuery"
            type="text"
            class="flex-1 bg-transparent text-[13px] text-fg-primary placeholder:text-fg-tertiary focus:outline-none"
            placeholder="搜索设置…"
            spellcheck="false"
          />
        </div>
      </div>

      <!-- 分类列表 -->
      <nav class="flex-1 overflow-y-auto px-2 pb-3">
        <button
          v-for="section in filteredSections"
          :key="section.id"
          type="button"
          class="mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors"
          :class="
            activeSection === section.id
              ? 'bg-brand-500/15 text-brand-500 font-medium'
              : 'text-fg-primary hover:bg-surface-hover'
          "
          @click="activeSection = section.id"
        >
          <AppIcon :icon="section.icon" :size="16" class="shrink-0" />
          <span class="flex-1 truncate">{{ section.label }}</span>
        </button>
        <div v-if="filteredSections.length === 0" class="px-3 py-8 text-center">
          <div class="text-[13px] text-fg-tertiary">没有匹配的设置</div>
          <div class="mt-1 text-[11px] text-fg-tertiary/70">换个关键词试试</div>
        </div>
      </nav>

      <!-- 底部版本信息 -->
      <div class="border-t border-line-subtle px-4 py-3">
        <div class="text-[11px] text-fg-tertiary">Frond v{{ appVersion }}</div>
      </div>
    </aside>

    <!-- ═══ 右侧内容区 ═══ -->
    <main class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-[520px] px-6 py-8">
        <!-- ═══ 通用 ═══ -->
        <template v-if="activeSection === 'general'">
          <h1 class="mb-1 text-[28px] font-semibold tracking-tight text-fg-primary">通用</h1>
          <p class="mb-8 text-[14px] text-fg-tertiary">外观与界面偏好。</p>

          <!-- 外观 -->
          <section class="mb-8">
            <h2 class="mb-3 text-[12px] font-medium uppercase tracking-wider text-fg-tertiary">
              外观
            </h2>
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="divide-y divide-line-subtle">
                <button
                  v-for="t in themes"
                  :key="t.id"
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                  @click="onSelectTheme(t.id)"
                >
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-tertiary"
                  >
                    <AppIcon :icon="t.icon" :size="16" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[14px] font-medium text-fg-primary">{{ t.label }}</div>
                    <div class="mt-0.5 text-[12px] text-fg-tertiary">{{ t.description }}</div>
                  </div>
                  <div
                    v-if="theme === t.id"
                    class="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500"
                  >
                    <AppIcon icon="ri-check-line" :size="12" class="text-white" />
                  </div>
                </button>
              </div>
            </div>
          </section>

          <!-- 主题文件（#12 Phase 2）：userData/themes/*.json，可放多个 -->
          <section class="mb-8">
            <h2 class="mb-3 text-[12px] font-medium uppercase tracking-wider text-fg-tertiary">
              主题文件
            </h2>
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="divide-y divide-line-subtle">
                <button
                  v-for="t in userThemeOptions"
                  :key="t.id || 'builtin'"
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                  @click="onSelectUserTheme(t.id)"
                >
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-tertiary"
                  >
                    <AppIcon :icon="t.id ? 'ri-palette-line' : 'ri-brush-line'" :size="16" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[14px] font-medium text-fg-primary">{{ t.name }}</div>
                    <div class="mt-0.5 text-[12px] text-fg-tertiary">
                      {{
                        t.appearance
                          ? `${t.appearance === 'dark' ? '深色' : '浅色'} · 激活时一并切换明暗`
                          : '不注入自定义变量（tokens.css 现状）'
                      }}
                    </div>
                  </div>
                  <div
                    v-if="activeUserTheme === t.id"
                    class="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500"
                  >
                    <AppIcon icon="ri-check-line" :size="12" class="text-white" />
                  </div>
                </button>
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                  @click="onInstallUserTheme"
                >
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-tertiary"
                  >
                    <AppIcon icon="ri-download-line" :size="16" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[14px] font-medium text-fg-primary">导入主题文件…</div>
                    <div class="mt-0.5 text-[12px] text-fg-tertiary">
                      校验通过才安装；未通过的字段会直接指出
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                  @click="openThemesDir"
                >
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-tertiary"
                  >
                    <AppIcon icon="ri-folder-open-line" :size="16" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[14px] font-medium text-fg-primary">打开主题目录</div>
                    <div class="mt-0.5 text-[12px] text-fg-tertiary">
                      放入 JSON 后重新打开本页即可列出
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <p v-if="rejectedThemes.length" class="mt-2 text-[12px] leading-relaxed text-[#d70015]">
              {{ rejectedThemes.length }} 份未通过校验：{{
                rejectedThemes.map((r) => `${r.file}（${r.error}）`).join('；')
              }}
            </p>
          </section>
        </template>

        <!-- ═══ 启动器 ═══ -->
        <template v-else-if="activeSection === 'launcher'">
          <h1 class="mb-1 text-[28px] font-semibold tracking-tight text-fg-primary">启动器</h1>
          <p class="mb-8 text-[14px] text-fg-tertiary">全局搜索、插件命令与快捷键。</p>

          <section class="mb-8">
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="flex items-center gap-3 px-4 py-3">
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"
                >
                  <AppIcon icon="ri-search-line" :size="16" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-[14px] font-medium text-fg-primary">胶囊启动台与插件</div>
                  <div class="mt-0.5 text-[12px] text-fg-tertiary">
                    全局搜索 / 插件命令 / WebDAV 同步，均在启动器管理页配置
                  </div>
                </div>
                <UButton size="sm" variant="secondary" @click="router.push('/launcher')"
                  >管理插件</UButton
                >
              </div>
            </div>
          </section>

          <!-- 结果列表密度（P-6④）：只改行高与间距，字号与图标不跟着缩。
               与「启动器 → 紧凑模式」（P-6⑤，空查询时整窗收成一条栏）是两件事 -->
          <section class="mb-8">
            <h2 class="mb-3 text-[12px] font-medium uppercase tracking-wider text-fg-tertiary">
              结果列表密度
            </h2>
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="flex items-center gap-3 px-4 py-3">
                <div class="min-w-0 flex-1">
                  <div class="text-[14px] font-medium text-fg-primary">胶囊里一屏看几条</div>
                  <div class="mt-0.5 text-[12px] text-fg-tertiary">
                    紧凑档把行高从 38px 压到 28px；字号与图标保持原样，避免与详情面板的像素对齐打架
                  </div>
                </div>
                <div class="flex shrink-0 gap-1" data-testid="density-picker">
                  <button
                    v-for="d in DENSITY_VALUES"
                    :key="d"
                    type="button"
                    class="rounded-lg px-2.5 py-1.5 text-[12px] transition-colors"
                    :class="
                      density === d
                        ? 'bg-brand-500 text-white'
                        : 'bg-surface-2 text-fg-primary hover:bg-surface-hover'
                    "
                    :data-density-opt="d"
                    @click="chooseDensity(d)"
                  >
                    {{ d === 'comfortable' ? '宽松' : '紧凑' }}
                  </button>
                </div>
              </div>
              <div class="flex items-center gap-3 border-t border-line-subtle px-4 py-3">
                <div class="min-w-0 flex-1">
                  <div class="text-[14px] font-medium text-fg-primary">胶囊透明度</div>
                  <div class="mt-0.5 text-[12px] text-fg-tertiary">
                    默认「不透明」与之前完全一致；半透明档让背后的桌面透出来（底色沿用当前主题，
                    深色/浅色自动是各自的半透明玻璃）
                  </div>
                </div>
                <div class="flex shrink-0 gap-1" data-testid="glass-picker">
                  <button
                    v-for="g in CAPSULE_GLASS_VALUES"
                    :key="g"
                    type="button"
                    class="rounded-lg px-2.5 py-1.5 text-[12px] transition-colors"
                    :class="
                      glass === g
                        ? 'bg-brand-500 text-white'
                        : 'bg-surface-2 text-fg-primary hover:bg-surface-hover'
                    "
                    :data-glass-opt="g"
                    @click="chooseGlass(g)"
                  >
                    {{ g === 'opaque' ? '不透明' : g === 'soft' ? '半透明' : '通透' }}
                  </button>
                </div>
              </div>
              <div class="flex items-center gap-3 border-t border-line-subtle px-4 py-3">
                <div class="min-w-0 flex-1">
                  <div class="text-[14px] font-medium text-fg-primary">紧凑模式</div>
                  <div class="mt-0.5 text-[12px] text-fg-tertiary">
                    没输入时把胶囊收成一条搜索栏。开启后空态那一屏（下一个会议、固定建议、
                    最近搜索）不再显示，打字即恢复完整高度
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="compactMode"
                  data-compact-toggle
                  class="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
                  :class="compactMode ? 'bg-brand-500' : 'bg-surface-2 ring-1 ring-line-subtle'"
                  @click="chooseCompact(!compactMode)"
                >
                  <span
                    class="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-all"
                    :class="compactMode ? 'left-[18px]' : 'left-[2px]'"
                  ></span>
                </button>
              </div>
            </div>
          </section>
        </template>

        <!-- ═══ AI ═══ -->
        <template v-else-if="activeSection === 'ai'">
          <h1 class="mb-1 text-[28px] font-semibold tracking-tight text-fg-primary">AI</h1>
          <p class="mb-8 text-[14px] text-fg-tertiary">
            AI 助手配置。OpenAI 兼容 API，支持 DeepSeek / 通义 / Ollama 等。
          </p>

          <section class="mb-8">
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <!-- 启用开关 -->
              <div class="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"
                >
                  <AppIcon icon="sparkling-2-line" :size="16" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-[14px] font-medium text-fg-primary">AI 助手</div>
                  <div class="mt-0.5 text-[12px] text-fg-tertiary">配置仅存本机</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="aiEnabled"
                  class="relative h-[28px] w-[46px] shrink-0 rounded-full transition-colors"
                  :class="aiEnabled ? 'bg-fg-success' : 'bg-surface-active'"
                  @click="aiEnabled = !aiEnabled"
                >
                  <span
                    class="absolute top-[2px] size-6 rounded-full bg-white shadow-sm transition-all"
                    :class="aiEnabled ? 'left-[20px]' : 'left-[2px]'"
                  />
                </button>
              </div>

              <!-- 配置表单 -->
              <div class="space-y-4 px-4 py-4">
                <!-- provider 目录（P-4① BYOM）：点一下只是把表填好，不自动保存 -->
                <div>
                  <label class="mb-1.5 block text-[12px] font-medium text-fg-tertiary"
                    >服务方</label
                  >
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="p in AI_PROVIDERS"
                      :key="p.id"
                      type="button"
                      class="rounded-full px-2.5 py-1 text-[12px] transition-colors"
                      :class="
                        aiProvider === p.id
                          ? 'bg-brand-500 text-white'
                          : 'bg-surface-2 text-fg-primary hover:bg-surface-hover'
                      "
                      :title="p.hint || p.baseUrl"
                      @click="pickProvider(p)"
                    >
                      {{ p.label }}
                    </button>
                  </div>
                  <p v-if="pickedProvider?.hint" class="mt-1.5 text-[12px] text-fg-tertiary">
                    {{ pickedProvider.hint }}
                  </p>
                </div>
                <div>
                  <label class="mb-1.5 block text-[12px] font-medium text-fg-tertiary">
                    API Key
                    <span
                      v-if="pickedProvider && !pickedProvider.keyRequired"
                      class="text-fg-tertiary/70"
                    >
                      （本地端点可留空）
                    </span>
                  </label>
                  <input
                    v-model="aiApiKey"
                    type="password"
                    placeholder="sk-..."
                    class="w-full rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-fg-primary outline-none ring-1 ring-line-subtle transition-all focus:ring-brand-500/50"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="mb-1.5 block text-[12px] font-medium text-fg-tertiary"
                      >Base URL</label
                    >
                    <input
                      v-model="aiBaseUrl"
                      type="text"
                      placeholder="https://api.openai.com/v1"
                      class="w-full rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12px] text-fg-primary outline-none ring-1 ring-line-subtle transition-all focus:ring-brand-500/50"
                    />
                  </div>
                  <div>
                    <label class="mb-1.5 block text-[12px] font-medium text-fg-tertiary"
                      >模型</label
                    >
                    <input
                      v-model="aiModel"
                      type="text"
                      placeholder="gpt-4o-mini"
                      class="w-full rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12px] text-fg-primary outline-none ring-1 ring-line-subtle transition-all focus:ring-brand-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-[12px] font-medium text-fg-tertiary"
                    >系统提示词</label
                  >
                  <textarea
                    v-model="aiSystemPrompt"
                    rows="2"
                    class="w-full resize-none rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-fg-primary outline-none ring-1 ring-line-subtle transition-all focus:ring-brand-500/50"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <label class="text-[12px] font-medium text-fg-tertiary"
                    >温度 {{ aiTemperature }}</label
                  >
                  <input
                    v-model.number="aiTemperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    class="flex-1"
                  />
                </div>
                <div v-if="aiModels.length > 0" class="space-y-1.5">
                  <label class="mb-1.5 block text-[12px] font-medium text-fg-tertiary">
                    探测到的模型（{{ aiModels.length }}）
                  </label>
                  <div class="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                    <button
                      v-for="m in aiModels"
                      :key="m"
                      type="button"
                      class="rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors"
                      :class="
                        aiModel === m
                          ? 'bg-brand-500 text-white'
                          : 'bg-surface-2 text-fg-primary hover:bg-surface-hover'
                      "
                      @click="aiModel = m"
                    >
                      {{ m }}
                    </button>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <UButton size="sm" variant="primary" :loading="aiSaving" @click="saveAIConfig"
                    >保存配置</UButton
                  >
                  <UButton size="sm" variant="ghost" :loading="aiProbing" @click="probeModels">
                    探测端点
                  </UButton>
                  <span v-if="aiSaveMsg" class="text-[12px] text-fg-tertiary">{{ aiSaveMsg }}</span>
                </div>
                <p
                  v-if="aiProbeMsg"
                  class="text-[12px] text-fg-tertiary"
                  data-testid="ai-probe-msg"
                >
                  {{ aiProbeMsg }}
                </p>
              </div>
            </div>
          </section>

          <!-- MCP 服务器（P-4②）：本期只做到「连上、列工具、零参数工具能调一次」 -->
          <section class="mb-8">
            <h2 class="mb-3 text-[12px] font-medium uppercase tracking-wider text-fg-tertiary">
              MCP 服务器
            </h2>
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="border-b border-line-subtle px-4 py-3">
                <div class="text-[13px] text-fg-tertiary">
                  这些命令会在本机直接执行（不经过 shell），只连接你在下面写下的服务器。
                </div>
              </div>

              <div
                v-for="srv in mcp?.servers ?? []"
                :key="srv.id"
                class="border-b border-line-subtle px-4 py-3"
                data-testid="mcp-server-row"
              >
                <div class="flex items-center gap-2">
                  <span class="text-[14px] font-medium text-fg-primary">{{ srv.label }}</span>
                  <span
                    class="rounded-full px-2 py-0.5 text-[11px]"
                    :class="
                      srv.status === 'ready'
                        ? 'bg-fg-success/15 text-fg-success'
                        : srv.status === 'error'
                          ? 'bg-fg-danger/10 text-fg-danger'
                          : 'bg-surface-2 text-fg-tertiary'
                    "
                  >
                    {{
                      srv.status === 'ready'
                        ? `已连接 · ${srv.tools.length} 个工具`
                        : srv.status === 'error'
                          ? '连接失败'
                          : srv.status === 'connecting'
                            ? '连接中'
                            : '未连接'
                    }}
                  </span>
                  <span v-if="!srv.enabled" class="text-[11px] text-fg-tertiary">（已停用）</span>
                  <span class="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-tertiary">
                    {{ [srv.command, ...srv.args].join(' ') }}
                  </span>
                  <UButton
                    v-if="srv.status === 'ready'"
                    size="sm"
                    variant="ghost"
                    :loading="mcpBusyId === srv.id"
                    @click="mcpStop(srv.id)"
                  >
                    停止
                  </UButton>
                  <UButton
                    v-else
                    size="sm"
                    variant="ghost"
                    :loading="mcpBusyId === srv.id"
                    @click="mcpConnect(srv.id)"
                  >
                    连接
                  </UButton>
                </div>
                <div v-if="srv.error" class="mt-1 text-[12px] text-fg-danger">
                  {{ srv.error }}
                </div>
                <div v-if="srv.skipped > 0" class="mt-1 text-[12px] text-fg-tertiary">
                  {{ srv.skipped }} 个非法工具条目已忽略
                </div>
                <div v-if="srv.envKeys.length > 0" class="mt-1 text-[11px] text-fg-tertiary">
                  env：{{ srv.envKeys.join(', ') }}（值不回显，保存时按 id 沿用本机原值）
                </div>
                <div v-if="srv.tools.length > 0" class="mt-2 space-y-1.5">
                  <div
                    v-for="t in srv.tools"
                    :key="t.name"
                    class="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5"
                  >
                    <span class="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-primary">
                      {{ t.name }}
                    </span>
                    <span class="shrink-0 text-[11px] text-fg-tertiary">
                      {{
                        t.required.length > 0 ? `需参数：${t.required.join(', ')}` : '无必填参数'
                      }}
                    </span>
                    <UButton
                      v-if="t.required.length === 0"
                      size="sm"
                      variant="ghost"
                      :loading="mcpBusyId === `${srv.id}:${t.name}`"
                      @click="mcpCall(srv.id, t.name)"
                    >
                      调用
                    </UButton>
                  </div>
                  <!-- v-for 包 template：v-show 与 v-for 同节点时 key 的位置在 Vue 3 里不合法 -->
                  <template v-for="(result, key) in mcpCallResult" :key="key">
                    <div
                      v-if="key.startsWith(`${srv.id}:`)"
                      class="whitespace-pre-wrap rounded-lg bg-surface-inverse px-2.5 py-2 font-mono text-[11px] text-white/90"
                      data-testid="mcp-call-result"
                    >
                      {{ result }}
                    </div>
                  </template>
                </div>
              </div>
              <div
                v-if="!mcp || mcp.servers.length === 0"
                class="px-4 py-6 text-center text-[12px] text-fg-tertiary"
              >
                还没有配置 MCP 服务器
              </div>

              <div class="px-4 py-3">
                <label class="mb-1.5 block text-[12px] font-medium text-fg-tertiary">
                  配置（JSON 数组）
                </label>
                <textarea
                  v-model="mcpJson"
                  rows="7"
                  data-testid="mcp-json"
                  spellcheck="false"
                  class="w-full resize-y rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12px] text-fg-primary outline-none ring-1 ring-line-subtle transition-all focus:ring-brand-500/50"
                  placeholder='[{ "id": "demo", "command": "node", "args": ["server.mjs"] }]'
                />
                <div class="mt-2 flex items-center gap-3">
                  <UButton size="sm" variant="primary" @click="saveMcpJson">保存并生效</UButton>
                  <UButton size="sm" variant="ghost" @click="loadMcp">重新读取</UButton>
                  <span v-if="mcpMsg" class="text-[12px] text-fg-tertiary" data-testid="mcp-msg">
                    {{ mcpMsg }}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- ═══ 专注 ═══ -->
        <template v-else-if="activeSection === 'focus'">
          <h1 class="mb-1 text-[28px] font-semibold tracking-tight text-fg-primary">专注</h1>
          <p class="mb-8 text-[14px] text-fg-tertiary">番茄钟专注时屏蔽干扰应用和网站。</p>

          <section class="mb-8">
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <!-- 启用开关 -->
              <div class="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ff9500]/10 text-[#ff9500]"
                >
                  <AppIcon icon="ri-shield-line" :size="16" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-[14px] font-medium text-fg-primary">专注护盾</div>
                  <div class="mt-0.5 text-[12px] text-fg-tertiary">
                    工作计时进行中，清单内应用/网站切到前台即弹出全屏提醒
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="shieldEnabled"
                  :disabled="!shieldSupported"
                  class="relative h-[28px] w-[46px] shrink-0 rounded-full transition-colors disabled:opacity-40"
                  :class="shieldEnabled ? 'bg-fg-success' : 'bg-surface-active'"
                  @click="toggleShieldEnabled"
                >
                  <span
                    class="absolute top-[2px] size-6 rounded-full bg-white shadow-sm transition-all"
                    :class="shieldEnabled ? 'left-[20px]' : 'left-[2px]'"
                  />
                </button>
              </div>

              <!-- 屏蔽清单 -->
              <div class="space-y-4 px-4 py-4">
                <div>
                  <label class="mb-1.5 block text-[12px] font-medium text-fg-tertiary"
                    >屏蔽清单（应用名片段，逗号分隔）</label
                  >
                  <textarea
                    v-model="shieldAppsDraft"
                    rows="2"
                    :disabled="!shieldSupported"
                    placeholder="游戏, chrome, bilibili"
                    class="w-full resize-none rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12px] text-fg-primary outline-none ring-1 ring-line-subtle transition-all focus:ring-brand-500/50 disabled:opacity-40"
                    @blur="saveShieldApps"
                  />
                </div>
                <div>
                  <label class="mb-1.5 block text-[12px] font-medium text-fg-tertiary">
                    网站屏蔽（域名片段，逗号分隔）
                    <span v-if="!shieldWebsiteSupported" class="text-[#ff9500]"
                      >（仅 macOS 支持）</span
                    >
                  </label>
                  <textarea
                    v-model="shieldWebsitesDraft"
                    rows="2"
                    :disabled="!shieldSupported || !shieldWebsiteSupported"
                    placeholder="youtube.com, twitter.com, bilibili.com"
                    class="w-full resize-none rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12px] text-fg-primary outline-none ring-1 ring-line-subtle transition-all focus:ring-brand-500/50 disabled:opacity-40"
                    @blur="saveShieldWebsites"
                  />
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- ═══ 插件 ═══ -->
        <template v-else-if="activeSection === 'extensions'">
          <h1 class="mb-1 text-[28px] font-semibold tracking-tight text-fg-primary">插件</h1>
          <p class="mb-8 text-[14px] text-fg-tertiary">管理已安装的插件与扩展。</p>

          <section class="mb-8">
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="flex items-center gap-3 px-4 py-3">
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#af52de]/10 text-[#af52de]"
                >
                  <AppIcon icon="plug-2-line" :size="16" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-[14px] font-medium text-fg-primary">插件管理</div>
                  <div class="mt-0.5 text-[12px] text-fg-tertiary">
                    查看、安装、卸载插件，管理插件偏好设置
                  </div>
                </div>
                <UButton size="sm" variant="secondary" @click="router.push('/launcher')"
                  >打开管理页</UButton
                >
              </div>
            </div>
          </section>
        </template>

        <!-- ═══ 更新 ═══ -->
        <template v-else-if="activeSection === 'updates'">
          <h1 class="mb-1 text-[28px] font-semibold tracking-tight text-fg-primary">更新</h1>
          <p class="mb-8 text-[14px] text-fg-tertiary">自动更新与版本管理。</p>

          <section class="mb-8">
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="flex items-center gap-3 px-4 py-3">
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"
                >
                  <AppIcon icon="ri-refresh-line" :size="16" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-[14px] font-medium text-fg-primary">自动更新</span>
                    <UBadge v-if="updateStatus === 'available'" variant="brand">可更新</UBadge>
                    <UBadge v-else-if="updateStatus === 'error'" variant="danger">错误</UBadge>
                  </div>
                  <div class="mt-0.5 text-[12px] text-fg-tertiary">
                    {{ statusText(updateStatus) }}
                  </div>
                  <UProgress
                    v-if="updateStatus === 'downloading'"
                    :value="updateProgress"
                    class="mt-2"
                  />
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <UButton
                    v-if="canCheck()"
                    size="sm"
                    variant="secondary"
                    :loading="updateStatus === 'checking'"
                    @click="onCheckUpdate"
                  >
                    {{ updateStatus === 'checking' ? '检查中…' : '检查更新' }}
                  </UButton>
                  <UButton v-if="canDownload()" size="sm" variant="primary" @click="onDownload"
                    >下载</UButton
                  >
                  <UButton v-if="canInstall()" size="sm" variant="primary" @click="onInstall"
                    >重启安装</UButton
                  >
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- ═══ 数据 ═══ -->
        <template v-else-if="activeSection === 'data'">
          <h1 class="mb-1 text-[28px] font-semibold tracking-tight text-fg-primary">数据</h1>
          <p class="mb-8 text-[14px] text-fg-tertiary">数据存储、迁移与备份。</p>

          <section class="mb-8">
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="divide-y divide-line-subtle">
                <!-- 数据目录 -->
                <div class="flex items-center gap-3 px-4 py-3">
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-tertiary"
                  >
                    <AppIcon icon="ri-folder-line" :size="16" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[14px] font-medium text-fg-primary">数据目录</div>
                    <div class="truncate font-mono text-[11px] text-fg-tertiary">
                      {{ systemInfo?.userDataPath ?? '—' }}
                    </div>
                  </div>
                  <UButton
                    v-if="systemInfo?.userDataPath"
                    size="sm"
                    variant="ghost"
                    @click="onOpenDataDir"
                    >打开</UButton
                  >
                </div>

                <!-- 旧版数据归档 -->
                <div class="flex items-center gap-3 px-4 py-3">
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                    :class="
                      systemInfo?.legacyArchivePath
                        ? 'bg-fg-success/10 text-[#34c759]'
                        : 'bg-surface-2 text-fg-tertiary'
                    "
                  >
                    <AppIcon
                      :icon="
                        systemInfo?.legacyArchivePath ? 'ri-archive-line' : 'ri-archive-stack-line'
                      "
                      :size="16"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-[14px] font-medium text-fg-primary">旧版数据归档</span>
                      <UBadge v-if="systemInfo?.legacyArchivePath" variant="success">已归档</UBadge>
                      <UBadge v-else-if="systemInfo?.migrationDone === false" variant="neutral"
                        >无需迁移</UBadge
                      >
                    </div>
                    <div class="mt-0.5 truncate font-mono text-[11px] text-fg-tertiary">
                      <template v-if="systemInfo?.legacyArchivePath">{{
                        systemInfo.legacyArchivePath
                      }}</template>
                      <template v-else>无旧数据</template>
                    </div>
                  </div>
                  <UButton
                    v-if="systemInfo?.legacyArchivePath"
                    size="sm"
                    variant="ghost"
                    @click="onOpenLegacyDir"
                    >打开</UButton
                  >
                </div>

                <!-- 数据迁移中心 -->
                <router-link
                  to="/migration"
                  class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
                >
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-tertiary"
                  >
                    <AppIcon icon="database-2-line" :size="16" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[14px] font-medium text-fg-primary">数据迁移中心</div>
                    <div class="text-[12px] text-fg-tertiary">
                      导入 / 导出 / 备份恢复 / 出厂重置
                    </div>
                  </div>
                  <AppIcon icon="ri-arrow-right-s-line" :size="16" class="text-fg-tertiary" />
                </router-link>
              </div>
            </div>
          </section>
        </template>

        <!-- ═══ 高级 ═══ -->
        <template v-else-if="activeSection === 'advanced'">
          <h1 class="mb-1 text-[28px] font-semibold tracking-tight text-fg-primary">高级</h1>
          <p class="mb-8 text-[14px] text-fg-tertiary">系统权限、日志、遥测与开发者选项。</p>

          <!-- 系统权限（P-3.5）：跳过引导后补授权的落点，读的是主进程真状态 -->
          <section class="mb-8">
            <h2 class="mb-3 text-[12px] font-medium uppercase tracking-wider text-fg-tertiary">
              系统权限
            </h2>
            <PermissionPanel />
          </section>

          <!-- 定时任务（P-4④）：cron 按本机本地时间判定，动作面只留无人值守说得通的几类 -->
          <section class="mb-8">
            <h2 class="mb-3 text-[12px] font-medium uppercase tracking-wider text-fg-tertiary">
              定时任务
            </h2>
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="border-b border-line-subtle px-4 py-2.5 text-[12px] text-fg-tertiary">
                标准 5 字段 cron（分 时 日 月 周，本机时间）。应用没在跑的时候不会补跑。
              </div>
              <div
                v-for="t in autoTasks"
                :key="t.id"
                class="border-b border-line-subtle px-4 py-3"
                data-testid="automation-row"
              >
                <div class="flex items-center gap-2">
                  <span class="text-[14px] font-medium text-fg-primary">{{ t.label }}</span>
                  <span class="font-mono text-[11px] text-fg-tertiary">{{ t.cron }}</span>
                  <span
                    v-if="!t.cronValid"
                    class="rounded-full bg-fg-danger/10 px-2 py-0.5 text-[11px] text-fg-danger"
                  >
                    表达式不合法
                  </span>
                  <span class="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-tertiary">
                    {{ automationActionLabel(t) }}
                  </span>
                  <!-- 后台会跑的东西必须看得见是谁安排的：插件登记的那条带上来源 -->
                  <span
                    v-if="automationOwner(t)"
                    class="shrink-0 rounded-full bg-surface-active px-2 py-0.5 text-[11px] text-fg-secondary"
                  >
                    {{ automationOwner(t) }}
                  </span>
                  <UButton
                    size="sm"
                    variant="ghost"
                    :loading="autoBusyId === t.id"
                    @click="runAutomationNow(t.id)"
                  >
                    立刻跑一次
                  </UButton>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="t.enabled"
                    class="relative h-[24px] w-[42px] shrink-0 rounded-full transition-colors"
                    :class="t.enabled ? 'bg-fg-success' : 'bg-surface-active'"
                    @click="toggleAutomation(t)"
                  >
                    <span
                      class="absolute top-[2px] size-5 rounded-full bg-white shadow-sm transition-all"
                      :class="t.enabled ? 'left-[18px]' : 'left-[2px]'"
                    />
                  </button>
                </div>
                <div v-if="t.lastFiredAt" class="mt-1 text-[11px] text-fg-tertiary">
                  上次 {{ new Date(t.lastFiredAt).toLocaleString('zh-CN', { hour12: false }) }} ·
                  <span :class="t.lastOk ? 'text-fg-success' : 'text-fg-danger'">
                    {{ automationResultLabel(t) }}
                  </span>
                </div>
              </div>
              <div
                v-if="autoTasks.length === 0"
                class="px-4 py-6 text-center text-[12px] text-fg-tertiary"
              >
                还没有定时任务
              </div>
              <div class="px-4 py-3">
                <label class="mb-1.5 block text-[12px] font-medium text-fg-tertiary">
                  任务列表（JSON 数组）
                </label>
                <textarea
                  v-model="autoJson"
                  rows="8"
                  spellcheck="false"
                  data-testid="automation-json"
                  class="w-full resize-y rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12px] text-fg-primary outline-none ring-1 ring-line-subtle transition-all focus:ring-brand-500/50"
                  placeholder='[{ "id": "morning", "label": "早上问一句", "cron": "30 9 * * *", "action": { "type": "ai", "prompt": "今天有什么安排" } }]'
                />
                <div class="mt-2 flex items-center gap-3">
                  <UButton size="sm" variant="primary" @click="saveAutomations">保存并生效</UButton>
                  <UButton size="sm" variant="ghost" @click="loadAutomations">重新读取</UButton>
                  <span
                    v-if="autoMsg"
                    class="text-[12px] text-fg-tertiary"
                    data-testid="automation-msg"
                  >
                    {{ autoMsg }}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <!-- 日志模式 -->
          <section class="mb-8">
            <h2 class="mb-3 text-[12px] font-medium uppercase tracking-wider text-fg-tertiary">
              日志
            </h2>
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="divide-y divide-line-subtle">
                <button
                  v-for="t in telemetryOptions"
                  :key="t.id"
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                  @click="onSelectTelemetry(t.id)"
                >
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                    :class="
                      telemetryMode === t.id
                        ? 'bg-brand-500/10 text-brand-500'
                        : 'bg-surface-2 text-fg-tertiary'
                    "
                  >
                    <AppIcon
                      :icon="
                        t.id === 'off'
                          ? 'ri-eye-off-line'
                          : t.id === 'remote'
                            ? 'ri-cloud-line'
                            : 'ri-hard-drive-2-line'
                      "
                      :size="16"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-[14px] font-medium text-fg-primary">{{ t.label }}</span>
                    </div>
                    <div class="mt-0.5 text-[12px] text-fg-tertiary">{{ t.description }}</div>
                  </div>
                  <div
                    v-if="telemetryMode === t.id"
                    class="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500"
                  >
                    <AppIcon icon="ri-check-line" :size="12" class="text-white" />
                  </div>
                </button>
              </div>

              <!-- 导出日志 -->
              <div class="flex items-center gap-3 border-t border-line-subtle px-4 py-3">
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-tertiary"
                >
                  <AppIcon icon="download-2-line" :size="16" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-[14px] font-medium text-fg-primary">导出日志</div>
                  <div class="text-[12px] text-fg-tertiary">
                    打包最近 500 条日志，便于反馈问题时附上
                  </div>
                </div>
                <UButton size="sm" variant="secondary" @click="onExportLogs">导出</UButton>
              </div>
            </div>
          </section>
        </template>

        <!-- ═══ 关于 ═══ -->
        <template v-else-if="activeSection === 'about'">
          <h1 class="mb-1 text-[28px] font-semibold tracking-tight text-fg-primary">关于</h1>
          <p class="mb-8 text-[14px] text-fg-tertiary">版本信息与致谢。</p>

          <section class="mb-8">
            <div class="overflow-hidden rounded-xl bg-surface-1 ring-1 ring-line-subtle">
              <div class="divide-y divide-line-subtle">
                <router-link
                  to="/about"
                  class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
                >
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"
                  >
                    <AppIcon icon="ri-information-line" :size="16" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[14px] font-medium text-fg-primary">关于 Frond</div>
                    <div class="text-[12px] text-fg-tertiary">版本、隐私、致谢</div>
                  </div>
                  <AppIcon icon="ri-arrow-right-s-line" :size="16" class="text-fg-tertiary" />
                </router-link>

                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                  @click="onRestartOnboarding"
                >
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ff9500]/10 text-[#ff9500]"
                  >
                    <AppIcon icon="ri-refresh-line" :size="16" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[14px] font-medium text-fg-primary">重新开始引导</div>
                    <div class="text-[12px] text-fg-tertiary">重看首次启动的 4 步引导</div>
                  </div>
                  <AppIcon icon="ri-arrow-right-s-line" :size="16" class="text-fg-tertiary" />
                </button>
              </div>
            </div>
          </section>

          <p class="text-center text-[12px] text-fg-tertiary">
            Frond · v{{ appVersion }} · 本地优先 / 开源
          </p>
        </template>
      </div>
    </main>
  </div>
</template>

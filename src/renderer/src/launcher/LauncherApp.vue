<template>
  <div class="launcher" :class="{ compact: barOnlyMode }">
    <LauncherSearchBar
      ref="searchBarRef"
      v-model="query"
      v-model:clip-filter="clipFilter"
      :placeholder="searchPlaceholder"
      :show-back="!!firstPartyPage || pluginState.canGoBack === true"
      :plugin-open="pluginState.open"
      :plugin-name="pluginState.pluginName"
      :show-filter="firstPartyPage === 'clips'"
      :list-expanded="!pluginState.open && results.length > 0"
      :active-descendant-id="activeDescendantId"
      :compact="barOnlyMode"
      :arg-mode="argModeOn"
      :arg-title="argTarget?.title ?? ''"
      :arg-slots="argSlotsOf"
      :arg-values="argValues"
      :arg-index="argIndex"
      :arg-invalid="argInvalid"
      @arg-input="setArgValue"
      @arg-focus="(i: number) => (argIndex = i)"
      @arg-keydown="onArgSlotKeydown"
      @input="onInput"
      @keydown="onKeydown"
      @back="onEscape"
      @ai="askAIWithQuery"
    />

    <!-- I9 统一加载态：内联页慢路径期间顶部不确定进度条（Raycast isLoading 语义） -->
    <div v-if="busyCount > 0" class="launcher-busy">
      <div class="launcher-busy-bar"></div>
    </div>

    <!-- P-1.3 keep-open 指示：钉住后失焦不再隐藏，得让用户看得见当前是这个态 -->
    <div
      v-if="pinned"
      class="launcher-pinned-dot"
      data-testid="pinned-indicator"
      title="保持打开（⌘⇧K 取消）"
    ></div>

    <!-- 插件 showHud 轻提示（spec 3.3）：plugapi:hud → launcher:plugin-hud → 此处 1.5s 淡出 -->
    <PluginHud ref="pluginHud" />

    <!-- 结果级动作面板（M1.2 → I4 Raycast 化）：⌘K 呼出，右锚定浮层 + 底部过滤框 -->
    <div v-if="actionPanelEntry" class="launcher-actions" data-testid="action-panel">
      <div class="launcher-actions-title">{{ actionPanelEntry.title }}</div>
      <div class="launcher-actions-list" role="listbox" aria-label="可用动作">
        <div
          v-for="(act, i) in filteredPanelActions"
          :key="act.id"
          class="launcher-action"
          role="option"
          :aria-selected="i === actionIndex"
          :class="{ selected: i === actionIndex }"
          @mouseenter="actionIndex = i"
          @mousedown.prevent="act.run()"
        >
          <AppIcon :icon="act.icon" :size="14" class="launcher-action-icon" />
          <span class="launcher-action-label">{{ act.label }}</span>
          <!-- 键帽只由真实绑定生成：声明了 key 用 prettyKey，否则仅主动作的 ↵ -->
          <kbd v-if="act.key || act.hint" class="launcher-action-keys">{{
            act.key ? prettyKey(act.key) : act.hint
          }}</kbd>
        </div>
        <div v-if="filteredPanelActions.length === 0" class="launcher-actions-empty">
          没有匹配的动作
        </div>
      </div>
      <input
        ref="actionFilterRef"
        v-model="actionFilter"
        class="launcher-actions-filter"
        type="text"
        placeholder="搜索动作…"
        spellcheck="false"
        @keydown="onActionFilterKeydown"
      />
    </div>

    <!-- 内联页与插件的声明式视图：由注册表挑「这一次渲染谁」（P-2④）。
         以前这里是 24 节 v-if/v-else-if 硬链——加页面时漏一节只是一片空白，类型管不到；
         现在少一条 def 就是编译错误。表见 composables/launcherPageViews.ts -->
    <component
      :is="activeView.component"
      v-if="activeView"
      :key="activeView.key"
      ref="pageRef"
      v-bind="activeView.props"
      v-on="activeView.on"
    />

    <div
      v-else-if="!pluginState.open && !compactIdle && !argModeOn && results.length > 0"
      class="launcher-body"
    >
      <div
        id="launcher-result-list"
        class="launcher-results"
        role="listbox"
        aria-label="搜索结果"
        :class="{ 'has-detail': currentDetail || detailLoading }"
      >
        <template v-for="group in resultGroups" :key="group.label">
          <div class="launcher-section-label">{{ group.label }}</div>
          <div
            v-for="slotItem in group.items"
            :id="`launcher-opt-${slotItem.index}`"
            :key="slotItem.item.entry.key"
            class="launcher-result"
            :data-index="slotItem.index"
            role="option"
            :aria-selected="slotItem.index === selectedIndex"
            :class="{ selected: slotItem.index === selectedIndex }"
            @mouseenter="selectedIndex = slotItem.index"
            @mousedown.prevent="runEntry(slotItem.item.entry)"
          >
            <div class="launcher-result-icon" :style="{ background: iconBg(slotItem.item.entry) }">
              <img
                v-if="faviconOf(slotItem.item.entry)"
                class="launcher-result-favicon"
                :src="`image://${encodeURI(faviconOf(slotItem.item.entry) ?? '')}`"
                alt=""
              />
              <AppIcon
                v-else
                :icon="slotItem.item.entry.icon"
                :size="16"
                class="launcher-result-icon-svg"
              />
            </div>
            <div class="launcher-result-text">
              <div class="launcher-result-title">
                <template v-if="highlightParts(slotItem.item)"
                  >{{ highlightParts(slotItem.item)!.before
                  }}<span class="hl">{{ highlightParts(slotItem.item)!.hit }}</span
                  >{{ highlightParts(slotItem.item)!.after }}
                </template>
                <template v-else>{{ slotItem.item.entry.title }}</template>
                <span v-if="slotItem.item.entry.subtitle" class="launcher-result-subtitle">{{
                  slotItem.item.entry.subtitle
                }}</span>
              </div>
            </div>
            <div class="launcher-result-meta">
              <span v-if="slotItem.item.entry.badge" class="launcher-result-badge">{{
                slotItem.item.entry.badge
              }}</span>
              <!-- 数字徽标只发前 10 条（V3：Raycast 语义，1-9 + 0） -->
              <span v-if="slotItem.index < 10" class="launcher-result-quick">{{
                slotItem.index < 9 ? slotItem.index + 1 : 0
              }}</span>
            </div>
          </div>
        </template>
      </div>
      <!-- 右侧详情面板（Raycast List-Detail） -->
      <div
        v-if="currentDetail"
        class="launcher-detail"
        data-testid="detail-panel"
        role="region"
        aria-label="详情"
        aria-live="polite"
      >
        <DetailPanel
          :title="currentDetail.title"
          :content="currentDetail.content"
          :format="currentDetail.format"
        />
      </div>
      <!-- 异步详情占位：宽度先占住，避免内容到达时结果列表跳一下 -->
      <div v-else-if="detailLoading" class="launcher-detail" data-testid="detail-loading">
        <div class="launcher-detail-loading-text">读取详情…</div>
      </div>
    </div>

    <div v-else-if="query && !pluginState.open" class="launcher-empty">
      <div class="launcher-empty-text">没有找到「{{ query }}」相关结果</div>
      <div class="launcher-fallback-list">
        <div
          v-for="(cmd, i) in fallbackCommands"
          :key="cmd.id"
          class="launcher-fallback-item"
          :class="{
            selected: i === fallbackSelectedIndex,
            'ai-emphasis': cmd.id === 'fallback:ai'
          }"
          @mouseenter="fallbackSelectedIndex = i"
          @mousedown.prevent="runFallbackCommand(cmd)"
        >
          <AppIcon :icon="cmd.icon" :size="16" class="launcher-fallback-icon" />
          <div class="launcher-fallback-text">
            <div class="launcher-fallback-title">{{ cmd.title }}</div>
            <div class="launcher-fallback-subtitle">{{ cmd.subtitle }}</div>
          </div>
          <span v-if="cmd.badge" class="launcher-fallback-badge">{{ cmd.badge }}</span>
        </div>
      </div>
    </div>

    <!-- 底部动作栏（B1 → V4 Raycast 化）：左图标按钮，右侧「主动作 ↵ / Actions ⌘K」 -->
    <div v-if="!firstPartyPage && !pluginState.open" class="launcher-footer">
      <button
        class="launcher-footer-menu"
        title="快捷键（?）"
        @mousedown.prevent="showShortcuts = true"
      >
        <AppIcon icon="menu-line" :size="16" />
      </button>
      <div class="launcher-footer-actions">
        <button class="launcher-footer-btn" @mousedown.prevent="runSelected">
          <kbd>↵</kbd> {{ primaryLabel }}
        </button>
        <button class="launcher-footer-btn" @mousedown.prevent="toggleActionPanel">
          <kbd>⌘K</kbd> 动作
        </button>
      </div>
    </div>

    <!-- 快捷键速查面板（阶段5.3） -->
    <div v-if="showShortcuts" class="shortcuts-overlay" @mousedown.prevent="showShortcuts = false">
      <div class="shortcuts-panel" @mousedown.stop>
        <div class="shortcuts-title">快捷键</div>
        <div class="shortcuts-grid">
          <div class="shortcut-item"><kbd>↑</kbd><kbd>↓</kbd><span>上下选择</span></div>
          <div class="shortcut-item"><kbd>↵</kbd><span>执行命令</span></div>
          <div class="shortcut-item"><kbd>⌘K</kbd><span>动作面板</span></div>
          <div class="shortcut-item"><kbd>⌘1-9</kbd><span>快速打开</span></div>
          <div class="shortcut-item"><kbd>Tab</kbd><span>Quick AI</span></div>
          <div class="shortcut-item"><kbd>esc</kbd><span>关闭 / 返回</span></div>
          <div class="shortcut-item"><kbd>?</kbd><span>快捷键面板</span></div>
          <div class="shortcut-item"><kbd>⌘C</kbd><span>复制（文件/路径）</span></div>
          <div class="shortcut-item"><kbd>⌘N</kbd><span>新建笔记</span></div>
        </div>
        <div class="shortcuts-hint">按任意键关闭</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Frond · 启动器胶囊窗（Raycast 式）
 *
 * 本组件是编排层：状态与领域逻辑拆在同目录 composables/
 * - useLauncherPages      内联页导航栈
 * - useSearchHistoryNav   ↑ 搜索历史导航
 * - useIdleWatcher        闲置 60s Pop to Root
 * - useCommandSources     命令源聚合（Registry/静态/插件/动态）+ 别名
 * - useUnifiedSearch      统一混合搜索（同步 + 异步增量）
 * - useActionPanel        结果级 ⌘K 动作面板
 * 模板中的内联页分发与结果列表保持内联（拆子组件见后续批次）。
 */
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import LauncherSearchBar from './LauncherSearchBar.vue'
import { FIRST_PARTY_COMMANDS, type CommandEntry, type FirstPartyPage } from '@shared/commands'
import { normalizeWithMap, type ScoredEntry } from '@shared/search'
import {
  normalizePopToRootMode,
  shouldPopToRootOnShow,
  type PopToRootMode
} from '@shared/popToRoot'
import {
  DEFAULT_FALLBACK_COMMANDS,
  renderFallbackCommand,
  sortFallbackCommands,
  type FallbackCommand
} from '@shared/fallbackCommands'
import { useUsageBoost } from '@renderer/composables/useUsageBoost'
import { executeCommand } from '@renderer/utils/commandRunner'
import DetailPanel from './components/DetailPanel.vue'
import PluginHud from './components/PluginHud.vue'
import {
  addDocumentListener,
  addWindowListener,
  digitToIndex,
  groupResultsForDisplay,
  primaryActionLabel
} from './composables/launcherInteractions'
import {
  FIRST_PARTY_PAGE_TITLES,
  providePageTitle,
  useLauncherPages
} from './composables/useLauncherPages'
import { useLauncherBusy } from './composables/useLauncherBusy'
import { useMcpToolLaunch } from './composables/useMcpToolLaunch'
import { usePluginArgLaunch } from './composables/usePluginArgLaunch'
import { useQuicklinkArgLaunch } from './composables/useQuicklinkArgLaunch'
import { useAiLaunch } from './composables/useAiLaunch'
import { useArgSlots } from './composables/useArgSlots'
import type { KindFilter } from './pages/clipboardLogic'
import { useSearchHistoryNav } from './composables/useSearchHistoryNav'
import { useIdleWatcher } from './composables/useIdleWatcher'
import { useCommandSources, moduleToEntry } from './composables/useCommandSources'
import { pickPageView, type LauncherViewCtx } from './composables/launcherPageViews'
import { useUnifiedSearch } from './composables/useUnifiedSearch'
import { useActionPanel } from './composables/useActionPanel'
import { useCapsuleAppearance } from './composables/useCapsuleAppearance'
import { isReservedCombo, prettyKey, resolveModifierAction } from './composables/modifierKeys'
import { DetailToken, detailKind } from './composables/detailLogic'
import type { CommandDetail } from '@shared/commandRegistry'
import type { PluginListItem, PluginFormNode } from '@shared/plugin-protocol'
import type { McpToolArg } from '@shared/mcp'

/** React 表单视图（#11 M2）：主进程归一后的表单（fields + submit 元数据） */
type PluginForm = Omit<PluginFormNode, '$t' | 'submitId'> & { submitId: string }

const query = ref('')
const selectedIndex = ref(0)
const fallbackSelectedIndex = ref(0)
/** 搜索输入区拆到子组件后，焦点由它自己管（P-1.6b 前置拆分） */
const searchBarRef = ref<InstanceType<typeof LauncherSearchBar> | null>(null)
const pluginHud = ref<InstanceType<typeof PluginHud> | null>(null)

/**
 * P-1.3 keep-open：主进程才是生效方（blur 判定在那边），这里只镜像状态给
 * 指示器与动作文案用，且以主进程返回的生效值为准，避免两边各说各话。
 */
const pinned = ref(false)
// misused-promises（批 2c）：配置对象要求 void 返回的回调，异步函数经 voidify 收口
const voidify =
  <A extends unknown[]>(fn: (...args: A) => unknown) =>
  (...args: A): void => {
    void fn(...args)
  }

async function togglePinned(): Promise<void> {
  const { pinned: effective } = await window.api.launcher.setPinned(!pinned.value)
  pinned.value = effective
}

/**
 * P-1.4：收藏的 CommandEntry.key（全类型，不再只限模块）。
 * 存储侧沿用 usage_favorites.module_id 列——它本就是自由字符串，只是过去只有模块 key 写得进、读得出。
 */
const favoriteKeys = ref<string[]>([])
async function refreshFavorites(): Promise<void> {
  favoriteKeys.value = await window.api.usage.getFavorites()
}
function toggleFavorite(key: string): void {
  void window.api.usage.toggleFavorite(key).then(() => refreshFavorites())
}

/** 阶段5.3：快捷键速查面板显示状态 */
const showShortcuts = ref(false)

/** 内联页导航栈（M5.2） */
const { pageStack, firstPartyPage, pageRef, pushPage, popPage, beginShowCycle, pushedSince } =
  useLauncherPages()

/** I7 面包屑：向 CapsulePage 提供当前页标题（底栏左侧返回按钮） */
providePageTitle(
  computed(() => (firstPartyPage.value ? FIRST_PARTY_PAGE_TITLES[firstPartyPage.value] : null))
)

/** I6 剪贴板类型筛选（状态提升到搜索栏下拉，v-model:filter 下发页面） */
const clipFilter = ref<KindFilter>('all')

/** I9 统一加载态：内联页慢路径忙碌计数 */
const { busyCount } = useLauncherBusy()

/** 当前打开的插件状态（打开时搜索框转为插件副输入框）。
 *  形状**取自 getPluginState 的契约推导类型**：这里曾另抄一份四行字面量，主进程补
 *  viewDepth / canGoBack 后本文件仍读 unknown——「返回键先退插件层」静默失效。
 *  抄一份就会漂一次，所以推出去；实现为源后契约缺字段会在这里直接报错。 */
type PluginSnapshot = NonNullable<Awaited<ReturnType<typeof window.api.launcher.getPluginState>>>
const pluginState = ref<PluginSnapshot>({
  open: false,
  pluginId: null,
  pluginName: null,
  subInputPlaceholder: null,
  declaredList: null,
  declaredForm: null,
  declaredLoading: false,
  declaredEmptyMessage: null,
  viewDepth: 0,
  canGoBack: false,
  headless: false,
  attached: false
})

/**
 * combobox 的当前项：读屏靠它念高亮行。没有结果、或插件占着输入框时
 * 不能留一个指向不存在元素的 id（aria-activedescendant 悬空比没有更糟）。
 */
const activeDescendantId = computed(() =>
  !pluginState.value.open && results.value.length > 0 && selectedIndex.value < results.value.length
    ? `launcher-opt-${selectedIndex.value}`
    : undefined
)

/** 声明式 List（M3.1）：插件提交的 items，胶囊原生渲染 */
const declaredList = ref<PluginListItem[] | null>(null)
/** P-2.6：插件列表的加载态 / 空态文案（随快照同步，只在列表为空时影响渲染） */
const declaredLoading = ref(false)
const declaredEmptyMessage = ref<string | null>(null)
/** React 表单视图（#11 M2）：插件提交的表单（与 declaredList 互斥） */
const pluginForm = ref<PluginForm | null>(null)

/** B1 · 搜索历史 ↑ 恢复 */
const {
  historyCache,
  historyNavActive,
  historyNavApplying,
  exitHistoryNav,
  enterHistoryNav,
  stepHistoryNav
} = useSearchHistoryNav(query)

/** 命令源聚合（Registry / 静态 / 插件 / 动态）+ 别名 + favicon */
const {
  registryCommands,
  loadRegistryCommands,
  loadDynamicCommands,
  loadPluginCommands,
  loadMcpCommands,
  loadPluginSearchItems,
  enrichAliases,
  faviconOf,
  iconBg,
  entries
} = useCommandSources(undefined, () => rerunSearch())

/** 空态建议：固定动作 + 最近使用 + 收藏（按 key 去重） */
const suggestions = ref<ScoredEntry[]>([])

/** 空态置顶「下一个会议」愿意等多久（超了就先上固定建议，见 refreshSuggestions） */
const MEETING_WAIT_MS = 400

/** 下一个会议条目（V4 P0-1 批次4：Raycast 空态「next event」对齐）。
 *  仅在有可入会链接时展示；未授权/非 mac/查询失败静默无条目。 */
async function fetchNextMeetingEntry(): Promise<CommandEntry | null> {
  try {
    const { auth, next } = await window.api.calendar.next()
    if (auth !== 'authorized' || !next?.meeting) return null
    const start = new Date(next.startMs)
    const hm = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    return {
      key: 'cal:next',
      icon: 'calendar-line',
      title: `${hm} ${next.title}`,
      subtitle: `日程 · ${next.meeting.provider}`,
      badge: '会议',
      action: { type: 'openUrl', url: next.meeting.url }
    }
  } catch {
    return null
  }
}

async function refreshSuggestions(): Promise<void> {
  const seen = new Set<string>()
  const list: CommandEntry[] = []
  // 下一个会议置顶（Raycast 空态对齐）。**不能无限等它**：EventKit 首次授权/慢查询时
  // 这一路会挂住，整个空态就成了空白面板（e2e 实测 25s 采不到一行）。
  // 400ms 拿不到就先上固定建议，下一次唤起/查询自然会再补——少一行会议比一屏空白好。
  const meeting = await Promise.race([
    fetchNextMeetingEntry(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), MEETING_WAIT_MS))
  ])
  if (meeting) {
    seen.add(meeting.key)
    list.push(meeting)
  }
  // 固定命令：第一方内联页（Raycast 根态建议）
  for (const entry of FIRST_PARTY_COMMANDS) {
    if (!seen.has(entry.key)) {
      seen.add(entry.key)
      list.push(entry)
    }
  }
  try {
    const [recentIds, favIds] = await Promise.all([
      // frecency 全类型后记录含 app:/syscmd: 等非模块 key：多取一些，
      // 只让能映射成模块条目的前 6 个占用建议位
      window.api.usage.getRecent(20),
      window.api.usage.getFavorites()
    ])
    // 同一份数据供查询态置顶用（refreshSuggestions 在 onShown 里会重跑）
    favoriteKeys.value = favIds
    let recentTaken = 0
    for (const raw of recentIds) {
      if (recentTaken >= 6) break
      const e = moduleToEntry(raw)
      if (!e || seen.has(e.key)) continue
      seen.add(e.key)
      list.push(e)
      recentTaken++
    }
    for (const raw of favIds) {
      // key 可以是任意条目类型（app:/quicklink:/firstparty:…）：先在当前全量条目里解析，
      // 解析不到（应用卸载、快捷链接删除）才跳过。moduleToEntry 兜住历史上的模块 key 形态。
      const e = entries.value.find((x) => x.key === raw) ?? moduleToEntry(raw)
      if (!e || seen.has(e.key)) continue
      seen.add(e.key)
      list.push(e)
    }
  } catch {
    /* 使用记录读取失败时仅展示固定动作 */
  }
  // P2-9：最近搜索历史（最多 5 条，排在固定动作之后）
  try {
    const history = (await window.api.searchHistory.get()) as string[]
    historyCache.value = history // B1：↑ 恢复搜索历史用（最新在前）
    for (const q of history.slice(0, 5)) {
      const key = `history:${q}`
      if (!seen.has(key)) {
        seen.add(key)
        list.push({
          key,
          icon: 'history-line',
          title: q,
          subtitle: '最近搜索',
          badge: '最近搜索',
          action: { type: 'searchQuery', query: q }
        })
      }
    }
  } catch {
    /* 搜索历史读取失败不阻塞 */
  }
  suggestions.value = list.slice(0, 10).map((entry) => ({ entry, highlight: null, score: 0 }))
}

/** 使用统计（排序自学习，维度 1）：频次 × 新近混合加权，与 ⌘K 面板共用 */
const { refresh: refreshRecentUsage, boost: usageBoost } = useUsageBoost()

/** P0-1 统一混合搜索 */
const { results, runUnifiedSearch, scheduleForQuery, resetToSuggestions } = useUnifiedSearch({
  entries: () => entries.value,
  favorites: favoriteKeys,
  usageBoost,
  suggestions
})

/** 当前选中项的详情（右侧 Detail 面板）；函数型 detail 在选中那一刻才异步取 */
const currentDetail = ref<CommandDetail | null>(null)
const detailLoading = ref(false)
const detailTokens = new DetailToken()

async function loadSelectedDetail(): Promise<void> {
  const item = results.value[selectedIndex.value]
  const cmd = item ? registryCommands.value.find((c) => c.id === item.entry.key) : undefined
  const detail = cmd?.detail
  const kind = detailKind(detail)
  const token = detailTokens.begin()
  if (kind !== 'async') {
    currentDetail.value = kind === 'static' ? (detail as CommandDetail) : null
    detailLoading.value = false
    return
  }
  detailLoading.value = true
  try {
    const got = await (detail as () => Promise<CommandDetail | null> | CommandDetail | null)()
    if (!detailTokens.isCurrent(token)) return // 用户已换行，旧响应作废
    currentDetail.value = (got as CommandDetail) ?? null
  } catch {
    currentDetail.value = null
  } finally {
    if (detailTokens.isCurrent(token)) detailLoading.value = false
  }
}

watch([selectedIndex, results], () => void loadSelectedDetail())

const searchPlaceholder = computed(() => {
  if (firstPartyPage.value === 'focus') return '回车 开始 / 暂停专注'
  if (firstPartyPage.value === 'snippets') return '搜索片段…'
  if (firstPartyPage.value === 'schedule') return '浏览未来 7 天日程…'
  if (firstPartyPage.value === 'shots') return '按文件名或图内文字搜索截图…'
  if (firstPartyPage.value === 'clips') return '浏览剪贴板历史…'
  if (firstPartyPage.value === 'focusStats') return '专注统计速览'
  if (firstPartyPage.value === 'files') return '搜索文件名…'
  if (firstPartyPage.value === 'notes') return '搜索或新建笔记…'
  if (firstPartyPage.value === 'ai') return '输入问题，回车发送…'
  return pluginState.value.subInputPlaceholder ?? '搜索应用、命令、文件…'
})

/** 底部动作栏主动作提示（B1）：跟随当前选中项的回车语义（打开/复制/填入/执行） */
const primaryLabel = computed(() => {
  const item = results.value[selectedIndex.value]
  return primaryActionLabel(item?.entry.action.type)
})

/** 被用户停用的兜底命令 id（启动器管理页可配；唤起时重读，V4 P0-3） */
const fallbackDisabled = ref<string[]>([])
/** 兜底命令的用户自定义顺序（id 列表；未收录的保持默认相对序随后） */
const fallbackOrder = ref<string[]>([])

async function loadFallbackConfig(): Promise<void> {
  try {
    ;[fallbackDisabled.value, fallbackOrder.value] = await Promise.all([
      window.api.preferences.getFallbackDisabled(),
      window.api.preferences.getFallbackOrder()
    ])
  } catch {
    /* 读取失败按全启用 + 默认序处理 */
  }
}

/** Fallback Commands：搜索无结果时的兜底命令列表（对标 Raycast，可配置启停与顺序） */
const fallbackCommands = computed<FallbackCommand[]>(() => {
  const q = query.value.trim()
  if (!q) return []
  return sortFallbackCommands(
    DEFAULT_FALLBACK_COMMANDS.filter((cmd) => !fallbackDisabled.value.includes(cmd.id)),
    fallbackOrder.value
  ).map((cmd) => renderFallbackCommand(cmd, q))
})

/** 内联槽引擎抽在 composables/useArgSlots.ts（第五刀，2026-09-25）；必须先于三个发射段创建
 * ——它们的 enterArgSlots 依赖在这里。提交去向走 dispatchArgSlots（提升的函数声明，见文件后部） */
const {
  argTarget,
  argSlotsOf,
  argValues,
  argIndex,
  argInvalid,
  argModeOn,
  setArgValue,
  enterArgSlots,
  exitArgSlots,
  onArgSlotKeydown
} = useArgSlots({ query, searchBarRef, dispatch: dispatchArgSlots })

/** 参数化 Quicklink 的发射段抽在 composables/useQuicklinkArgLaunch.ts（第三刀，2026-09-25） */
const { qlArgTarget, qlArgFields, qlArgInitialMap, openQuicklinkArg, submitQuicklinkArg } =
  useQuicklinkArgLaunch({
    query,
    searchBarRef,
    pushPage,
    enterArgSlots,
    hideWindow
  })

/** 插件带参命令的发射段抽在 composables/usePluginArgLaunch.ts（第二刀，2026-09-25） */
const { pluginArgTarget, pluginArgFields, openPluginArg, openPluginWithArgs } = usePluginArgLaunch({
  query,
  searchBarRef,
  pushPage,
  popPage,
  enterArgSlots
})

/* ── MCP 工具进根搜索（P-4② 收尾）：发射段抽在 composables/useMcpToolLaunch.ts ──
 * 三条路共用一份参数清单（`action.args`，出自主进程的工具清单缓存）：
 * 0 个参数直接跑、≤2 格内联填、第 3 格起进表单。判定在 shared/argSlots，这里只管现场。 */
const {
  mcpArgTarget,
  mcpArgFields,
  mcpArgInitial,
  mcpCall,
  openMcpTool,
  runMcpToolEntry,
  submitMcpArg
} = useMcpToolLaunch({
  query,
  searchBarRef,
  pushPage,
  popPage,
  enterArgSlots
})

/**
 * 插件有没有接管胶囊的搜索区：挂了视图（含 headless 升级出来的可见视图）、
 * 提交了声明式列表 / 表单，或设了副输入框。只有接管了才动得起搜索框里的词。
 */
function tookSearchBox(state: {
  open?: boolean
  attached?: boolean
  declaredList?: unknown
  declaredForm?: unknown
  subInputPlaceholder?: string | null
}): boolean {
  if (!state.open) return false
  return (
    state.attached === true ||
    !!state.declaredList ||
    !!state.declaredForm ||
    !!state.subInputPlaceholder
  )
}

/** 槽态提交的去向分发（引擎通过它交还宿主；函数声明提升，引擎创建时可引用）。
 * 三种去向各由对应发射 composable 承接：先落 target 再走提交出口。 */
function dispatchArgSlots(target: CommandEntry, values: Record<string, string>): void {
  const kind = target.action.type
  if (kind === 'plugin') {
    pluginArgTarget.value = target
    openPluginWithArgs(values)
  } else if (kind === 'mcpTool') {
    runMcpToolEntry(target, values)
  } else {
    qlArgTarget.value = target
    submitQuicklinkArg(values)
  }
}

/** 推送到了就按当前查询再跑一遍（空查询走建议列表）——两条插件推送共用 */
function rerunSearch(): void {
  const q = query.value.trim()
  if (q) void runUnifiedSearch(q)
  else resetToSuggestions()
}

/** Pop to Root：清 query / 页栈 / 面板与历史导航态，恢复建议列表（Raycast 行为） */
function popToRoot(): void {
  exitHistoryNav()
  showShortcuts.value = false
  actionPanelEntry.value = null
  qlArgTarget.value = null
  argTarget.value = null
  argValues.value = []
  argIndex.value = 0
  argInvalid.value = []
  pluginArgTarget.value = null
  if (pluginState.value.open) void window.api.launcher.closePlugin()
  query.value = ''
  selectedIndex.value = 0
  fallbackSelectedIndex.value = 0
  pageStack.value = []
  resetToSuggestions()
}

/** B1 · Pop to Root 闲置计时（键入/点击/鼠标移动/滚轮重置；窗口隐藏暂停） */
/** Pop to Root 三态（V4 P0-3）：唤起是否回到根搜索（管理页可配） */
const popToRootMode = ref<PopToRootMode>('immediately')
/** 上次隐藏时间戳（afterInterval 模式的 30s 保留窗口判定用） */
let lastHiddenAt: number | null = null

async function loadPopToRootMode(): Promise<void> {
  try {
    popToRootMode.value = normalizePopToRootMode(await window.api.preferences.getPopToRootMode())
  } catch {
    /* 读取失败按缺省 immediately 处理 */
  }
}

const { noteActivity, onVisibilityChangeForIdle, onWindowMouseMove } = useIdleWatcher(() => {
  // manually 模式：空内自动回根也一并抑制（对标 Raycast「Manually」语义）
  if (popToRootMode.value !== 'manually') popToRoot()
})

/** AI 接线段抽在 composables/useAiLaunch.ts（第四刀，2026-09-25）；aiReady 必须先于 useActionPanel 声明 */
const { aiReady, refreshAiReady, askAIWithText, askAIWithQuery, askAIAbout } = useAiLaunch({
  pageRef,
  pushPage,
  query,
  searchBarRef
})

/** ⌘K 动作面板 */
const { actionPanelEntry, actionIndex, panelActions, actionsFor, toggleActionPanel } =
  useActionPanel({
    results,
    selectedIndex,
    runEntry,
    hideWindow,
    pinned,
    togglePinned: voidify(togglePinned),
    favorites: favoriteKeys,
    toggleFavorite,
    aiReady,
    askAI: askAIAbout
  })

/** I4 动作面板过滤：底部过滤框词 → 过滤动作列表（Raycast ActionPanel 底部搜索语义） */
const actionFilter = ref('')
const actionFilterRef = ref<HTMLInputElement | null>(null)
const filteredPanelActions = computed(() => {
  const kw = actionFilter.value.trim().toLowerCase()
  if (!kw) return panelActions.value
  return panelActions.value.filter((a) => a.label.toLowerCase().includes(kw))
})
watch(actionFilter, () => {
  actionIndex.value = 0
})
// 面板打开时清空过滤并把焦点交给过滤框（Raycast 行为：呼出即可键入过滤）
watch(actionPanelEntry, (entry) => {
  actionFilter.value = ''
  if (entry) {
    void nextTick(() => actionFilterRef.value?.focus())
  }
})

/** 动作面板过滤框键盘：↑↓ 选择 / ↵ 执行 / Esc 关面板回主输入框 */
function onActionFilterKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const count = filteredPanelActions.value.length
    if (count === 0) return
    actionIndex.value =
      e.key === 'ArrowDown'
        ? Math.min(actionIndex.value + 1, count - 1)
        : Math.max(actionIndex.value - 1, 0)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    filteredPanelActions.value[actionIndex.value]?.run()
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    actionPanelEntry.value = null
    searchBarRef.value?.focus()
  }
}

/** Raycast 式分区（V5）：根态「建议」；查询态拆「结果/文件」。纯函数见 launcherInteractions。 */
const resultGroups = computed(() =>
  groupResultsForDisplay(results.value, Boolean(query.value.trim()))
)

/** 数字直达 + Pop to Root 活动监听共用的 window 级 keydown */
function onWindowKeydown(e: KeyboardEvent): void {
  noteActivity()
  handleDigitShortcut(e)
}

/** 数字直达：裸数字键执行根列表第 N 条（0 = 第 10 条）。
 * 仅根列表态生效；输入框聚焦时不拦截（数字仍作为搜索词输入）。 */
function handleDigitShortcut(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const index = digitToIndex(e.key)
  if (index === null) return
  if (firstPartyPage.value || pluginState.value.open) return
  if (actionPanelEntry.value || showShortcuts.value) return
  // 槽态里数字是**参数内容**，不是「执行第 N 条」：那会儿根列表整个藏着，
  // 而下面那句焦点比对靠的是搜索输入框——槽态下它没渲染，比出 null 永不相等
  if (argTarget.value) return
  if (document.activeElement === searchBarRef.value?.element()) return
  if (historyNavActive.value) return
  const item = results.value[index]
  if (!item) return
  e.preventDefault()
  selectedIndex.value = index
  void runEntry(item.entry)
}

/** 执行兜底命令 */
function runFallbackCommand(cmd: FallbackCommand): void {
  const action = cmd.action
  if (action.type === 'firstParty') {
    pushPage(action.page as FirstPartyPage)
    if (action.query) {
      if (action.page === 'ai') {
        // Quick AI 兜底：把当前搜索词交给 AI 页自动发送（一次直达）
        query.value = ''
        void nextTick(() => {
          const page = pageRef.value as unknown as { queueInitial?: (text: string) => void } | null
          page?.queueInitial?.(action.query as string)
        })
      } else {
        query.value = action.query
      }
    }
  } else if (action.type === 'searchFiles') {
    pushPage('files')
    query.value = action.query
  } else if (action.type === 'openUrl') {
    void window.api.system.openExternal(action.url)
    hideWindow()
  } else if (action.type === 'copyText') {
    navigator.clipboard.writeText(action.text).catch(() => {})
    hideWindow()
  }
}

// 输入变化：选中复位 + debounce 触发统一搜索；
// 用户键入（非历史导航回填）即退出历史导航（B1 ↑ 恢复搜索历史）
watch(query, (q) => {
  if (!historyNavApplying.value && historyNavActive.value) exitHistoryNav()
  selectedIndex.value = 0
  fallbackSelectedIndex.value = 0
  actionPanelEntry.value = null
  scheduleForQuery(q)
})

function moveSelection(delta: number): void {
  if (results.value.length === 0) return
  const next = (selectedIndex.value + delta + results.value.length) % results.value.length
  selectedIndex.value = next
  scrollSelectedIntoView(next)
}

function scrollSelectedIntoView(index: number): void {
  void nextTick(() => {
    // 分组渲染后 DOM 序 ≠ results 扁平序（文件分区会把靠后的文件行挪到组尾），
    // 用 data-index 精确定位，不依赖 DOM 顺序
    document
      .querySelector(`.launcher-result[data-index="${index}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

/** 主标题高亮区间换算回原文下标 */
function highlightParts(item: ScoredEntry): { before: string; hit: string; after: string } | null {
  if (!item.highlight) return null
  const { map } = normalizeWithMap(item.entry.title)
  const start = map[item.highlight.start] ?? 0
  const end = (map[item.highlight.end] ?? start) + 1
  const title = item.entry.title
  return {
    before: title.slice(0, start),
    hit: title.slice(start, end),
    after: title.slice(end)
  }
}

async function runSelected(): Promise<void> {
  // 插件打开期间搜索框是插件的副输入框，Enter 不执行本地结果
  if (pluginState.value.open) return
  const item = results.value[selectedIndex.value]
  if (item) await runEntry(item.entry)
}

/** React 表单提交（#11 M2）：值回传插件 onSubmit；胶囊保持可见（插件可再 renderView） */
async function submitPluginForm(values: Record<string, string | boolean>): Promise<void> {
  const form = pluginForm.value
  if (!form) return
  await window.api.launcher.pluginFormSubmit(values)
  pluginForm.value = null
}

function closePluginForm(): void {
  pluginForm.value = null
  void window.api.launcher.closePlugin()
}

async function runEntry(entry: CommandEntry): Promise<void> {
  // P2-9：最近搜索词 → 填入搜索框，不执行命令
  if (entry.action.type === 'searchQuery') {
    query.value = (entry.action as { query: string }).query
    searchBarRef.value?.focus()
    return
  }
  // 记录搜索历史（P2-9）：执行命令时把当前查询词记入历史
  if (query.value.trim()) {
    void window.api.searchHistory.add(query.value.trim()).catch(() => {})
  }
  await executeCommand(entry, {
    inMainWindow: false,
    close: hideWindow,
    openFirstParty: (page) => {
      exitArgSlots() // 内联页覆盖根列表：槽态与它互斥，留着 chip 就是挡住页面的一条填空栏
      pushPage(page)
      query.value = ''
      searchBarRef.value?.focus()
      // AI 预设命令：打开 AI 页后自动发送预设提示词 / 日报生成（V4 批次5）
      if (page === 'ai' && entry.key.startsWith('ai:')) {
        const preset = entry.key.replace('ai:', '')
        if (preset === 'pomodoroReport') {
          // 番茄钟日报：聚合今日数据 → AI 页排队生成（无今日数据时不发）
          void buildPomodoroDigest().then((digest) => {
            if (!digest) return
            void nextTick(() => {
              const aiPage = pageRef.value as unknown as {
                queueInitial?: (text: string) => void
              } | null
              aiPage?.queueInitial?.(digest)
            })
          })
        } else if (['translate', 'summarize', 'rewrite'].includes(preset)) {
          const typed = preset as 'translate' | 'summarize' | 'rewrite'
          void nextTick(() => {
            const aiPage = pageRef.value as unknown as {
              sendPreset?: (p: 'translate' | 'summarize' | 'rewrite') => void
            } | null
            aiPage?.sendPreset?.(typed)
          })
        }
      }
    },
    // 参数化 Quicklink（URL 含 {query}）：胶囊内弹参数表单，
    // 搜索词里标题之外的部分作为参数初值（"github react" → 预填 "react"）
    openQuicklinkArg,
    // MCP 工具（P-4②）：参数格与结果页都在胶囊里，两个入口都收在这一侧执行
    openMcpTool: (target) => openMcpTool(target),
    // 带参数声明的插件命令（多参数命令）：胶囊内逐参数填写后带参打开插件
    openPluginArg
  })
  if (entry.action.type === 'plugin') {
    if (pluginArgTarget.value) return // 已进入参数表单页，保留页栈
    // 刚进内联槽（P-1.6b）：这条命令还没执行，插件视图也没起来，什么都不该清
    if (argTarget.value === entry) return
    if (argTarget.value) exitArgSlots() // 槽态指向别的命令 = 现场已失效，留着就是一张没人能填的填空条
    pageStack.value = [] // 插件与内联页互斥
    query.value = ''
    return // 插件打开后胶囊窗保留，进入插件交互
  }
}

/** 创建日程表单提交：解析日期+时间+时长 → calendar.createEvent（主进程失败时弹系统通知） */
async function createCalendarEvent(values: Record<string, string | boolean>): Promise<void> {
  const title = String(values.title ?? '').trim()
  const date = String(values.date ?? '').trim()
  const time = String(values.time ?? '').trim()
  const durationLabel = String(values.duration ?? '1 小时')
  if (!title || !date) return // 留在表单

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!dateMatch || !timeMatch) return // 日期/时间不合法留在表单
  const start = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2])
  )
  if (Number.isNaN(start.getTime())) return
  const minutes =
    durationLabel === '30 分钟'
      ? 30
      : durationLabel === '90 分钟'
        ? 90
        : durationLabel === '2 小时'
          ? 120
          : 60
  const result = await window.api.calendar.createEvent({
    title,
    startMs: start.getTime(),
    endMs: start.getTime() + minutes * 60 * 1000
  })
  if (result.ok) {
    popToRoot()
  }
}

/**
 * 注册表能看到的胶囊现场（P-2④）。
 * 一律 getter/action：状态还归本组件，注册表只是「看着这份现场决定渲染谁」。
 */
const viewCtx: LauncherViewCtx = {
  query: () => query.value,
  clipFilter: () => clipFilter.value,
  setClipFilter: (v) => {
    clipFilter.value = v
  },
  hideWindow,
  popPage,
  onSnippetCopied,
  askAIWithText,
  createCalendarEvent: voidify(createCalendarEvent),
  saveQuicklinkForm: voidify(saveQuicklinkForm),
  // 注意两个同名接口：viewCtx 这条是 qlarg 表单的**提交**（FormValues）；「打开表单页」
  // 的入口（CommandEntry）在 executeCommand 依赖对象那边，两者曾经共用一个函数名
  openQuicklinkArg: submitQuicklinkArg,
  openPluginWithArgs,
  submitMcpArg,
  qlArgFields: () => qlArgFields.value,
  qlArgInitial: () => qlArgInitialMap.value,
  pluginArgFields: () => pluginArgFields.value,
  mcpArgFields: () => mcpArgFields.value,
  mcpArgInitial: () => mcpArgInitial.value,
  qlArgTarget: () => qlArgTarget.value,
  pluginArgTarget: () => pluginArgTarget.value,
  mcpArgTarget: () => mcpArgTarget.value,
  mcpCall: () => mcpCall.value,
  pluginForm: () => pluginForm.value,
  pluginList: () => declaredList.value,
  pluginId: () => pluginState.value.pluginId ?? '',
  pluginListLoading: () => declaredLoading.value,
  pluginListEmptyMessage: () => declaredEmptyMessage.value,
  submitPluginForm: voidify(submitPluginForm),
  closePluginForm
}

/** 这一次渲染哪个内联页（栈顶优先，栈空才轮到插件的声明式视图） */
const activeView = computed(() => pickPageView(firstPartyPage.value, viewCtx))

/** 键盘集中分发：ESC 三段式归胶囊；内联页打开时其余按键先交给页面；否则走根列表 */
function onKeydown(e: KeyboardEvent): void {
  // IME 组合态（中文输入法选拼音）：↑↓/Tab/Esc 是输入法自身的按键语义，
  // 全部放行——否则 ↑ 选候选词会触发历史导航回填、打断组合（中文用户高频路径）
  if (e.isComposing || e.keyCode === 229) return
  if (e.key === 'Escape') {
    e.preventDefault()
    // 动作面板打开时 ESC 只关面板
    if (actionPanelEntry.value) {
      actionPanelEntry.value = null
      searchBarRef.value?.focus()
      return
    }
    onEscape()
    return
  }
  if (firstPartyPage.value) {
    if (pageRef.value?.handleKey?.(e)) {
      e.preventDefault()
      e.stopPropagation()
    }
    return
  }
  // 插件已打开（传统模式，未提交 declaredList）：插件视图覆盖根结果列表，
  // 按键不应再作用于被遮挡的列表（否则 ⌘K/↑↓ 移动的是看不见的选中项）
  if (pluginState.value.open && !declaredList.value) {
    // 仅保留 ESC 的归胶囊职责（上方已处理）；其余按键交给插件副输入框
    return
  }
  // 声明式插件列表（M3.1）：↑↓/Enter/⌘数字 交给原生渲染的列表；
  // 字符输入不拦截，继续作为插件副输入框
  if (pluginState.value.open && declaredList.value) {
    if (pageRef.value?.handleKey?.(e)) {
      e.preventDefault()
      e.stopPropagation()
    }
    return
  }
  // P-1.2：修饰键二级动作直触（⌘⌫ 在 Finder 中显示 / ⌘⇧C 复制路径 / ⌘⇧V 粘贴回前台）。
  // 取「当前高亮条目」的动作集而非面板状态——面板没打开也要能按；键位由 PanelAction.key
  // 声明，命中判定在 modifierKeys.ts（纯函数，可单测）
  const modifierTarget = results.value[selectedIndex.value]?.entry ?? null
  const modifierHit = resolveModifierAction(actionsFor(modifierTarget), e)
  if (modifierHit) {
    e.preventDefault()
    e.stopPropagation()
    modifierHit.run()
    return
  }
  if (isReservedCombo(e)) {
    // 当前行没有这个动作，但组合已被占用：吞掉，别让它清掉查询词
    e.preventDefault()
  }
  // ⌘K：对选中结果呼出动作面板（M1.2）
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    const item = results.value[selectedIndex.value]
    if (item) {
      actionPanelEntry.value = item.entry
      actionIndex.value = 0
    }
    return
  }
  // 阶段5.2：⌘1-9 快捷执行对应位置的结果（Raycast 风格）
  if (e.metaKey && /^[1-9]$/.test(e.key)) {
    const index = parseInt(e.key) - 1
    const item = results.value[index]
    if (item) {
      e.preventDefault()
      selectedIndex.value = index
      void runEntry(item.entry)
    }
    return
  }
  // B1 · Tab Quick AI：输入框聚焦（本 handler 绑定于输入框）且非插件态、
  // 非速查面板态时，Tab 进入 AI 页并自动发送当前 query（复用兜底「询问 AI」
  // 的 queueInitial 排队）。速查面板打开时不拦截——否则 overlay 叠 AI 页成脏状态
  if (
    e.key === 'Tab' &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !pluginState.value.open &&
    !firstPartyPage.value &&
    !actionPanelEntry.value &&
    !showShortcuts.value
  ) {
    e.preventDefault()
    askAIWithQuery()
    return
  }
  if (actionPanelEntry.value) {
    const actions = filteredPanelActions.value
    if (actions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      actionIndex.value = Math.min(actionIndex.value + 1, actions.length - 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      actionIndex.value = Math.max(actionIndex.value - 1, 0)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      actions[actionIndex.value]?.run()
      return
    }
    return
  }
  // B1 · 搜索历史 ↑ 恢复：空查询按 ↑ 回填最近搜索词；激活后 ↑/↓ 循环导航。
  // 仅根列表态生效（插件/内联页/动作面板已在上方分支 return 或被排除）。
  // 无历史时不消费 ↑，保持原有「绕到列表末项」行为
  if (!pluginState.value.open && !firstPartyPage.value && !actionPanelEntry.value) {
    if (e.key === 'ArrowUp' && !query.value.trim() && !historyNavActive.value) {
      if (enterHistoryNav()) {
        e.preventDefault()
        return
      }
      // fallthrough：历史为空，交给下方通用 ↑ 导航
    } else if (historyNavActive.value && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      stepHistoryNav(e.key === 'ArrowUp' ? 'up' : 'down')
      return
    }
  }
  // Fallback Commands：搜索无结果时用 ↑↓ 导航兜底命令，Enter 执行
  const showFallback =
    query.value.trim() &&
    results.value.length === 0 &&
    !pluginState.value.open &&
    !firstPartyPage.value
  if (showFallback && fallbackCommands.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      fallbackSelectedIndex.value = Math.min(
        fallbackSelectedIndex.value + 1,
        fallbackCommands.value.length - 1
      )
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      fallbackSelectedIndex.value = Math.max(fallbackSelectedIndex.value - 1, 0)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = fallbackCommands.value[fallbackSelectedIndex.value]
      if (cmd) runFallbackCommand(cmd)
      return
    }
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveSelection(1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveSelection(-1)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    void runSelected()
    return
  }
  // 阶段5.3：? 键显示快捷键速查面板
  if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault()
    showShortcuts.value = !showShortcuts.value
    return
  }
}

/** 片段复制完成 → 反馈后收起胶囊（Raycast 的 copy-then-close） */
function onSnippetCopied(title: string): void {
  if (!title) return
  hideWindow()
}

/** Quicklink 表单提交（M5.2 Form 基元）：保存后提示并返回 */
async function saveQuicklinkForm(values: Record<string, string | boolean>): Promise<void> {
  const name = String(values.name ?? '').trim()
  const url = String(values.url ?? '').trim()
  if (!name || !/^https?:\/\//.test(url)) {
    // 校验失败：留在表单（焦点本就在表单字段，用户可直接修正）
    return
  }
  try {
    const list = (await window.api.launcher.quicklinksList()) as Array<{
      id: string
      name: string
      url: string
    }>
    list.push({ id: `ql-${Date.now().toString(36)}`, name, url })
    await window.api.launcher.quicklinksSave(list)
    await loadDynamicCommands()
    popPage()
    query.value = name // 搜出刚添加的链接（Raycast 提交后可见结果）
  } catch {
    /* 保存失败留在表单 */
  }
}

/** 搜索框输入：插件打开时转发 SubInputChange；键入重置 Pop to Root 计时（IME 兜底） */
function onInput(): void {
  noteActivity()
  if (pluginState.value.open) {
    window.api.launcher.input(query.value)
  }
}

/** 番茄钟日报数据聚合（V4 批次5）：今日 trend + 项目分布 → AI 提示词；无数据返回 null */
async function buildPomodoroDigest(): Promise<string | null> {
  try {
    const [trend, dist] = await Promise.all([
      window.api.pomodoro.stats.getDailyTrend(1),
      window.api.pomodoro.stats.getProjectDistribution(Date.now() - 86400000, Date.now())
    ])
    const today = trend[trend.length - 1]
    if (!today || (today.workMinutes === 0 && today.completedPomodoros === 0)) return null
    const projects = dist
      .filter((d) => d.workMinutes > 0)
      .map((d) => `${d.projectName} ${d.workMinutes} 分钟`)
      .join('、')
    return [
      '请基于我今天的番茄钟专注数据写一份简短日报（中文，3-5 句）：',
      '- 给出整体节奏点评',
      '- 给一条改进建议',
      '',
      `今日数据：完成番茄钟 ${today.completedPomodoros} 个，专注 ${today.workMinutes} 分钟，完成任务 ${today.completedTasks} 个${projects ? `；项目分布：${projects}` : ''}。`
    ].join('\n')
  } catch {
    return null
  }
}

// AI 的三个发送入口（askAIWithText/WithQuery/About）与 refreshAiReady 已抽至 useAiLaunch；
// 挂载补读一次配置态，另在面板打开后补读（补读对本次列表不生效，影响下一次打开）
void refreshAiReady()
watch(actionPanelEntry, (entry) => {
  if (entry) void refreshAiReady()
})

/** ESC：关插件 → 内联页逐级返回（M5.2 导航栈）→ 隐藏窗口 */
function onEscape(): void {
  // 槽态优先：Esc 先退出参数模式回到搜索，不是直接关窗
  if (argTarget.value) {
    exitArgSlots()
    return
  }
  if (pluginState.value.open) {
    // 插件自己压的层先退它（P-2④ 第二半）。顺序反了的后果很具体：用户在插件里
    // 按一次返回，整个插件被弹掉 —— 而他要的只是从详情页回到列表。
    if (pluginState.value.canGoBack) void window.api.launcher.popPluginView()
    else void window.api.launcher.closePlugin()
  } else if (firstPartyPage.value) {
    popPage()
    searchBarRef.value?.focus()
  } else {
    hideWindow()
  }
}

function hideWindow(): void {
  // Pop to Root 三态：immediately（缺省）隐藏即清栈；其余模式保留现场，
  // 唤起时按 shouldPopToRootOnShow 决定是否清（30s 间隔 / 手动）
  if (popToRootMode.value === 'immediately') {
    exitHistoryNav()
    query.value = ''
    selectedIndex.value = 0
    pageStack.value = []
    actionPanelEntry.value = null
    qlArgTarget.value = null
    argTarget.value = null
    argValues.value = []
    argIndex.value = 0
    argInvalid.value = []
    pluginArgTarget.value = null
  } else {
    lastHiddenAt = Date.now()
  }
  void window.api.launcher.hide()
}

// IPC 订阅退订函数集中保存，卸载时统一释放（常驻窗口下影响小，但生命周期要正确）
const unsubscribers: Array<() => void> = []
onUnmounted(() => {
  unsubscribers.forEach((fn) => fn())
  unsubscribers.length = 0
})

/* ── 紧凑模式（P-6⑤）：空查询时整窗收成一条栏 ──
 * 默认关：开着它空态那一屏（下一个会议、固定建议、最近搜索）就不显示了，
 * 那是另一格 Raycast 对齐拍板过的东西，不能被这个开关悄悄推翻，所以做成可选项。 */
const { compactModePref, start: startCapsuleAppearance } = useCapsuleAppearance({
  barOnly: () => barOnlyMode.value,
  barHeight: () => (searchBarRef.value as unknown as { barHeight(): number } | null)?.barHeight() ?? 0
})
const compactIdle = computed(
  () =>
    compactModePref.value &&
    !query.value.trim() &&
    !pluginState.value.open &&
    !firstPartyPage.value &&
    !actionPanelEntry.value &&
    !showShortcuts.value
)

/** 只占一条栏的高度：紧凑模式的空态，或正在搜索框里填参数（P-1.6b）。
 *  槽态必须收——不搜的话整窗是 64px 栏 + 456px 空白，正是紧凑模式要治的那个症状。 */
const barOnlyMode = computed(() => compactIdle.value || argModeOn.value)

onMounted(() => {
  // 密度档 / 玻璃档 / 紧凑模式：读偏好 → 应用到根元素（或上报主进程）→ 订阅变更，
  // 统一由 useCapsuleAppearance 管（C3-3 Step 1 从本文件抽出，现在可单测）。
  // 注意它在 onMounted 里调而不是 setup 期：内部的 watch 会立刻求值 barOnlyMode。
  unsubscribers.push(startCapsuleAppearance())
  searchBarRef.value?.focus()
  // I7 面包屑点击 = 逐级返回（CapsulePage 经 CustomEvent 上抛，页面无需各自接线）
  const onBreadcrumbPop = (): void => {
    noteActivity()
    if (pluginState.value.open || !firstPartyPage.value) return
    popPage()
    searchBarRef.value?.focus()
  }
  window.addEventListener('frond:launcher-pop', onBreadcrumbPop)
  unsubscribers.push(() => window.removeEventListener('frond:launcher-pop', onBreadcrumbPop))
  // 快捷键面板「按任意键关闭」：捕获阶段吞掉按键，避免面板开着时按键漏进底层输入框
  const onShortcutsAnyKey = (e: KeyboardEvent): void => {
    if (!showShortcuts.value) return
    e.preventDefault()
    e.stopPropagation()
    showShortcuts.value = false
  }
  window.addEventListener('keydown', onShortcutsAnyKey, { capture: true })
  unsubscribers.push(() =>
    window.removeEventListener('keydown', onShortcutsAnyKey, { capture: true })
  )
  // B1：数字直达 + Pop to Root 活动探测（键入/点击/鼠标移动/滚轮均重置 60s 计时）
  addWindowListener(unsubscribers, 'keydown', onWindowKeydown)
  addWindowListener(unsubscribers, 'mousedown', () => noteActivity())
  addWindowListener(unsubscribers, 'mousemove', onWindowMouseMove, { passive: true })
  addWindowListener(unsubscribers, 'wheel', () => noteActivity(), { passive: true })
  addDocumentListener(unsubscribers, 'visibilitychange', onVisibilityChangeForIdle)
  noteActivity()
  // 初始化：空查询展示建议
  resetToSuggestions()
  // 阶段1.1：加载统一 Command Registry（应用扫描慢批的重跑走 onSlowBatch 钩子——loadRegistryCommands 在快批后就 resolve，挂后面的时机是错的）
  void loadRegistryCommands()
  // 先注册订阅（同步），再异步加载数据——避免慢速 IO（应用扫描）阻塞监听注册
  void loadPopToRootMode()
  unsubscribers.push(
    window.api.launcher.onShown(() => {
      // Pop to Root 三态（V4 P0-3）：immediately 唤起即回根（Raycast 缺省行为）；
      // afterInterval 30s 内保留现场；manually 永不自动清。数据加载始终执行。
      const cycle = beginShowCycle()
      void loadPopToRootMode().then(() => {
        // 这一轮唤起里有人**显式**要过页面（⌘K 转交的 MCP 调用、openFirstParty）：
        // 那是比「唤起即回根」更新的用户意图。只让开这四行——后面的焦点、刷新、
        // 槽态清理照做（早退会把整块都跳掉，那是一次「什么都不刷新」的隐蔽回归）
        const keepRequestedPage = pushedSince(cycle)
        if (
          !keepRequestedPage &&
          shouldPopToRootOnShow(popToRootMode.value, lastHiddenAt, Date.now())
        ) {
          query.value = ''
          selectedIndex.value = 0
          pageStack.value = [] // 每次唤起回到根态（Raycast 行为）
          actionPanelEntry.value = null
          exitHistoryNav() // B1：唤起复位历史导航态
        }
        lastHiddenAt = null
        // 槽态不能跨隐藏留着：这次隐藏可能是失焦（主进程直接 hide()，不走 hideWindow），
        // 回来时查询词已被清掉，chip 还在就等于挂着一条指向不明命令的填空条
        exitArgSlots()
        searchBarRef.value?.focus()
        noteActivity() // B1：Pop to Root 计时从唤起重新开始
        // 常驻窗口：每次唤起刷新插件命令与建议（管理页装/停插件后立即生效）
        void loadRegistryCommands().then(() => enrichAliases())
        void loadPluginCommands().then(() => enrichAliases())
        // 工具清单缓存变便宜（一次 pref 读），每次唤起顺手重拉：
        // 连上服务器再回胶囊这条路本来就靠「唤起即重拉」，不靠推送也能对上
        void loadMcpCommands().then(() => enrichAliases())
        void loadPluginSearchItems()
        void loadFallbackConfig()
        void refreshSuggestions().then(() => {
          if (!query.value.trim()) resetToSuggestions()
        })
        void refreshRecentUsage()
      })
    })
  )
  // ⌘K 等外部入口打开第一方内联页（主进程唤起胶囊后转发）
  unsubscribers.push(
    window.api.launcher.onOpenFirstParty((page) => {
      exitArgSlots() // 外部入口（⌘K）插进来的页覆盖根列表：槽态与它互斥
      pushPage(page)
      query.value = ''
      searchBarRef.value?.focus()
    })
  )
  // ⌘K 面板把 MCP 调用转交过来（那边既没有参数格也没有结果页）：
  // 按它给的清单现场重建成一条命令，再走与胶囊回车完全同一条路
  unsubscribers.push(
    window.api.launcher.onRunMcpTool((p) => {
      const specs = (p.argSpecs ?? []) as McpToolArg[]
      const entry: CommandEntry = {
        key: `mcp:${p.serverId}:${p.tool}`,
        icon: 'tools',
        title: p.tool,
        subtitle: p.serverLabel,
        badge: 'MCP',
        acceptsArgs: specs.length > 0,
        action: {
          type: 'mcpTool',
          serverId: p.serverId,
          serverLabel: p.serverLabel,
          tool: p.tool,
          args: specs
        }
      }
      exitArgSlots() // 与 onOpenFirstParty 同一条规矩：内联页覆盖根列表，槽态与它互斥
      openMcpTool(entry)
      searchBarRef.value?.focus()
    })
  )
  // 握手：挂载后主动拉一次状态，兜住 mount 前丢失的一次性推送
  void window.api.launcher.getPluginState().then((state) => {
    if (state && state.open) {
      pluginState.value = state
      declaredList.value = (state.declaredList as PluginListItem[]) ?? null
      declaredLoading.value = state.declaredLoading === true
      declaredEmptyMessage.value = state.declaredEmptyMessage ?? null
      pluginForm.value = (state.declaredForm as PluginForm) ?? null
      searchBarRef.value?.focus()
    }
  })
  unsubscribers.push(
    window.api.launcher.onPluginChanged((state) => {
      const wasOpen = pluginState.value.open
      const wasTakenOver = tookSearchBox(pluginState.value)
      pluginState.value = state
      // 声明式列表随插件状态同步（关闭即清空）；表单视图同步（#11 M2）
      declaredList.value = state.open ? ((state.declaredList as PluginListItem[]) ?? null) : null
      declaredLoading.value = state.open && state.declaredLoading === true
      declaredEmptyMessage.value = state.open ? (state.declaredEmptyMessage ?? null) : null
      pluginForm.value = state.open ? ((state.declaredForm as PluginForm) ?? null) : null
      if (state.open && !wasOpen) {
        // 进入插件**且它真接管了胶囊**才清搜索词：Action 命令（headless）跑完就走，
        // 清词等于把用户刚搜出来的那一屏抹掉——Raycast 的 action 不碰搜索框
        if (tookSearchBox(state)) {
          query.value = ''
          searchBarRef.value?.focus()
        }
      } else if (!state.open) {
        // 插件关闭：只有它生前占过搜索框，才需要把界面恢复成默认态
        if (wasTakenOver) query.value = ''
        searchBarRef.value?.focus()
      }
      // placeholder 更新等其余情况不动焦点，避免抢插件视图的交互
    })
  )
  // 声明式插件视图（列表/表单）只走 onPluginChanged 的整份快照：两条独立推送
  // 会让同一次更新过两遍 IPC，且后到的列表/placeholder 会把表单清掉
  // #5 插件双通道：searchable 插件提交新条目集 → 刷新合并缓存（当前查询激活则重跑）
  unsubscribers.push(
    window.api.launcher.onPluginSearchIndexUpdated(() => {
      // 重跑当前查询必须排在**拉取之后**：并行的话这一跑用的还是旧条目集，
      // 表现就是「插件提交了新条目，但搜索框里要再敲一个字才看得到」
      void loadPluginSearchItems().then(() => rerunSearch())
    })
  )
  // 命令表变了（插件装 / 卸 / 启停 / 市场更新，以及 MCP 工具清单变化）：
  // 两路都要重拉——以前只重拉插件那一路，于是「在设置页连上服务器，回到搜索框搜不到工具，
  // 收起再唤起才有」这条老毛病换到 MCP 身上又犯了一遍
  unsubscribers.push(
    window.api.launcher.onCommandTableChanged(() => {
      // MCP 那一路不能漏（注释说的「以及 MCP 工具清单变化」曾只停留在注释上）：
      // 推送一次 pref 读，代价可忽略；漏了就是「连上服务器回到搜索框搜不到工具」
      void Promise.all([loadPluginCommands(), loadRegistryCommands(), loadMcpCommands()]).then(
        async () => {
          await enrichAliases()
          rerunSearch()
        }
      )
    })
  )

  // 插件 showHud（spec 3.3）：瞬时事件不进快照，独立通道直打 HUD 组件
  unsubscribers.push(
    window.api.launcher.onPluginHud(({ title }) => {
      pluginHud.value?.show(title)
    })
  )

  void (async () => {
    try {
      // 阶段1.1：应用命令已迁移到 ApplicationCommandProvider
      await loadRegistryCommands()
      await enrichAliases()
    } catch {
      /* Registry 加载失败不阻塞 */
    }
  })()
  void loadPluginCommands().then(() => enrichAliases())
  void loadMcpCommands().then(() => enrichAliases())
  void loadDynamicCommands().then(() => enrichAliases())
  // 冷启动这一屏不能只依赖 launcher:shown：主进程的补发挂在 did-finish-load，
  // 那可能早于组件注册监听（Vue 还没挂载），事件就没人接了 → 空态整片空白。
  void refreshSuggestions().then(() => {
    if (!query.value.trim()) resetToSuggestions()
  })
  void refreshRecentUsage()
  void loadFallbackConfig()
})
</script>

<style scoped>
.launcher {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: var(--launcher-radius);
  overflow: hidden;
  border: 1px solid var(--launcher-border);
  /* 玻璃档（P-6）：变量没设时兜底回原 token，默认档下计算值与改动前一致 */
  background: var(--frond-capsule-bg, var(--launcher-bg));
  backdrop-filter: var(--frond-capsule-blur, var(--launcher-blur));
  -webkit-backdrop-filter: var(--frond-capsule-blur, var(--launcher-blur));
  box-shadow: var(--launcher-shadow);
  box-sizing: border-box;
  position: relative;
}

/* 搜索输入区已拆到 LauncherSearchBar.vue（P-1.6b 前置），样式跟着模板走了 */
.launcher-busy {
  position: absolute;
  top: var(--launcher-search-height);
  left: 0;
  right: 0;
  height: 2px;
  overflow: hidden;
  z-index: 25;
  pointer-events: none;
}

/* keep-open 指示点：贴窗口右上角（fixed 不依赖祖先定位，胶囊窗本身就是视口） */
.launcher-pinned-dot {
  position: fixed;
  top: 8px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--launcher-accent);
  z-index: 30;
  pointer-events: none;
}

.launcher-busy-bar {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 30%;
  border-radius: 2px;
  background: var(--launcher-accent);
  animation: launcher-busy-slide 1.1s ease-in-out infinite;
}

@keyframes launcher-busy-slide {
  0% {
    left: -30%;
  }
  100% {
    left: 100%;
  }
}

/* ── 动作面板（I4：Raycast 化——右锚定浮层 ~460px、动作行图标+键帽、底部过滤框）── */
.launcher-actions {
  position: absolute;
  top: calc(var(--launcher-search-height) + 4px);
  right: 12px;
  z-index: 20;
  width: 460px;
  max-height: 380px;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid var(--launcher-border);
  background: var(--launcher-popover-bg);
  backdrop-filter: var(--launcher-blur);
  -webkit-backdrop-filter: var(--launcher-blur);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  padding: 6px;
  box-sizing: border-box;
}

.launcher-actions-title {
  padding: 4px 10px 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--launcher-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.launcher-actions-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.launcher-action {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--launcher-text-dim);
  cursor: pointer;
}

.launcher-action.selected {
  background: var(--launcher-selected-bg);
  color: var(--launcher-text);
}

.launcher-action-icon {
  color: var(--launcher-text-muted);
  flex-shrink: 0;
}

.launcher-action.selected .launcher-action-icon {
  color: var(--launcher-accent);
}

.launcher-action-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.launcher-action-keys {
  font-family: inherit;
  font-size: 11px;
  color: var(--launcher-text-dim);
  border: 1px solid var(--launcher-border);
  border-radius: 4px;
  padding: 2px 6px;
  background: var(--frond-capsule-bg-elevated, var(--launcher-bg-elevated));
  flex-shrink: 0;
}

.launcher-actions-empty {
  padding: 14px 10px;
  font-size: 12px;
  color: var(--launcher-text-faint);
  text-align: center;
}

.launcher-actions-filter {
  flex-shrink: 0;
  margin-top: 6px;
  height: 32px;
  border: 1px solid var(--launcher-hairline);
  outline: none;
  background: var(--launcher-input-bg);
  color: var(--launcher-text);
  font-size: 13px;
  border-radius: 7px;
  padding: 0 10px;
  box-sizing: border-box;
}

.launcher-actions-filter::placeholder {
  color: var(--launcher-text-faint);
}

/* ── 结果列表 + 详情面板（List-Detail） ── */
.launcher-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.launcher-results {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  min-width: 0;
}

.launcher-results.has-detail {
  border-right: 1px solid var(--launcher-hairline);
}

.launcher-detail {
  width: var(--launcher-detail-width);
  flex-shrink: 0;
  overflow: hidden;
  background: var(--frond-capsule-bg-elevated, var(--launcher-bg-elevated));
}

.launcher-detail-loading-text {
  padding: 16px;
  font-size: 12px;
  color: var(--launcher-text-muted);
}

.launcher-section-label {
  padding: var(--frond-section-gap, 6px) 16px 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--launcher-text-muted);
}

.launcher-result {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  /* 密度档（P-6 Compact Mode）由根元素上的 CSS 变量给；这里的兜底值就是 comfortable */
  padding: var(--frond-row-pad-y, 8px) 16px;
  min-height: var(--frond-row-min-h, 38px);
  box-sizing: border-box;
  cursor: pointer;
  transition: background 0.1s ease;
}

.launcher-result.selected {
  background: var(--launcher-selected-bg);
}

.launcher-result-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 5px;
  color: var(--text-inverse);
}

.launcher-result-icon-svg {
  filter: brightness(0) invert(1);
}

.launcher-result-favicon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  border-radius: 4px;
}

.launcher-result-text {
  flex: 1;
  min-width: 0;
}

.launcher-result-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.launcher-result-title .hl {
  color: var(--launcher-accent);
  font-weight: 600;
}

.launcher-result-subtitle {
  font-size: 12px;
  color: var(--launcher-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.launcher-result-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.launcher-result-badge {
  font-size: 11px;
  color: var(--launcher-accent);
  font-weight: 500;
}

.launcher-result-quick {
  font-size: 10px;
  color: var(--launcher-text-muted);
  font-family: inherit;
  font-weight: 500;
  min-width: 18px;
  text-align: center;
  padding: 1px 0;
  border-radius: 4px;
  background: var(--frond-capsule-bg-elevated, var(--launcher-bg-elevated));
}

.launcher-result.selected .launcher-result-quick {
  color: var(--launcher-text-dim);
}

/* ── 空态 + Fallback Commands ── */
.launcher-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 10px;
  padding: 16px 12px;
  overflow-y: auto;
}

.launcher-empty-text {
  font-size: 13px;
  color: var(--launcher-text-muted);
  text-align: center;
  padding: 4px 0;
}

.launcher-fallback-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.launcher-fallback-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}

.launcher-fallback-item:hover,
.launcher-fallback-item.selected {
  background: var(--launcher-result-hover);
}

.launcher-fallback-icon {
  color: var(--launcher-text-muted);
  flex-shrink: 0;
}

.launcher-fallback-item.selected .launcher-fallback-icon {
  color: var(--launcher-accent);
}

/* Quick AI 兜底项视觉强调 */
.launcher-fallback-item.ai-emphasis .launcher-fallback-title {
  color: var(--launcher-accent);
}

.launcher-fallback-item.ai-emphasis.selected {
  background: var(--launcher-accent-soft);
}

.launcher-fallback-item.ai-emphasis.selected .launcher-fallback-title {
  color: var(--launcher-accent);
}

.launcher-fallback-text {
  flex: 1;
  min-width: 0;
}

.launcher-fallback-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.launcher-fallback-subtitle {
  font-size: 11px;
  color: var(--launcher-text-muted);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.launcher-fallback-badge {
  font-size: 10px;
  color: var(--launcher-text-faint);
  background: var(--launcher-badge-bg);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.launcher-empty-ai {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  border: 1px solid var(--launcher-accent-strong);
  border-radius: 8px;
  background: var(--launcher-accent-soft);
  color: var(--launcher-accent);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.launcher-empty-ai:hover {
  background: var(--launcher-accent-strong);
}

/* ── 底部操作栏 ── */
.launcher-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--launcher-hairline);
  flex-shrink: 0;
  min-height: var(--launcher-footer-height);
  box-sizing: border-box;
}

.launcher-footer-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--launcher-text-muted);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s ease;
}

.launcher-footer-menu:hover {
  background: var(--launcher-selected-bg);
  color: var(--launcher-text);
}

.launcher-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.launcher-footer-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  border: 1px solid var(--launcher-border);
  background: var(--frond-capsule-bg-elevated, var(--launcher-bg-elevated));
  color: var(--launcher-text-dim);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 0 10px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: all 0.1s ease;
  box-sizing: border-box;
}

.launcher-footer-btn:hover {
  background: var(--launcher-result-hover);
  color: var(--launcher-text);
}

.launcher-footer-btn kbd {
  font-family: inherit;
  font-size: 10px;
  color: var(--launcher-text-muted);
  border: 1px solid var(--launcher-border);
  border-radius: 4px;
  padding: 1px 5px;
  background: var(--frond-capsule-bg-elevated, var(--launcher-bg-elevated));
}

/* ── 快捷键速查面板 ── */
.shortcuts-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}

.shortcuts-panel {
  background: var(--frond-capsule-bg-elevated, var(--launcher-bg-elevated));
  border: 1px solid var(--launcher-border);
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  min-width: 320px;
}

.shortcuts-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--launcher-text);
  margin-bottom: 16px;
  text-align: center;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 20px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--launcher-text-dim);
}

.shortcut-item kbd {
  font-family: inherit;
  font-size: 10px;
  color: var(--launcher-text-dim);
  border: 1px solid var(--launcher-border);
  border-radius: 4px;
  padding: 2px 6px;
  background: var(--frond-capsule-bg-elevated, var(--launcher-bg-elevated));
  min-width: 20px;
  text-align: center;
}

.shortcuts-hint {
  margin-top: 16px;
  font-size: 11px;
  color: var(--launcher-text-faint);
  text-align: center;
}
</style>

import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/LauncherApp.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import AppIcon from "/src/components/AppIcon.vue";
import {
  buildQuicklinkUrl,
  buildQuicklinkUrlMulti,
  quicklinkArgNames,
  FIRST_PARTY_COMMANDS
} from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/commands.ts";
import { normalizeWithMap } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/search.ts?t=1789709850689";
import {
  DEFAULT_FALLBACK_COMMANDS,
  renderFallbackCommand
} from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/fallbackCommands.ts";
import { useUsageBoost } from "/src/composables/useUsageBoost.ts";
import { executeCommand } from "/src/utils/commandRunner.ts";
import DetailPanel from "/src/launcher/components/DetailPanel.vue";
import {
  addDocumentListener,
  addWindowListener,
  digitToIndex,
  groupResultsForDisplay,
  primaryActionLabel
} from "/src/launcher/composables/launcherInteractions.ts";
import {
  FIRST_PARTY_PAGE_TITLES,
  providePageTitle,
  useLauncherPages
} from "/src/launcher/composables/useLauncherPages.ts";
import { useLauncherBusy } from "/src/launcher/composables/useLauncherBusy.ts";
import { useSearchHistoryNav } from "/src/launcher/composables/useSearchHistoryNav.ts";
import { useIdleWatcher } from "/src/launcher/composables/useIdleWatcher.ts";
import { useCommandSources, moduleToEntry } from "/src/launcher/composables/useCommandSources.ts";
import { useUnifiedSearch } from "/src/launcher/composables/useUnifiedSearch.ts?t=1789709850689";
import { useActionPanel } from "/src/launcher/composables/useActionPanel.ts";
import FocusPage from "/src/launcher/pages/FocusPage.vue";
import SnippetsPage from "/src/launcher/pages/SnippetsPage.vue?t=1789709850689";
import ClipboardPage from "/src/launcher/pages/ClipboardPage.vue";
import ShotsIndexPage from "/src/launcher/pages/ShotsIndexPage.vue";
import SchedulePage from "/src/launcher/pages/SchedulePage.vue";
import FocusStatsPage from "/src/launcher/pages/FocusStatsPage.vue";
import PluginListPage from "/src/launcher/pages/PluginListPage.vue";
import FilesPage from "/src/launcher/pages/FilesPage.vue";
import SettingsPage from "/src/launcher/pages/SettingsPage.vue";
import FormPage from "/src/launcher/pages/FormPage.vue";
import AIChatPage from "/src/launcher/pages/AIChatPage.vue";
import BrowserTabsPage from "/src/launcher/pages/BrowserTabsPage.vue";
import SystemInfoPage from "/src/launcher/pages/SystemInfoPage.vue";
import WindowSwitcherPage from "/src/launcher/pages/WindowSwitcherPage.vue";
import TrashPage from "/src/launcher/pages/TrashPage.vue";
import DictionaryPage from "/src/launcher/pages/DictionaryPage.vue";
import NotesPage from "/src/launcher/pages/NotesPage.vue";
import ReminderPage from "/src/launcher/pages/ReminderPage.vue";
import CalendarPage from "/src/launcher/pages/CalendarPage.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "LauncherApp",
  setup(__props, { expose: __expose }) {
    __expose();
    const query = ref("");
    const selectedIndex = ref(0);
    const fallbackSelectedIndex = ref(0);
    const inputRef = ref(null);
    const showShortcuts = ref(false);
    const { pageStack, firstPartyPage, pageRef, pushPage, popPage } = useLauncherPages();
    providePageTitle(
      computed(() => firstPartyPage.value ? FIRST_PARTY_PAGE_TITLES[firstPartyPage.value] : null)
    );
    const clipFilter = ref("all");
    const { busyCount } = useLauncherBusy();
    const pluginState = ref({ open: false, pluginId: null, pluginName: null, subInputPlaceholder: null });
    const declaredList = ref(null);
    const {
      historyCache,
      historyNavActive,
      historyNavApplying,
      exitHistoryNav,
      enterHistoryNav,
      stepHistoryNav
    } = useSearchHistoryNav(query);
    const {
      registryCommands,
      loadRegistryCommands,
      loadDynamicCommands,
      loadPluginCommands,
      enrichAliases,
      faviconOf,
      iconBg,
      entries
    } = useCommandSources();
    const suggestions = ref([]);
    async function fetchNextMeetingEntry() {
      try {
        const { auth, next } = await window.api.calendar.next();
        if (auth !== "authorized" || !next?.meeting) return null;
        const start = new Date(next.startMs);
        const hm = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
        return {
          key: "cal:next",
          icon: "calendar-line",
          title: `${hm} ${next.title}`,
          subtitle: `日程 · ${next.meeting.provider}`,
          badge: "会议",
          action: { type: "openUrl", url: next.meeting.url }
        };
      } catch {
        return null;
      }
    }
    async function refreshSuggestions() {
      const seen = /* @__PURE__ */ new Set();
      const list = [];
      const meeting = await fetchNextMeetingEntry();
      if (meeting) {
        seen.add(meeting.key);
        list.push(meeting);
      }
      for (const entry of FIRST_PARTY_COMMANDS) {
        if (!seen.has(entry.key)) {
          seen.add(entry.key);
          list.push(entry);
        }
      }
      try {
        const [recentIds, favIds] = await Promise.all([
          // frecency 全类型后记录含 app:/syscmd: 等非模块 key：多取一些，
          // 只让能映射成模块条目的前 6 个占用建议位
          window.api.usage.getRecent(20),
          window.api.usage.getFavorites()
        ]);
        let recentTaken = 0;
        for (const raw of recentIds) {
          if (recentTaken >= 6) break;
          const e = moduleToEntry(raw);
          if (!e || seen.has(e.key)) continue;
          seen.add(e.key);
          list.push(e);
          recentTaken++;
        }
        for (const raw of favIds) {
          const e = moduleToEntry(raw);
          if (!e || seen.has(e.key)) continue;
          seen.add(e.key);
          list.push(e);
        }
      } catch {
      }
      try {
        const history = await window.api.searchHistory.get();
        historyCache.value = history;
        for (const q of history.slice(0, 5)) {
          const key = `history:${q}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({
              key,
              icon: "history-line",
              title: q,
              subtitle: "最近搜索",
              badge: "最近搜索",
              action: { type: "searchQuery", query: q }
            });
          }
        }
      } catch {
      }
      suggestions.value = list.slice(0, 10).map((entry) => ({ entry, highlight: null, score: 0 }));
    }
    const { refresh: refreshRecentUsage, boost: usageBoost } = useUsageBoost();
    const { results, scheduleForQuery, resetToSuggestions } = useUnifiedSearch({
      entries: () => entries.value,
      usageBoost,
      suggestions
    });
    const currentDetail = computed(() => {
      const item = results.value[selectedIndex.value];
      if (!item) return null;
      const cmd = registryCommands.value.find((c) => c.id === item.entry.key);
      if (!cmd?.detail) return null;
      return typeof cmd.detail === "function" ? null : cmd.detail;
    });
    const searchPlaceholder = computed(() => {
      if (firstPartyPage.value === "focus") return "回车 开始 / 暂停专注";
      if (firstPartyPage.value === "snippets") return "搜索片段…";
      if (firstPartyPage.value === "schedule") return "浏览未来 7 天日程…";
      if (firstPartyPage.value === "shots") return "按文件名或图内文字搜索截图…";
      if (firstPartyPage.value === "clips") return "浏览剪贴板历史…";
      if (firstPartyPage.value === "focusStats") return "专注统计速览";
      if (firstPartyPage.value === "files") return "搜索文件名…";
      if (firstPartyPage.value === "notes") return "搜索或新建笔记…";
      if (firstPartyPage.value === "ai") return "输入问题，回车发送…";
      return pluginState.value.subInputPlaceholder ?? "搜索应用、命令、文件…";
    });
    const primaryLabel = computed(() => {
      const item = results.value[selectedIndex.value];
      return primaryActionLabel(item?.entry.action.type);
    });
    const fallbackDisabled = ref([]);
    async function loadFallbackDisabled() {
      try {
        fallbackDisabled.value = await window.api.preferences.getFallbackDisabled();
      } catch {
      }
    }
    const fallbackCommands = computed(() => {
      const q = query.value.trim();
      if (!q) return [];
      return DEFAULT_FALLBACK_COMMANDS.filter((cmd) => !fallbackDisabled.value.includes(cmd.id)).map(
        (cmd) => renderFallbackCommand(cmd, q)
      );
    });
    const qlArgTarget = ref(null);
    const qlArgInitial = ref("");
    const qlArgFields = computed(() => {
      const t = qlArgTarget.value;
      if (!t || t.action.type !== "quicklink") return [];
      const names = quicklinkArgNames(t.action.url);
      if (names.length > 0) return names.map((n) => ({ key: n, label: n }));
      return [{ key: "query", label: "参数" }];
    });
    function popToRoot() {
      exitHistoryNav();
      showShortcuts.value = false;
      actionPanelEntry.value = null;
      qlArgTarget.value = null;
      if (pluginState.value.open) void window.api.launcher.closePlugin();
      query.value = "";
      selectedIndex.value = 0;
      fallbackSelectedIndex.value = 0;
      pageStack.value = [];
      resetToSuggestions();
    }
    const { noteActivity, onVisibilityChangeForIdle, onWindowMouseMove } = useIdleWatcher(popToRoot);
    const { actionPanelEntry, actionIndex, panelActions, toggleActionPanel } = useActionPanel({
      results,
      selectedIndex,
      runEntry,
      hideWindow
    });
    const actionFilter = ref("");
    const actionFilterRef = ref(null);
    const filteredPanelActions = computed(() => {
      const kw = actionFilter.value.trim().toLowerCase();
      if (!kw) return panelActions.value;
      return panelActions.value.filter((a) => a.label.toLowerCase().includes(kw));
    });
    watch(actionFilter, () => {
      actionIndex.value = 0;
    });
    watch(actionPanelEntry, (entry) => {
      actionFilter.value = "";
      if (entry) {
        nextTick(() => actionFilterRef.value?.focus());
      }
    });
    function onActionFilterKeydown(e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const count = filteredPanelActions.value.length;
        if (count === 0) return;
        actionIndex.value = e.key === "ArrowDown" ? Math.min(actionIndex.value + 1, count - 1) : Math.max(actionIndex.value - 1, 0);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        filteredPanelActions.value[actionIndex.value]?.run();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        actionPanelEntry.value = null;
        inputRef.value?.focus();
      }
    }
    const resultGroups = computed(
      () => groupResultsForDisplay(results.value, Boolean(query.value.trim()))
    );
    function onWindowKeydown(e) {
      noteActivity();
      handleDigitShortcut(e);
    }
    function handleDigitShortcut(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const index = digitToIndex(e.key);
      if (index === null) return;
      if (firstPartyPage.value || pluginState.value.open) return;
      if (actionPanelEntry.value || showShortcuts.value) return;
      if (document.activeElement === inputRef.value) return;
      if (historyNavActive.value) return;
      const item = results.value[index];
      if (!item) return;
      e.preventDefault();
      selectedIndex.value = index;
      void runEntry(item.entry);
    }
    function runFallbackCommand(cmd) {
      const action = cmd.action;
      if (action.type === "firstParty") {
        pushPage(action.page);
        if (action.query) {
          if (action.page === "ai") {
            query.value = "";
            nextTick(() => {
              const page = pageRef.value;
              page?.queueInitial?.(action.query);
            });
          } else {
            query.value = action.query;
          }
        }
      } else if (action.type === "searchFiles") {
        pushPage("files");
        query.value = action.query;
      } else if (action.type === "openUrl") {
        void window.api.system.openExternal(action.url);
        hideWindow();
      } else if (action.type === "copyText") {
        navigator.clipboard.writeText(action.text).catch(() => {
        });
        hideWindow();
      }
    }
    watch(query, (q) => {
      if (!historyNavApplying.value && historyNavActive.value) exitHistoryNav();
      selectedIndex.value = 0;
      fallbackSelectedIndex.value = 0;
      actionPanelEntry.value = null;
      scheduleForQuery(q);
    });
    function moveSelection(delta) {
      if (results.value.length === 0) return;
      const next = (selectedIndex.value + delta + results.value.length) % results.value.length;
      selectedIndex.value = next;
      scrollSelectedIntoView(next);
    }
    function scrollSelectedIntoView(index) {
      nextTick(() => {
        document.querySelector(`.launcher-result[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
      });
    }
    function highlightParts(item) {
      if (!item.highlight) return null;
      const { map } = normalizeWithMap(item.entry.title);
      const start = map[item.highlight.start] ?? 0;
      const end = (map[item.highlight.end] ?? start) + 1;
      const title = item.entry.title;
      return {
        before: title.slice(0, start),
        hit: title.slice(start, end),
        after: title.slice(end)
      };
    }
    async function runSelected() {
      if (pluginState.value.open) return;
      const item = results.value[selectedIndex.value];
      if (item) await runEntry(item.entry);
    }
    async function runEntry(entry) {
      if (entry.action.type === "searchQuery") {
        query.value = entry.action.query;
        inputRef.value?.focus();
        return;
      }
      if (query.value.trim()) {
        void window.api.searchHistory.add(query.value.trim()).catch(() => {
        });
      }
      await executeCommand(entry, {
        inMainWindow: false,
        close: hideWindow,
        openFirstParty: (page) => {
          pushPage(page);
          query.value = "";
          inputRef.value?.focus();
          if (page === "ai" && entry.key.startsWith("ai:")) {
            const preset = entry.key.replace("ai:", "");
            if (preset === "pomodoroReport") {
              void buildPomodoroDigest().then((digest) => {
                if (!digest) return;
                nextTick(() => {
                  const aiPage = pageRef.value;
                  aiPage?.queueInitial?.(digest);
                });
              });
            } else if (["translate", "summarize", "rewrite"].includes(preset)) {
              const typed = preset;
              nextTick(() => {
                const aiPage = pageRef.value;
                aiPage?.sendPreset?.(typed);
              });
            }
          }
        },
        // 参数化 Quicklink（URL 含 {query}）：胶囊内弹参数表单，
        // 搜索词里标题之外的部分作为参数初值（"github react" → 预填 "react"）
        openQuicklinkArg: (target) => {
          qlArgTarget.value = target;
          const q = query.value.trim();
          const t = target.title.toLowerCase();
          qlArgInitial.value = q.toLowerCase().startsWith(t) ? q.slice(target.title.length).trim() : "";
          pushPage("qlarg");
          query.value = "";
          inputRef.value?.focus();
        }
      });
      if (entry.action.type === "plugin") {
        pageStack.value = [];
        query.value = "";
        return;
      }
    }
    async function createCalendarEvent(values) {
      const title = String(values.title ?? "").trim();
      const date = String(values.date ?? "").trim();
      const time = String(values.time ?? "").trim();
      const durationLabel = String(values.duration ?? "1 小时");
      if (!title || !date) return;
      const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
      if (!dateMatch || !timeMatch) return;
      const start = new Date(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3]),
        Number(timeMatch[1]),
        Number(timeMatch[2])
      );
      if (Number.isNaN(start.getTime())) return;
      const minutes = durationLabel === "30 分钟" ? 30 : durationLabel === "90 分钟" ? 90 : durationLabel === "2 小时" ? 120 : 60;
      const result = await window.api.calendar.createEvent({
        title,
        startMs: start.getTime(),
        endMs: start.getTime() + minutes * 60 * 1e3
      });
      if (result.ok) {
        popToRoot();
      }
    }
    function openQuicklinkArg(values) {
      const target = qlArgTarget.value;
      if (!target || target.action.type !== "quicklink") return;
      const url = target.action.url;
      const names = quicklinkArgNames(url);
      if (names.length > 0) {
        const vals = {};
        for (const n of names) {
          const v = String(values[n] ?? "").trim();
          if (!v) return;
          vals[n] = v;
        }
        void window.api.system.openExternal(buildQuicklinkUrlMulti(url, vals));
        hideWindow();
        return;
      }
      const arg = String(values.query ?? "").trim();
      if (!arg) return;
      const built = buildQuicklinkUrl(url, arg);
      void window.api.system.openExternal(built);
      hideWindow();
    }
    function onKeydown(e) {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (actionPanelEntry.value) {
          actionPanelEntry.value = null;
          inputRef.value?.focus();
          return;
        }
        onEscape();
        return;
      }
      if (firstPartyPage.value) {
        if (pageRef.value?.handleKey(e)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (pluginState.value.open && !declaredList.value) {
        return;
      }
      if (pluginState.value.open && declaredList.value) {
        if (pageRef.value?.handleKey(e)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        const item = results.value[selectedIndex.value];
        if (item) {
          actionPanelEntry.value = item.entry;
          actionIndex.value = 0;
        }
        return;
      }
      if (e.metaKey && /^[1-9]$/.test(e.key)) {
        const index = parseInt(e.key) - 1;
        const item = results.value[index];
        if (item) {
          e.preventDefault();
          selectedIndex.value = index;
          void runEntry(item.entry);
        }
        return;
      }
      if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey && !pluginState.value.open && !firstPartyPage.value && !actionPanelEntry.value && !showShortcuts.value) {
        e.preventDefault();
        askAIWithQuery();
        return;
      }
      if (actionPanelEntry.value) {
        const actions = filteredPanelActions.value;
        if (actions.length === 0) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          actionIndex.value = Math.min(actionIndex.value + 1, actions.length - 1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          actionIndex.value = Math.max(actionIndex.value - 1, 0);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          actions[actionIndex.value]?.run();
          return;
        }
        return;
      }
      if (!pluginState.value.open && !firstPartyPage.value && !actionPanelEntry.value) {
        if (e.key === "ArrowUp" && !query.value.trim() && !historyNavActive.value) {
          if (enterHistoryNav()) {
            e.preventDefault();
            return;
          }
        } else if (historyNavActive.value && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          stepHistoryNav(e.key === "ArrowUp" ? "up" : "down");
          return;
        }
      }
      const showFallback = query.value.trim() && results.value.length === 0 && !pluginState.value.open && !firstPartyPage.value;
      if (showFallback && fallbackCommands.value.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          fallbackSelectedIndex.value = Math.min(
            fallbackSelectedIndex.value + 1,
            fallbackCommands.value.length - 1
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          fallbackSelectedIndex.value = Math.max(fallbackSelectedIndex.value - 1, 0);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const cmd = fallbackCommands.value[fallbackSelectedIndex.value];
          if (cmd) runFallbackCommand(cmd);
          return;
        }
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        void runSelected();
        return;
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        showShortcuts.value = !showShortcuts.value;
        return;
      }
    }
    function onSnippetCopied(title) {
      if (!title) return;
      hideWindow();
    }
    async function saveQuicklinkForm(values) {
      const name = String(values.name ?? "").trim();
      const url = String(values.url ?? "").trim();
      if (!name || !/^https?:\/\//.test(url)) {
        return;
      }
      try {
        const list = await window.api.launcher.quicklinksList();
        list.push({ id: `ql-${Date.now().toString(36)}`, name, url });
        await window.api.launcher.quicklinksSave(list);
        await loadDynamicCommands();
        popPage();
        query.value = name;
      } catch {
      }
    }
    function onInput() {
      noteActivity();
      if (pluginState.value.open) {
        window.api.launcher.input(query.value);
      }
    }
    async function buildPomodoroDigest() {
      try {
        const [trend, dist] = await Promise.all([
          window.api.pomodoro.stats.getDailyTrend(1),
          window.api.pomodoro.stats.getProjectDistribution(Date.now() - 864e5, Date.now())
        ]);
        const today = trend[trend.length - 1];
        if (!today || today.workMinutes === 0 && today.completedPomodoros === 0) return null;
        const projects = dist.filter((d) => d.workMinutes > 0).map((d) => `${d.projectName} ${d.workMinutes} 分钟`).join("、");
        return [
          "请基于我今天的番茄钟专注数据写一份简短日报（中文，3-5 句）：",
          "- 给出整体节奏点评",
          "- 给一条改进建议",
          "",
          `今日数据：完成番茄钟 ${today.completedPomodoros} 个，专注 ${today.workMinutes} 分钟，完成任务 ${today.completedTasks} 个${projects ? `；项目分布：${projects}` : ""}。`
        ].join("\n");
      } catch {
        return null;
      }
    }
    function askAIWithText(text) {
      pushPage("ai");
      query.value = "";
      inputRef.value?.focus();
      nextTick(() => {
        const aiPage = pageRef.value;
        if (aiPage?.queueInitial && text) aiPage.queueInitial(text);
      });
    }
    function askAIWithQuery() {
      const q = query.value.trim();
      pushPage("ai");
      query.value = "";
      inputRef.value?.focus();
      nextTick(() => {
        const aiPage = pageRef.value;
        if (aiPage?.queueInitial && q) {
          aiPage.queueInitial(q);
        }
      });
    }
    function onEscape() {
      if (pluginState.value.open) {
        void window.api.launcher.closePlugin();
      } else if (firstPartyPage.value) {
        popPage();
        inputRef.value?.focus();
      } else {
        hideWindow();
      }
    }
    function hideWindow() {
      exitHistoryNav();
      query.value = "";
      selectedIndex.value = 0;
      pageStack.value = [];
      actionPanelEntry.value = null;
      qlArgTarget.value = null;
      void window.api.launcher.hide();
    }
    const unsubscribers = [];
    onUnmounted(() => {
      unsubscribers.forEach((fn) => fn());
      unsubscribers.length = 0;
    });
    onMounted(() => {
      inputRef.value?.focus();
      const onBreadcrumbPop = () => {
        noteActivity();
        if (pluginState.value.open || !firstPartyPage.value) return;
        popPage();
        inputRef.value?.focus();
      };
      window.addEventListener("leaf:launcher-pop", onBreadcrumbPop);
      unsubscribers.push(() => window.removeEventListener("leaf:launcher-pop", onBreadcrumbPop));
      const onShortcutsAnyKey = (e) => {
        if (!showShortcuts.value) return;
        e.preventDefault();
        e.stopPropagation();
        showShortcuts.value = false;
      };
      window.addEventListener("keydown", onShortcutsAnyKey, { capture: true });
      unsubscribers.push(
        () => window.removeEventListener("keydown", onShortcutsAnyKey, { capture: true })
      );
      addWindowListener(unsubscribers, "keydown", onWindowKeydown);
      addWindowListener(unsubscribers, "mousedown", () => noteActivity());
      addWindowListener(unsubscribers, "mousemove", onWindowMouseMove, { passive: true });
      addWindowListener(unsubscribers, "wheel", () => noteActivity(), { passive: true });
      addDocumentListener(unsubscribers, "visibilitychange", onVisibilityChangeForIdle);
      noteActivity();
      resetToSuggestions();
      void loadRegistryCommands().then(() => enrichAliases());
      unsubscribers.push(
        window.api.launcher.onShown(() => {
          query.value = "";
          selectedIndex.value = 0;
          pageStack.value = [];
          actionPanelEntry.value = null;
          exitHistoryNav();
          inputRef.value?.focus();
          noteActivity();
          void loadRegistryCommands().then(() => enrichAliases());
          void loadPluginCommands().then(() => enrichAliases());
          void loadFallbackDisabled();
          void refreshSuggestions().then(() => {
            if (!query.value.trim()) resetToSuggestions();
          });
          void refreshRecentUsage();
        })
      );
      unsubscribers.push(
        window.api.launcher.onOpenFirstParty((page) => {
          pushPage(page);
          query.value = "";
          inputRef.value?.focus();
        })
      );
      void window.api.launcher.getPluginState().then((state) => {
        if (state && state.open) {
          pluginState.value = state;
          declaredList.value = state.declaredList ?? null;
          inputRef.value?.focus();
        }
      });
      unsubscribers.push(
        window.api.launcher.onPluginChanged((state) => {
          const wasOpen = pluginState.value.open;
          pluginState.value = state;
          declaredList.value = state.open ? state.declaredList ?? null : null;
          if (state.open && !wasOpen) {
            query.value = "";
            inputRef.value?.focus();
          } else if (!state.open) {
            query.value = "";
            inputRef.value?.focus();
          }
        })
      );
      unsubscribers.push(
        window.api.launcher.onPluginList((payload) => {
          if (pluginState.value.open && payload.pluginId === pluginState.value.pluginId) {
            declaredList.value = payload.items;
          }
        })
      );
      void (async () => {
        try {
          await loadRegistryCommands();
          await enrichAliases();
        } catch {
        }
      })();
      void loadPluginCommands().then(() => enrichAliases());
      void loadDynamicCommands().then(() => enrichAliases());
      void refreshSuggestions();
      void refreshRecentUsage();
      void loadFallbackDisabled();
    });
    const __returned__ = { query, selectedIndex, fallbackSelectedIndex, inputRef, showShortcuts, pageStack, firstPartyPage, pageRef, pushPage, popPage, clipFilter, busyCount, pluginState, declaredList, historyCache, historyNavActive, historyNavApplying, exitHistoryNav, enterHistoryNav, stepHistoryNav, registryCommands, loadRegistryCommands, loadDynamicCommands, loadPluginCommands, enrichAliases, faviconOf, iconBg, entries, suggestions, fetchNextMeetingEntry, refreshSuggestions, refreshRecentUsage, usageBoost, results, scheduleForQuery, resetToSuggestions, currentDetail, searchPlaceholder, primaryLabel, fallbackDisabled, loadFallbackDisabled, fallbackCommands, qlArgTarget, qlArgInitial, qlArgFields, popToRoot, noteActivity, onVisibilityChangeForIdle, onWindowMouseMove, actionPanelEntry, actionIndex, panelActions, toggleActionPanel, actionFilter, actionFilterRef, filteredPanelActions, onActionFilterKeydown, resultGroups, onWindowKeydown, handleDigitShortcut, runFallbackCommand, moveSelection, scrollSelectedIntoView, highlightParts, runSelected, runEntry, createCalendarEvent, openQuicklinkArg, onKeydown, onSnippetCopied, saveQuicklinkForm, onInput, buildPomodoroDigest, askAIWithText, askAIWithQuery, onEscape, hideWindow, unsubscribers, AppIcon, DetailPanel, FocusPage, SnippetsPage, ClipboardPage, ShotsIndexPage, SchedulePage, FocusStatsPage, PluginListPage, FilesPage, SettingsPage, FormPage, AIChatPage, BrowserTabsPage, SystemInfoPage, WindowSwitcherPage, TrashPage, DictionaryPage, NotesPage, ReminderPage, CalendarPage };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, createVNode as _createVNode, withModifiers as _withModifiers, openBlock as _openBlock, createElementBlock as _createElementBlock, createBlock as _createBlock, vModelText as _vModelText, createElementVNode as _createElementVNode, withDirectives as _withDirectives, toDisplayString as _toDisplayString, vModelSelect as _vModelSelect, Fragment as _Fragment, createTextVNode as _createTextVNode, renderList as _renderList, normalizeClass as _normalizeClass, normalizeStyle as _normalizeStyle, createStaticVNode as _createStaticVNode } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "launcher" };
const _hoisted_2 = { class: "launcher-search" };
const _hoisted_3 = ["placeholder"];
const _hoisted_4 = { class: "launcher-search-right" };
const _hoisted_5 = {
  key: 0,
  class: "launcher-search-plugin"
};
const _hoisted_6 = {
  key: 0,
  class: "launcher-busy"
};
const _hoisted_7 = {
  key: 1,
  class: "launcher-actions"
};
const _hoisted_8 = { class: "launcher-actions-title" };
const _hoisted_9 = { class: "launcher-actions-list" };
const _hoisted_10 = ["onMouseenter", "onMousedown"];
const _hoisted_11 = { class: "launcher-action-label" };
const _hoisted_12 = {
  key: 0,
  class: "launcher-action-keys"
};
const _hoisted_13 = {
  key: 0,
  class: "launcher-actions-empty"
};
const _hoisted_14 = {
  key: 23,
  class: "launcher-body"
};
const _hoisted_15 = { class: "launcher-section-label" };
const _hoisted_16 = ["data-index", "onMouseenter", "onMousedown"];
const _hoisted_17 = ["src"];
const _hoisted_18 = { class: "launcher-result-text" };
const _hoisted_19 = { class: "launcher-result-title" };
const _hoisted_20 = { class: "hl" };
const _hoisted_21 = {
  key: 2,
  class: "launcher-result-subtitle"
};
const _hoisted_22 = { class: "launcher-result-meta" };
const _hoisted_23 = {
  key: 0,
  class: "launcher-result-badge"
};
const _hoisted_24 = {
  key: 1,
  class: "launcher-result-quick"
};
const _hoisted_25 = {
  key: 0,
  class: "launcher-detail"
};
const _hoisted_26 = {
  key: 24,
  class: "launcher-empty"
};
const _hoisted_27 = { class: "launcher-empty-text" };
const _hoisted_28 = { class: "launcher-fallback-list" };
const _hoisted_29 = ["onMouseenter", "onMousedown"];
const _hoisted_30 = { class: "launcher-fallback-text" };
const _hoisted_31 = { class: "launcher-fallback-title" };
const _hoisted_32 = { class: "launcher-fallback-subtitle" };
const _hoisted_33 = {
  key: 0,
  class: "launcher-fallback-badge"
};
const _hoisted_34 = {
  key: 25,
  class: "launcher-footer"
};
const _hoisted_35 = { class: "launcher-footer-actions" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _createElementVNode("div", _hoisted_2, [
      _createCommentVNode(" 推入页（Raycast）：搜索栏左侧变返回按钮，Esc/点击逐级返回 "),
      $setup.firstPartyPage ? (_openBlock(), _createElementBlock(
        "button",
        {
          key: 0,
          class: "launcher-search-back",
          title: "返回（Esc）",
          onMousedown: _withModifiers($setup.onEscape, ["prevent"])
        },
        [
          _createVNode($setup["AppIcon"], {
            icon: "arrow-left-s-line",
            size: 22
          })
        ],
        32
        /* NEED_HYDRATION */
      )) : (_openBlock(), _createBlock($setup["AppIcon"], {
        key: 1,
        icon: "search",
        size: 22,
        class: "launcher-search-icon"
      })),
      _withDirectives(_createElementVNode("input", {
        ref: "inputRef",
        "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.query = $event),
        class: "launcher-search-input",
        type: "text",
        placeholder: $setup.searchPlaceholder,
        spellcheck: "false",
        onInput: $setup.onInput,
        onKeydown: $setup.onKeydown
      }, null, 40, _hoisted_3), [
        [_vModelText, $setup.query]
      ]),
      _createElementVNode("div", _hoisted_4, [
        $setup.pluginState.open ? (_openBlock(), _createElementBlock(
          "span",
          _hoisted_5,
          _toDisplayString($setup.pluginState.pluginName),
          1
          /* TEXT */
        )) : $setup.firstPartyPage === "clips" ? (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 1 },
          [
            _createCommentVNode(" I6：剪贴板页类型筛选迁入搜索栏右侧（Raycast All Types 位置） "),
            _withDirectives(_createElementVNode(
              "select",
              {
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $setup.clipFilter = $event),
                class: "launcher-search-filter",
                "aria-label": "按类型筛选"
              },
              [..._cache[8] || (_cache[8] = [
                _createStaticVNode('<option value="all" data-v-53c7cc5b>全部</option><option value="text" data-v-53c7cc5b>文本</option><option value="link" data-v-53c7cc5b>链接</option><option value="image" data-v-53c7cc5b>图片</option><option value="files" data-v-53c7cc5b>文件</option>', 5)
              ])],
              512
              /* NEED_PATCH */
            ), [
              [_vModelSelect, $setup.clipFilter]
            ])
          ],
          2112
          /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
        )) : (_openBlock(), _createElementBlock(
          "button",
          {
            key: 2,
            class: "launcher-search-ai",
            onMousedown: _withModifiers($setup.askAIWithQuery, ["prevent"])
          },
          [..._cache[9] || (_cache[9] = [
            _createTextVNode(
              " Quick AI ",
              -1
              /* CACHED */
            ),
            _createElementVNode(
              "kbd",
              null,
              "⇥",
              -1
              /* CACHED */
            )
          ])],
          32
          /* NEED_HYDRATION */
        ))
      ])
    ]),
    _createCommentVNode(" I9 统一加载态：内联页慢路径期间顶部不确定进度条（Raycast isLoading 语义） "),
    $setup.busyCount > 0 ? (_openBlock(), _createElementBlock("div", _hoisted_6, [..._cache[10] || (_cache[10] = [
      _createElementVNode(
        "div",
        { class: "launcher-busy-bar" },
        null,
        -1
        /* CACHED */
      )
    ])])) : _createCommentVNode("v-if", true),
    _createCommentVNode(" 结果级动作面板（M1.2 → I4 Raycast 化）：⌘K 呼出，右锚定浮层 + 底部过滤框 "),
    $setup.actionPanelEntry ? (_openBlock(), _createElementBlock("div", _hoisted_7, [
      _createElementVNode(
        "div",
        _hoisted_8,
        _toDisplayString($setup.actionPanelEntry.title),
        1
        /* TEXT */
      ),
      _createElementVNode("div", _hoisted_9, [
        (_openBlock(true), _createElementBlock(
          _Fragment,
          null,
          _renderList($setup.filteredPanelActions, (act, i) => {
            return _openBlock(), _createElementBlock("div", {
              key: act.label,
              class: _normalizeClass(["launcher-action", { selected: i === $setup.actionIndex }]),
              onMouseenter: ($event) => $setup.actionIndex = i,
              onMousedown: _withModifiers(($event) => act.run(), ["prevent"])
            }, [
              _createVNode($setup["AppIcon"], {
                icon: act.icon,
                size: 14,
                class: "launcher-action-icon"
              }, null, 8, ["icon"]),
              _createElementVNode(
                "span",
                _hoisted_11,
                _toDisplayString(act.label),
                1
                /* TEXT */
              ),
              act.hint ? (_openBlock(), _createElementBlock(
                "kbd",
                _hoisted_12,
                _toDisplayString(act.hint),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true)
            ], 42, _hoisted_10);
          }),
          128
          /* KEYED_FRAGMENT */
        )),
        $setup.filteredPanelActions.length === 0 ? (_openBlock(), _createElementBlock("div", _hoisted_13, " 没有匹配的动作 ")) : _createCommentVNode("v-if", true)
      ]),
      _withDirectives(_createElementVNode(
        "input",
        {
          ref: "actionFilterRef",
          "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $setup.actionFilter = $event),
          class: "launcher-actions-filter",
          type: "text",
          placeholder: "搜索动作…",
          spellcheck: "false",
          onKeydown: $setup.onActionFilterKeydown
        },
        null,
        544
        /* NEED_HYDRATION, NEED_PATCH */
      ), [
        [_vModelText, $setup.actionFilter]
      ])
    ])) : _createCommentVNode("v-if", true),
    _createCommentVNode(" 第一方内联页（Raycast 式）：命令结果在胶囊内呈现 "),
    $setup.firstPartyPage === "focus" ? (_openBlock(), _createBlock(
      $setup["FocusPage"],
      {
        key: 2,
        ref: "pageRef"
      },
      null,
      512
      /* NEED_PATCH */
    )) : $setup.firstPartyPage === "snippets" ? (_openBlock(), _createBlock($setup["SnippetsPage"], {
      key: 3,
      ref: "pageRef",
      query: $setup.query,
      onCopied: $setup.onSnippetCopied,
      onNavigate: $setup.hideWindow
    }, null, 8, ["query"])) : $setup.firstPartyPage === "schedule" ? (_openBlock(), _createBlock(
      $setup["SchedulePage"],
      {
        key: 4,
        ref: "pageRef",
        onClose: $setup.hideWindow
      },
      null,
      512
      /* NEED_PATCH */
    )) : $setup.firstPartyPage === "eventform" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 5 },
      [
        _createCommentVNode(" 创建日程（V4 P0-1 批次4 第三档：Form 基元写回系统日历） "),
        _createVNode($setup["FormPage"], {
          ref: "pageRef",
          fields: [
            { key: "title", label: "标题", placeholder: "例如：与团队同步" },
            { key: "date", label: "开始日期", type: "date" },
            { key: "time", label: "开始时间", placeholder: "HH:mm，如 14:30" },
            {
              key: "duration",
              label: "时长",
              type: "select",
              options: ["30 分钟", "1 小时", "90 分钟", "2 小时"],
              initial: "1 小时"
            }
          ],
          "submit-label": "创建日程",
          onSubmit: $setup.createCalendarEvent,
          onCancel: $setup.popPage
        }, null, 8, ["onCancel"])
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "shots" ? (_openBlock(), _createBlock($setup["ShotsIndexPage"], {
      key: 6,
      ref: "pageRef",
      query: $setup.query,
      onAskAi: $setup.askAIWithText
    }, null, 8, ["query"])) : $setup.firstPartyPage === "clips" ? (_openBlock(), _createBlock($setup["ClipboardPage"], {
      key: 7,
      ref: "pageRef",
      filter: $setup.clipFilter,
      "onUpdate:filter": _cache[3] || (_cache[3] = ($event) => $setup.clipFilter = $event),
      query: $setup.query,
      onAskAi: $setup.askAIWithText
    }, null, 8, ["filter", "query"])) : $setup.firstPartyPage === "focusStats" ? (_openBlock(), _createBlock(
      $setup["FocusStatsPage"],
      {
        key: 8,
        ref: "pageRef",
        onNavigate: $setup.hideWindow
      },
      null,
      512
      /* NEED_PATCH */
    )) : $setup.pluginState.open && $setup.declaredList ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 9 },
      [
        _createCommentVNode(" 声明式插件列表（M3.1）：第三方插件数据用原生组件渲染 "),
        _createVNode($setup["PluginListPage"], {
          ref: "pageRef",
          "plugin-id": $setup.pluginState.pluginId ?? "",
          items: $setup.declaredList
        }, null, 8, ["plugin-id", "items"])
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "files" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 10 },
      [
        _createCommentVNode(" 文件搜索（M5.3）：Spotlight 即时搜索 "),
        _createVNode($setup["FilesPage"], { query: $setup.query }, null, 8, ["query"])
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "settings" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 11 },
      [
        _createCommentVNode(" 快捷设置（胶囊内直达：主题 / 文本扩展 / 剪贴板历史） "),
        _createVNode(
          $setup["SettingsPage"],
          { ref: "pageRef" },
          null,
          512
          /* NEED_PATCH */
        )
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "ai" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 12 },
      [
        _createCommentVNode(" AI 对话（P0-3：胶囊内流式对话） "),
        _createVNode(
          $setup["AIChatPage"],
          { ref: "pageRef" },
          null,
          512
          /* NEED_PATCH */
        )
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "browserTabs" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 13 },
      [
        _createCommentVNode(" 浏览器标签（P1-5：Chrome/Safari 标签搜索与切换） "),
        _createVNode(
          $setup["BrowserTabsPage"],
          { ref: "pageRef" },
          null,
          512
          /* NEED_PATCH */
        )
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "systemInfo" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 14 },
      [
        _createCommentVNode(" 系统信息（阶段3.3a：CPU/内存/磁盘概览） "),
        _createVNode(
          $setup["SystemInfoPage"],
          { ref: "pageRef" },
          null,
          512
          /* NEED_PATCH */
        )
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "windowSwitcher" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 15 },
      [
        _createCommentVNode(" 窗口切换（阶段3.3b：搜索并激活窗口） "),
        _createVNode($setup["WindowSwitcherPage"], {
          ref: "pageRef",
          query: $setup.query
        }, null, 8, ["query"])
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "trash" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 16 },
      [
        _createCommentVNode(" 回收站（阶段3.3c：查看/清空/恢复） "),
        _createVNode(
          $setup["TrashPage"],
          { ref: "pageRef" },
          null,
          512
          /* NEED_PATCH */
        )
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "dictionary" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 17 },
      [
        _createCommentVNode(" 词典（阶段3.3d：查询英文单词释义） "),
        _createVNode($setup["DictionaryPage"], {
          ref: "pageRef",
          query: $setup.query
        }, null, 8, ["query"])
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "notes" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 18 },
      [
        _createCommentVNode(" 轻量笔记（Markdown 本地存储） "),
        _createVNode(
          $setup["NotesPage"],
          { ref: "pageRef" },
          null,
          512
          /* NEED_PATCH */
        )
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "reminders" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 19 },
      [
        _createCommentVNode(" 提醒事项 "),
        _createVNode($setup["ReminderPage"], {
          ref: "pageRef",
          query: $setup.query
        }, null, 8, ["query"])
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "calendar" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 20 },
      [
        _createCommentVNode(" 日历 "),
        _createVNode(
          $setup["CalendarPage"],
          { ref: "pageRef" },
          null,
          512
          /* NEED_PATCH */
        )
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "qlform" ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 21 },
      [
        _createCommentVNode(" Quicklink 表单（M5.2 Form 基元） "),
        _createVNode($setup["FormPage"], {
          ref: "pageRef",
          fields: [
            { key: "name", label: "名称", placeholder: "GitHub" },
            { key: "url", label: "URL", placeholder: "https://github.com" }
          ],
          "submit-label": "保存链接",
          initial: { url: "https://" },
          onSubmit: $setup.saveQuicklinkForm,
          onCancel: $setup.popPage
        }, null, 8, ["onCancel"])
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : $setup.firstPartyPage === "qlarg" && $setup.qlArgTarget ? (_openBlock(), _createElementBlock(
      _Fragment,
      { key: 22 },
      [
        _createCommentVNode(" 参数化 Quicklink（{query} 单参或 {name} 多参）：先填参数再打开 "),
        _createVNode($setup["FormPage"], {
          ref: "pageRef",
          fields: $setup.qlArgFields,
          "submit-label": "打开",
          initial: { query: $setup.qlArgInitial },
          onSubmit: $setup.openQuicklinkArg,
          onCancel: $setup.popPage
        }, null, 8, ["fields", "initial", "onCancel"])
      ],
      2112
      /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
    )) : !$setup.pluginState.open && $setup.results.length > 0 ? (_openBlock(), _createElementBlock("div", _hoisted_14, [
      _createElementVNode(
        "div",
        {
          class: _normalizeClass(["launcher-results", { "has-detail": $setup.currentDetail }])
        },
        [
          (_openBlock(true), _createElementBlock(
            _Fragment,
            null,
            _renderList($setup.resultGroups, (group) => {
              return _openBlock(), _createElementBlock(
                _Fragment,
                {
                  key: group.label
                },
                [
                  _createElementVNode(
                    "div",
                    _hoisted_15,
                    _toDisplayString(group.label),
                    1
                    /* TEXT */
                  ),
                  (_openBlock(true), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList(group.items, (slotItem) => {
                      return _openBlock(), _createElementBlock("div", {
                        key: slotItem.item.entry.key,
                        class: _normalizeClass(["launcher-result", { selected: slotItem.index === $setup.selectedIndex }]),
                        "data-index": slotItem.index,
                        onMouseenter: ($event) => $setup.selectedIndex = slotItem.index,
                        onMousedown: _withModifiers(($event) => $setup.runEntry(slotItem.item.entry), ["prevent"])
                      }, [
                        _createElementVNode(
                          "div",
                          {
                            class: "launcher-result-icon",
                            style: _normalizeStyle({ background: $setup.iconBg(slotItem.item.entry) })
                          },
                          [
                            $setup.faviconOf(slotItem.item.entry) ? (_openBlock(), _createElementBlock("img", {
                              key: 0,
                              class: "launcher-result-favicon",
                              src: `image://${encodeURI($setup.faviconOf(slotItem.item.entry) ?? "")}`,
                              alt: ""
                            }, null, 8, _hoisted_17)) : (_openBlock(), _createBlock($setup["AppIcon"], {
                              key: 1,
                              icon: slotItem.item.entry.icon,
                              size: 16,
                              class: "launcher-result-icon-svg"
                            }, null, 8, ["icon"]))
                          ],
                          4
                          /* STYLE */
                        ),
                        _createElementVNode("div", _hoisted_18, [
                          _createElementVNode("div", _hoisted_19, [
                            $setup.highlightParts(slotItem.item) ? (_openBlock(), _createElementBlock(
                              _Fragment,
                              { key: 0 },
                              [
                                _createTextVNode(
                                  _toDisplayString($setup.highlightParts(slotItem.item).before),
                                  1
                                  /* TEXT */
                                ),
                                _createElementVNode(
                                  "span",
                                  _hoisted_20,
                                  _toDisplayString($setup.highlightParts(slotItem.item).hit),
                                  1
                                  /* TEXT */
                                ),
                                _createTextVNode(
                                  _toDisplayString($setup.highlightParts(slotItem.item).after),
                                  1
                                  /* TEXT */
                                )
                              ],
                              64
                              /* STABLE_FRAGMENT */
                            )) : (_openBlock(), _createElementBlock(
                              _Fragment,
                              { key: 1 },
                              [
                                _createTextVNode(
                                  _toDisplayString(slotItem.item.entry.title),
                                  1
                                  /* TEXT */
                                )
                              ],
                              64
                              /* STABLE_FRAGMENT */
                            )),
                            slotItem.item.entry.subtitle ? (_openBlock(), _createElementBlock(
                              "span",
                              _hoisted_21,
                              _toDisplayString(slotItem.item.entry.subtitle),
                              1
                              /* TEXT */
                            )) : _createCommentVNode("v-if", true)
                          ])
                        ]),
                        _createElementVNode("div", _hoisted_22, [
                          slotItem.item.entry.badge ? (_openBlock(), _createElementBlock(
                            "span",
                            _hoisted_23,
                            _toDisplayString(slotItem.item.entry.badge),
                            1
                            /* TEXT */
                          )) : _createCommentVNode("v-if", true),
                          _createCommentVNode(" 数字徽标只发前 10 条（V3：Raycast 语义，1-9 + 0） "),
                          slotItem.index < 10 ? (_openBlock(), _createElementBlock(
                            "span",
                            _hoisted_24,
                            _toDisplayString(slotItem.index < 9 ? slotItem.index + 1 : 0),
                            1
                            /* TEXT */
                          )) : _createCommentVNode("v-if", true)
                        ])
                      ], 42, _hoisted_16);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ],
                64
                /* STABLE_FRAGMENT */
              );
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ],
        2
        /* CLASS */
      ),
      _createCommentVNode(" 右侧详情面板（Raycast List-Detail） "),
      $setup.currentDetail ? (_openBlock(), _createElementBlock("div", _hoisted_25, [
        _createVNode($setup["DetailPanel"], {
          title: $setup.currentDetail.title,
          content: $setup.currentDetail.content,
          format: $setup.currentDetail.format
        }, null, 8, ["title", "content", "format"])
      ])) : _createCommentVNode("v-if", true)
    ])) : $setup.query && !$setup.pluginState.open ? (_openBlock(), _createElementBlock("div", _hoisted_26, [
      _createElementVNode(
        "div",
        _hoisted_27,
        "没有找到「" + _toDisplayString($setup.query) + "」相关结果",
        1
        /* TEXT */
      ),
      _createElementVNode("div", _hoisted_28, [
        (_openBlock(true), _createElementBlock(
          _Fragment,
          null,
          _renderList($setup.fallbackCommands, (cmd, i) => {
            return _openBlock(), _createElementBlock("div", {
              key: cmd.id,
              class: _normalizeClass(["launcher-fallback-item", {
                selected: i === $setup.fallbackSelectedIndex,
                "ai-emphasis": cmd.id === "fallback:ai"
              }]),
              onMouseenter: ($event) => $setup.fallbackSelectedIndex = i,
              onMousedown: _withModifiers(($event) => $setup.runFallbackCommand(cmd), ["prevent"])
            }, [
              _createVNode($setup["AppIcon"], {
                icon: cmd.icon,
                size: 16,
                class: "launcher-fallback-icon"
              }, null, 8, ["icon"]),
              _createElementVNode("div", _hoisted_30, [
                _createElementVNode(
                  "div",
                  _hoisted_31,
                  _toDisplayString(cmd.title),
                  1
                  /* TEXT */
                ),
                _createElementVNode(
                  "div",
                  _hoisted_32,
                  _toDisplayString(cmd.subtitle),
                  1
                  /* TEXT */
                )
              ]),
              cmd.badge ? (_openBlock(), _createElementBlock(
                "span",
                _hoisted_33,
                _toDisplayString(cmd.badge),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true)
            ], 42, _hoisted_29);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])
    ])) : _createCommentVNode("v-if", true),
    _createCommentVNode(" 底部动作栏（B1 → V4 Raycast 化）：左图标按钮，右侧「主动作 ↵ / Actions ⌘K」 "),
    !$setup.firstPartyPage && !$setup.pluginState.open ? (_openBlock(), _createElementBlock("div", _hoisted_34, [
      _createElementVNode(
        "button",
        {
          class: "launcher-footer-menu",
          title: "快捷键（?）",
          onMousedown: _cache[4] || (_cache[4] = _withModifiers(($event) => $setup.showShortcuts = true, ["prevent"]))
        },
        [
          _createVNode($setup["AppIcon"], {
            icon: "menu-line",
            size: 16
          })
        ],
        32
        /* NEED_HYDRATION */
      ),
      _createElementVNode("div", _hoisted_35, [
        _createElementVNode(
          "button",
          {
            class: "launcher-footer-btn",
            onMousedown: _withModifiers($setup.runSelected, ["prevent"])
          },
          [
            _cache[11] || (_cache[11] = _createElementVNode(
              "kbd",
              null,
              "↵",
              -1
              /* CACHED */
            )),
            _createTextVNode(
              " " + _toDisplayString($setup.primaryLabel),
              1
              /* TEXT */
            )
          ],
          32
          /* NEED_HYDRATION */
        ),
        _createElementVNode(
          "button",
          {
            class: "launcher-footer-btn",
            onMousedown: _cache[5] || (_cache[5] = _withModifiers((...args) => $setup.toggleActionPanel && $setup.toggleActionPanel(...args), ["prevent"]))
          },
          [..._cache[12] || (_cache[12] = [
            _createElementVNode(
              "kbd",
              null,
              "⌘K",
              -1
              /* CACHED */
            ),
            _createTextVNode(
              " 动作 ",
              -1
              /* CACHED */
            )
          ])],
          32
          /* NEED_HYDRATION */
        )
      ])
    ])) : _createCommentVNode("v-if", true),
    _createCommentVNode(" 快捷键速查面板（阶段5.3） "),
    $setup.showShortcuts ? (_openBlock(), _createElementBlock(
      "div",
      {
        key: 26,
        class: "shortcuts-overlay",
        onMousedown: _cache[7] || (_cache[7] = _withModifiers(($event) => $setup.showShortcuts = false, ["prevent"]))
      },
      [
        _createElementVNode(
          "div",
          {
            class: "shortcuts-panel",
            onMousedown: _cache[6] || (_cache[6] = _withModifiers(() => {
            }, ["stop"]))
          },
          [..._cache[13] || (_cache[13] = [
            _createStaticVNode('<div class="shortcuts-title" data-v-53c7cc5b>快捷键</div><div class="shortcuts-grid" data-v-53c7cc5b><div class="shortcut-item" data-v-53c7cc5b><kbd data-v-53c7cc5b>↑</kbd><kbd data-v-53c7cc5b>↓</kbd><span data-v-53c7cc5b>上下选择</span></div><div class="shortcut-item" data-v-53c7cc5b><kbd data-v-53c7cc5b>↵</kbd><span data-v-53c7cc5b>执行命令</span></div><div class="shortcut-item" data-v-53c7cc5b><kbd data-v-53c7cc5b>⌘K</kbd><span data-v-53c7cc5b>动作面板</span></div><div class="shortcut-item" data-v-53c7cc5b><kbd data-v-53c7cc5b>⌘1-9</kbd><span data-v-53c7cc5b>快速打开</span></div><div class="shortcut-item" data-v-53c7cc5b><kbd data-v-53c7cc5b>Tab</kbd><span data-v-53c7cc5b>Quick AI</span></div><div class="shortcut-item" data-v-53c7cc5b><kbd data-v-53c7cc5b>esc</kbd><span data-v-53c7cc5b>关闭 / 返回</span></div><div class="shortcut-item" data-v-53c7cc5b><kbd data-v-53c7cc5b>?</kbd><span data-v-53c7cc5b>快捷键面板</span></div><div class="shortcut-item" data-v-53c7cc5b><kbd data-v-53c7cc5b>⌘C</kbd><span data-v-53c7cc5b>复制（文件/路径）</span></div><div class="shortcut-item" data-v-53c7cc5b><kbd data-v-53c7cc5b>⌘N</kbd><span data-v-53c7cc5b>新建笔记</span></div></div><div class="shortcuts-hint" data-v-53c7cc5b>按任意键关闭</div>', 3)
          ])],
          32
          /* NEED_HYDRATION */
        )
      ],
      32
      /* NEED_HYDRATION */
    )) : _createCommentVNode("v-if", true)
  ]);
}
import "/src/launcher/LauncherApp.vue?vue&type=style&index=0&scoped=53c7cc5b&lang.css";
_sfc_main.__hmrId = "53c7cc5b";
typeof __VUE_HMR_RUNTIME__ !== "undefined" && __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId, _sfc_main);
import.meta.hot.on("file-changed", ({ file }) => {
  __VUE_HMR_RUNTIME__.CHANGED_FILE = file;
});
import.meta.hot.accept((mod) => {
  if (!mod) return;
  const { default: updated, _rerender_only } = mod;
  if (_rerender_only) {
    __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render);
  } else {
    __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated);
  }
});
import _export_sfc from "/@id/__x00__plugin-vue:export-helper";
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-53c7cc5b"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/LauncherApp.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QUFhO0FBQUE7QUFBQSxjQUFSO0FBQUEsY0FBRTtBQUFBO0FBQUE7QUFBQTtjQUFNO0FBQUEsY0FDZjtBQUFBO0FBQUE7QUFBQTs7Ozs7O0lBSUo7QUFBQSxJQUNXLHNDQUFYO0FBQUEsTUFnQk07QUFBQTtBQUFBO1FBaEJvQixPQUFNO0FBQUEsUUFBcUIsYUFBUyxxREFBVSx1QkFBYTtBQUFBOztRQUNuRjtBQUFBLFVBY007QUFBQTtBQUFBLFlBZEQsT0FBTTtBQUFBLFlBQW1CLGFBQVMseUNBQVY7QUFBQSxlQUFlO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkxhdW5jaGVyQXBwLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxkaXYgY2xhc3M9XCJsYXVuY2hlclwiPlxuICAgIDxkaXYgY2xhc3M9XCJsYXVuY2hlci1zZWFyY2hcIj5cbiAgICAgIDwhLS0g5o6o5YWl6aG177yIUmF5Y2FzdO+8ie+8muaQnOe0ouagj+W3puS+p+WPmOi/lOWbnuaMiemSru+8jEVzYy/ngrnlh7vpgJDnuqfov5Tlm54gLS0+XG4gICAgICA8YnV0dG9uXG4gICAgICAgIHYtaWY9XCJmaXJzdFBhcnR5UGFnZVwiXG4gICAgICAgIGNsYXNzPVwibGF1bmNoZXItc2VhcmNoLWJhY2tcIlxuICAgICAgICB0aXRsZT1cIui/lOWbnu+8iEVzY++8iVwiXG4gICAgICAgIEBtb3VzZWRvd24ucHJldmVudD1cIm9uRXNjYXBlXCJcbiAgICAgID5cbiAgICAgICAgPEFwcEljb24gaWNvbj1cImFycm93LWxlZnQtcy1saW5lXCIgOnNpemU9XCIyMlwiIC8+XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIDxBcHBJY29uIHYtZWxzZSBpY29uPVwic2VhcmNoXCIgOnNpemU9XCIyMlwiIGNsYXNzPVwibGF1bmNoZXItc2VhcmNoLWljb25cIiAvPlxuICAgICAgPGlucHV0XG4gICAgICAgIHJlZj1cImlucHV0UmVmXCJcbiAgICAgICAgdi1tb2RlbD1cInF1ZXJ5XCJcbiAgICAgICAgY2xhc3M9XCJsYXVuY2hlci1zZWFyY2gtaW5wdXRcIlxuICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgIDpwbGFjZWhvbGRlcj1cInNlYXJjaFBsYWNlaG9sZGVyXCJcbiAgICAgICAgc3BlbGxjaGVjaz1cImZhbHNlXCJcbiAgICAgICAgQGlucHV0PVwib25JbnB1dFwiXG4gICAgICAgIEBrZXlkb3duPVwib25LZXlkb3duXCJcbiAgICAgIC8+XG4gICAgICA8ZGl2IGNsYXNzPVwibGF1bmNoZXItc2VhcmNoLXJpZ2h0XCI+XG4gICAgICAgIDxzcGFuIHYtaWY9XCJwbHVnaW5TdGF0ZS5vcGVuXCIgY2xhc3M9XCJsYXVuY2hlci1zZWFyY2gtcGx1Z2luXCI+e3tcbiAgICAgICAgICBwbHVnaW5TdGF0ZS5wbHVnaW5OYW1lXG4gICAgICAgIH19PC9zcGFuPlxuICAgICAgICA8IS0tIEk277ya5Ymq6LS05p2/6aG157G75Z6L562b6YCJ6L+B5YWl5pCc57Si5qCP5Y+z5L6n77yIUmF5Y2FzdCBBbGwgVHlwZXMg5L2N572u77yJIC0tPlxuICAgICAgICA8c2VsZWN0XG4gICAgICAgICAgdi1lbHNlLWlmPVwiZmlyc3RQYXJ0eVBhZ2UgPT09ICdjbGlwcydcIlxuICAgICAgICAgIHYtbW9kZWw9XCJjbGlwRmlsdGVyXCJcbiAgICAgICAgICBjbGFzcz1cImxhdW5jaGVyLXNlYXJjaC1maWx0ZXJcIlxuICAgICAgICAgIGFyaWEtbGFiZWw9XCLmjInnsbvlnovnrZvpgIlcIlxuICAgICAgICA+XG4gICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cImFsbFwiPuWFqOmDqDwvb3B0aW9uPlxuICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJ0ZXh0XCI+5paH5pysPC9vcHRpb24+XG4gICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cImxpbmtcIj7pk77mjqU8L29wdGlvbj5cbiAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiaW1hZ2VcIj7lm77niYc8L29wdGlvbj5cbiAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiZmlsZXNcIj7mlofku7Y8L29wdGlvbj5cbiAgICAgICAgPC9zZWxlY3Q+XG4gICAgICAgIDxidXR0b24gdi1lbHNlIGNsYXNzPVwibGF1bmNoZXItc2VhcmNoLWFpXCIgQG1vdXNlZG93bi5wcmV2ZW50PVwiYXNrQUlXaXRoUXVlcnlcIj5cbiAgICAgICAgICBRdWljayBBSSA8a2JkPuKHpTwva2JkPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgPCEtLSBJOSDnu5/kuIDliqDovb3mgIHvvJrlhoXogZTpobXmhaLot6/lvoTmnJ/pl7Tpobbpg6jkuI3noa7lrprov5vluqbmnaHvvIhSYXljYXN0IGlzTG9hZGluZyDor63kuYnvvIkgLS0+XG4gICAgPGRpdiB2LWlmPVwiYnVzeUNvdW50ID4gMFwiIGNsYXNzPVwibGF1bmNoZXItYnVzeVwiPlxuICAgICAgPGRpdiBjbGFzcz1cImxhdW5jaGVyLWJ1c3ktYmFyXCI+PC9kaXY+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIOe7k+aenOe6p+WKqOS9nOmdouadv++8iE0xLjIg4oaSIEk0IFJheWNhc3Qg5YyW77yJ77ya4oyYSyDlkbzlh7rvvIzlj7PplJrlrprmta7lsYIgKyDlupXpg6jov4fmu6TmoYYgLS0+XG4gICAgPGRpdiB2LWlmPVwiYWN0aW9uUGFuZWxFbnRyeVwiIGNsYXNzPVwibGF1bmNoZXItYWN0aW9uc1wiPlxuICAgICAgPGRpdiBjbGFzcz1cImxhdW5jaGVyLWFjdGlvbnMtdGl0bGVcIj57eyBhY3Rpb25QYW5lbEVudHJ5LnRpdGxlIH19PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwibGF1bmNoZXItYWN0aW9ucy1saXN0XCI+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICB2LWZvcj1cIihhY3QsIGkpIGluIGZpbHRlcmVkUGFuZWxBY3Rpb25zXCJcbiAgICAgICAgICA6a2V5PVwiYWN0LmxhYmVsXCJcbiAgICAgICAgICBjbGFzcz1cImxhdW5jaGVyLWFjdGlvblwiXG4gICAgICAgICAgOmNsYXNzPVwieyBzZWxlY3RlZDogaSA9PT0gYWN0aW9uSW5kZXggfVwiXG4gICAgICAgICAgQG1vdXNlZW50ZXI9XCJhY3Rpb25JbmRleCA9IGlcIlxuICAgICAgICAgIEBtb3VzZWRvd24ucHJldmVudD1cImFjdC5ydW4oKVwiXG4gICAgICAgID5cbiAgICAgICAgICA8QXBwSWNvbiA6aWNvbj1cImFjdC5pY29uXCIgOnNpemU9XCIxNFwiIGNsYXNzPVwibGF1bmNoZXItYWN0aW9uLWljb25cIiAvPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwibGF1bmNoZXItYWN0aW9uLWxhYmVsXCI+e3sgYWN0LmxhYmVsIH19PC9zcGFuPlxuICAgICAgICAgIDxrYmQgdi1pZj1cImFjdC5oaW50XCIgY2xhc3M9XCJsYXVuY2hlci1hY3Rpb24ta2V5c1wiPnt7IGFjdC5oaW50IH19PC9rYmQ+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IHYtaWY9XCJmaWx0ZXJlZFBhbmVsQWN0aW9ucy5sZW5ndGggPT09IDBcIiBjbGFzcz1cImxhdW5jaGVyLWFjdGlvbnMtZW1wdHlcIj5cbiAgICAgICAgICDmsqHmnInljLnphY3nmoTliqjkvZxcbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxpbnB1dFxuICAgICAgICByZWY9XCJhY3Rpb25GaWx0ZXJSZWZcIlxuICAgICAgICB2LW1vZGVsPVwiYWN0aW9uRmlsdGVyXCJcbiAgICAgICAgY2xhc3M9XCJsYXVuY2hlci1hY3Rpb25zLWZpbHRlclwiXG4gICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgcGxhY2Vob2xkZXI9XCLmkJzntKLliqjkvZzigKZcIlxuICAgICAgICBzcGVsbGNoZWNrPVwiZmFsc2VcIlxuICAgICAgICBAa2V5ZG93bj1cIm9uQWN0aW9uRmlsdGVyS2V5ZG93blwiXG4gICAgICAvPlxuICAgIDwvZGl2PlxuXG4gICAgPCEtLSDnrKzkuIDmlrnlhoXogZTpobXvvIhSYXljYXN0IOW8j++8ie+8muWRveS7pOe7k+aenOWcqOiDtuWbiuWGheWRiOeOsCAtLT5cbiAgICA8Rm9jdXNQYWdlIHYtaWY9XCJmaXJzdFBhcnR5UGFnZSA9PT0gJ2ZvY3VzJ1wiIHJlZj1cInBhZ2VSZWZcIiAvPlxuICAgIDxTbmlwcGV0c1BhZ2VcbiAgICAgIHYtZWxzZS1pZj1cImZpcnN0UGFydHlQYWdlID09PSAnc25pcHBldHMnXCJcbiAgICAgIHJlZj1cInBhZ2VSZWZcIlxuICAgICAgOnF1ZXJ5PVwicXVlcnlcIlxuICAgICAgQGNvcGllZD1cIm9uU25pcHBldENvcGllZFwiXG4gICAgICBAbmF2aWdhdGU9XCJoaWRlV2luZG93XCJcbiAgICAvPlxuICAgIDxTY2hlZHVsZVBhZ2Ugdi1lbHNlLWlmPVwiZmlyc3RQYXJ0eVBhZ2UgPT09ICdzY2hlZHVsZSdcIiByZWY9XCJwYWdlUmVmXCIgQGNsb3NlPVwiaGlkZVdpbmRvd1wiIC8+XG5cbiAgICA8IS0tIOWIm+W7uuaXpeeoi++8iFY0IFAwLTEg5om55qyhNCDnrKzkuInmoaPvvJpGb3JtIOWfuuWFg+WGmeWbnuezu+e7n+aXpeWOhu+8iSAtLT5cbiAgICA8Rm9ybVBhZ2VcbiAgICAgIHYtZWxzZS1pZj1cImZpcnN0UGFydHlQYWdlID09PSAnZXZlbnRmb3JtJ1wiXG4gICAgICByZWY9XCJwYWdlUmVmXCJcbiAgICAgIDpmaWVsZHM9XCJbXG4gICAgICAgIHsga2V5OiAndGl0bGUnLCBsYWJlbDogJ+agh+mimCcsIHBsYWNlaG9sZGVyOiAn5L6L5aaC77ya5LiO5Zui6Zif5ZCM5q2lJyB9LFxuICAgICAgICB7IGtleTogJ2RhdGUnLCBsYWJlbDogJ+W8gOWni+aXpeacnycsIHR5cGU6ICdkYXRlJyB9LFxuICAgICAgICB7IGtleTogJ3RpbWUnLCBsYWJlbDogJ+W8gOWni+aXtumXtCcsIHBsYWNlaG9sZGVyOiAnSEg6bW3vvIzlpoIgMTQ6MzAnIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBrZXk6ICdkdXJhdGlvbicsXG4gICAgICAgICAgbGFiZWw6ICfml7bplb8nLFxuICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgIG9wdGlvbnM6IFsnMzAg5YiG6ZKfJywgJzEg5bCP5pe2JywgJzkwIOWIhumSnycsICcyIOWwj+aXtiddLFxuICAgICAgICAgIGluaXRpYWw6ICcxIOWwj+aXtidcbiAgICAgICAgfVxuICAgICAgXVwiXG4gICAgICBzdWJtaXQtbGFiZWw9XCLliJvlu7rml6XnqItcIlxuICAgICAgQHN1Ym1pdD1cImNyZWF0ZUNhbGVuZGFyRXZlbnRcIlxuICAgICAgQGNhbmNlbD1cInBvcFBhZ2VcIlxuICAgIC8+XG4gICAgPFNob3RzSW5kZXhQYWdlXG4gICAgICB2LWVsc2UtaWY9XCJmaXJzdFBhcnR5UGFnZSA9PT0gJ3Nob3RzJ1wiXG4gICAgICByZWY9XCJwYWdlUmVmXCJcbiAgICAgIDpxdWVyeT1cInF1ZXJ5XCJcbiAgICAgIEBhc2stYWk9XCJhc2tBSVdpdGhUZXh0XCJcbiAgICAvPlxuICAgIDxDbGlwYm9hcmRQYWdlXG4gICAgICB2LWVsc2UtaWY9XCJmaXJzdFBhcnR5UGFnZSA9PT0gJ2NsaXBzJ1wiXG4gICAgICByZWY9XCJwYWdlUmVmXCJcbiAgICAgIHYtbW9kZWw6ZmlsdGVyPVwiY2xpcEZpbHRlclwiXG4gICAgICA6cXVlcnk9XCJxdWVyeVwiXG4gICAgICBAYXNrLWFpPVwiYXNrQUlXaXRoVGV4dFwiXG4gICAgLz5cbiAgICA8Rm9jdXNTdGF0c1BhZ2VcbiAgICAgIHYtZWxzZS1pZj1cImZpcnN0UGFydHlQYWdlID09PSAnZm9jdXNTdGF0cydcIlxuICAgICAgcmVmPVwicGFnZVJlZlwiXG4gICAgICBAbmF2aWdhdGU9XCJoaWRlV2luZG93XCJcbiAgICAvPlxuXG4gICAgPCEtLSDlo7DmmI7lvI/mj5Lku7bliJfooajvvIhNMy4x77yJ77ya56ys5LiJ5pa55o+S5Lu25pWw5o2u55So5Y6f55Sf57uE5Lu25riy5p+TIC0tPlxuICAgIDxQbHVnaW5MaXN0UGFnZVxuICAgICAgdi1lbHNlLWlmPVwicGx1Z2luU3RhdGUub3BlbiAmJiBkZWNsYXJlZExpc3RcIlxuICAgICAgcmVmPVwicGFnZVJlZlwiXG4gICAgICA6cGx1Z2luLWlkPVwicGx1Z2luU3RhdGUucGx1Z2luSWQgPz8gJydcIlxuICAgICAgOml0ZW1zPVwiZGVjbGFyZWRMaXN0XCJcbiAgICAvPlxuXG4gICAgPCEtLSDmlofku7bmkJzntKLvvIhNNS4z77yJ77yaU3BvdGxpZ2h0IOWNs+aXtuaQnOe0oiAtLT5cbiAgICA8RmlsZXNQYWdlIHYtZWxzZS1pZj1cImZpcnN0UGFydHlQYWdlID09PSAnZmlsZXMnXCIgOnF1ZXJ5PVwicXVlcnlcIiAvPlxuXG4gICAgPCEtLSDlv6vmjbforr7nva7vvIjog7blm4rlhoXnm7Tovr7vvJrkuLvpopggLyDmlofmnKzmianlsZUgLyDliarotLTmnb/ljoblj7LvvIkgLS0+XG4gICAgPFNldHRpbmdzUGFnZSB2LWVsc2UtaWY9XCJmaXJzdFBhcnR5UGFnZSA9PT0gJ3NldHRpbmdzJ1wiIHJlZj1cInBhZ2VSZWZcIiAvPlxuXG4gICAgPCEtLSBBSSDlr7nor53vvIhQMC0z77ya6IO25ZuK5YaF5rWB5byP5a+56K+d77yJIC0tPlxuICAgIDxBSUNoYXRQYWdlIHYtZWxzZS1pZj1cImZpcnN0UGFydHlQYWdlID09PSAnYWknXCIgcmVmPVwicGFnZVJlZlwiIC8+XG5cbiAgICA8IS0tIOa1j+iniOWZqOagh+etvu+8iFAxLTXvvJpDaHJvbWUvU2FmYXJpIOagh+etvuaQnOe0ouS4juWIh+aNou+8iSAtLT5cbiAgICA8QnJvd3NlclRhYnNQYWdlIHYtZWxzZS1pZj1cImZpcnN0UGFydHlQYWdlID09PSAnYnJvd3NlclRhYnMnXCIgcmVmPVwicGFnZVJlZlwiIC8+XG5cbiAgICA8IS0tIOezu+e7n+S/oeaBr++8iOmYtuautTMuM2HvvJpDUFUv5YaF5a2YL+ejgeebmOamguiniO+8iSAtLT5cbiAgICA8U3lzdGVtSW5mb1BhZ2Ugdi1lbHNlLWlmPVwiZmlyc3RQYXJ0eVBhZ2UgPT09ICdzeXN0ZW1JbmZvJ1wiIHJlZj1cInBhZ2VSZWZcIiAvPlxuXG4gICAgPCEtLSDnqpflj6PliIfmjaLvvIjpmLbmrrUzLjNi77ya5pCc57Si5bm25r+A5rS756qX5Y+j77yJIC0tPlxuICAgIDxXaW5kb3dTd2l0Y2hlclBhZ2VcbiAgICAgIHYtZWxzZS1pZj1cImZpcnN0UGFydHlQYWdlID09PSAnd2luZG93U3dpdGNoZXInXCJcbiAgICAgIHJlZj1cInBhZ2VSZWZcIlxuICAgICAgOnF1ZXJ5PVwicXVlcnlcIlxuICAgIC8+XG5cbiAgICA8IS0tIOWbnuaUtuerme+8iOmYtuautTMuM2PvvJrmn6XnnIsv5riF56m6L+aBouWkje+8iSAtLT5cbiAgICA8VHJhc2hQYWdlIHYtZWxzZS1pZj1cImZpcnN0UGFydHlQYWdlID09PSAndHJhc2gnXCIgcmVmPVwicGFnZVJlZlwiIC8+XG5cbiAgICA8IS0tIOivjeWFuO+8iOmYtuautTMuM2TvvJrmn6Xor6Loi7HmlofljZXor43ph4rkuYnvvIkgLS0+XG4gICAgPERpY3Rpb25hcnlQYWdlIHYtZWxzZS1pZj1cImZpcnN0UGFydHlQYWdlID09PSAnZGljdGlvbmFyeSdcIiByZWY9XCJwYWdlUmVmXCIgOnF1ZXJ5PVwicXVlcnlcIiAvPlxuXG4gICAgPCEtLSDovbvph4/nrJTorrDvvIhNYXJrZG93biDmnKzlnLDlrZjlgqjvvIkgLS0+XG4gICAgPE5vdGVzUGFnZSB2LWVsc2UtaWY9XCJmaXJzdFBhcnR5UGFnZSA9PT0gJ25vdGVzJ1wiIHJlZj1cInBhZ2VSZWZcIiAvPlxuXG4gICAgPCEtLSDmj5DphpLkuovpobkgLS0+XG4gICAgPFJlbWluZGVyUGFnZSB2LWVsc2UtaWY9XCJmaXJzdFBhcnR5UGFnZSA9PT0gJ3JlbWluZGVycydcIiByZWY9XCJwYWdlUmVmXCIgOnF1ZXJ5PVwicXVlcnlcIiAvPlxuXG4gICAgPCEtLSDml6XljoYgLS0+XG4gICAgPENhbGVuZGFyUGFnZSB2LWVsc2UtaWY9XCJmaXJzdFBhcnR5UGFnZSA9PT0gJ2NhbGVuZGFyJ1wiIHJlZj1cInBhZ2VSZWZcIiAvPlxuXG4gICAgPCEtLSBRdWlja2xpbmsg6KGo5Y2V77yITTUuMiBGb3JtIOWfuuWFg++8iSAtLT5cbiAgICA8Rm9ybVBhZ2VcbiAgICAgIHYtZWxzZS1pZj1cImZpcnN0UGFydHlQYWdlID09PSAncWxmb3JtJ1wiXG4gICAgICByZWY9XCJwYWdlUmVmXCJcbiAgICAgIDpmaWVsZHM9XCJbXG4gICAgICAgIHsga2V5OiAnbmFtZScsIGxhYmVsOiAn5ZCN56ewJywgcGxhY2Vob2xkZXI6ICdHaXRIdWInIH0sXG4gICAgICAgIHsga2V5OiAndXJsJywgbGFiZWw6ICdVUkwnLCBwbGFjZWhvbGRlcjogJ2h0dHBzOi8vZ2l0aHViLmNvbScgfVxuICAgICAgXVwiXG4gICAgICBzdWJtaXQtbGFiZWw9XCLkv53lrZjpk77mjqVcIlxuICAgICAgOmluaXRpYWw9XCJ7IHVybDogJ2h0dHBzOi8vJyB9XCJcbiAgICAgIEBzdWJtaXQ9XCJzYXZlUXVpY2tsaW5rRm9ybVwiXG4gICAgICBAY2FuY2VsPVwicG9wUGFnZVwiXG4gICAgLz5cblxuICAgIDwhLS0g5Y+C5pWw5YyWIFF1aWNrbGlua++8iHtxdWVyeX0g5Y2V5Y+C5oiWIHtuYW1lfSDlpJrlj4LvvInvvJrlhYjloavlj4LmlbDlho3miZPlvIAgLS0+XG4gICAgPEZvcm1QYWdlXG4gICAgICB2LWVsc2UtaWY9XCJmaXJzdFBhcnR5UGFnZSA9PT0gJ3FsYXJnJyAmJiBxbEFyZ1RhcmdldFwiXG4gICAgICByZWY9XCJwYWdlUmVmXCJcbiAgICAgIDpmaWVsZHM9XCJxbEFyZ0ZpZWxkc1wiXG4gICAgICBzdWJtaXQtbGFiZWw9XCLmiZPlvIBcIlxuICAgICAgOmluaXRpYWw9XCJ7IHF1ZXJ5OiBxbEFyZ0luaXRpYWwgfVwiXG4gICAgICBAc3VibWl0PVwib3BlblF1aWNrbGlua0FyZ1wiXG4gICAgICBAY2FuY2VsPVwicG9wUGFnZVwiXG4gICAgLz5cblxuICAgIDxkaXYgdi1lbHNlLWlmPVwiIXBsdWdpblN0YXRlLm9wZW4gJiYgcmVzdWx0cy5sZW5ndGggPiAwXCIgY2xhc3M9XCJsYXVuY2hlci1ib2R5XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwibGF1bmNoZXItcmVzdWx0c1wiIDpjbGFzcz1cInsgJ2hhcy1kZXRhaWwnOiBjdXJyZW50RGV0YWlsIH1cIj5cbiAgICAgICAgPHRlbXBsYXRlIHYtZm9yPVwiZ3JvdXAgaW4gcmVzdWx0R3JvdXBzXCIgOmtleT1cImdyb3VwLmxhYmVsXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImxhdW5jaGVyLXNlY3Rpb24tbGFiZWxcIj57eyBncm91cC5sYWJlbCB9fTwvZGl2PlxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIHYtZm9yPVwic2xvdEl0ZW0gaW4gZ3JvdXAuaXRlbXNcIlxuICAgICAgICAgICAgOmtleT1cInNsb3RJdGVtLml0ZW0uZW50cnkua2V5XCJcbiAgICAgICAgICAgIGNsYXNzPVwibGF1bmNoZXItcmVzdWx0XCJcbiAgICAgICAgICAgIDpkYXRhLWluZGV4PVwic2xvdEl0ZW0uaW5kZXhcIlxuICAgICAgICAgICAgOmNsYXNzPVwieyBzZWxlY3RlZDogc2xvdEl0ZW0uaW5kZXggPT09IHNlbGVjdGVkSW5kZXggfVwiXG4gICAgICAgICAgICBAbW91c2VlbnRlcj1cInNlbGVjdGVkSW5kZXggPSBzbG90SXRlbS5pbmRleFwiXG4gICAgICAgICAgICBAbW91c2Vkb3duLnByZXZlbnQ9XCJydW5FbnRyeShzbG90SXRlbS5pdGVtLmVudHJ5KVwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImxhdW5jaGVyLXJlc3VsdC1pY29uXCIgOnN0eWxlPVwieyBiYWNrZ3JvdW5kOiBpY29uQmcoc2xvdEl0ZW0uaXRlbS5lbnRyeSkgfVwiPlxuICAgICAgICAgICAgICA8aW1nXG4gICAgICAgICAgICAgICAgdi1pZj1cImZhdmljb25PZihzbG90SXRlbS5pdGVtLmVudHJ5KVwiXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJsYXVuY2hlci1yZXN1bHQtZmF2aWNvblwiXG4gICAgICAgICAgICAgICAgOnNyYz1cImBpbWFnZTovLyR7ZW5jb2RlVVJJKGZhdmljb25PZihzbG90SXRlbS5pdGVtLmVudHJ5KSA/PyAnJyl9YFwiXG4gICAgICAgICAgICAgICAgYWx0PVwiXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPEFwcEljb25cbiAgICAgICAgICAgICAgICB2LWVsc2VcbiAgICAgICAgICAgICAgICA6aWNvbj1cInNsb3RJdGVtLml0ZW0uZW50cnkuaWNvblwiXG4gICAgICAgICAgICAgICAgOnNpemU9XCIxNlwiXG4gICAgICAgICAgICAgICAgY2xhc3M9XCJsYXVuY2hlci1yZXN1bHQtaWNvbi1zdmdcIlxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibGF1bmNoZXItcmVzdWx0LXRleHRcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImxhdW5jaGVyLXJlc3VsdC10aXRsZVwiPlxuICAgICAgICAgICAgICAgIDx0ZW1wbGF0ZSB2LWlmPVwiaGlnaGxpZ2h0UGFydHMoc2xvdEl0ZW0uaXRlbSlcIlxuICAgICAgICAgICAgICAgICAgPnt7IGhpZ2hsaWdodFBhcnRzKHNsb3RJdGVtLml0ZW0pIS5iZWZvcmVcbiAgICAgICAgICAgICAgICAgIH19PHNwYW4gY2xhc3M9XCJobFwiPnt7IGhpZ2hsaWdodFBhcnRzKHNsb3RJdGVtLml0ZW0pIS5oaXQgfX08L3NwYW5cbiAgICAgICAgICAgICAgICAgID57eyBoaWdobGlnaHRQYXJ0cyhzbG90SXRlbS5pdGVtKSEuYWZ0ZXIgfX1cbiAgICAgICAgICAgICAgICA8L3RlbXBsYXRlPlxuICAgICAgICAgICAgICAgIDx0ZW1wbGF0ZSB2LWVsc2U+e3sgc2xvdEl0ZW0uaXRlbS5lbnRyeS50aXRsZSB9fTwvdGVtcGxhdGU+XG4gICAgICAgICAgICAgICAgPHNwYW4gdi1pZj1cInNsb3RJdGVtLml0ZW0uZW50cnkuc3VidGl0bGVcIiBjbGFzcz1cImxhdW5jaGVyLXJlc3VsdC1zdWJ0aXRsZVwiPnt7XG4gICAgICAgICAgICAgICAgICBzbG90SXRlbS5pdGVtLmVudHJ5LnN1YnRpdGxlXG4gICAgICAgICAgICAgICAgfX08L3NwYW4+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwibGF1bmNoZXItcmVzdWx0LW1ldGFcIj5cbiAgICAgICAgICAgICAgPHNwYW4gdi1pZj1cInNsb3RJdGVtLml0ZW0uZW50cnkuYmFkZ2VcIiBjbGFzcz1cImxhdW5jaGVyLXJlc3VsdC1iYWRnZVwiPnt7XG4gICAgICAgICAgICAgICAgc2xvdEl0ZW0uaXRlbS5lbnRyeS5iYWRnZVxuICAgICAgICAgICAgICB9fTwvc3Bhbj5cbiAgICAgICAgICAgICAgPCEtLSDmlbDlrZflvr3moIflj6rlj5HliY0gMTAg5p2h77yIVjPvvJpSYXljYXN0IOivreS5ie+8jDEtOSArIDDvvIkgLS0+XG4gICAgICAgICAgICAgIDxzcGFuIHYtaWY9XCJzbG90SXRlbS5pbmRleCA8IDEwXCIgY2xhc3M9XCJsYXVuY2hlci1yZXN1bHQtcXVpY2tcIj57e1xuICAgICAgICAgICAgICAgIHNsb3RJdGVtLmluZGV4IDwgOSA/IHNsb3RJdGVtLmluZGV4ICsgMSA6IDBcbiAgICAgICAgICAgICAgfX08L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgIDwvZGl2PlxuICAgICAgPCEtLSDlj7Pkvqfor6bmg4XpnaLmnb/vvIhSYXljYXN0IExpc3QtRGV0YWls77yJIC0tPlxuICAgICAgPGRpdiB2LWlmPVwiY3VycmVudERldGFpbFwiIGNsYXNzPVwibGF1bmNoZXItZGV0YWlsXCI+XG4gICAgICAgIDxEZXRhaWxQYW5lbFxuICAgICAgICAgIDp0aXRsZT1cImN1cnJlbnREZXRhaWwudGl0bGVcIlxuICAgICAgICAgIDpjb250ZW50PVwiY3VycmVudERldGFpbC5jb250ZW50XCJcbiAgICAgICAgICA6Zm9ybWF0PVwiY3VycmVudERldGFpbC5mb3JtYXRcIlxuICAgICAgICAvPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG5cbiAgICA8ZGl2IHYtZWxzZS1pZj1cInF1ZXJ5ICYmICFwbHVnaW5TdGF0ZS5vcGVuXCIgY2xhc3M9XCJsYXVuY2hlci1lbXB0eVwiPlxuICAgICAgPGRpdiBjbGFzcz1cImxhdW5jaGVyLWVtcHR5LXRleHRcIj7msqHmnInmib7liLDjgIx7eyBxdWVyeSB9feOAjeebuOWFs+e7k+aenDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImxhdW5jaGVyLWZhbGxiYWNrLWxpc3RcIj5cbiAgICAgICAgPGRpdlxuICAgICAgICAgIHYtZm9yPVwiKGNtZCwgaSkgaW4gZmFsbGJhY2tDb21tYW5kc1wiXG4gICAgICAgICAgOmtleT1cImNtZC5pZFwiXG4gICAgICAgICAgY2xhc3M9XCJsYXVuY2hlci1mYWxsYmFjay1pdGVtXCJcbiAgICAgICAgICA6Y2xhc3M9XCJ7XG4gICAgICAgICAgICBzZWxlY3RlZDogaSA9PT0gZmFsbGJhY2tTZWxlY3RlZEluZGV4LFxuICAgICAgICAgICAgJ2FpLWVtcGhhc2lzJzogY21kLmlkID09PSAnZmFsbGJhY2s6YWknXG4gICAgICAgICAgfVwiXG4gICAgICAgICAgQG1vdXNlZW50ZXI9XCJmYWxsYmFja1NlbGVjdGVkSW5kZXggPSBpXCJcbiAgICAgICAgICBAbW91c2Vkb3duLnByZXZlbnQ9XCJydW5GYWxsYmFja0NvbW1hbmQoY21kKVwiXG4gICAgICAgID5cbiAgICAgICAgICA8QXBwSWNvbiA6aWNvbj1cImNtZC5pY29uXCIgOnNpemU9XCIxNlwiIGNsYXNzPVwibGF1bmNoZXItZmFsbGJhY2staWNvblwiIC8+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImxhdW5jaGVyLWZhbGxiYWNrLXRleHRcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJsYXVuY2hlci1mYWxsYmFjay10aXRsZVwiPnt7IGNtZC50aXRsZSB9fTwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImxhdW5jaGVyLWZhbGxiYWNrLXN1YnRpdGxlXCI+e3sgY21kLnN1YnRpdGxlIH19PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPHNwYW4gdi1pZj1cImNtZC5iYWRnZVwiIGNsYXNzPVwibGF1bmNoZXItZmFsbGJhY2stYmFkZ2VcIj57eyBjbWQuYmFkZ2UgfX08L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIOW6lemDqOWKqOS9nOagj++8iEIxIOKGkiBWNCBSYXljYXN0IOWMlu+8ie+8muW3puWbvuagh+aMiemSru+8jOWPs+S+p+OAjOS4u+WKqOS9nCDihrUgLyBBY3Rpb25zIOKMmEvjgI0gLS0+XG4gICAgPGRpdiB2LWlmPVwiIWZpcnN0UGFydHlQYWdlICYmICFwbHVnaW5TdGF0ZS5vcGVuXCIgY2xhc3M9XCJsYXVuY2hlci1mb290ZXJcIj5cbiAgICAgIDxidXR0b25cbiAgICAgICAgY2xhc3M9XCJsYXVuY2hlci1mb290ZXItbWVudVwiXG4gICAgICAgIHRpdGxlPVwi5b+r5o236ZSu77yIP++8iVwiXG4gICAgICAgIEBtb3VzZWRvd24ucHJldmVudD1cInNob3dTaG9ydGN1dHMgPSB0cnVlXCJcbiAgICAgID5cbiAgICAgICAgPEFwcEljb24gaWNvbj1cIm1lbnUtbGluZVwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgPC9idXR0b24+XG4gICAgICA8ZGl2IGNsYXNzPVwibGF1bmNoZXItZm9vdGVyLWFjdGlvbnNcIj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImxhdW5jaGVyLWZvb3Rlci1idG5cIiBAbW91c2Vkb3duLnByZXZlbnQ9XCJydW5TZWxlY3RlZFwiPlxuICAgICAgICAgIDxrYmQ+4oa1PC9rYmQ+IHt7IHByaW1hcnlMYWJlbCB9fVxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImxhdW5jaGVyLWZvb3Rlci1idG5cIiBAbW91c2Vkb3duLnByZXZlbnQ9XCJ0b2dnbGVBY3Rpb25QYW5lbFwiPlxuICAgICAgICAgIDxrYmQ+4oyYSzwva2JkPiDliqjkvZxcbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cblxuICAgIDwhLS0g5b+r5o236ZSu6YCf5p+l6Z2i5p2/77yI6Zi25q61NS4z77yJIC0tPlxuICAgIDxkaXYgdi1pZj1cInNob3dTaG9ydGN1dHNcIiBjbGFzcz1cInNob3J0Y3V0cy1vdmVybGF5XCIgQG1vdXNlZG93bi5wcmV2ZW50PVwic2hvd1Nob3J0Y3V0cyA9IGZhbHNlXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwic2hvcnRjdXRzLXBhbmVsXCIgQG1vdXNlZG93bi5zdG9wPlxuICAgICAgICA8ZGl2IGNsYXNzPVwic2hvcnRjdXRzLXRpdGxlXCI+5b+r5o236ZSuPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJzaG9ydGN1dHMtZ3JpZFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJzaG9ydGN1dC1pdGVtXCI+PGtiZD7ihpE8L2tiZD48a2JkPuKGkzwva2JkPjxzcGFuPuS4iuS4i+mAieaLqTwvc3Bhbj48L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwic2hvcnRjdXQtaXRlbVwiPjxrYmQ+4oa1PC9rYmQ+PHNwYW4+5omn6KGM5ZG95LukPC9zcGFuPjwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJzaG9ydGN1dC1pdGVtXCI+PGtiZD7ijJhLPC9rYmQ+PHNwYW4+5Yqo5L2c6Z2i5p2/PC9zcGFuPjwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJzaG9ydGN1dC1pdGVtXCI+PGtiZD7ijJgxLTk8L2tiZD48c3Bhbj7lv6vpgJ/miZPlvIA8L3NwYW4+PC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInNob3J0Y3V0LWl0ZW1cIj48a2JkPlRhYjwva2JkPjxzcGFuPlF1aWNrIEFJPC9zcGFuPjwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJzaG9ydGN1dC1pdGVtXCI+PGtiZD5lc2M8L2tiZD48c3Bhbj7lhbPpl60gLyDov5Tlm548L3NwYW4+PC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInNob3J0Y3V0LWl0ZW1cIj48a2JkPj88L2tiZD48c3Bhbj7lv6vmjbfplK7pnaLmnb88L3NwYW4+PC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInNob3J0Y3V0LWl0ZW1cIj48a2JkPuKMmEM8L2tiZD48c3Bhbj7lpI3liLbvvIjmlofku7Yv6Lev5b6E77yJPC9zcGFuPjwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJzaG9ydGN1dC1pdGVtXCI+PGtiZD7ijJhOPC9rYmQ+PHNwYW4+5paw5bu656yU6K6wPC9zcGFuPjwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInNob3J0Y3V0cy1oaW50XCI+5oyJ5Lu75oSP6ZSu5YWz6ZetPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuLyoqXG4gKiBMZWFmIMK3IOWQr+WKqOWZqOiDtuWbiueql++8iFJheWNhc3Qg5byP77yJXG4gKlxuICog5pys57uE5Lu25piv57yW5o6S5bGC77ya54q25oCB5LiO6aKG5Z+f6YC76L6R5ouG5Zyo5ZCM55uu5b2VIGNvbXBvc2FibGVzL1xuICogLSB1c2VMYXVuY2hlclBhZ2VzICAgICAg5YaF6IGU6aG15a+86Iiq5qCIXG4gKiAtIHVzZVNlYXJjaEhpc3RvcnlOYXYgICDihpEg5pCc57Si5Y6G5Y+y5a+86IiqXG4gKiAtIHVzZUlkbGVXYXRjaGVyICAgICAgICDpl7Lnva4gNjBzIFBvcCB0byBSb290XG4gKiAtIHVzZUNvbW1hbmRTb3VyY2VzICAgICDlkb3ku6TmupDogZrlkIjvvIhSZWdpc3RyeS/pnZnmgIEv5o+S5Lu2L+WKqOaAge+8iSsg5Yir5ZCNXG4gKiAtIHVzZVVuaWZpZWRTZWFyY2ggICAgICDnu5/kuIDmt7flkIjmkJzntKLvvIjlkIzmraUgKyDlvILmraXlop7ph4/vvIlcbiAqIC0gdXNlQWN0aW9uUGFuZWwgICAgICAgIOe7k+aenOe6pyDijJhLIOWKqOS9nOmdouadv1xuICog5qih5p2/5Lit55qE5YaF6IGU6aG15YiG5Y+R5LiO57uT5p6c5YiX6KGo5L+d5oyB5YaF6IGU77yI5ouG5a2Q57uE5Lu26KeB5ZCO57ut5om55qyh77yJ44CCXG4gKi9cbmltcG9ydCB7IGNvbXB1dGVkLCBvbk1vdW50ZWQsIG9uVW5tb3VudGVkLCByZWYsIG5leHRUaWNrLCB3YXRjaCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCBBcHBJY29uIGZyb20gJ0Bjb21wb25lbnRzL0FwcEljb24udnVlJ1xuaW1wb3J0IHtcbiAgYnVpbGRRdWlja2xpbmtVcmwsXG4gIGJ1aWxkUXVpY2tsaW5rVXJsTXVsdGksXG4gIHF1aWNrbGlua0FyZ05hbWVzLFxuICBGSVJTVF9QQVJUWV9DT01NQU5EUyxcbiAgdHlwZSBDb21tYW5kRW50cnksXG4gIHR5cGUgRmlyc3RQYXJ0eVBhZ2Vcbn0gZnJvbSAnQHNoYXJlZC9jb21tYW5kcydcbmltcG9ydCB7IG5vcm1hbGl6ZVdpdGhNYXAsIHR5cGUgU2NvcmVkRW50cnkgfSBmcm9tICdAc2hhcmVkL3NlYXJjaCdcbmltcG9ydCB7XG4gIERFRkFVTFRfRkFMTEJBQ0tfQ09NTUFORFMsXG4gIHJlbmRlckZhbGxiYWNrQ29tbWFuZCxcbiAgdHlwZSBGYWxsYmFja0NvbW1hbmRcbn0gZnJvbSAnQHNoYXJlZC9mYWxsYmFja0NvbW1hbmRzJ1xuaW1wb3J0IHsgdXNlVXNhZ2VCb29zdCB9IGZyb20gJ0ByZW5kZXJlci9jb21wb3NhYmxlcy91c2VVc2FnZUJvb3N0J1xuaW1wb3J0IHsgZXhlY3V0ZUNvbW1hbmQgfSBmcm9tICdAcmVuZGVyZXIvdXRpbHMvY29tbWFuZFJ1bm5lcidcbmltcG9ydCBEZXRhaWxQYW5lbCBmcm9tICcuL2NvbXBvbmVudHMvRGV0YWlsUGFuZWwudnVlJ1xuaW1wb3J0IHtcbiAgYWRkRG9jdW1lbnRMaXN0ZW5lcixcbiAgYWRkV2luZG93TGlzdGVuZXIsXG4gIGRpZ2l0VG9JbmRleCxcbiAgZ3JvdXBSZXN1bHRzRm9yRGlzcGxheSxcbiAgcHJpbWFyeUFjdGlvbkxhYmVsXG59IGZyb20gJy4vY29tcG9zYWJsZXMvbGF1bmNoZXJJbnRlcmFjdGlvbnMnXG5pbXBvcnQge1xuICBGSVJTVF9QQVJUWV9QQUdFX1RJVExFUyxcbiAgcHJvdmlkZVBhZ2VUaXRsZSxcbiAgdXNlTGF1bmNoZXJQYWdlc1xufSBmcm9tICcuL2NvbXBvc2FibGVzL3VzZUxhdW5jaGVyUGFnZXMnXG5pbXBvcnQgeyB1c2VMYXVuY2hlckJ1c3kgfSBmcm9tICcuL2NvbXBvc2FibGVzL3VzZUxhdW5jaGVyQnVzeSdcbmltcG9ydCB0eXBlIHsgS2luZEZpbHRlciB9IGZyb20gJy4vcGFnZXMvY2xpcGJvYXJkTG9naWMnXG5pbXBvcnQgeyB1c2VTZWFyY2hIaXN0b3J5TmF2IH0gZnJvbSAnLi9jb21wb3NhYmxlcy91c2VTZWFyY2hIaXN0b3J5TmF2J1xuaW1wb3J0IHsgdXNlSWRsZVdhdGNoZXIgfSBmcm9tICcuL2NvbXBvc2FibGVzL3VzZUlkbGVXYXRjaGVyJ1xuaW1wb3J0IHsgdXNlQ29tbWFuZFNvdXJjZXMsIG1vZHVsZVRvRW50cnkgfSBmcm9tICcuL2NvbXBvc2FibGVzL3VzZUNvbW1hbmRTb3VyY2VzJ1xuaW1wb3J0IHsgdXNlVW5pZmllZFNlYXJjaCB9IGZyb20gJy4vY29tcG9zYWJsZXMvdXNlVW5pZmllZFNlYXJjaCdcbmltcG9ydCB7IHVzZUFjdGlvblBhbmVsIH0gZnJvbSAnLi9jb21wb3NhYmxlcy91c2VBY3Rpb25QYW5lbCdcbmltcG9ydCBGb2N1c1BhZ2UgZnJvbSAnLi9wYWdlcy9Gb2N1c1BhZ2UudnVlJ1xuaW1wb3J0IFNuaXBwZXRzUGFnZSBmcm9tICcuL3BhZ2VzL1NuaXBwZXRzUGFnZS52dWUnXG5pbXBvcnQgQ2xpcGJvYXJkUGFnZSBmcm9tICcuL3BhZ2VzL0NsaXBib2FyZFBhZ2UudnVlJ1xuaW1wb3J0IFNob3RzSW5kZXhQYWdlIGZyb20gJy4vcGFnZXMvU2hvdHNJbmRleFBhZ2UudnVlJ1xuaW1wb3J0IFNjaGVkdWxlUGFnZSBmcm9tICcuL3BhZ2VzL1NjaGVkdWxlUGFnZS52dWUnXG5pbXBvcnQgRm9jdXNTdGF0c1BhZ2UgZnJvbSAnLi9wYWdlcy9Gb2N1c1N0YXRzUGFnZS52dWUnXG5pbXBvcnQgUGx1Z2luTGlzdFBhZ2UgZnJvbSAnLi9wYWdlcy9QbHVnaW5MaXN0UGFnZS52dWUnXG5pbXBvcnQgRmlsZXNQYWdlIGZyb20gJy4vcGFnZXMvRmlsZXNQYWdlLnZ1ZSdcbmltcG9ydCBTZXR0aW5nc1BhZ2UgZnJvbSAnLi9wYWdlcy9TZXR0aW5nc1BhZ2UudnVlJ1xuaW1wb3J0IEZvcm1QYWdlIGZyb20gJy4vcGFnZXMvRm9ybVBhZ2UudnVlJ1xuaW1wb3J0IEFJQ2hhdFBhZ2UgZnJvbSAnLi9wYWdlcy9BSUNoYXRQYWdlLnZ1ZSdcbmltcG9ydCBCcm93c2VyVGFic1BhZ2UgZnJvbSAnLi9wYWdlcy9Ccm93c2VyVGFic1BhZ2UudnVlJ1xuaW1wb3J0IFN5c3RlbUluZm9QYWdlIGZyb20gJy4vcGFnZXMvU3lzdGVtSW5mb1BhZ2UudnVlJ1xuaW1wb3J0IFdpbmRvd1N3aXRjaGVyUGFnZSBmcm9tICcuL3BhZ2VzL1dpbmRvd1N3aXRjaGVyUGFnZS52dWUnXG5pbXBvcnQgVHJhc2hQYWdlIGZyb20gJy4vcGFnZXMvVHJhc2hQYWdlLnZ1ZSdcbmltcG9ydCBEaWN0aW9uYXJ5UGFnZSBmcm9tICcuL3BhZ2VzL0RpY3Rpb25hcnlQYWdlLnZ1ZSdcbmltcG9ydCBOb3Rlc1BhZ2UgZnJvbSAnLi9wYWdlcy9Ob3Rlc1BhZ2UudnVlJ1xuaW1wb3J0IFJlbWluZGVyUGFnZSBmcm9tICcuL3BhZ2VzL1JlbWluZGVyUGFnZS52dWUnXG5pbXBvcnQgQ2FsZW5kYXJQYWdlIGZyb20gJy4vcGFnZXMvQ2FsZW5kYXJQYWdlLnZ1ZSdcbmltcG9ydCB0eXBlIHsgUGx1Z2luTGlzdEl0ZW0gfSBmcm9tICdAc2hhcmVkL3BsdWdpbi1wcm90b2NvbCdcblxuY29uc3QgcXVlcnkgPSByZWYoJycpXG5jb25zdCBzZWxlY3RlZEluZGV4ID0gcmVmKDApXG5jb25zdCBmYWxsYmFja1NlbGVjdGVkSW5kZXggPSByZWYoMClcbmNvbnN0IGlucHV0UmVmID0gcmVmPEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsPihudWxsKVxuXG4vKiog6Zi25q61NS4z77ya5b+r5o236ZSu6YCf5p+l6Z2i5p2/5pi+56S654q25oCBICovXG5jb25zdCBzaG93U2hvcnRjdXRzID0gcmVmKGZhbHNlKVxuXG4vKiog5YaF6IGU6aG15a+86Iiq5qCI77yITTUuMu+8iSAqL1xuY29uc3QgeyBwYWdlU3RhY2ssIGZpcnN0UGFydHlQYWdlLCBwYWdlUmVmLCBwdXNoUGFnZSwgcG9wUGFnZSB9ID0gdXNlTGF1bmNoZXJQYWdlcygpXG5cbi8qKiBJNyDpnaLljIXlsZHvvJrlkJEgQ2Fwc3VsZVBhZ2Ug5o+Q5L6b5b2T5YmN6aG15qCH6aKY77yI5bqV5qCP5bem5L6n6L+U5Zue5oyJ6ZKu77yJICovXG5wcm92aWRlUGFnZVRpdGxlKFxuICBjb21wdXRlZCgoKSA9PiAoZmlyc3RQYXJ0eVBhZ2UudmFsdWUgPyBGSVJTVF9QQVJUWV9QQUdFX1RJVExFU1tmaXJzdFBhcnR5UGFnZS52YWx1ZV0gOiBudWxsKSlcbilcblxuLyoqIEk2IOWJqui0tOadv+exu+Wei+etm+mAie+8iOeKtuaAgeaPkOWNh+WIsOaQnOe0ouagj+S4i+aLie+8jHYtbW9kZWw6ZmlsdGVyIOS4i+WPkemhtemdou+8iSAqL1xuY29uc3QgY2xpcEZpbHRlciA9IHJlZjxLaW5kRmlsdGVyPignYWxsJylcblxuLyoqIEk5IOe7n+S4gOWKoOi9veaAge+8muWGheiBlOmhteaFoui3r+W+hOW/meeijOiuoeaVsCAqL1xuY29uc3QgeyBidXN5Q291bnQgfSA9IHVzZUxhdW5jaGVyQnVzeSgpXG5cbi8qKiDlvZPliY3miZPlvIDnmoTmj5Lku7bnirbmgIHvvIjmiZPlvIDml7bmkJzntKLmoYbovazkuLrmj5Lku7blia/ovpPlhaXmoYbvvIkgKi9cbmNvbnN0IHBsdWdpblN0YXRlID0gcmVmPHtcbiAgb3BlbjogYm9vbGVhblxuICBwbHVnaW5JZDogc3RyaW5nIHwgbnVsbFxuICBwbHVnaW5OYW1lOiBzdHJpbmcgfCBudWxsXG4gIHN1YklucHV0UGxhY2Vob2xkZXI6IHN0cmluZyB8IG51bGxcbn0+KHsgb3BlbjogZmFsc2UsIHBsdWdpbklkOiBudWxsLCBwbHVnaW5OYW1lOiBudWxsLCBzdWJJbnB1dFBsYWNlaG9sZGVyOiBudWxsIH0pXG5cbi8qKiDlo7DmmI7lvI8gTGlzdO+8iE0zLjHvvInvvJrmj5Lku7bmj5DkuqTnmoQgaXRlbXPvvIzog7blm4rljp/nlJ/muLLmn5MgKi9cbmNvbnN0IGRlY2xhcmVkTGlzdCA9IHJlZjxQbHVnaW5MaXN0SXRlbVtdIHwgbnVsbD4obnVsbClcblxuLyoqIEIxIMK3IOaQnOe0ouWOhuWPsiDihpEg5oGi5aSNICovXG5jb25zdCB7XG4gIGhpc3RvcnlDYWNoZSxcbiAgaGlzdG9yeU5hdkFjdGl2ZSxcbiAgaGlzdG9yeU5hdkFwcGx5aW5nLFxuICBleGl0SGlzdG9yeU5hdixcbiAgZW50ZXJIaXN0b3J5TmF2LFxuICBzdGVwSGlzdG9yeU5hdlxufSA9IHVzZVNlYXJjaEhpc3RvcnlOYXYocXVlcnkpXG5cbi8qKiDlkb3ku6TmupDogZrlkIjvvIhSZWdpc3RyeSAvIOmdmeaAgSAvIOaPkuS7tiAvIOWKqOaAge+8iSsg5Yir5ZCNICsgZmF2aWNvbiAqL1xuY29uc3Qge1xuICByZWdpc3RyeUNvbW1hbmRzLFxuICBsb2FkUmVnaXN0cnlDb21tYW5kcyxcbiAgbG9hZER5bmFtaWNDb21tYW5kcyxcbiAgbG9hZFBsdWdpbkNvbW1hbmRzLFxuICBlbnJpY2hBbGlhc2VzLFxuICBmYXZpY29uT2YsXG4gIGljb25CZyxcbiAgZW50cmllc1xufSA9IHVzZUNvbW1hbmRTb3VyY2VzKClcblxuLyoqIOepuuaAgeW7uuiuru+8muWbuuWumuWKqOS9nCArIOacgOi/keS9v+eUqCArIOaUtuiXj++8iOaMiSBrZXkg5Y676YeN77yJICovXG5jb25zdCBzdWdnZXN0aW9ucyA9IHJlZjxTY29yZWRFbnRyeVtdPihbXSlcblxuLyoqIOS4i+S4gOS4quS8muiuruadoeebru+8iFY0IFAwLTEg5om55qyhNO+8mlJheWNhc3Qg56m65oCB44CMbmV4dCBldmVudOOAjeWvuem9kO+8ieOAglxuICogIOS7heWcqOacieWPr+WFpeS8mumTvuaOpeaXtuWxleekuu+8m+acquaOiOadgy/pnZ4gbWFjL+afpeivouWksei0pemdmem7mOaXoOadoeebruOAgiAqL1xuYXN5bmMgZnVuY3Rpb24gZmV0Y2hOZXh0TWVldGluZ0VudHJ5KCk6IFByb21pc2U8Q29tbWFuZEVudHJ5IHwgbnVsbD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgYXV0aCwgbmV4dCB9ID0gYXdhaXQgd2luZG93LmFwaS5jYWxlbmRhci5uZXh0KClcbiAgICBpZiAoYXV0aCAhPT0gJ2F1dGhvcml6ZWQnIHx8ICFuZXh0Py5tZWV0aW5nKSByZXR1cm4gbnVsbFxuICAgIGNvbnN0IHN0YXJ0ID0gbmV3IERhdGUobmV4dC5zdGFydE1zKVxuICAgIGNvbnN0IGhtID0gYCR7U3RyaW5nKHN0YXJ0LmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsICcwJyl9OiR7U3RyaW5nKHN0YXJ0LmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgJzAnKX1gXG4gICAgcmV0dXJuIHtcbiAgICAgIGtleTogJ2NhbDpuZXh0JyxcbiAgICAgIGljb246ICdjYWxlbmRhci1saW5lJyxcbiAgICAgIHRpdGxlOiBgJHtobX0gJHtuZXh0LnRpdGxlfWAsXG4gICAgICBzdWJ0aXRsZTogYOaXpeeoiyDCtyAke25leHQubWVldGluZy5wcm92aWRlcn1gLFxuICAgICAgYmFkZ2U6ICfkvJrorq4nLFxuICAgICAgYWN0aW9uOiB7IHR5cGU6ICdvcGVuVXJsJywgdXJsOiBuZXh0Lm1lZXRpbmcudXJsIH1cbiAgICB9XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVmcmVzaFN1Z2dlc3Rpb25zKCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KClcbiAgY29uc3QgbGlzdDogQ29tbWFuZEVudHJ5W10gPSBbXVxuICAvLyDkuIvkuIDkuKrkvJrorq7nva7pobbvvIhSYXljYXN0IOepuuaAgeWvuem9kO+8iVxuICBjb25zdCBtZWV0aW5nID0gYXdhaXQgZmV0Y2hOZXh0TWVldGluZ0VudHJ5KClcbiAgaWYgKG1lZXRpbmcpIHtcbiAgICBzZWVuLmFkZChtZWV0aW5nLmtleSlcbiAgICBsaXN0LnB1c2gobWVldGluZylcbiAgfVxuICAvLyDlm7rlrprlkb3ku6TvvJrnrKzkuIDmlrnlhoXogZTpobXvvIhSYXljYXN0IOagueaAgeW7uuiuru+8iVxuICBmb3IgKGNvbnN0IGVudHJ5IG9mIEZJUlNUX1BBUlRZX0NPTU1BTkRTKSB7XG4gICAgaWYgKCFzZWVuLmhhcyhlbnRyeS5rZXkpKSB7XG4gICAgICBzZWVuLmFkZChlbnRyeS5rZXkpXG4gICAgICBsaXN0LnB1c2goZW50cnkpXG4gICAgfVxuICB9XG4gIHRyeSB7XG4gICAgY29uc3QgW3JlY2VudElkcywgZmF2SWRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIC8vIGZyZWNlbmN5IOWFqOexu+Wei+WQjuiusOW9leWQqyBhcHA6L3N5c2NtZDog562J6Z2e5qih5Z2XIGtlee+8muWkmuWPluS4gOS6m++8jFxuICAgICAgLy8g5Y+q6K6p6IO95pig5bCE5oiQ5qih5Z2X5p2h55uu55qE5YmNIDYg5Liq5Y2g55So5bu66K6u5L2NXG4gICAgICB3aW5kb3cuYXBpLnVzYWdlLmdldFJlY2VudCgyMCksXG4gICAgICB3aW5kb3cuYXBpLnVzYWdlLmdldEZhdm9yaXRlcygpXG4gICAgXSlcbiAgICBsZXQgcmVjZW50VGFrZW4gPSAwXG4gICAgZm9yIChjb25zdCByYXcgb2YgcmVjZW50SWRzKSB7XG4gICAgICBpZiAocmVjZW50VGFrZW4gPj0gNikgYnJlYWtcbiAgICAgIGNvbnN0IGUgPSBtb2R1bGVUb0VudHJ5KHJhdylcbiAgICAgIGlmICghZSB8fCBzZWVuLmhhcyhlLmtleSkpIGNvbnRpbnVlXG4gICAgICBzZWVuLmFkZChlLmtleSlcbiAgICAgIGxpc3QucHVzaChlKVxuICAgICAgcmVjZW50VGFrZW4rK1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHJhdyBvZiBmYXZJZHMpIHtcbiAgICAgIGNvbnN0IGUgPSBtb2R1bGVUb0VudHJ5KHJhdylcbiAgICAgIGlmICghZSB8fCBzZWVuLmhhcyhlLmtleSkpIGNvbnRpbnVlXG4gICAgICBzZWVuLmFkZChlLmtleSlcbiAgICAgIGxpc3QucHVzaChlKVxuICAgIH1cbiAgfSBjYXRjaCB7XG4gICAgLyog5L2/55So6K6w5b2V6K+75Y+W5aSx6LSl5pe25LuF5bGV56S65Zu65a6a5Yqo5L2cICovXG4gIH1cbiAgLy8gUDItOe+8muacgOi/keaQnOe0ouWOhuWPsu+8iOacgOWkmiA1IOadoe+8jOaOkuWcqOWbuuWumuWKqOS9nOS5i+WQju+8iVxuICB0cnkge1xuICAgIGNvbnN0IGhpc3RvcnkgPSAoYXdhaXQgd2luZG93LmFwaS5zZWFyY2hIaXN0b3J5LmdldCgpKSBhcyBzdHJpbmdbXVxuICAgIGhpc3RvcnlDYWNoZS52YWx1ZSA9IGhpc3RvcnkgLy8gQjHvvJrihpEg5oGi5aSN5pCc57Si5Y6G5Y+y55So77yI5pyA5paw5Zyo5YmN77yJXG4gICAgZm9yIChjb25zdCBxIG9mIGhpc3Rvcnkuc2xpY2UoMCwgNSkpIHtcbiAgICAgIGNvbnN0IGtleSA9IGBoaXN0b3J5OiR7cX1gXG4gICAgICBpZiAoIXNlZW4uaGFzKGtleSkpIHtcbiAgICAgICAgc2Vlbi5hZGQoa2V5KVxuICAgICAgICBsaXN0LnB1c2goe1xuICAgICAgICAgIGtleSxcbiAgICAgICAgICBpY29uOiAnaGlzdG9yeS1saW5lJyxcbiAgICAgICAgICB0aXRsZTogcSxcbiAgICAgICAgICBzdWJ0aXRsZTogJ+acgOi/keaQnOe0oicsXG4gICAgICAgICAgYmFkZ2U6ICfmnIDov5HmkJzntKInLFxuICAgICAgICAgIGFjdGlvbjogeyB0eXBlOiAnc2VhcmNoUXVlcnknLCBxdWVyeTogcSB9XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICAvKiDmkJzntKLljoblj7Lor7vlj5blpLHotKXkuI3pmLvloZ4gKi9cbiAgfVxuICBzdWdnZXN0aW9ucy52YWx1ZSA9IGxpc3Quc2xpY2UoMCwgMTApLm1hcCgoZW50cnkpID0+ICh7IGVudHJ5LCBoaWdobGlnaHQ6IG51bGwsIHNjb3JlOiAwIH0pKVxufVxuXG4vKiog5L2/55So57uf6K6h77yI5o6S5bqP6Ieq5a2m5Lmg77yM57u05bqmIDHvvInvvJrpopHmrKEgw5cg5paw6L+R5re35ZCI5Yqg5p2D77yM5LiOIOKMmEsg6Z2i5p2/5YWx55SoICovXG5jb25zdCB7IHJlZnJlc2g6IHJlZnJlc2hSZWNlbnRVc2FnZSwgYm9vc3Q6IHVzYWdlQm9vc3QgfSA9IHVzZVVzYWdlQm9vc3QoKVxuXG4vKiogUDAtMSDnu5/kuIDmt7flkIjmkJzntKIgKi9cbmNvbnN0IHsgcmVzdWx0cywgc2NoZWR1bGVGb3JRdWVyeSwgcmVzZXRUb1N1Z2dlc3Rpb25zIH0gPSB1c2VVbmlmaWVkU2VhcmNoKHtcbiAgZW50cmllczogKCkgPT4gZW50cmllcy52YWx1ZSxcbiAgdXNhZ2VCb29zdCxcbiAgc3VnZ2VzdGlvbnNcbn0pXG5cbi8qKiDlvZPliY3pgInkuK3pobnnmoTor6bmg4XvvIjlj7PkvqcgRGV0YWlsIOmdouadv++8iSAqL1xuY29uc3QgY3VycmVudERldGFpbCA9IGNvbXB1dGVkKCgpID0+IHtcbiAgY29uc3QgaXRlbSA9IHJlc3VsdHMudmFsdWVbc2VsZWN0ZWRJbmRleC52YWx1ZV1cbiAgaWYgKCFpdGVtKSByZXR1cm4gbnVsbFxuICBjb25zdCBjbWQgPSByZWdpc3RyeUNvbW1hbmRzLnZhbHVlLmZpbmQoKGMpID0+IGMuaWQgPT09IGl0ZW0uZW50cnkua2V5KVxuICBpZiAoIWNtZD8uZGV0YWlsKSByZXR1cm4gbnVsbFxuICByZXR1cm4gdHlwZW9mIGNtZC5kZXRhaWwgPT09ICdmdW5jdGlvbicgPyBudWxsIDogY21kLmRldGFpbFxufSlcblxuY29uc3Qgc2VhcmNoUGxhY2Vob2xkZXIgPSBjb21wdXRlZCgoKSA9PiB7XG4gIGlmIChmaXJzdFBhcnR5UGFnZS52YWx1ZSA9PT0gJ2ZvY3VzJykgcmV0dXJuICflm57ovaYg5byA5aeLIC8g5pqC5YGc5LiT5rOoJ1xuICBpZiAoZmlyc3RQYXJ0eVBhZ2UudmFsdWUgPT09ICdzbmlwcGV0cycpIHJldHVybiAn5pCc57Si54mH5q614oCmJ1xuICBpZiAoZmlyc3RQYXJ0eVBhZ2UudmFsdWUgPT09ICdzY2hlZHVsZScpIHJldHVybiAn5rWP6KeI5pyq5p2lIDcg5aSp5pel56iL4oCmJ1xuICBpZiAoZmlyc3RQYXJ0eVBhZ2UudmFsdWUgPT09ICdzaG90cycpIHJldHVybiAn5oyJ5paH5Lu25ZCN5oiW5Zu+5YaF5paH5a2X5pCc57Si5oiq5Zu+4oCmJ1xuICBpZiAoZmlyc3RQYXJ0eVBhZ2UudmFsdWUgPT09ICdjbGlwcycpIHJldHVybiAn5rWP6KeI5Ymq6LS05p2/5Y6G5Y+y4oCmJ1xuICBpZiAoZmlyc3RQYXJ0eVBhZ2UudmFsdWUgPT09ICdmb2N1c1N0YXRzJykgcmV0dXJuICfkuJPms6jnu5/orqHpgJ/op4gnXG4gIGlmIChmaXJzdFBhcnR5UGFnZS52YWx1ZSA9PT0gJ2ZpbGVzJykgcmV0dXJuICfmkJzntKLmlofku7blkI3igKYnXG4gIGlmIChmaXJzdFBhcnR5UGFnZS52YWx1ZSA9PT0gJ25vdGVzJykgcmV0dXJuICfmkJzntKLmiJbmlrDlu7rnrJTorrDigKYnXG4gIGlmIChmaXJzdFBhcnR5UGFnZS52YWx1ZSA9PT0gJ2FpJykgcmV0dXJuICfovpPlhaXpl67popjvvIzlm57ovablj5HpgIHigKYnXG4gIHJldHVybiBwbHVnaW5TdGF0ZS52YWx1ZS5zdWJJbnB1dFBsYWNlaG9sZGVyID8/ICfmkJzntKLlupTnlKjjgIHlkb3ku6TjgIHmlofku7bigKYnXG59KVxuXG4vKiog5bqV6YOo5Yqo5L2c5qCP5Li75Yqo5L2c5o+Q56S677yIQjHvvInvvJrot5/pmo/lvZPliY3pgInkuK3pobnnmoTlm57ovabor63kuYnvvIjmiZPlvIAv5aSN5Yi2L+Whq+WFpS/miafooYzvvIkgKi9cbmNvbnN0IHByaW1hcnlMYWJlbCA9IGNvbXB1dGVkKCgpID0+IHtcbiAgY29uc3QgaXRlbSA9IHJlc3VsdHMudmFsdWVbc2VsZWN0ZWRJbmRleC52YWx1ZV1cbiAgcmV0dXJuIHByaW1hcnlBY3Rpb25MYWJlbChpdGVtPy5lbnRyeS5hY3Rpb24udHlwZSlcbn0pXG5cbi8qKiDooqvnlKjmiLflgZznlKjnmoTlhZzlupXlkb3ku6QgaWTvvIjlkK/liqjlmajnrqHnkIbpobXlj6/phY3vvJvllKTotbfml7bph43or7vvvIxWNCBQMC0z77yJICovXG5jb25zdCBmYWxsYmFja0Rpc2FibGVkID0gcmVmPHN0cmluZ1tdPihbXSlcblxuYXN5bmMgZnVuY3Rpb24gbG9hZEZhbGxiYWNrRGlzYWJsZWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgZmFsbGJhY2tEaXNhYmxlZC52YWx1ZSA9IGF3YWl0IHdpbmRvdy5hcGkucHJlZmVyZW5jZXMuZ2V0RmFsbGJhY2tEaXNhYmxlZCgpXG4gIH0gY2F0Y2gge1xuICAgIC8qIOivu+WPluWksei0peaMieWFqOWQr+eUqOWkhOeQhiAqL1xuICB9XG59XG5cbi8qKiBGYWxsYmFjayBDb21tYW5kc++8muaQnOe0ouaXoOe7k+aenOaXtueahOWFnOW6leWRveS7pOWIl+ihqO+8iOWvueaghyBSYXljYXN077yM5Y+v6YWN572u5ZCv5YGc77yJICovXG5jb25zdCBmYWxsYmFja0NvbW1hbmRzID0gY29tcHV0ZWQ8RmFsbGJhY2tDb21tYW5kW10+KCgpID0+IHtcbiAgY29uc3QgcSA9IHF1ZXJ5LnZhbHVlLnRyaW0oKVxuICBpZiAoIXEpIHJldHVybiBbXVxuICByZXR1cm4gREVGQVVMVF9GQUxMQkFDS19DT01NQU5EUy5maWx0ZXIoKGNtZCkgPT4gIWZhbGxiYWNrRGlzYWJsZWQudmFsdWUuaW5jbHVkZXMoY21kLmlkKSkubWFwKFxuICAgIChjbWQpID0+IHJlbmRlckZhbGxiYWNrQ29tbWFuZChjbWQsIHEpXG4gIClcbn0pXG5cbi8qKiDlvZPliY3lvoXmiZPlvIDnmoTlj4LmlbDljJYgUXVpY2tsaW5r77yIcWxhcmcg6KGo5Y2V6aG155qE5pWw5o2u5rqQ77yJICovXG5jb25zdCBxbEFyZ1RhcmdldCA9IHJlZjxDb21tYW5kRW50cnkgfCBudWxsPihudWxsKVxuLyoqIOWPguaVsOWIneWAvO+8mueUqOaIt+aQnOe0ouivjeebtOaOpeW4puWFpe+8iFJheWNhc3Qg55qEIGFyZ3VtZW50IOmihOWhq++8m+S7hSB7cXVlcnl9IOWNleWPguivreS5ie+8iSAqL1xuY29uc3QgcWxBcmdJbml0aWFsID0gcmVmKCcnKVxuXG4vKiogcWxhcmcg6KGo5Y2V5a2X5q6177yae3F1ZXJ5fSDljZXlj4Ig4oaSIOS4gOagvOOAjOWPguaVsOOAje+8m+WRveWQjeWkmuWPgiDihpIg5q+P5Liq5Y2g5L2N56ym5LiA5qC877yIVjQgUDAtNO+8iSAqL1xuY29uc3QgcWxBcmdGaWVsZHMgPSBjb21wdXRlZCgoKSA9PiB7XG4gIGNvbnN0IHQgPSBxbEFyZ1RhcmdldC52YWx1ZVxuICBpZiAoIXQgfHwgdC5hY3Rpb24udHlwZSAhPT0gJ3F1aWNrbGluaycpIHJldHVybiBbXSBhcyBBcnJheTx7IGtleTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIH0+XG4gIGNvbnN0IG5hbWVzID0gcXVpY2tsaW5rQXJnTmFtZXModC5hY3Rpb24udXJsKVxuICBpZiAobmFtZXMubGVuZ3RoID4gMCkgcmV0dXJuIG5hbWVzLm1hcCgobikgPT4gKHsga2V5OiBuLCBsYWJlbDogbiB9KSlcbiAgcmV0dXJuIFt7IGtleTogJ3F1ZXJ5JywgbGFiZWw6ICflj4LmlbAnIH1dXG59KVxuXG4vKiogUG9wIHRvIFJvb3TvvJrmuIUgcXVlcnkgLyDpobXmoIggLyDpnaLmnb/kuI7ljoblj7Llr7zoiKrmgIHvvIzmgaLlpI3lu7rorq7liJfooajvvIhSYXljYXN0IOihjOS4uu+8iSAqL1xuZnVuY3Rpb24gcG9wVG9Sb290KCk6IHZvaWQge1xuICBleGl0SGlzdG9yeU5hdigpXG4gIHNob3dTaG9ydGN1dHMudmFsdWUgPSBmYWxzZVxuICBhY3Rpb25QYW5lbEVudHJ5LnZhbHVlID0gbnVsbFxuICBxbEFyZ1RhcmdldC52YWx1ZSA9IG51bGxcbiAgaWYgKHBsdWdpblN0YXRlLnZhbHVlLm9wZW4pIHZvaWQgd2luZG93LmFwaS5sYXVuY2hlci5jbG9zZVBsdWdpbigpXG4gIHF1ZXJ5LnZhbHVlID0gJydcbiAgc2VsZWN0ZWRJbmRleC52YWx1ZSA9IDBcbiAgZmFsbGJhY2tTZWxlY3RlZEluZGV4LnZhbHVlID0gMFxuICBwYWdlU3RhY2sudmFsdWUgPSBbXVxuICByZXNldFRvU3VnZ2VzdGlvbnMoKVxufVxuXG4vKiogQjEgwrcgUG9wIHRvIFJvb3Qg6Zey572u6K6h5pe277yI6ZSu5YWlL+eCueWHuy/pvKDmoIfnp7vliqgv5rua6L2u6YeN572u77yb56qX5Y+j6ZqQ6JeP5pqC5YGc77yJICovXG5jb25zdCB7IG5vdGVBY3Rpdml0eSwgb25WaXNpYmlsaXR5Q2hhbmdlRm9ySWRsZSwgb25XaW5kb3dNb3VzZU1vdmUgfSA9IHVzZUlkbGVXYXRjaGVyKHBvcFRvUm9vdClcblxuLyoqIOKMmEsg5Yqo5L2c6Z2i5p2/ICovXG5jb25zdCB7IGFjdGlvblBhbmVsRW50cnksIGFjdGlvbkluZGV4LCBwYW5lbEFjdGlvbnMsIHRvZ2dsZUFjdGlvblBhbmVsIH0gPSB1c2VBY3Rpb25QYW5lbCh7XG4gIHJlc3VsdHMsXG4gIHNlbGVjdGVkSW5kZXgsXG4gIHJ1bkVudHJ5LFxuICBoaWRlV2luZG93XG59KVxuXG4vKiogSTQg5Yqo5L2c6Z2i5p2/6L+H5ruk77ya5bqV6YOo6L+H5ruk5qGG6K+NIOKGkiDov4fmu6TliqjkvZzliJfooajvvIhSYXljYXN0IEFjdGlvblBhbmVsIOW6lemDqOaQnOe0ouivreS5ie+8iSAqL1xuY29uc3QgYWN0aW9uRmlsdGVyID0gcmVmKCcnKVxuY29uc3QgYWN0aW9uRmlsdGVyUmVmID0gcmVmPEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsPihudWxsKVxuY29uc3QgZmlsdGVyZWRQYW5lbEFjdGlvbnMgPSBjb21wdXRlZCgoKSA9PiB7XG4gIGNvbnN0IGt3ID0gYWN0aW9uRmlsdGVyLnZhbHVlLnRyaW0oKS50b0xvd2VyQ2FzZSgpXG4gIGlmICgha3cpIHJldHVybiBwYW5lbEFjdGlvbnMudmFsdWVcbiAgcmV0dXJuIHBhbmVsQWN0aW9ucy52YWx1ZS5maWx0ZXIoKGEpID0+IGEubGFiZWwudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrdykpXG59KVxud2F0Y2goYWN0aW9uRmlsdGVyLCAoKSA9PiB7XG4gIGFjdGlvbkluZGV4LnZhbHVlID0gMFxufSlcbi8vIOmdouadv+aJk+W8gOaXtua4heepuui/h+a7pOW5tuaKiueEpueCueS6pOe7mei/h+a7pOahhu+8iFJheWNhc3Qg6KGM5Li677ya5ZG85Ye65Y2z5Y+v6ZSu5YWl6L+H5ruk77yJXG53YXRjaChhY3Rpb25QYW5lbEVudHJ5LCAoZW50cnkpID0+IHtcbiAgYWN0aW9uRmlsdGVyLnZhbHVlID0gJydcbiAgaWYgKGVudHJ5KSB7XG4gICAgbmV4dFRpY2soKCkgPT4gYWN0aW9uRmlsdGVyUmVmLnZhbHVlPy5mb2N1cygpKVxuICB9XG59KVxuXG4vKiog5Yqo5L2c6Z2i5p2/6L+H5ruk5qGG6ZSu55uY77ya4oaR4oaTIOmAieaLqSAvIOKGtSDmiafooYwgLyBFc2Mg5YWz6Z2i5p2/5Zue5Li76L6T5YWl5qGGICovXG5mdW5jdGlvbiBvbkFjdGlvbkZpbHRlcktleWRvd24oZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICBpZiAoZS5rZXkgPT09ICdBcnJvd0Rvd24nIHx8IGUua2V5ID09PSAnQXJyb3dVcCcpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBjb25zdCBjb3VudCA9IGZpbHRlcmVkUGFuZWxBY3Rpb25zLnZhbHVlLmxlbmd0aFxuICAgIGlmIChjb3VudCA9PT0gMCkgcmV0dXJuXG4gICAgYWN0aW9uSW5kZXgudmFsdWUgPVxuICAgICAgZS5rZXkgPT09ICdBcnJvd0Rvd24nXG4gICAgICAgID8gTWF0aC5taW4oYWN0aW9uSW5kZXgudmFsdWUgKyAxLCBjb3VudCAtIDEpXG4gICAgICAgIDogTWF0aC5tYXgoYWN0aW9uSW5kZXgudmFsdWUgLSAxLCAwKVxuICAgIHJldHVyblxuICB9XG4gIGlmIChlLmtleSA9PT0gJ0VudGVyJykge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGZpbHRlcmVkUGFuZWxBY3Rpb25zLnZhbHVlW2FjdGlvbkluZGV4LnZhbHVlXT8ucnVuKClcbiAgICByZXR1cm5cbiAgfVxuICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIGFjdGlvblBhbmVsRW50cnkudmFsdWUgPSBudWxsXG4gICAgaW5wdXRSZWYudmFsdWU/LmZvY3VzKClcbiAgfVxufVxuXG4vKiogUmF5Y2FzdCDlvI/liIbljLrvvIhWNe+8ie+8muagueaAgeOAjOW7uuiuruOAje+8m+afpeivouaAgeaLhuOAjOe7k+aenC/mlofku7bjgI3jgILnuq/lh73mlbDop4EgbGF1bmNoZXJJbnRlcmFjdGlvbnPjgIIgKi9cbmNvbnN0IHJlc3VsdEdyb3VwcyA9IGNvbXB1dGVkKCgpID0+XG4gIGdyb3VwUmVzdWx0c0ZvckRpc3BsYXkocmVzdWx0cy52YWx1ZSwgQm9vbGVhbihxdWVyeS52YWx1ZS50cmltKCkpKVxuKVxuXG4vKiog5pWw5a2X55u06L6+ICsgUG9wIHRvIFJvb3Qg5rS75Yqo55uR5ZCs5YWx55So55qEIHdpbmRvdyDnuqcga2V5ZG93biAqL1xuZnVuY3Rpb24gb25XaW5kb3dLZXlkb3duKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgbm90ZUFjdGl2aXR5KClcbiAgaGFuZGxlRGlnaXRTaG9ydGN1dChlKVxufVxuXG4vKiog5pWw5a2X55u06L6+77ya6KO45pWw5a2X6ZSu5omn6KGM5qC55YiX6KGo56ysIE4g5p2h77yIMCA9IOesrCAxMCDmnaHvvInjgIJcbiAqIOS7heagueWIl+ihqOaAgeeUn+aViO+8m+i+k+WFpeahhuiBmueEpuaXtuS4jeaLpuaIqu+8iOaVsOWtl+S7jeS9nOS4uuaQnOe0ouivjei+k+WFpe+8ieOAgiAqL1xuZnVuY3Rpb24gaGFuZGxlRGlnaXRTaG9ydGN1dChlOiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gIGlmIChlLm1ldGFLZXkgfHwgZS5jdHJsS2V5IHx8IGUuYWx0S2V5KSByZXR1cm5cbiAgY29uc3QgaW5kZXggPSBkaWdpdFRvSW5kZXgoZS5rZXkpXG4gIGlmIChpbmRleCA9PT0gbnVsbCkgcmV0dXJuXG4gIGlmIChmaXJzdFBhcnR5UGFnZS52YWx1ZSB8fCBwbHVnaW5TdGF0ZS52YWx1ZS5vcGVuKSByZXR1cm5cbiAgaWYgKGFjdGlvblBhbmVsRW50cnkudmFsdWUgfHwgc2hvd1Nob3J0Y3V0cy52YWx1ZSkgcmV0dXJuXG4gIGlmIChkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBpbnB1dFJlZi52YWx1ZSkgcmV0dXJuXG4gIGlmIChoaXN0b3J5TmF2QWN0aXZlLnZhbHVlKSByZXR1cm5cbiAgY29uc3QgaXRlbSA9IHJlc3VsdHMudmFsdWVbaW5kZXhdXG4gIGlmICghaXRlbSkgcmV0dXJuXG4gIGUucHJldmVudERlZmF1bHQoKVxuICBzZWxlY3RlZEluZGV4LnZhbHVlID0gaW5kZXhcbiAgdm9pZCBydW5FbnRyeShpdGVtLmVudHJ5KVxufVxuXG4vKiog5omn6KGM5YWc5bqV5ZG95LukICovXG5mdW5jdGlvbiBydW5GYWxsYmFja0NvbW1hbmQoY21kOiBGYWxsYmFja0NvbW1hbmQpOiB2b2lkIHtcbiAgY29uc3QgYWN0aW9uID0gY21kLmFjdGlvblxuICBpZiAoYWN0aW9uLnR5cGUgPT09ICdmaXJzdFBhcnR5Jykge1xuICAgIHB1c2hQYWdlKGFjdGlvbi5wYWdlIGFzIEZpcnN0UGFydHlQYWdlKVxuICAgIGlmIChhY3Rpb24ucXVlcnkpIHtcbiAgICAgIGlmIChhY3Rpb24ucGFnZSA9PT0gJ2FpJykge1xuICAgICAgICAvLyBRdWljayBBSSDlhZzlupXvvJrmiorlvZPliY3mkJzntKLor43kuqTnu5kgQUkg6aG16Ieq5Yqo5Y+R6YCB77yI5LiA5qyh55u06L6+77yJXG4gICAgICAgIHF1ZXJ5LnZhbHVlID0gJydcbiAgICAgICAgbmV4dFRpY2soKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHBhZ2UgPSBwYWdlUmVmLnZhbHVlIGFzIHVua25vd24gYXMgeyBxdWV1ZUluaXRpYWw/OiAodGV4dDogc3RyaW5nKSA9PiB2b2lkIH0gfCBudWxsXG4gICAgICAgICAgcGFnZT8ucXVldWVJbml0aWFsPy4oYWN0aW9uLnF1ZXJ5IGFzIHN0cmluZylcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXJ5LnZhbHVlID0gYWN0aW9uLnF1ZXJ5XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGFjdGlvbi50eXBlID09PSAnc2VhcmNoRmlsZXMnKSB7XG4gICAgcHVzaFBhZ2UoJ2ZpbGVzJylcbiAgICBxdWVyeS52YWx1ZSA9IGFjdGlvbi5xdWVyeVxuICB9IGVsc2UgaWYgKGFjdGlvbi50eXBlID09PSAnb3BlblVybCcpIHtcbiAgICB2b2lkIHdpbmRvdy5hcGkuc3lzdGVtLm9wZW5FeHRlcm5hbChhY3Rpb24udXJsKVxuICAgIGhpZGVXaW5kb3coKVxuICB9IGVsc2UgaWYgKGFjdGlvbi50eXBlID09PSAnY29weVRleHQnKSB7XG4gICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoYWN0aW9uLnRleHQpLmNhdGNoKCgpID0+IHt9KVxuICAgIGhpZGVXaW5kb3coKVxuICB9XG59XG5cbi8vIOi+k+WFpeWPmOWMlu+8mumAieS4reWkjeS9jSArIGRlYm91bmNlIOinpuWPkee7n+S4gOaQnOe0ou+8m1xuLy8g55So5oi36ZSu5YWl77yI6Z2e5Y6G5Y+y5a+86Iiq5Zue5aGr77yJ5Y2z6YCA5Ye65Y6G5Y+y5a+86Iiq77yIQjEg4oaRIOaBouWkjeaQnOe0ouWOhuWPsu+8iVxud2F0Y2gocXVlcnksIChxKSA9PiB7XG4gIGlmICghaGlzdG9yeU5hdkFwcGx5aW5nLnZhbHVlICYmIGhpc3RvcnlOYXZBY3RpdmUudmFsdWUpIGV4aXRIaXN0b3J5TmF2KClcbiAgc2VsZWN0ZWRJbmRleC52YWx1ZSA9IDBcbiAgZmFsbGJhY2tTZWxlY3RlZEluZGV4LnZhbHVlID0gMFxuICBhY3Rpb25QYW5lbEVudHJ5LnZhbHVlID0gbnVsbFxuICBzY2hlZHVsZUZvclF1ZXJ5KHEpXG59KVxuXG5mdW5jdGlvbiBtb3ZlU2VsZWN0aW9uKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgaWYgKHJlc3VsdHMudmFsdWUubGVuZ3RoID09PSAwKSByZXR1cm5cbiAgY29uc3QgbmV4dCA9IChzZWxlY3RlZEluZGV4LnZhbHVlICsgZGVsdGEgKyByZXN1bHRzLnZhbHVlLmxlbmd0aCkgJSByZXN1bHRzLnZhbHVlLmxlbmd0aFxuICBzZWxlY3RlZEluZGV4LnZhbHVlID0gbmV4dFxuICBzY3JvbGxTZWxlY3RlZEludG9WaWV3KG5leHQpXG59XG5cbmZ1bmN0aW9uIHNjcm9sbFNlbGVjdGVkSW50b1ZpZXcoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuICBuZXh0VGljaygoKSA9PiB7XG4gICAgLy8g5YiG57uE5riy5p+T5ZCOIERPTSDluo8g4omgIHJlc3VsdHMg5omB5bmz5bqP77yI5paH5Lu25YiG5Yy65Lya5oqK6Z2g5ZCO55qE5paH5Lu26KGM5oyq5Yiw57uE5bC+77yJ77yMXG4gICAgLy8g55SoIGRhdGEtaW5kZXgg57K+56Gu5a6a5L2N77yM5LiN5L6d6LWWIERPTSDpobrluo9cbiAgICBkb2N1bWVudFxuICAgICAgLnF1ZXJ5U2VsZWN0b3IoYC5sYXVuY2hlci1yZXN1bHRbZGF0YS1pbmRleD1cIiR7aW5kZXh9XCJdYClcbiAgICAgID8uc2Nyb2xsSW50b1ZpZXcoeyBibG9jazogJ25lYXJlc3QnIH0pXG4gIH0pXG59XG5cbi8qKiDkuLvmoIfpopjpq5jkuq7ljLrpl7TmjaLnrpflm57ljp/mlofkuIvmoIcgKi9cbmZ1bmN0aW9uIGhpZ2hsaWdodFBhcnRzKGl0ZW06IFNjb3JlZEVudHJ5KTogeyBiZWZvcmU6IHN0cmluZzsgaGl0OiBzdHJpbmc7IGFmdGVyOiBzdHJpbmcgfSB8IG51bGwge1xuICBpZiAoIWl0ZW0uaGlnaGxpZ2h0KSByZXR1cm4gbnVsbFxuICBjb25zdCB7IG1hcCB9ID0gbm9ybWFsaXplV2l0aE1hcChpdGVtLmVudHJ5LnRpdGxlKVxuICBjb25zdCBzdGFydCA9IG1hcFtpdGVtLmhpZ2hsaWdodC5zdGFydF0gPz8gMFxuICBjb25zdCBlbmQgPSAobWFwW2l0ZW0uaGlnaGxpZ2h0LmVuZF0gPz8gc3RhcnQpICsgMVxuICBjb25zdCB0aXRsZSA9IGl0ZW0uZW50cnkudGl0bGVcbiAgcmV0dXJuIHtcbiAgICBiZWZvcmU6IHRpdGxlLnNsaWNlKDAsIHN0YXJ0KSxcbiAgICBoaXQ6IHRpdGxlLnNsaWNlKHN0YXJ0LCBlbmQpLFxuICAgIGFmdGVyOiB0aXRsZS5zbGljZShlbmQpXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcnVuU2VsZWN0ZWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gIC8vIOaPkuS7tuaJk+W8gOacn+mXtOaQnOe0ouahhuaYr+aPkuS7tueahOWJr+i+k+WFpeahhu+8jEVudGVyIOS4jeaJp+ihjOacrOWcsOe7k+aenFxuICBpZiAocGx1Z2luU3RhdGUudmFsdWUub3BlbikgcmV0dXJuXG4gIGNvbnN0IGl0ZW0gPSByZXN1bHRzLnZhbHVlW3NlbGVjdGVkSW5kZXgudmFsdWVdXG4gIGlmIChpdGVtKSBhd2FpdCBydW5FbnRyeShpdGVtLmVudHJ5KVxufVxuXG5hc3luYyBmdW5jdGlvbiBydW5FbnRyeShlbnRyeTogQ29tbWFuZEVudHJ5KTogUHJvbWlzZTx2b2lkPiB7XG4gIC8vIFAyLTnvvJrmnIDov5HmkJzntKLor40g4oaSIOWhq+WFpeaQnOe0ouahhu+8jOS4jeaJp+ihjOWRveS7pFxuICBpZiAoZW50cnkuYWN0aW9uLnR5cGUgPT09ICdzZWFyY2hRdWVyeScpIHtcbiAgICBxdWVyeS52YWx1ZSA9IChlbnRyeS5hY3Rpb24gYXMgeyBxdWVyeTogc3RyaW5nIH0pLnF1ZXJ5XG4gICAgaW5wdXRSZWYudmFsdWU/LmZvY3VzKClcbiAgICByZXR1cm5cbiAgfVxuICAvLyDorrDlvZXmkJzntKLljoblj7LvvIhQMi0577yJ77ya5omn6KGM5ZG95Luk5pe25oqK5b2T5YmN5p+l6K+i6K+N6K6w5YWl5Y6G5Y+yXG4gIGlmIChxdWVyeS52YWx1ZS50cmltKCkpIHtcbiAgICB2b2lkIHdpbmRvdy5hcGkuc2VhcmNoSGlzdG9yeS5hZGQocXVlcnkudmFsdWUudHJpbSgpKS5jYXRjaCgoKSA9PiB7fSlcbiAgfVxuICBhd2FpdCBleGVjdXRlQ29tbWFuZChlbnRyeSwge1xuICAgIGluTWFpbldpbmRvdzogZmFsc2UsXG4gICAgY2xvc2U6IGhpZGVXaW5kb3csXG4gICAgb3BlbkZpcnN0UGFydHk6IChwYWdlKSA9PiB7XG4gICAgICBwdXNoUGFnZShwYWdlKVxuICAgICAgcXVlcnkudmFsdWUgPSAnJ1xuICAgICAgaW5wdXRSZWYudmFsdWU/LmZvY3VzKClcbiAgICAgIC8vIEFJIOmihOiuvuWRveS7pO+8muaJk+W8gCBBSSDpobXlkI7oh6rliqjlj5HpgIHpooTorr7mj5DnpLror40gLyDml6XmiqXnlJ/miJDvvIhWNCDmibnmrKE177yJXG4gICAgICBpZiAocGFnZSA9PT0gJ2FpJyAmJiBlbnRyeS5rZXkuc3RhcnRzV2l0aCgnYWk6JykpIHtcbiAgICAgICAgY29uc3QgcHJlc2V0ID0gZW50cnkua2V5LnJlcGxhY2UoJ2FpOicsICcnKVxuICAgICAgICBpZiAocHJlc2V0ID09PSAncG9tb2Rvcm9SZXBvcnQnKSB7XG4gICAgICAgICAgLy8g55Wq6IyE6ZKf5pel5oql77ya6IGa5ZCI5LuK5pel5pWw5o2uIOKGkiBBSSDpobXmjpLpmJ/nlJ/miJDvvIjml6Dku4rml6XmlbDmja7ml7bkuI3lj5HvvIlcbiAgICAgICAgICB2b2lkIGJ1aWxkUG9tb2Rvcm9EaWdlc3QoKS50aGVuKChkaWdlc3QpID0+IHtcbiAgICAgICAgICAgIGlmICghZGlnZXN0KSByZXR1cm5cbiAgICAgICAgICAgIG5leHRUaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgYWlQYWdlID0gcGFnZVJlZi52YWx1ZSBhcyB1bmtub3duIGFzIHtcbiAgICAgICAgICAgICAgICBxdWV1ZUluaXRpYWw/OiAodGV4dDogc3RyaW5nKSA9PiB2b2lkXG4gICAgICAgICAgICAgIH0gfCBudWxsXG4gICAgICAgICAgICAgIGFpUGFnZT8ucXVldWVJbml0aWFsPy4oZGlnZXN0KVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2UgaWYgKFsndHJhbnNsYXRlJywgJ3N1bW1hcml6ZScsICdyZXdyaXRlJ10uaW5jbHVkZXMocHJlc2V0KSkge1xuICAgICAgICAgIGNvbnN0IHR5cGVkID0gcHJlc2V0IGFzICd0cmFuc2xhdGUnIHwgJ3N1bW1hcml6ZScgfCAncmV3cml0ZSdcbiAgICAgICAgICBuZXh0VGljaygoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBhaVBhZ2UgPSBwYWdlUmVmLnZhbHVlIGFzIHVua25vd24gYXMge1xuICAgICAgICAgICAgICBzZW5kUHJlc2V0PzogKHA6ICd0cmFuc2xhdGUnIHwgJ3N1bW1hcml6ZScgfCAncmV3cml0ZScpID0+IHZvaWRcbiAgICAgICAgICAgIH0gfCBudWxsXG4gICAgICAgICAgICBhaVBhZ2U/LnNlbmRQcmVzZXQ/Lih0eXBlZClcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICAvLyDlj4LmlbDljJYgUXVpY2tsaW5r77yIVVJMIOWQqyB7cXVlcnl977yJ77ya6IO25ZuK5YaF5by55Y+C5pWw6KGo5Y2V77yMXG4gICAgLy8g5pCc57Si6K+N6YeM5qCH6aKY5LmL5aSW55qE6YOo5YiG5L2c5Li65Y+C5pWw5Yid5YC877yIXCJnaXRodWIgcmVhY3RcIiDihpIg6aKE5aGrIFwicmVhY3RcIu+8iVxuICAgIG9wZW5RdWlja2xpbmtBcmc6ICh0YXJnZXQpID0+IHtcbiAgICAgIHFsQXJnVGFyZ2V0LnZhbHVlID0gdGFyZ2V0XG4gICAgICBjb25zdCBxID0gcXVlcnkudmFsdWUudHJpbSgpXG4gICAgICBjb25zdCB0ID0gdGFyZ2V0LnRpdGxlLnRvTG93ZXJDYXNlKClcbiAgICAgIHFsQXJnSW5pdGlhbC52YWx1ZSA9IHEudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKHQpID8gcS5zbGljZSh0YXJnZXQudGl0bGUubGVuZ3RoKS50cmltKCkgOiAnJ1xuICAgICAgcHVzaFBhZ2UoJ3FsYXJnJylcbiAgICAgIHF1ZXJ5LnZhbHVlID0gJydcbiAgICAgIGlucHV0UmVmLnZhbHVlPy5mb2N1cygpXG4gICAgfVxuICB9KVxuICBpZiAoZW50cnkuYWN0aW9uLnR5cGUgPT09ICdwbHVnaW4nKSB7XG4gICAgcGFnZVN0YWNrLnZhbHVlID0gW10gLy8g5o+S5Lu25LiO5YaF6IGU6aG15LqS5palXG4gICAgcXVlcnkudmFsdWUgPSAnJ1xuICAgIHJldHVybiAvLyDmj5Lku7bmiZPlvIDlkI7og7blm4rnqpfkv53nlZnvvIzov5vlhaXmj5Lku7bkuqTkupJcbiAgfVxufVxuXG4vKiog5Yib5bu65pel56iL6KGo5Y2V5o+Q5Lqk77ya6Kej5p6Q5pel5pyfK+aXtumXtCvml7bplb8g4oaSIGNhbGVuZGFyLmNyZWF0ZUV2ZW5077yI5Li76L+b56iL5aSx6LSl5pe25by557O757uf6YCa55+l77yJICovXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVDYWxlbmRhckV2ZW50KHZhbHVlczogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgYm9vbGVhbj4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgdGl0bGUgPSBTdHJpbmcodmFsdWVzLnRpdGxlID8/ICcnKS50cmltKClcbiAgY29uc3QgZGF0ZSA9IFN0cmluZyh2YWx1ZXMuZGF0ZSA/PyAnJykudHJpbSgpXG4gIGNvbnN0IHRpbWUgPSBTdHJpbmcodmFsdWVzLnRpbWUgPz8gJycpLnRyaW0oKVxuICBjb25zdCBkdXJhdGlvbkxhYmVsID0gU3RyaW5nKHZhbHVlcy5kdXJhdGlvbiA/PyAnMSDlsI/ml7YnKVxuICBpZiAoIXRpdGxlIHx8ICFkYXRlKSByZXR1cm4gLy8g55WZ5Zyo6KGo5Y2VXG5cbiAgY29uc3QgZGF0ZU1hdGNoID0gL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KSQvLmV4ZWMoZGF0ZSlcbiAgY29uc3QgdGltZU1hdGNoID0gL14oXFxkezEsMn0pOihcXGR7Mn0pJC8uZXhlYyh0aW1lKVxuICBpZiAoIWRhdGVNYXRjaCB8fCAhdGltZU1hdGNoKSByZXR1cm4gLy8g5pel5pyfL+aXtumXtOS4jeWQiOazleeVmeWcqOihqOWNlVxuICBjb25zdCBzdGFydCA9IG5ldyBEYXRlKFxuICAgIE51bWJlcihkYXRlTWF0Y2hbMV0pLFxuICAgIE51bWJlcihkYXRlTWF0Y2hbMl0pIC0gMSxcbiAgICBOdW1iZXIoZGF0ZU1hdGNoWzNdKSxcbiAgICBOdW1iZXIodGltZU1hdGNoWzFdKSxcbiAgICBOdW1iZXIodGltZU1hdGNoWzJdKVxuICApXG4gIGlmIChOdW1iZXIuaXNOYU4oc3RhcnQuZ2V0VGltZSgpKSkgcmV0dXJuXG4gIGNvbnN0IG1pbnV0ZXMgPVxuICAgIGR1cmF0aW9uTGFiZWwgPT09ICczMCDliIbpkp8nXG4gICAgICA/IDMwXG4gICAgICA6IGR1cmF0aW9uTGFiZWwgPT09ICc5MCDliIbpkp8nXG4gICAgICAgID8gOTBcbiAgICAgICAgOiBkdXJhdGlvbkxhYmVsID09PSAnMiDlsI/ml7YnXG4gICAgICAgICAgPyAxMjBcbiAgICAgICAgICA6IDYwXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpbmRvdy5hcGkuY2FsZW5kYXIuY3JlYXRlRXZlbnQoe1xuICAgIHRpdGxlLFxuICAgIHN0YXJ0TXM6IHN0YXJ0LmdldFRpbWUoKSxcbiAgICBlbmRNczogc3RhcnQuZ2V0VGltZSgpICsgbWludXRlcyAqIDYwICogMTAwMFxuICB9KVxuICBpZiAocmVzdWx0Lm9rKSB7XG4gICAgcG9wVG9Sb290KClcbiAgfVxufVxuXG4vKiog5Y+C5pWw6KGo5Y2V5o+Q5LqkIOKGkiDljaDkvY3nrKbmm7/mjaLlkI7nlKjns7vnu5/mtY/op4jlmajmiZPlvIDvvIjooajljZXlgLzlkKsgY2hlY2tib3gg5biD5bCU77yM5q2k5aSE5oyJ5a2X56ym5Liy5Y+W77yJICovXG5mdW5jdGlvbiBvcGVuUXVpY2tsaW5rQXJnKHZhbHVlczogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgYm9vbGVhbj4pOiB2b2lkIHtcbiAgY29uc3QgdGFyZ2V0ID0gcWxBcmdUYXJnZXQudmFsdWVcbiAgaWYgKCF0YXJnZXQgfHwgdGFyZ2V0LmFjdGlvbi50eXBlICE9PSAncXVpY2tsaW5rJykgcmV0dXJuXG4gIGNvbnN0IHVybCA9IHRhcmdldC5hY3Rpb24udXJsXG4gIGNvbnN0IG5hbWVzID0gcXVpY2tsaW5rQXJnTmFtZXModXJsKVxuICBpZiAobmFtZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHZhbHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxuICAgIGZvciAoY29uc3QgbiBvZiBuYW1lcykge1xuICAgICAgY29uc3QgdiA9IFN0cmluZyh2YWx1ZXNbbl0gPz8gJycpLnRyaW0oKVxuICAgICAgaWYgKCF2KSByZXR1cm4gLy8g56m65Y+C5pWw55WZ5Zyo6KGo5Y2VXG4gICAgICB2YWxzW25dID0gdlxuICAgIH1cbiAgICB2b2lkIHdpbmRvdy5hcGkuc3lzdGVtLm9wZW5FeHRlcm5hbChidWlsZFF1aWNrbGlua1VybE11bHRpKHVybCwgdmFscykpXG4gICAgaGlkZVdpbmRvdygpXG4gICAgcmV0dXJuXG4gIH1cbiAgY29uc3QgYXJnID0gU3RyaW5nKHZhbHVlcy5xdWVyeSA/PyAnJykudHJpbSgpXG4gIGlmICghYXJnKSByZXR1cm4gLy8g56m65Y+C5pWw55WZ5Zyo6KGo5Y2VXG4gIGNvbnN0IGJ1aWx0ID0gYnVpbGRRdWlja2xpbmtVcmwodXJsLCBhcmcpXG4gIHZvaWQgd2luZG93LmFwaS5zeXN0ZW0ub3BlbkV4dGVybmFsKGJ1aWx0KVxuICBoaWRlV2luZG93KClcbn1cblxuLyoqIOmUruebmOmbhuS4reWIhuWPke+8mkVTQyDkuInmrrXlvI/lvZLog7blm4rvvJvlhoXogZTpobXmiZPlvIDml7blhbbkvZnmjInplK7lhYjkuqTnu5npobXpnaLvvJvlkKbliJnotbDmoLnliJfooaggKi9cbmZ1bmN0aW9uIG9uS2V5ZG93bihlOiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gIC8vIElNRSDnu4TlkIjmgIHvvIjkuK3mlofovpPlhaXms5XpgInmi7zpn7PvvInvvJrihpHihpMvVGFiL0VzYyDmmK/ovpPlhaXms5Xoh6rouqvnmoTmjInplK7or63kuYnvvIxcbiAgLy8g5YWo6YOo5pS+6KGM4oCU4oCU5ZCm5YiZIOKGkSDpgInlgJnpgInor43kvJrop6blj5Hljoblj7Llr7zoiKrlm57loavjgIHmiZPmlq3nu4TlkIjvvIjkuK3mlofnlKjmiLfpq5jpopHot6/lvoTvvIlcbiAgaWYgKGUuaXNDb21wb3NpbmcgfHwgZS5rZXlDb2RlID09PSAyMjkpIHJldHVyblxuICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgLy8g5Yqo5L2c6Z2i5p2/5omT5byA5pe2IEVTQyDlj6rlhbPpnaLmnb9cbiAgICBpZiAoYWN0aW9uUGFuZWxFbnRyeS52YWx1ZSkge1xuICAgICAgYWN0aW9uUGFuZWxFbnRyeS52YWx1ZSA9IG51bGxcbiAgICAgIGlucHV0UmVmLnZhbHVlPy5mb2N1cygpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgb25Fc2NhcGUoKVxuICAgIHJldHVyblxuICB9XG4gIGlmIChmaXJzdFBhcnR5UGFnZS52YWx1ZSkge1xuICAgIGlmIChwYWdlUmVmLnZhbHVlPy5oYW5kbGVLZXkoZSkpIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIH1cbiAgICByZXR1cm5cbiAgfVxuICAvLyDmj5Lku7blt7LmiZPlvIDvvIjkvKDnu5/mqKHlvI/vvIzmnKrmj5DkuqQgZGVjbGFyZWRMaXN077yJ77ya5o+S5Lu26KeG5Zu+6KaG55uW5qC557uT5p6c5YiX6KGo77yMXG4gIC8vIOaMiemUruS4jeW6lOWGjeS9nOeUqOS6juiiq+mBruaMoeeahOWIl+ihqO+8iOWQpuWImSDijJhLL+KGkeKGkyDnp7vliqjnmoTmmK/nnIvkuI3op4HnmoTpgInkuK3pobnvvIlcbiAgaWYgKHBsdWdpblN0YXRlLnZhbHVlLm9wZW4gJiYgIWRlY2xhcmVkTGlzdC52YWx1ZSkge1xuICAgIC8vIOS7heS/neeVmSBFU0Mg55qE5b2S6IO25ZuK6IGM6LSj77yI5LiK5pa55bey5aSE55CG77yJ77yb5YW25L2Z5oyJ6ZSu5Lqk57uZ5o+S5Lu25Ymv6L6T5YWl5qGGXG4gICAgcmV0dXJuXG4gIH1cbiAgLy8g5aOw5piO5byP5o+S5Lu25YiX6KGo77yITTMuMe+8ie+8muKGkeKGky9FbnRlci/ijJjmlbDlrZcg5Lqk57uZ5Y6f55Sf5riy5p+T55qE5YiX6KGo77ybXG4gIC8vIOWtl+espui+k+WFpeS4jeaLpuaIqu+8jOe7p+e7reS9nOS4uuaPkuS7tuWJr+i+k+WFpeahhlxuICBpZiAocGx1Z2luU3RhdGUudmFsdWUub3BlbiAmJiBkZWNsYXJlZExpc3QudmFsdWUpIHtcbiAgICBpZiAocGFnZVJlZi52YWx1ZT8uaGFuZGxlS2V5KGUpKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICB9XG4gICAgcmV0dXJuXG4gIH1cbiAgLy8g4oyYS++8muWvuemAieS4ree7k+aenOWRvOWHuuWKqOS9nOmdouadv++8iE0xLjLvvIlcbiAgaWYgKChlLm1ldGFLZXkgfHwgZS5jdHJsS2V5KSAmJiAoZS5rZXkgPT09ICdrJyB8fCBlLmtleSA9PT0gJ0snKSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGNvbnN0IGl0ZW0gPSByZXN1bHRzLnZhbHVlW3NlbGVjdGVkSW5kZXgudmFsdWVdXG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIGFjdGlvblBhbmVsRW50cnkudmFsdWUgPSBpdGVtLmVudHJ5XG4gICAgICBhY3Rpb25JbmRleC52YWx1ZSA9IDBcbiAgICB9XG4gICAgcmV0dXJuXG4gIH1cbiAgLy8g6Zi25q61NS4y77ya4oyYMS05IOW/q+aNt+aJp+ihjOWvueW6lOS9jee9rueahOe7k+aenO+8iFJheWNhc3Qg6aOO5qC877yJXG4gIGlmIChlLm1ldGFLZXkgJiYgL15bMS05XSQvLnRlc3QoZS5rZXkpKSB7XG4gICAgY29uc3QgaW5kZXggPSBwYXJzZUludChlLmtleSkgLSAxXG4gICAgY29uc3QgaXRlbSA9IHJlc3VsdHMudmFsdWVbaW5kZXhdXG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgc2VsZWN0ZWRJbmRleC52YWx1ZSA9IGluZGV4XG4gICAgICB2b2lkIHJ1bkVudHJ5KGl0ZW0uZW50cnkpXG4gICAgfVxuICAgIHJldHVyblxuICB9XG4gIC8vIEIxIMK3IFRhYiBRdWljayBBSe+8mui+k+WFpeahhuiBmueEpu+8iOacrCBoYW5kbGVyIOe7keWumuS6jui+k+WFpeahhu+8ieS4lOmdnuaPkuS7tuaAgeOAgVxuICAvLyDpnZ7pgJ/mn6XpnaLmnb/mgIHml7bvvIxUYWIg6L+b5YWlIEFJIOmhteW5tuiHquWKqOWPkemAgeW9k+WJjSBxdWVyee+8iOWkjeeUqOWFnOW6leOAjOivoumXriBBSeOAjVxuICAvLyDnmoQgcXVldWVJbml0aWFsIOaOkumYn++8ieOAgumAn+afpemdouadv+aJk+W8gOaXtuS4jeaLpuaIquKAlOKAlOWQpuWImSBvdmVybGF5IOWPoCBBSSDpobXmiJDohI/nirbmgIFcbiAgaWYgKFxuICAgIGUua2V5ID09PSAnVGFiJyAmJlxuICAgICFlLm1ldGFLZXkgJiZcbiAgICAhZS5jdHJsS2V5ICYmXG4gICAgIWUuYWx0S2V5ICYmXG4gICAgIXBsdWdpblN0YXRlLnZhbHVlLm9wZW4gJiZcbiAgICAhZmlyc3RQYXJ0eVBhZ2UudmFsdWUgJiZcbiAgICAhYWN0aW9uUGFuZWxFbnRyeS52YWx1ZSAmJlxuICAgICFzaG93U2hvcnRjdXRzLnZhbHVlXG4gICkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGFza0FJV2l0aFF1ZXJ5KClcbiAgICByZXR1cm5cbiAgfVxuICBpZiAoYWN0aW9uUGFuZWxFbnRyeS52YWx1ZSkge1xuICAgIGNvbnN0IGFjdGlvbnMgPSBmaWx0ZXJlZFBhbmVsQWN0aW9ucy52YWx1ZVxuICAgIGlmIChhY3Rpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG4gICAgaWYgKGUua2V5ID09PSAnQXJyb3dEb3duJykge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBhY3Rpb25JbmRleC52YWx1ZSA9IE1hdGgubWluKGFjdGlvbkluZGV4LnZhbHVlICsgMSwgYWN0aW9ucy5sZW5ndGggLSAxKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGlmIChlLmtleSA9PT0gJ0Fycm93VXAnKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGFjdGlvbkluZGV4LnZhbHVlID0gTWF0aC5tYXgoYWN0aW9uSW5kZXgudmFsdWUgLSAxLCAwKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGlmIChlLmtleSA9PT0gJ0VudGVyJykge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBhY3Rpb25zW2FjdGlvbkluZGV4LnZhbHVlXT8ucnVuKClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICByZXR1cm5cbiAgfVxuICAvLyBCMSDCtyDmkJzntKLljoblj7Ig4oaRIOaBouWkje+8muepuuafpeivouaMiSDihpEg5Zue5aGr5pyA6L+R5pCc57Si6K+N77yb5r+A5rS75ZCOIOKGkS/ihpMg5b6q546v5a+86Iiq44CCXG4gIC8vIOS7heagueWIl+ihqOaAgeeUn+aViO+8iOaPkuS7ti/lhoXogZTpobUv5Yqo5L2c6Z2i5p2/5bey5Zyo5LiK5pa55YiG5pSvIHJldHVybiDmiJbooqvmjpLpmaTvvInjgIJcbiAgLy8g5peg5Y6G5Y+y5pe25LiN5raI6LS5IOKGke+8jOS/neaMgeWOn+acieOAjOe7leWIsOWIl+ihqOacq+mhueOAjeihjOS4ulxuICBpZiAoIXBsdWdpblN0YXRlLnZhbHVlLm9wZW4gJiYgIWZpcnN0UGFydHlQYWdlLnZhbHVlICYmICFhY3Rpb25QYW5lbEVudHJ5LnZhbHVlKSB7XG4gICAgaWYgKGUua2V5ID09PSAnQXJyb3dVcCcgJiYgIXF1ZXJ5LnZhbHVlLnRyaW0oKSAmJiAhaGlzdG9yeU5hdkFjdGl2ZS52YWx1ZSkge1xuICAgICAgaWYgKGVudGVySGlzdG9yeU5hdigpKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIC8vIGZhbGx0aHJvdWdo77ya5Y6G5Y+y5Li656m677yM5Lqk57uZ5LiL5pa56YCa55SoIOKGkSDlr7zoiKpcbiAgICB9IGVsc2UgaWYgKGhpc3RvcnlOYXZBY3RpdmUudmFsdWUgJiYgKGUua2V5ID09PSAnQXJyb3dVcCcgfHwgZS5rZXkgPT09ICdBcnJvd0Rvd24nKSkge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBzdGVwSGlzdG9yeU5hdihlLmtleSA9PT0gJ0Fycm93VXAnID8gJ3VwJyA6ICdkb3duJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgfVxuICAvLyBGYWxsYmFjayBDb21tYW5kc++8muaQnOe0ouaXoOe7k+aenOaXtueUqCDihpHihpMg5a+86Iiq5YWc5bqV5ZG95Luk77yMRW50ZXIg5omn6KGMXG4gIGNvbnN0IHNob3dGYWxsYmFjayA9XG4gICAgcXVlcnkudmFsdWUudHJpbSgpICYmXG4gICAgcmVzdWx0cy52YWx1ZS5sZW5ndGggPT09IDAgJiZcbiAgICAhcGx1Z2luU3RhdGUudmFsdWUub3BlbiAmJlxuICAgICFmaXJzdFBhcnR5UGFnZS52YWx1ZVxuICBpZiAoc2hvd0ZhbGxiYWNrICYmIGZhbGxiYWNrQ29tbWFuZHMudmFsdWUubGVuZ3RoID4gMCkge1xuICAgIGlmIChlLmtleSA9PT0gJ0Fycm93RG93bicpIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgZmFsbGJhY2tTZWxlY3RlZEluZGV4LnZhbHVlID0gTWF0aC5taW4oXG4gICAgICAgIGZhbGxiYWNrU2VsZWN0ZWRJbmRleC52YWx1ZSArIDEsXG4gICAgICAgIGZhbGxiYWNrQ29tbWFuZHMudmFsdWUubGVuZ3RoIC0gMVxuICAgICAgKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGlmIChlLmtleSA9PT0gJ0Fycm93VXAnKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGZhbGxiYWNrU2VsZWN0ZWRJbmRleC52YWx1ZSA9IE1hdGgubWF4KGZhbGxiYWNrU2VsZWN0ZWRJbmRleC52YWx1ZSAtIDEsIDApXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGNvbnN0IGNtZCA9IGZhbGxiYWNrQ29tbWFuZHMudmFsdWVbZmFsbGJhY2tTZWxlY3RlZEluZGV4LnZhbHVlXVxuICAgICAgaWYgKGNtZCkgcnVuRmFsbGJhY2tDb21tYW5kKGNtZClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgfVxuICBpZiAoZS5rZXkgPT09ICdBcnJvd0Rvd24nKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgbW92ZVNlbGVjdGlvbigxKVxuICAgIHJldHVyblxuICB9XG4gIGlmIChlLmtleSA9PT0gJ0Fycm93VXAnKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgbW92ZVNlbGVjdGlvbigtMSlcbiAgICByZXR1cm5cbiAgfVxuICBpZiAoZS5rZXkgPT09ICdFbnRlcicpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICB2b2lkIHJ1blNlbGVjdGVkKClcbiAgICByZXR1cm5cbiAgfVxuICAvLyDpmLbmrrU1LjPvvJo/IOmUruaYvuekuuW/q+aNt+mUrumAn+afpemdouadv1xuICBpZiAoZS5rZXkgPT09ICc/JyAmJiAhZS5tZXRhS2V5ICYmICFlLmN0cmxLZXkgJiYgIWUuYWx0S2V5KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgc2hvd1Nob3J0Y3V0cy52YWx1ZSA9ICFzaG93U2hvcnRjdXRzLnZhbHVlXG4gICAgcmV0dXJuXG4gIH1cbn1cblxuLyoqIOeJh+auteWkjeWItuWujOaIkCDihpIg5Y+N6aaI5ZCO5pS26LW36IO25ZuK77yIUmF5Y2FzdCDnmoQgY29weS10aGVuLWNsb3Nl77yJICovXG5mdW5jdGlvbiBvblNuaXBwZXRDb3BpZWQodGl0bGU6IHN0cmluZyk6IHZvaWQge1xuICBpZiAoIXRpdGxlKSByZXR1cm5cbiAgaGlkZVdpbmRvdygpXG59XG5cbi8qKiBRdWlja2xpbmsg6KGo5Y2V5o+Q5Lqk77yITTUuMiBGb3JtIOWfuuWFg++8ie+8muS/neWtmOWQjuaPkOekuuW5tui/lOWbniAqL1xuYXN5bmMgZnVuY3Rpb24gc2F2ZVF1aWNrbGlua0Zvcm0odmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBib29sZWFuPik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBuYW1lID0gU3RyaW5nKHZhbHVlcy5uYW1lID8/ICcnKS50cmltKClcbiAgY29uc3QgdXJsID0gU3RyaW5nKHZhbHVlcy51cmwgPz8gJycpLnRyaW0oKVxuICBpZiAoIW5hbWUgfHwgIS9eaHR0cHM/OlxcL1xcLy8udGVzdCh1cmwpKSB7XG4gICAgLy8g5qCh6aqM5aSx6LSl77ya55WZ5Zyo6KGo5Y2V77yI54Sm54K55pys5bCx5Zyo6KGo5Y2V5a2X5q6177yM55So5oi35Y+v55u05o6l5L+u5q2j77yJXG4gICAgcmV0dXJuXG4gIH1cbiAgdHJ5IHtcbiAgICBjb25zdCBsaXN0ID0gKGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIucXVpY2tsaW5rc0xpc3QoKSkgYXMgQXJyYXk8e1xuICAgICAgaWQ6IHN0cmluZ1xuICAgICAgbmFtZTogc3RyaW5nXG4gICAgICB1cmw6IHN0cmluZ1xuICAgIH0+XG4gICAgbGlzdC5wdXNoKHsgaWQ6IGBxbC0ke0RhdGUubm93KCkudG9TdHJpbmcoMzYpfWAsIG5hbWUsIHVybCB9KVxuICAgIGF3YWl0IHdpbmRvdy5hcGkubGF1bmNoZXIucXVpY2tsaW5rc1NhdmUobGlzdClcbiAgICBhd2FpdCBsb2FkRHluYW1pY0NvbW1hbmRzKClcbiAgICBwb3BQYWdlKClcbiAgICBxdWVyeS52YWx1ZSA9IG5hbWUgLy8g5pCc5Ye65Yia5re75Yqg55qE6ZO+5o6l77yIUmF5Y2FzdCDmj5DkuqTlkI7lj6/op4Hnu5PmnpzvvIlcbiAgfSBjYXRjaCB7XG4gICAgLyog5L+d5a2Y5aSx6LSl55WZ5Zyo6KGo5Y2VICovXG4gIH1cbn1cblxuLyoqIOaQnOe0ouahhui+k+WFpe+8muaPkuS7tuaJk+W8gOaXtui9rOWPkSBTdWJJbnB1dENoYW5nZe+8m+mUruWFpemHjee9riBQb3AgdG8gUm9vdCDorqHml7bvvIhJTUUg5YWc5bqV77yJICovXG5mdW5jdGlvbiBvbklucHV0KCk6IHZvaWQge1xuICBub3RlQWN0aXZpdHkoKVxuICBpZiAocGx1Z2luU3RhdGUudmFsdWUub3Blbikge1xuICAgIHdpbmRvdy5hcGkubGF1bmNoZXIuaW5wdXQocXVlcnkudmFsdWUpXG4gIH1cbn1cblxuLyoqIOeVquiMhOmSn+aXpeaKpeaVsOaNruiBmuWQiO+8iFY0IOaJueasoTXvvInvvJrku4rml6UgdHJlbmQgKyDpobnnm67liIbluIMg4oaSIEFJIOaPkOekuuivje+8m+aXoOaVsOaNrui/lOWbniBudWxsICovXG5hc3luYyBmdW5jdGlvbiBidWlsZFBvbW9kb3JvRGlnZXN0KCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICB0cnkge1xuICAgIGNvbnN0IFt0cmVuZCwgZGlzdF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICB3aW5kb3cuYXBpLnBvbW9kb3JvLnN0YXRzLmdldERhaWx5VHJlbmQoMSksXG4gICAgICB3aW5kb3cuYXBpLnBvbW9kb3JvLnN0YXRzLmdldFByb2plY3REaXN0cmlidXRpb24oRGF0ZS5ub3coKSAtIDg2NDAwMDAwLCBEYXRlLm5vdygpKVxuICAgIF0pXG4gICAgY29uc3QgdG9kYXkgPSB0cmVuZFt0cmVuZC5sZW5ndGggLSAxXVxuICAgIGlmICghdG9kYXkgfHwgKHRvZGF5LndvcmtNaW51dGVzID09PSAwICYmIHRvZGF5LmNvbXBsZXRlZFBvbW9kb3JvcyA9PT0gMCkpIHJldHVybiBudWxsXG4gICAgY29uc3QgcHJvamVjdHMgPSBkaXN0XG4gICAgICAuZmlsdGVyKChkKSA9PiBkLndvcmtNaW51dGVzID4gMClcbiAgICAgIC5tYXAoKGQpID0+IGAke2QucHJvamVjdE5hbWV9ICR7ZC53b3JrTWludXRlc30g5YiG6ZKfYClcbiAgICAgIC5qb2luKCfjgIEnKVxuICAgIHJldHVybiBbXG4gICAgICAn6K+35Z+65LqO5oiR5LuK5aSp55qE55Wq6IyE6ZKf5LiT5rOo5pWw5o2u5YaZ5LiA5Lu9566A55+t5pel5oql77yI5Lit5paH77yMMy01IOWPpe+8ie+8micsXG4gICAgICAnLSDnu5nlh7rmlbTkvZPoioLlpY/ngrnor4QnLFxuICAgICAgJy0g57uZ5LiA5p2h5pS56L+b5bu66K6uJyxcbiAgICAgICcnLFxuICAgICAgYOS7iuaXpeaVsOaNru+8muWujOaIkOeVquiMhOmSnyAke3RvZGF5LmNvbXBsZXRlZFBvbW9kb3Jvc30g5Liq77yM5LiT5rOoICR7dG9kYXkud29ya01pbnV0ZXN9IOWIhumSn++8jOWujOaIkOS7u+WKoSAke3RvZGF5LmNvbXBsZXRlZFRhc2tzfSDkuKoke3Byb2plY3RzID8gYO+8m+mhueebruWIhuW4g++8miR7cHJvamVjdHN9YCA6ICcnfeOAgmBcbiAgICBdLmpvaW4oJ1xcbicpXG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsXG4gIH1cbn1cblxuLyoqIFY0IOaJueasoTXvvJrmqKHlnZflhoXlrrnpl64gQUnvvIjmiKrlm77or4blrZcgLyDnrJTorrDmkZjopoHlhbHnlKjlhaXlj6PvvIkgKi9cbmZ1bmN0aW9uIGFza0FJV2l0aFRleHQodGV4dDogc3RyaW5nKTogdm9pZCB7XG4gIHB1c2hQYWdlKCdhaScpXG4gIHF1ZXJ5LnZhbHVlID0gJydcbiAgaW5wdXRSZWYudmFsdWU/LmZvY3VzKClcbiAgbmV4dFRpY2soKCkgPT4ge1xuICAgIGNvbnN0IGFpUGFnZSA9IHBhZ2VSZWYudmFsdWUgYXMgdW5rbm93biBhcyB7IHF1ZXVlSW5pdGlhbD86ICh0ZXh0OiBzdHJpbmcpID0+IHZvaWQgfSB8IG51bGxcbiAgICBpZiAoYWlQYWdlPy5xdWV1ZUluaXRpYWwgJiYgdGV4dCkgYWlQYWdlLnF1ZXVlSW5pdGlhbCh0ZXh0KVxuICB9KVxufVxuXG4vKiogUDAtMyAvIEIxIMK3IFF1aWNrIEFJ77ya5oqK5b2T5YmN5pCc57Si6K+N5Lqk57uZIEFJIOmhteiHquWKqOWPkemAgeOAglxuICog55SoIHF1ZXVlSW5pdGlhbCDmjpLpmJ/mnLrliLbvvIjphY3nva7mnKrlsLHnu6rml7blhYjmjILotbfvvIzlsLHnu6rlkI7oh6rliqjlj5Hlh7rvvInvvIzkuI7lhZzlupXjgIzor6Lpl64gQUnjgI3kuIDoh7TvvJtcbiAqIFRhYiDplK7kuI7mkJzntKLmoYblj7PkvqfmjInpkq7lhbHnlKjmraTlhaXlj6PjgIIgKi9cbmZ1bmN0aW9uIGFza0FJV2l0aFF1ZXJ5KCk6IHZvaWQge1xuICBjb25zdCBxID0gcXVlcnkudmFsdWUudHJpbSgpXG4gIHB1c2hQYWdlKCdhaScpXG4gIHF1ZXJ5LnZhbHVlID0gJydcbiAgaW5wdXRSZWYudmFsdWU/LmZvY3VzKClcbiAgLy8g562JIEFJQ2hhdFBhZ2Ug5oyC6L295ZCO5o6S6Zif5Y+R6YCB5Yid5aeL6Zeu6aKYXG4gIG5leHRUaWNrKCgpID0+IHtcbiAgICBjb25zdCBhaVBhZ2UgPSBwYWdlUmVmLnZhbHVlIGFzIHVua25vd24gYXMgeyBxdWV1ZUluaXRpYWw/OiAodGV4dDogc3RyaW5nKSA9PiB2b2lkIH0gfCBudWxsXG4gICAgaWYgKGFpUGFnZT8ucXVldWVJbml0aWFsICYmIHEpIHtcbiAgICAgIGFpUGFnZS5xdWV1ZUluaXRpYWwocSlcbiAgICB9XG4gIH0pXG59XG5cbi8qKiBFU0PvvJrlhbPmj5Lku7Yg4oaSIOWGheiBlOmhtemAkOe6p+i/lOWbnu+8iE01LjIg5a+86Iiq5qCI77yJ4oaSIOmakOiXj+eql+WPoyAqL1xuZnVuY3Rpb24gb25Fc2NhcGUoKTogdm9pZCB7XG4gIGlmIChwbHVnaW5TdGF0ZS52YWx1ZS5vcGVuKSB7XG4gICAgdm9pZCB3aW5kb3cuYXBpLmxhdW5jaGVyLmNsb3NlUGx1Z2luKClcbiAgfSBlbHNlIGlmIChmaXJzdFBhcnR5UGFnZS52YWx1ZSkge1xuICAgIHBvcFBhZ2UoKVxuICAgIGlucHV0UmVmLnZhbHVlPy5mb2N1cygpXG4gIH0gZWxzZSB7XG4gICAgaGlkZVdpbmRvdygpXG4gIH1cbn1cblxuZnVuY3Rpb24gaGlkZVdpbmRvdygpOiB2b2lkIHtcbiAgZXhpdEhpc3RvcnlOYXYoKVxuICBxdWVyeS52YWx1ZSA9ICcnXG4gIHNlbGVjdGVkSW5kZXgudmFsdWUgPSAwXG4gIHBhZ2VTdGFjay52YWx1ZSA9IFtdXG4gIGFjdGlvblBhbmVsRW50cnkudmFsdWUgPSBudWxsXG4gIHFsQXJnVGFyZ2V0LnZhbHVlID0gbnVsbFxuICB2b2lkIHdpbmRvdy5hcGkubGF1bmNoZXIuaGlkZSgpXG59XG5cbi8vIElQQyDorqLpmIXpgIDorqLlh73mlbDpm4bkuK3kv53lrZjvvIzljbjovb3ml7bnu5/kuIDph4rmlL7vvIjluLjpqbvnqpflj6PkuIvlvbHlk43lsI/vvIzkvYbnlJ/lkb3lkajmnJ/opoHmraPnoa7vvIlcbmNvbnN0IHVuc3Vic2NyaWJlcnM6IEFycmF5PCgpID0+IHZvaWQ+ID0gW11cbm9uVW5tb3VudGVkKCgpID0+IHtcbiAgdW5zdWJzY3JpYmVycy5mb3JFYWNoKChmbikgPT4gZm4oKSlcbiAgdW5zdWJzY3JpYmVycy5sZW5ndGggPSAwXG59KVxuXG5vbk1vdW50ZWQoKCkgPT4ge1xuICBpbnB1dFJlZi52YWx1ZT8uZm9jdXMoKVxuICAvLyBJNyDpnaLljIXlsZHngrnlh7sgPSDpgJDnuqfov5Tlm57vvIhDYXBzdWxlUGFnZSDnu48gQ3VzdG9tRXZlbnQg5LiK5oqb77yM6aG16Z2i5peg6ZyA5ZCE6Ieq5o6l57q/77yJXG4gIGNvbnN0IG9uQnJlYWRjcnVtYlBvcCA9ICgpOiB2b2lkID0+IHtcbiAgICBub3RlQWN0aXZpdHkoKVxuICAgIGlmIChwbHVnaW5TdGF0ZS52YWx1ZS5vcGVuIHx8ICFmaXJzdFBhcnR5UGFnZS52YWx1ZSkgcmV0dXJuXG4gICAgcG9wUGFnZSgpXG4gICAgaW5wdXRSZWYudmFsdWU/LmZvY3VzKClcbiAgfVxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbGVhZjpsYXVuY2hlci1wb3AnLCBvbkJyZWFkY3J1bWJQb3ApXG4gIHVuc3Vic2NyaWJlcnMucHVzaCgoKSA9PiB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbGVhZjpsYXVuY2hlci1wb3AnLCBvbkJyZWFkY3J1bWJQb3ApKVxuICAvLyDlv6vmjbfplK7pnaLmnb/jgIzmjInku7vmhI/plK7lhbPpl63jgI3vvJrmjZXojrfpmLbmrrXlkJ7mjonmjInplK7vvIzpgb/lhY3pnaLmnb/lvIDnnYDml7bmjInplK7mvI/ov5vlupXlsYLovpPlhaXmoYZcbiAgY29uc3Qgb25TaG9ydGN1dHNBbnlLZXkgPSAoZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQgPT4ge1xuICAgIGlmICghc2hvd1Nob3J0Y3V0cy52YWx1ZSkgcmV0dXJuXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIHNob3dTaG9ydGN1dHMudmFsdWUgPSBmYWxzZVxuICB9XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25TaG9ydGN1dHNBbnlLZXksIHsgY2FwdHVyZTogdHJ1ZSB9KVxuICB1bnN1YnNjcmliZXJzLnB1c2goKCkgPT5cbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uU2hvcnRjdXRzQW55S2V5LCB7IGNhcHR1cmU6IHRydWUgfSlcbiAgKVxuICAvLyBCMe+8muaVsOWtl+ebtOi+viArIFBvcCB0byBSb290IOa0u+WKqOaOoua1i++8iOmUruWFpS/ngrnlh7sv6byg5qCH56e75YqoL+a7mui9ruWdh+mHjee9riA2MHMg6K6h5pe277yJXG4gIGFkZFdpbmRvd0xpc3RlbmVyKHVuc3Vic2NyaWJlcnMsICdrZXlkb3duJywgb25XaW5kb3dLZXlkb3duKVxuICBhZGRXaW5kb3dMaXN0ZW5lcih1bnN1YnNjcmliZXJzLCAnbW91c2Vkb3duJywgKCkgPT4gbm90ZUFjdGl2aXR5KCkpXG4gIGFkZFdpbmRvd0xpc3RlbmVyKHVuc3Vic2NyaWJlcnMsICdtb3VzZW1vdmUnLCBvbldpbmRvd01vdXNlTW92ZSwgeyBwYXNzaXZlOiB0cnVlIH0pXG4gIGFkZFdpbmRvd0xpc3RlbmVyKHVuc3Vic2NyaWJlcnMsICd3aGVlbCcsICgpID0+IG5vdGVBY3Rpdml0eSgpLCB7IHBhc3NpdmU6IHRydWUgfSlcbiAgYWRkRG9jdW1lbnRMaXN0ZW5lcih1bnN1YnNjcmliZXJzLCAndmlzaWJpbGl0eWNoYW5nZScsIG9uVmlzaWJpbGl0eUNoYW5nZUZvcklkbGUpXG4gIG5vdGVBY3Rpdml0eSgpXG4gIC8vIOWIneWni+WMlu+8muepuuafpeivouWxleekuuW7uuiurlxuICByZXNldFRvU3VnZ2VzdGlvbnMoKVxuICAvLyDpmLbmrrUxLjHvvJrliqDovb3nu5/kuIAgQ29tbWFuZCBSZWdpc3RyeVxuICB2b2lkIGxvYWRSZWdpc3RyeUNvbW1hbmRzKCkudGhlbigoKSA9PiBlbnJpY2hBbGlhc2VzKCkpXG4gIC8vIOWFiOazqOWGjOiuoumYhe+8iOWQjOatpe+8ie+8jOWGjeW8guatpeWKoOi9veaVsOaNruKAlOKAlOmBv+WFjeaFoumAnyBJT++8iOW6lOeUqOaJq+aPj++8iemYu+WhnuebkeWQrOazqOWGjFxuICB1bnN1YnNjcmliZXJzLnB1c2goXG4gICAgd2luZG93LmFwaS5sYXVuY2hlci5vblNob3duKCgpID0+IHtcbiAgICAgIHF1ZXJ5LnZhbHVlID0gJydcbiAgICAgIHNlbGVjdGVkSW5kZXgudmFsdWUgPSAwXG4gICAgICBwYWdlU3RhY2sudmFsdWUgPSBbXSAvLyDmr4/mrKHllKTotbflm57liLDmoLnmgIHvvIhSYXljYXN0IOihjOS4uu+8iVxuICAgICAgYWN0aW9uUGFuZWxFbnRyeS52YWx1ZSA9IG51bGxcbiAgICAgIGV4aXRIaXN0b3J5TmF2KCkgLy8gQjHvvJrllKTotbflpI3kvY3ljoblj7Llr7zoiKrmgIFcbiAgICAgIGlucHV0UmVmLnZhbHVlPy5mb2N1cygpXG4gICAgICBub3RlQWN0aXZpdHkoKSAvLyBCMe+8mlBvcCB0byBSb290IOiuoeaXtuS7juWUpOi1t+mHjeaWsOW8gOWni1xuICAgICAgLy8g5bi46am756qX5Y+j77ya5q+P5qyh5ZSk6LW35Yi35paw5o+S5Lu25ZG95Luk5LiO5bu66K6u77yI566h55CG6aG16KOFL+WBnOaPkuS7tuWQjueri+WNs+eUn+aViO+8iVxuICAgICAgdm9pZCBsb2FkUmVnaXN0cnlDb21tYW5kcygpLnRoZW4oKCkgPT4gZW5yaWNoQWxpYXNlcygpKVxuICAgICAgdm9pZCBsb2FkUGx1Z2luQ29tbWFuZHMoKS50aGVuKCgpID0+IGVucmljaEFsaWFzZXMoKSlcbiAgICAgIHZvaWQgbG9hZEZhbGxiYWNrRGlzYWJsZWQoKVxuICAgICAgdm9pZCByZWZyZXNoU3VnZ2VzdGlvbnMoKS50aGVuKCgpID0+IHtcbiAgICAgICAgaWYgKCFxdWVyeS52YWx1ZS50cmltKCkpIHJlc2V0VG9TdWdnZXN0aW9ucygpXG4gICAgICB9KVxuICAgICAgdm9pZCByZWZyZXNoUmVjZW50VXNhZ2UoKVxuICAgIH0pXG4gIClcbiAgLy8g4oyYSyDnrYnlpJbpg6jlhaXlj6PmiZPlvIDnrKzkuIDmlrnlhoXogZTpobXvvIjkuLvov5vnqIvllKTotbfog7blm4rlkI7ovazlj5HvvIlcbiAgdW5zdWJzY3JpYmVycy5wdXNoKFxuICAgIHdpbmRvdy5hcGkubGF1bmNoZXIub25PcGVuRmlyc3RQYXJ0eSgocGFnZSkgPT4ge1xuICAgICAgcHVzaFBhZ2UocGFnZSlcbiAgICAgIHF1ZXJ5LnZhbHVlID0gJydcbiAgICAgIGlucHV0UmVmLnZhbHVlPy5mb2N1cygpXG4gICAgfSlcbiAgKVxuICAvLyDmj6HmiYvvvJrmjILovb3lkI7kuLvliqjmi4nkuIDmrKHnirbmgIHvvIzlhZzkvY8gbW91bnQg5YmN5Lii5aSx55qE5LiA5qyh5oCn5o6o6YCBXG4gIHZvaWQgd2luZG93LmFwaS5sYXVuY2hlci5nZXRQbHVnaW5TdGF0ZSgpLnRoZW4oKHN0YXRlKSA9PiB7XG4gICAgaWYgKHN0YXRlICYmIHN0YXRlLm9wZW4pIHtcbiAgICAgIHBsdWdpblN0YXRlLnZhbHVlID0gc3RhdGVcbiAgICAgIGRlY2xhcmVkTGlzdC52YWx1ZSA9IChzdGF0ZS5kZWNsYXJlZExpc3QgYXMgUGx1Z2luTGlzdEl0ZW1bXSkgPz8gbnVsbFxuICAgICAgaW5wdXRSZWYudmFsdWU/LmZvY3VzKClcbiAgICB9XG4gIH0pXG4gIHVuc3Vic2NyaWJlcnMucHVzaChcbiAgICB3aW5kb3cuYXBpLmxhdW5jaGVyLm9uUGx1Z2luQ2hhbmdlZCgoc3RhdGUpID0+IHtcbiAgICAgIGNvbnN0IHdhc09wZW4gPSBwbHVnaW5TdGF0ZS52YWx1ZS5vcGVuXG4gICAgICBwbHVnaW5TdGF0ZS52YWx1ZSA9IHN0YXRlXG4gICAgICAvLyDlo7DmmI7lvI/liJfooajpmo/mj5Lku7bnirbmgIHlkIzmraXvvIjlhbPpl63ljbPmuIXnqbrvvIlcbiAgICAgIGRlY2xhcmVkTGlzdC52YWx1ZSA9IHN0YXRlLm9wZW4gPyAoKHN0YXRlLmRlY2xhcmVkTGlzdCBhcyBQbHVnaW5MaXN0SXRlbVtdKSA/PyBudWxsKSA6IG51bGxcbiAgICAgIGlmIChzdGF0ZS5vcGVuICYmICF3YXNPcGVuKSB7XG4gICAgICAgIC8vIOi/m+WFpeaPkuS7tu+8mua4heepuuaQnOe0ouivje+8jOeEpueCueS6pOe7meiDtuWbiui+k+WFpeahhu+8iOWJr+i+k+WFpeahhu+8iVxuICAgICAgICBxdWVyeS52YWx1ZSA9ICcnXG4gICAgICAgIGlucHV0UmVmLnZhbHVlPy5mb2N1cygpXG4gICAgICB9IGVsc2UgaWYgKCFzdGF0ZS5vcGVuKSB7XG4gICAgICAgIC8vIOaPkuS7tuWFs+mXre+8muaBouWkjeWQr+WKqOWZqOm7mOiupOaAgVxuICAgICAgICBxdWVyeS52YWx1ZSA9ICcnXG4gICAgICAgIGlucHV0UmVmLnZhbHVlPy5mb2N1cygpXG4gICAgICB9XG4gICAgICAvLyBwbGFjZWhvbGRlciDmm7TmlrDnrYnlhbbkvZnmg4XlhrXkuI3liqjnhKbngrnvvIzpgb/lhY3miqLmj5Lku7bop4blm77nmoTkuqTkupJcbiAgICB9KVxuICApXG4gIC8vIOWjsOaYjuW8j+WIl+ihqOWunuaXtuabtOaWsO+8iOaPkuS7tuaPkOS6pOaWsCBpdGVtc++8iVxuICB1bnN1YnNjcmliZXJzLnB1c2goXG4gICAgd2luZG93LmFwaS5sYXVuY2hlci5vblBsdWdpbkxpc3QoKHBheWxvYWQpID0+IHtcbiAgICAgIGlmIChwbHVnaW5TdGF0ZS52YWx1ZS5vcGVuICYmIHBheWxvYWQucGx1Z2luSWQgPT09IHBsdWdpblN0YXRlLnZhbHVlLnBsdWdpbklkKSB7XG4gICAgICAgIGRlY2xhcmVkTGlzdC52YWx1ZSA9IHBheWxvYWQuaXRlbXMgYXMgUGx1Z2luTGlzdEl0ZW1bXVxuICAgICAgfVxuICAgIH0pXG4gIClcblxuICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOmYtuautTEuMe+8muW6lOeUqOWRveS7pOW3sui/geenu+WIsCBBcHBsaWNhdGlvbkNvbW1hbmRQcm92aWRlclxuICAgICAgYXdhaXQgbG9hZFJlZ2lzdHJ5Q29tbWFuZHMoKVxuICAgICAgYXdhaXQgZW5yaWNoQWxpYXNlcygpXG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiBSZWdpc3RyeSDliqDovb3lpLHotKXkuI3pmLvloZ4gKi9cbiAgICB9XG4gIH0pKClcbiAgdm9pZCBsb2FkUGx1Z2luQ29tbWFuZHMoKS50aGVuKCgpID0+IGVucmljaEFsaWFzZXMoKSlcbiAgdm9pZCBsb2FkRHluYW1pY0NvbW1hbmRzKCkudGhlbigoKSA9PiBlbnJpY2hBbGlhc2VzKCkpXG4gIHZvaWQgcmVmcmVzaFN1Z2dlc3Rpb25zKClcbiAgdm9pZCByZWZyZXNoUmVjZW50VXNhZ2UoKVxuICB2b2lkIGxvYWRGYWxsYmFja0Rpc2FibGVkKClcbn0pXG48L3NjcmlwdD5cblxuPHN0eWxlIHNjb3BlZD5cbi5sYXVuY2hlciB7XG4gIHdpZHRoOiAxMDAlO1xuICBoZWlnaHQ6IDEwMCU7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gIGJvcmRlci1yYWRpdXM6IHZhcigtLWxhdW5jaGVyLXJhZGl1cyk7XG4gIG92ZXJmbG93OiBoaWRkZW47XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnKTtcbiAgYmFja2Ryb3AtZmlsdGVyOiB2YXIoLS1sYXVuY2hlci1ibHVyKTtcbiAgLXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6IHZhcigtLWxhdW5jaGVyLWJsdXIpO1xuICBib3gtc2hhZG93OiB2YXIoLS1sYXVuY2hlci1zaGFkb3cpO1xuICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICBwb3NpdGlvbjogcmVsYXRpdmU7XG59XG5cbi8qIOKUgOKUgCDmkJzntKLmoYbvvIhWMe+8mlJheWNhc3QgNjRwdCDooYzpq5ggPSAxNiBwYWRkaW5nICsgMzIg6L6T5YWl5qGG5bGF5Lit77yJ4pSA4pSAICovXG4ubGF1bmNoZXItc2VhcmNoIHtcbiAgaGVpZ2h0OiB2YXIoLS1sYXVuY2hlci1zZWFyY2gtaGVpZ2h0KTtcbiAgZmxleC1zaHJpbms6IDA7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdhcDogMTJweDtcbiAgcGFkZGluZzogMCAxNnB4O1xuICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItaGFpcmxpbmUpO1xuICBwb3NpdGlvbjogcmVsYXRpdmU7XG59XG5cbi8qIEk5IOe7n+S4gOWKoOi9veaAge+8mui0tOaQnOe0ouihjOW6lei+ueeahOS4jeehruWumui/m+W6puadoSAqL1xuLmxhdW5jaGVyLWJ1c3kge1xuICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gIHRvcDogdmFyKC0tbGF1bmNoZXItc2VhcmNoLWhlaWdodCk7XG4gIGxlZnQ6IDA7XG4gIHJpZ2h0OiAwO1xuICBoZWlnaHQ6IDJweDtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgei1pbmRleDogMjU7XG4gIHBvaW50ZXItZXZlbnRzOiBub25lO1xufVxuXG4ubGF1bmNoZXItYnVzeS1iYXIge1xuICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gIHRvcDogMDtcbiAgYm90dG9tOiAwO1xuICB3aWR0aDogMzAlO1xuICBib3JkZXItcmFkaXVzOiAycHg7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWFjY2VudCk7XG4gIGFuaW1hdGlvbjogbGF1bmNoZXItYnVzeS1zbGlkZSAxLjFzIGVhc2UtaW4tb3V0IGluZmluaXRlO1xufVxuXG5Aa2V5ZnJhbWVzIGxhdW5jaGVyLWJ1c3ktc2xpZGUge1xuICAwJSB7XG4gICAgbGVmdDogLTMwJTtcbiAgfVxuICAxMDAlIHtcbiAgICBsZWZ0OiAxMDAlO1xuICB9XG59XG5cbi5sYXVuY2hlci1zZWFyY2gtaWNvbiB7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgZmxleC1zaHJpbms6IDA7XG4gIHdpZHRoOiAyMnB4O1xuICBoZWlnaHQ6IDIycHg7XG59XG5cbi5sYXVuY2hlci1zZWFyY2gtYmFjayB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICB3aWR0aDogMjhweDtcbiAgaGVpZ2h0OiAyOHB4O1xuICBmbGV4LXNocmluazogMDtcbiAgYm9yZGVyOiBub25lO1xuICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICBib3JkZXItcmFkaXVzOiA2cHg7XG4gIGN1cnNvcjogcG9pbnRlcjtcbiAgbWFyZ2luLWxlZnQ6IC00cHg7XG4gIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xcyBlYXNlO1xufVxuXG4ubGF1bmNoZXItc2VhcmNoLWJhY2s6aG92ZXIge1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1zZWxlY3RlZC1iZyk7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0KTtcbn1cblxuLmxhdW5jaGVyLXNlYXJjaC1pbnB1dCB7XG4gIGZsZXg6IDE7XG4gIGhlaWdodDogMzJweDtcbiAgYm9yZGVyOiBub25lO1xuICBvdXRsaW5lOiBub25lO1xuICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQpO1xuICBmb250LXNpemU6IDE3cHg7XG4gIGZvbnQtd2VpZ2h0OiA0MDA7XG4gIGNhcmV0LWNvbG9yOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xufVxuXG4ubGF1bmNoZXItc2VhcmNoLWlucHV0OjpwbGFjZWhvbGRlciB7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LWZhaW50KTtcbn1cblxuLmxhdW5jaGVyLXNlYXJjaC1yaWdodCB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGZsZXgtc2hyaW5rOiAwO1xufVxuXG4vKiBJNu+8muWJqui0tOadv+mhteexu+Wei+etm+mAie+8iFJheWNhc3QgQWxsIFR5cGVzIOWcqOaQnOe0ouagj+WGheWPs+S+p++8iSAqL1xuLmxhdW5jaGVyLXNlYXJjaC1maWx0ZXIge1xuICBoZWlnaHQ6IDI4cHg7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtZGltKTtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItaW5wdXQtYmcpO1xuICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1sYXVuY2hlci1oYWlybGluZSk7XG4gIGJvcmRlci1yYWRpdXM6IDdweDtcbiAgcGFkZGluZzogMCA0cHg7XG4gIGN1cnNvcjogcG9pbnRlcjtcbiAgb3V0bGluZTogbm9uZTtcbiAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbn1cblxuLmxhdW5jaGVyLXNlYXJjaC1haSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdhcDogNXB4O1xuICBib3JkZXI6IG5vbmU7XG4gIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBwYWRkaW5nOiA0cHggOHB4O1xuICBib3JkZXItcmFkaXVzOiA2cHg7XG4gIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xcyBlYXNlO1xufVxuXG4ubGF1bmNoZXItc2VhcmNoLWFpOmhvdmVyIHtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItc2VsZWN0ZWQtYmcpO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG59XG5cbi5sYXVuY2hlci1zZWFyY2gtYWkga2JkIHtcbiAgZm9udC1mYW1pbHk6IGluaGVyaXQ7XG4gIGZvbnQtc2l6ZTogMTBweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtZmFpbnQpO1xuICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1sYXVuY2hlci1ib3JkZXIpO1xuICBib3JkZXItcmFkaXVzOiA0cHg7XG4gIHBhZGRpbmc6IDFweCA1cHg7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbn1cblxuLmxhdW5jaGVyLXNlYXJjaC1wbHVnaW4ge1xuICBmb250LXNpemU6IDEycHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xuICBmb250LXdlaWdodDogNTAwO1xufVxuXG4vKiDilIDilIAg5Yqo5L2c6Z2i5p2/77yISTTvvJpSYXljYXN0IOWMluKAlOKAlOWPs+mUmuWumua1ruWxgiB+NDYwcHjjgIHliqjkvZzooYzlm77moIcr6ZSu5bi944CB5bqV6YOo6L+H5ruk5qGG77yJ4pSA4pSAICovXG4ubGF1bmNoZXItYWN0aW9ucyB7XG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgdG9wOiBjYWxjKHZhcigtLWxhdW5jaGVyLXNlYXJjaC1oZWlnaHQpICsgNHB4KTtcbiAgcmlnaHQ6IDEycHg7XG4gIHotaW5kZXg6IDIwO1xuICB3aWR0aDogNDYwcHg7XG4gIG1heC1oZWlnaHQ6IDM4MHB4O1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1sYXVuY2hlci1ib3JkZXIpO1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1wb3BvdmVyLWJnKTtcbiAgYmFja2Ryb3AtZmlsdGVyOiB2YXIoLS1sYXVuY2hlci1ibHVyKTtcbiAgLXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6IHZhcigtLWxhdW5jaGVyLWJsdXIpO1xuICBib3gtc2hhZG93OiAwIDEwcHggNDBweCByZ2JhKDAsIDAsIDAsIDAuMTUpO1xuICBwYWRkaW5nOiA2cHg7XG4gIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG59XG5cbi5sYXVuY2hlci1hY3Rpb25zLXRpdGxlIHtcbiAgcGFkZGluZzogNHB4IDEwcHggOHB4O1xuICBmb250LXNpemU6IDExcHg7XG4gIGZvbnQtd2VpZ2h0OiA1MDA7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gIGZsZXgtc2hyaW5rOiAwO1xufVxuXG4ubGF1bmNoZXItYWN0aW9ucy1saXN0IHtcbiAgZmxleDogMTtcbiAgbWluLWhlaWdodDogMDtcbiAgb3ZlcmZsb3cteTogYXV0bztcbn1cblxuLmxhdW5jaGVyLWFjdGlvbiB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdhcDogMTBweDtcbiAgcGFkZGluZzogOHB4IDEwcHg7XG4gIGJvcmRlci1yYWRpdXM6IDdweDtcbiAgZm9udC1zaXplOiAxM3B4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1kaW0pO1xuICBjdXJzb3I6IHBvaW50ZXI7XG59XG5cbi5sYXVuY2hlci1hY3Rpb24uc2VsZWN0ZWQge1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1zZWxlY3RlZC1iZyk7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0KTtcbn1cblxuLmxhdW5jaGVyLWFjdGlvbi1pY29uIHtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICBmbGV4LXNocmluazogMDtcbn1cblxuLmxhdW5jaGVyLWFjdGlvbi5zZWxlY3RlZCAubGF1bmNoZXItYWN0aW9uLWljb24ge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbn1cblxuLmxhdW5jaGVyLWFjdGlvbi1sYWJlbCB7XG4gIGZsZXg6IDE7XG4gIG1pbi13aWR0aDogMDtcbiAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG59XG5cbi5sYXVuY2hlci1hY3Rpb24ta2V5cyB7XG4gIGZvbnQtZmFtaWx5OiBpbmhlcml0O1xuICBmb250LXNpemU6IDExcHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LWRpbSk7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgcGFkZGluZzogMnB4IDZweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYmctZWxldmF0ZWQpO1xuICBmbGV4LXNocmluazogMDtcbn1cblxuLmxhdW5jaGVyLWFjdGlvbnMtZW1wdHkge1xuICBwYWRkaW5nOiAxNHB4IDEwcHg7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtZmFpbnQpO1xuICB0ZXh0LWFsaWduOiBjZW50ZXI7XG59XG5cbi5sYXVuY2hlci1hY3Rpb25zLWZpbHRlciB7XG4gIGZsZXgtc2hyaW5rOiAwO1xuICBtYXJnaW4tdG9wOiA2cHg7XG4gIGhlaWdodDogMzJweDtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItaGFpcmxpbmUpO1xuICBvdXRsaW5lOiBub25lO1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1pbnB1dC1iZyk7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0KTtcbiAgZm9udC1zaXplOiAxM3B4O1xuICBib3JkZXItcmFkaXVzOiA3cHg7XG4gIHBhZGRpbmc6IDAgMTBweDtcbiAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbn1cblxuLmxhdW5jaGVyLWFjdGlvbnMtZmlsdGVyOjpwbGFjZWhvbGRlciB7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LWZhaW50KTtcbn1cblxuLyog4pSA4pSAIOe7k+aenOWIl+ihqCArIOivpuaDhemdouadv++8iExpc3QtRGV0YWls77yJIOKUgOKUgCAqL1xuLmxhdW5jaGVyLWJvZHkge1xuICBmbGV4OiAxO1xuICBkaXNwbGF5OiBmbGV4O1xuICBvdmVyZmxvdzogaGlkZGVuO1xufVxuXG4ubGF1bmNoZXItcmVzdWx0cyB7XG4gIGZsZXg6IDE7XG4gIG92ZXJmbG93LXk6IGF1dG87XG4gIHBhZGRpbmc6IDRweCAwO1xuICBtaW4td2lkdGg6IDA7XG59XG5cbi5sYXVuY2hlci1yZXN1bHRzLmhhcy1kZXRhaWwge1xuICBib3JkZXItcmlnaHQ6IDFweCBzb2xpZCB2YXIoLS1sYXVuY2hlci1oYWlybGluZSk7XG59XG5cbi5sYXVuY2hlci1kZXRhaWwge1xuICB3aWR0aDogdmFyKC0tbGF1bmNoZXItZGV0YWlsLXdpZHRoKTtcbiAgZmxleC1zaHJpbms6IDA7XG4gIG92ZXJmbG93OiBoaWRkZW47XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbn1cblxuLmxhdW5jaGVyLXNlY3Rpb24tbGFiZWwge1xuICBwYWRkaW5nOiA2cHggMTZweCA0cHg7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xufVxuXG4ubGF1bmNoZXItcmVzdWx0IHtcbiAgcG9zaXRpb246IHJlbGF0aXZlO1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDEycHg7XG4gIHBhZGRpbmc6IDhweCAxNnB4O1xuICBtaW4taGVpZ2h0OiAzOHB4O1xuICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICBjdXJzb3I6IHBvaW50ZXI7XG4gIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xcyBlYXNlO1xufVxuXG4ubGF1bmNoZXItcmVzdWx0LnNlbGVjdGVkIHtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItc2VsZWN0ZWQtYmcpO1xufVxuXG4ubGF1bmNoZXItcmVzdWx0LWljb24ge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgd2lkdGg6IDIycHg7XG4gIGhlaWdodDogMjJweDtcbiAgZmxleC1zaHJpbms6IDA7XG4gIGJvcmRlci1yYWRpdXM6IDVweDtcbiAgY29sb3I6ICNmZmY7XG59XG5cbi5sYXVuY2hlci1yZXN1bHQtaWNvbi1zdmcge1xuICBmaWx0ZXI6IGJyaWdodG5lc3MoMCkgaW52ZXJ0KDEpO1xufVxuXG4ubGF1bmNoZXItcmVzdWx0LWZhdmljb24ge1xuICB3aWR0aDogMThweDtcbiAgaGVpZ2h0OiAxOHB4O1xuICBvYmplY3QtZml0OiBjb250YWluO1xuICBib3JkZXItcmFkaXVzOiA0cHg7XG59XG5cbi5sYXVuY2hlci1yZXN1bHQtdGV4dCB7XG4gIGZsZXg6IDE7XG4gIG1pbi13aWR0aDogMDtcbn1cblxuLmxhdW5jaGVyLXJlc3VsdC10aXRsZSB7XG4gIGZvbnQtc2l6ZTogMTNweDtcbiAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQpO1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGJhc2VsaW5lO1xuICBnYXA6IDhweDtcbn1cblxuLmxhdW5jaGVyLXJlc3VsdC10aXRsZSAuaGwge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbn1cblxuLmxhdW5jaGVyLXJlc3VsdC1zdWJ0aXRsZSB7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgZmxleC1zaHJpbms6IDA7XG59XG5cbi5sYXVuY2hlci1yZXN1bHQtbWV0YSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdhcDogMTBweDtcbiAgZmxleC1zaHJpbms6IDA7XG59XG5cbi5sYXVuY2hlci1yZXN1bHQtYmFkZ2Uge1xuICBmb250LXNpemU6IDExcHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xuICBmb250LXdlaWdodDogNTAwO1xufVxuXG4ubGF1bmNoZXItcmVzdWx0LXF1aWNrIHtcbiAgZm9udC1zaXplOiAxMHB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG4gIGZvbnQtZmFtaWx5OiBpbmhlcml0O1xuICBmb250LXdlaWdodDogNTAwO1xuICBtaW4td2lkdGg6IDE4cHg7XG4gIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgcGFkZGluZzogMXB4IDA7XG4gIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYmctZWxldmF0ZWQpO1xufVxuXG4ubGF1bmNoZXItcmVzdWx0LnNlbGVjdGVkIC5sYXVuY2hlci1yZXN1bHQtcXVpY2sge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1kaW0pO1xufVxuXG4vKiDilIDilIAg56m65oCBICsgRmFsbGJhY2sgQ29tbWFuZHMg4pSA4pSAICovXG4ubGF1bmNoZXItZW1wdHkge1xuICBmbGV4OiAxO1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBhbGlnbi1pdGVtczogc3RyZXRjaDtcbiAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICBnYXA6IDEwcHg7XG4gIHBhZGRpbmc6IDE2cHggMTJweDtcbiAgb3ZlcmZsb3cteTogYXV0bztcbn1cblxuLmxhdW5jaGVyLWVtcHR5LXRleHQge1xuICBmb250LXNpemU6IDEzcHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgdGV4dC1hbGlnbjogY2VudGVyO1xuICBwYWRkaW5nOiA0cHggMDtcbn1cblxuLmxhdW5jaGVyLWZhbGxiYWNrLWxpc3Qge1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBnYXA6IDJweDtcbn1cblxuLmxhdW5jaGVyLWZhbGxiYWNrLWl0ZW0ge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDEwcHg7XG4gIHBhZGRpbmc6IDhweCAxMHB4O1xuICBib3JkZXItcmFkaXVzOiA4cHg7XG4gIGN1cnNvcjogcG9pbnRlcjtcbiAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjEycztcbn1cblxuLmxhdW5jaGVyLWZhbGxiYWNrLWl0ZW06aG92ZXIsXG4ubGF1bmNoZXItZmFsbGJhY2staXRlbS5zZWxlY3RlZCB7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLXJlc3VsdC1ob3Zlcik7XG59XG5cbi5sYXVuY2hlci1mYWxsYmFjay1pY29uIHtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICBmbGV4LXNocmluazogMDtcbn1cblxuLmxhdW5jaGVyLWZhbGxiYWNrLWl0ZW0uc2VsZWN0ZWQgLmxhdW5jaGVyLWZhbGxiYWNrLWljb24ge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbn1cblxuLyogUXVpY2sgQUkg5YWc5bqV6aG56KeG6KeJ5by66LCDICovXG4ubGF1bmNoZXItZmFsbGJhY2staXRlbS5haS1lbXBoYXNpcyAubGF1bmNoZXItZmFsbGJhY2stdGl0bGUge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbn1cblxuLmxhdW5jaGVyLWZhbGxiYWNrLWl0ZW0uYWktZW1waGFzaXMuc2VsZWN0ZWQge1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQtc29mdCk7XG59XG5cbi5sYXVuY2hlci1mYWxsYmFjay1pdGVtLmFpLWVtcGhhc2lzLnNlbGVjdGVkIC5sYXVuY2hlci1mYWxsYmFjay10aXRsZSB7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xufVxuXG4ubGF1bmNoZXItZmFsbGJhY2stdGV4dCB7XG4gIGZsZXg6IDE7XG4gIG1pbi13aWR0aDogMDtcbn1cblxuLmxhdW5jaGVyLWZhbGxiYWNrLXRpdGxlIHtcbiAgZm9udC1zaXplOiAxM3B4O1xuICBmb250LXdlaWdodDogNTAwO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gIG92ZXJmbG93OiBoaWRkZW47XG4gIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xufVxuXG4ubGF1bmNoZXItZmFsbGJhY2stc3VidGl0bGUge1xuICBmb250LXNpemU6IDExcHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgbWFyZ2luLXRvcDogMXB4O1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbn1cblxuLmxhdW5jaGVyLWZhbGxiYWNrLWJhZGdlIHtcbiAgZm9udC1zaXplOiAxMHB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1mYWludCk7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJhZGdlLWJnKTtcbiAgcGFkZGluZzogMnB4IDZweDtcbiAgYm9yZGVyLXJhZGl1czogNHB4O1xuICBmbGV4LXNocmluazogMDtcbn1cblxuLmxhdW5jaGVyLWVtcHR5LWFpIHtcbiAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdhcDogN3B4O1xuICBwYWRkaW5nOiA4cHggMThweDtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYWNjZW50LXN0cm9uZyk7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50LXNvZnQpO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgZm9udC1zaXplOiAxM3B4O1xuICBjdXJzb3I6IHBvaW50ZXI7XG4gIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xNXMgZWFzZTtcbn1cblxuLmxhdW5jaGVyLWVtcHR5LWFpOmhvdmVyIHtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50LXN0cm9uZyk7XG59XG5cbi8qIOKUgOKUgCDlupXpg6jmk43kvZzmoI8g4pSA4pSAICovXG4ubGF1bmNoZXItZm9vdGVyIHtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICBwYWRkaW5nOiA4cHggMTJweDtcbiAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWhhaXJsaW5lKTtcbiAgZmxleC1zaHJpbms6IDA7XG4gIG1pbi1oZWlnaHQ6IHZhcigtLWxhdW5jaGVyLWZvb3Rlci1oZWlnaHQpO1xuICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xufVxuXG4ubGF1bmNoZXItZm9vdGVyLW1lbnUge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgd2lkdGg6IDI4cHg7XG4gIGhlaWdodDogMjhweDtcbiAgYm9yZGVyOiBub25lO1xuICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICBib3JkZXItcmFkaXVzOiA2cHg7XG4gIGN1cnNvcjogcG9pbnRlcjtcbiAgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjFzIGVhc2U7XG59XG5cbi5sYXVuY2hlci1mb290ZXItbWVudTpob3ZlciB7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLXNlbGVjdGVkLWJnKTtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQpO1xufVxuXG4ubGF1bmNoZXItZm9vdGVyLWFjdGlvbnMge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDhweDtcbn1cblxuLmxhdW5jaGVyLWZvb3Rlci1idG4ge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDVweDtcbiAgaGVpZ2h0OiAyOHB4O1xuICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1sYXVuY2hlci1ib3JkZXIpO1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1iZy1lbGV2YXRlZCk7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LWRpbSk7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBwYWRkaW5nOiAwIDEwcHg7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgYm94LXNoYWRvdzogMCAxcHggM3B4IHJnYmEoMCwgMCwgMCwgMC4wOCk7XG4gIHRyYW5zaXRpb246IGFsbCAwLjFzIGVhc2U7XG4gIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG59XG5cbi5sYXVuY2hlci1mb290ZXItYnRuOmhvdmVyIHtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItcmVzdWx0LWhvdmVyKTtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQpO1xufVxuXG4ubGF1bmNoZXItZm9vdGVyLWJ0biBrYmQge1xuICBmb250LWZhbWlseTogaW5oZXJpdDtcbiAgZm9udC1zaXplOiAxMHB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgcGFkZGluZzogMXB4IDVweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYmctZWxldmF0ZWQpO1xufVxuXG4vKiDilIDilIAg5b+r5o236ZSu6YCf5p+l6Z2i5p2/IOKUgOKUgCAqL1xuLnNob3J0Y3V0cy1vdmVybGF5IHtcbiAgcG9zaXRpb246IGFic29sdXRlO1xuICBpbnNldDogMDtcbiAgYmFja2dyb3VuZDogcmdiYSgwLCAwLCAwLCAwLjI1KTtcbiAgYmFja2Ryb3AtZmlsdGVyOiBibHVyKDRweCk7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICB6LWluZGV4OiAzMDtcbn1cblxuLnNob3J0Y3V0cy1wYW5lbCB7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbiAgYm9yZGVyLXJhZGl1czogMTJweDtcbiAgcGFkZGluZzogMjBweCAyNHB4O1xuICBib3gtc2hhZG93OiAwIDIwcHggNjBweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gIG1pbi13aWR0aDogMzIwcHg7XG59XG5cbi5zaG9ydGN1dHMtdGl0bGUge1xuICBmb250LXNpemU6IDE0cHg7XG4gIGZvbnQtd2VpZ2h0OiA2MDA7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0KTtcbiAgbWFyZ2luLWJvdHRvbTogMTZweDtcbiAgdGV4dC1hbGlnbjogY2VudGVyO1xufVxuXG4uc2hvcnRjdXRzLWdyaWQge1xuICBkaXNwbGF5OiBncmlkO1xuICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciAxZnI7XG4gIGdhcDogMTBweCAyMHB4O1xufVxuXG4uc2hvcnRjdXQtaXRlbSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdhcDogNnB4O1xuICBmb250LXNpemU6IDEycHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LWRpbSk7XG59XG5cbi5zaG9ydGN1dC1pdGVtIGtiZCB7XG4gIGZvbnQtZmFtaWx5OiBpbmhlcml0O1xuICBmb250LXNpemU6IDEwcHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LWRpbSk7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgcGFkZGluZzogMnB4IDZweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYmctZWxldmF0ZWQpO1xuICBtaW4td2lkdGg6IDIwcHg7XG4gIHRleHQtYWxpZ246IGNlbnRlcjtcbn1cblxuLnNob3J0Y3V0cy1oaW50IHtcbiAgbWFyZ2luLXRvcDogMTZweDtcbiAgZm9udC1zaXplOiAxMXB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1mYWludCk7XG4gIHRleHQtYWxpZ246IGNlbnRlcjtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL2xhdW5jaGVyL0xhdW5jaGVyQXBwLnZ1ZSJ9
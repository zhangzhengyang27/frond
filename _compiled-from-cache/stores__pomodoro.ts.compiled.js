import { defineStore } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/pinia.js?v=c8635d8b";
import { computed, ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
export const usePomodoroStore = defineStore("pomodoro", () => {
  const tasks = ref([]);
  const projects = ref([]);
  const records = ref([]);
  const todayRecords = ref([]);
  const freeRecords = ref([]);
  const statistics = ref(null);
  const settings = ref(null);
  const focusedProjectId = ref(null);
  const projectSettings = ref({});
  const timerStates = ref({});
  const statsRange = ref("week");
  const dailyTrend = ref([]);
  const projectDistribution = ref([]);
  const focusHeatmap = ref([]);
  const taskStats = ref(null);
  const statsLoading = ref(false);
  const streak = ref({ current: 0, longest: 0, activeToday: false });
  const loading = ref(false);
  const integrationMode = ref("normal");
  const integrationShortcuts = ref({
    toggle: "CommandOrControl+Shift+P",
    skip: "CommandOrControl+Shift+S",
    reset: "CommandOrControl+Shift+R"
  });
  const focusMode = ref(false);
  const traySnapshot = ref({
    isRunning: false,
    currentMode: null,
    taskTitle: "",
    timeLeftSeconds: 0,
    todayCompleted: 0,
    updatedAt: 0
  });
  const taskDetailId = ref(null);
  const taskDetail = ref(null);
  const taskDetailLoading = ref(false);
  const selectedRecordId = ref(null);
  const recordDetail = ref(null);
  const integrationFailedShortcuts = ref([]);
  const lastError = ref(null);
  const todayFocusMinutes = computed(() => {
    if (!statistics.value || !settings.value) return 0;
    return statistics.value.today.work * settings.value.workDuration;
  });
  const completedTasks = computed(() => tasks.value.filter((t) => t.completed));
  const pendingTasks = computed(() => tasks.value.filter((t) => !t.completed));
  async function load() {
    loading.value = true;
    lastError.value = null;
    try {
      const [t, p, s, st, tr, allSettings, allTimerStates] = await Promise.all([
        window.api.pomodoro.getTasks(),
        window.api.pomodoro.projects.getAll(),
        window.api.pomodoro.getSettings(),
        window.api.pomodoro.getStatistics(),
        window.api.pomodoro.getTodayRecords(),
        window.api.pomodoro.projects.settings.all(),
        window.api.pomodoro.timerState.getAll()
      ]);
      tasks.value = t;
      projects.value = p;
      settings.value = s;
      statistics.value = st;
      todayRecords.value = tr || [];
      projectSettings.value = allSettings || {};
      timerStates.value = allTimerStates || {};
      void loadFreeRecords().catch(() => {
      });
      if (focusedProjectId.value && !projects.value.some((p2) => p2.id === focusedProjectId.value)) {
        focusedProjectId.value = null;
      }
      void pushProjectsToMain();
      void loadFocusMode();
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err);
      console.error("[pomodoro store] load failed:", err);
    } finally {
      loading.value = false;
    }
  }
  async function addTask(title, options) {
    const task = await window.api.pomodoro.addTask(title, options);
    tasks.value.unshift(task);
    return task;
  }
  async function updateTask(id, updates) {
    const updated = await window.api.pomodoro.updateTask(id, updates);
    if (updated) {
      const idx = tasks.value.findIndex((t) => t.id === id);
      if (idx >= 0) tasks.value[idx] = updated;
    }
  }
  async function deleteTask(id) {
    await window.api.pomodoro.deleteTask(id);
    tasks.value = tasks.value.filter((t) => t.id !== id);
  }
  async function completeTask(id) {
    const updated = await window.api.pomodoro.completeTask(id);
    if (updated) {
      const idx = tasks.value.findIndex((t) => t.id === id);
      if (idx >= 0) tasks.value[idx] = updated;
    }
  }
  async function addProject(name, color) {
    const project = await window.api.pomodoro.projects.add(name, color);
    projects.value.push(project);
    return project;
  }
  async function updateProject(id, updates) {
    const updated = await window.api.pomodoro.projects.update(
      id,
      updates
    );
    if (updated) {
      const idx = projects.value.findIndex((p) => p.id === id);
      if (idx >= 0) projects.value[idx] = updated;
    }
  }
  async function deleteProject(id) {
    await window.api.pomodoro.projects.delete(id);
    projects.value = projects.value.filter((p) => p.id !== id);
    if (focusedProjectId.value === id) {
      focusedProjectId.value = projects.value[0]?.id ?? null;
    }
    delete projectSettings.value[id];
  }
  function setFocusedProject(id) {
    focusedProjectId.value = id;
  }
  function getTimerState(projectId) {
    return timerStates.value[projectId] ?? null;
  }
  async function persistTimerState(projectId, snapshot) {
    try {
      const toStore = {
        ...snapshot,
        status: snapshot.status === "paused" ? "paused" : "idle",
        updatedAt: Date.now()
      };
      timerStates.value = { ...timerStates.value, [projectId]: toStore };
      await window.api.pomodoro.timerState.save(projectId, toStore);
    } catch (err) {
      console.error("[pomodoro store] persistTimerState failed:", err);
    }
  }
  function projectSettingsById(id) {
    if (!id) return null;
    return projectSettings.value[id] ?? null;
  }
  function effectiveSettings(id, fallback) {
    const base = fallback ?? (settings.value ? {
      workDuration: settings.value.workDuration,
      shortBreakDuration: settings.value.shortBreakDuration,
      longBreakDuration: settings.value.longBreakDuration,
      longBreakInterval: settings.value.longBreakInterval
    } : { workDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, longBreakInterval: 4 });
    if (!id) return { ...base, longBreakInterval: base.longBreakInterval ?? 4 };
    const ov = projectSettings.value[id];
    if (!ov) return { ...base, longBreakInterval: base.longBreakInterval ?? 4 };
    return {
      workDuration: ov.workDuration ?? base.workDuration,
      shortBreakDuration: ov.shortBreakDuration ?? base.shortBreakDuration,
      longBreakDuration: ov.longBreakDuration ?? base.longBreakDuration,
      longBreakInterval: ov.longBreakInterval ?? base.longBreakInterval ?? 4
    };
  }
  async function saveProjectOverride(projectId, overrides) {
    const next = await window.api.pomodoro.projects.settings.save(
      projectId,
      overrides
    );
    projectSettings.value = { ...projectSettings.value, [projectId]: next };
    return next;
  }
  async function clearProjectOverride(projectId) {
    const ok = await window.api.pomodoro.projects.settings.delete(projectId);
    if (projectSettings.value[projectId]) {
      const next = { ...projectSettings.value };
      delete next[projectId];
      projectSettings.value = next;
    }
    return ok;
  }
  async function refreshProjectSettings() {
    const all = await window.api.pomodoro.projects.settings.all();
    projectSettings.value = all || {};
  }
  async function addRecord(record) {
    const r = await window.api.pomodoro.addRecord(record);
    await refreshStats();
    void loadStats(statsRange.value).catch(() => {
    });
    void loadFreeRecords().catch(() => {
    });
    return r;
  }
  async function refreshStats() {
    const [st, tr] = await Promise.all([
      window.api.pomodoro.getStatistics(),
      window.api.pomodoro.getTodayRecords()
    ]);
    statistics.value = st;
    todayRecords.value = tr || [];
  }
  async function saveSettings(partial) {
    const next = await window.api.pomodoro.saveSettings(partial);
    settings.value = next ?? { ...settings.value ?? {}, ...partial };
  }
  function rangeBounds(range, custom) {
    const now = /* @__PURE__ */ new Date();
    if (range === "today") {
      const start2 = new Date(now);
      start2.setHours(0, 0, 0, 0);
      return { from: start2.getTime(), to: now.getTime(), days: 1 };
    }
    if (range === "week") {
      const start2 = new Date(now);
      start2.setDate(now.getDate() - 6);
      start2.setHours(0, 0, 0, 0);
      return { from: start2.getTime(), to: now.getTime(), days: 7 };
    }
    if (range === "month") {
      const start2 = new Date(now);
      start2.setDate(now.getDate() - 29);
      start2.setHours(0, 0, 0, 0);
      return { from: start2.getTime(), to: now.getTime(), days: 30 };
    }
    if (range === "custom" && custom) {
      return { from: custom.from, to: custom.to, days: 1 };
    }
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { from: start.getTime(), to: now.getTime(), days: 7 };
  }
  function computeStreakFromTrend(trend) {
    if (!Array.isArray(trend) || trend.length === 0) {
      return { current: 0, longest: 0, activeToday: false };
    }
    const dayKey = (s) => {
      if (typeof s === "number") {
        return localDayKey(new Date(s));
      }
      return (s || "").slice(0, 10);
    };
    const localDayKey = (d) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
    const today = /* @__PURE__ */ new Date();
    const todayKey = localDayKey(today);
    const map = /* @__PURE__ */ new Map();
    for (const t of trend) {
      map.set(dayKey(t.date), (map.get(dayKey(t.date)) ?? 0) + (t.completedPomodoros ?? 0));
    }
    let current = 0;
    const cursor = /* @__PURE__ */ new Date();
    cursor.setHours(0, 0, 0, 0);
    let firstSkipped = false;
    for (let i = 0; i < 365; i += 1) {
      const k = localDayKey(cursor);
      const count = map.get(k) ?? 0;
      if (count > 0) {
        current += 1;
      } else if (k === todayKey && !firstSkipped) {
        firstSkipped = true;
      } else {
        break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    let longest = 0;
    let run = 0;
    const sortedKeys = Array.from(map.keys()).sort();
    for (const k of sortedKeys) {
      if ((map.get(k) ?? 0) > 0) {
        run += 1;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }
    return {
      current,
      longest: Math.max(longest, current),
      activeToday: (map.get(todayKey) ?? 0) > 0
    };
  }
  let loadStatsSeq = 0;
  async function loadStats(range = statsRange.value, custom) {
    const seq = ++loadStatsSeq;
    statsLoading.value = true;
    lastError.value = null;
    try {
      statsRange.value = range;
      const { from, to, days } = rangeBounds(range, custom);
      const [trend, distribution, heatmap, taskCompletion] = await Promise.all([
        window.api.pomodoro.stats.getDailyTrend(days),
        window.api.pomodoro.stats.getProjectDistribution(from, to),
        window.api.pomodoro.stats.getFocusHeatmap(days),
        window.api.pomodoro.stats.getTaskCompletionStats(from, to)
      ]);
      if (seq !== loadStatsSeq) return;
      dailyTrend.value = trend;
      projectDistribution.value = distribution;
      focusHeatmap.value = heatmap;
      taskStats.value = taskCompletion;
      const streakInfo = computeStreakFromTrend(dailyTrend.value);
      streak.value = streakInfo;
    } catch (err) {
      if (seq === loadStatsSeq) {
        lastError.value = err instanceof Error ? err.message : String(err);
      }
      console.error("[pomodoro store] loadStats failed:", err);
    } finally {
      if (seq === loadStatsSeq) {
        statsLoading.value = false;
      }
    }
  }
  async function loadFreeRecords() {
    try {
      freeRecords.value = await window.api.pomodoro.getFreeRecords();
    } catch (err) {
      console.error("[pomodoro store] loadFreeRecords failed:", err);
    }
  }
  async function fetchRecordsByRange(from, to, projectId = null) {
    return await window.api.pomodoro.getRecordsByRange({
      from,
      to,
      projectId
    });
  }
  async function loadIntegration() {
    try {
      const [mode, shortcuts] = await Promise.all([
        window.api.pomodoro.integration.getMode(),
        window.api.pomodoro.integration.getShortcuts()
      ]);
      integrationMode.value = mode;
      integrationShortcuts.value = shortcuts;
    } catch (err) {
      console.error("[pomodoro store] loadIntegration failed:", err);
    }
  }
  async function setIntegrationMode(mode) {
    await window.api.pomodoro.integration.setMode(mode);
    integrationMode.value = mode;
  }
  async function testIntegrationNotification() {
    await window.api.pomodoro.integration.testNotification();
  }
  async function setFocusMode(enabled) {
    focusMode.value = enabled;
    try {
      await window.api.pomodoro.integration.setFocusMode(enabled);
      if (traySnapshot.value) {
        await pushTraySnapshot({ focusMode: enabled });
      }
    } catch (err) {
      console.error("[pomodoro store] setFocusMode failed:", err);
    }
  }
  async function loadFocusMode() {
    try {
      const enabled = await window.api.pomodoro.integration.getFocusMode();
      focusMode.value = !!enabled;
    } catch (err) {
      console.error("[pomodoro store] loadFocusMode failed:", err);
    }
  }
  const TODOIST_MAP_KEY = "leaf.todoist-map";
  const todoistMap = ref(loadTodoistMap());
  function loadTodoistMap() {
    try {
      const raw = localStorage.getItem(TODOIST_MAP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  function persistTodoistMap() {
    try {
      localStorage.setItem(TODOIST_MAP_KEY, JSON.stringify(todoistMap.value));
    } catch {
    }
  }
  async function importTodoistTasks() {
    const res = await window.api.pomodoro.todoist.importTasks();
    if (!res.ok || !res.tasks) {
      return { imported: 0, error: res.error ?? "导入失败" };
    }
    const existing = new Set(tasks.value.map((t) => t.title));
    let imported = 0;
    for (const t of res.tasks) {
      if (existing.has(t.title)) continue;
      const task = await addTask(t.title);
      if (task) {
        todoistMap.value[task.id] = t.externalId;
        imported += 1;
      }
    }
    persistTodoistMap();
    return { imported };
  }
  async function syncTaskCompleteToTodoist(taskId) {
    const externalId = todoistMap.value[taskId];
    if (!externalId) return;
    try {
      const res = await window.api.pomodoro.todoist.complete(externalId);
      if (res.ok) {
        delete todoistMap.value[taskId];
        persistTodoistMap();
      } else {
        console.warn("[pomodoro store] todoist complete failed:", res.error);
      }
    } catch (err) {
      console.error("[pomodoro store] todoist complete error:", err);
    }
  }
  async function notifyIntegration(event, message) {
    try {
      await window.api.pomodoro.integration.notify(event, message);
    } catch (err) {
      console.error("[pomodoro store] notifyIntegration failed:", err);
    }
  }
  async function setIntegrationShortcut(action, accelerator) {
    const result = await window.api.pomodoro.integration.setShortcut(action, accelerator);
    integrationShortcuts.value = result.shortcuts;
    integrationFailedShortcuts.value = result.failed;
    return { failed: result.failed };
  }
  async function resetIntegrationShortcuts() {
    const result = await window.api.pomodoro.integration.resetShortcuts();
    integrationShortcuts.value = result.shortcuts;
    integrationFailedShortcuts.value = result.failed;
  }
  async function pushTraySnapshot(patch) {
    const next = await window.api.pomodoro.integration.updateTraySnapshot(
      patch
    );
    traySnapshot.value = next;
  }
  function bindShortcutListener(handler) {
    return window.api.pomodoro.integration.onShortcut(handler);
  }
  function bindFocusProjectListener(handler) {
    return window.api.pomodoro.integration.onFocusProject(handler);
  }
  async function pushProjectsToMain() {
    const list = projects.value.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: false
    }));
    await window.api.pomodoro.integration.updateProjects(list, focusedProjectId.value);
  }
  async function openTaskDetail(taskId) {
    taskDetailId.value = taskId;
    taskDetail.value = null;
    selectedRecordId.value = null;
    recordDetail.value = null;
    taskDetailLoading.value = true;
    lastError.value = null;
    try {
      const detail = await window.api.pomodoro.task.detail(taskId);
      if (taskDetailId.value === taskId) {
        taskDetail.value = detail;
      }
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err);
      console.error("[pomodoro store] openTaskDetail failed:", err);
    } finally {
      if (taskDetailId.value === taskId) {
        taskDetailLoading.value = false;
      }
    }
  }
  function closeTaskDetail() {
    taskDetailId.value = null;
    taskDetail.value = null;
    selectedRecordId.value = null;
    recordDetail.value = null;
    taskDetailLoading.value = false;
  }
  async function loadRecordDetail(recordId) {
    selectedRecordId.value = recordId;
    recordDetail.value = null;
    try {
      const detail = await window.api.pomodoro.record.get(recordId);
      if (selectedRecordId.value === recordId) {
        recordDetail.value = detail;
      }
    } catch (err) {
      console.error("[pomodoro store] loadRecordDetail failed:", err);
    }
  }
  async function saveRecordNote(recordId, note) {
    try {
      const updated = await window.api.pomodoro.record.updateNote(
        recordId,
        note
      );
      if (updated && taskDetail.value) {
        taskDetail.value = {
          ...taskDetail.value,
          records: taskDetail.value.records.map((r) => r.id === recordId ? updated : r)
        };
      }
      if (updated && recordDetail.value?.record.id === recordId) {
        recordDetail.value = { ...recordDetail.value, record: updated };
      }
    } catch (err) {
      console.error("[pomodoro store] saveRecordNote failed:", err);
      throw err;
    }
  }
  return {
    // state
    tasks,
    projects,
    records,
    todayRecords,
    statistics,
    settings,
    statsRange,
    dailyTrend,
    projectDistribution,
    focusHeatmap,
    taskStats,
    statsLoading,
    integrationMode,
    integrationShortcuts,
    integrationFailedShortcuts,
    traySnapshot,
    taskDetailId,
    taskDetail,
    taskDetailLoading,
    selectedRecordId,
    recordDetail,
    focusedProjectId,
    projectSettings,
    loading,
    lastError,
    // getters
    todayFocusMinutes,
    completedTasks,
    pendingTasks,
    // actions
    load,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    addProject,
    updateProject,
    deleteProject,
    addRecord,
    refreshStats,
    saveSettings,
    loadStats,
    loadIntegration,
    setIntegrationMode,
    testIntegrationNotification,
    notifyIntegration,
    setIntegrationShortcut,
    resetIntegrationShortcuts,
    pushTraySnapshot,
    bindShortcutListener,
    bindFocusProjectListener,
    pushProjectsToMain,
    openTaskDetail,
    closeTaskDetail,
    loadRecordDetail,
    saveRecordNote,
    // P1-2：多项目并行
    setFocusedProject,
    projectSettingsById,
    effectiveSettings,
    saveProjectOverride,
    clearProjectOverride,
    refreshProjectSettings,
    // M14/M15
    getTimerState,
    persistTimerState,
    timerStates,
    // M8
    streak,
    // M4
    freeRecords,
    loadFreeRecords,
    // M6
    fetchRecordsByRange,
    // M7
    focusMode,
    setFocusMode,
    loadFocusMode,
    // P2-7：Todoist
    todoistMap,
    importTodoistTasks,
    syncTaskCompleteToTodoist
  };
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInBvbW9kb3JvLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGVhZiDCtyBQb21vZG9ybyBQaW5pYSBzdG9yZSAoUDAtMSDpqqjmnrYpXG4gKlxuICog6K6+6K6h55uu5qCH77yaXG4gKiAtIOWNleS4gOS6i+Wunua6kO+8mueVquiMhOmSn+aooeWdl+aJgOacieaVsOaNrui1sCBzdG9yZSArIElQQ1xuICogLSDmuJDov5vlvI/ov4Hnp7vvvJrmnKwgUFIg5pqC5LiN5by65Yi25omA5pyJ6LCD55So5pa56LWwIHN0b3Jl77yM5LuN5L+d55WZIHByb3BzL2VtaXRzXG4gKiAgIOWFvOWuueaXpyBpbmRleC52dWUg6KGM5Li677yMUDAtMiAvIFAwLTMg5pe25YaN5oqK5omA5pyJ57uE5Lu25YiH5YiwIHN0b3JlXG4gKlxuICog5b2T5YmN6IyD5Zu077yIUDAtMe+8ie+8mlxuICogLSB0YXNrcyAvIHJlY29yZHMgLyBzZXR0aW5ncyAvIHN0YXRpc3RpY3Mg5Zub5Liq6ZuG5ZCI55qEIHN0YXRlICsgYWN0aW9uc1xuICogLSDmtL7nlJ8gZ2V0dGVy77yadG9kYXlGb2N1c01pbnV0ZXPjgIFjb21wbGV0ZWRUYXNrc+OAgXBlbmRpbmdUYXNrc1xuICogLSDkuI3mjIHmnInorqHml7blmajnirbmgIHvvIh0aW1lTGVmdCAvIGlzUnVubmluZyAvIGN1cnJlbnRNb2RlIOS7jeeUsSBpbmRleC52dWUg5oyB5pyJ77yJXG4gKlxuICog5ZCO57utIFAwLTIg5Lya6L+B5YWl77yaXG4gKiAtIGN1cnJlbnRNb2RlIC8gaXNSdW5uaW5nIC8gdGltZUxlZnQgLyBjb21wbGV0ZWRDb3VudFxuICogLSB1c2VQb21vZG9yb1RpbWVyIGNvbXBvc2FibGVcbiAqIC0g6Ieq5Yqo5oyB5LmF5YyW5b2T5YmN5Lu75YqhIElEIOS4jui/t+S9oOeql+S9jee9rlxuICovXG5cbmltcG9ydCB7IGRlZmluZVN0b3JlIH0gZnJvbSAncGluaWEnXG5pbXBvcnQgeyBjb21wdXRlZCwgcmVmIH0gZnJvbSAndnVlJ1xuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAg57G75Z6L77yI5LiOIFBvbW9kb3JvUmVwb3NpdG9yeSDkuJrliqHmjqXlj6Plr7npvZDvvIkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbmV4cG9ydCB0eXBlIFRpbWVyTW9kZSA9ICd3b3JrJyB8ICdzaG9ydEJyZWFrJyB8ICdsb25nQnJlYWsnXG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9tb2Rvcm9UYXNrIHtcbiAgaWQ6IHN0cmluZ1xuICB0aXRsZTogc3RyaW5nXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nXG4gIGNvbXBsZXRlZDogYm9vbGVhblxuICBwcmlvcml0eTogbnVtYmVyXG4gIGVzdGltYXRlTXM6IG51bWJlciB8IG51bGxcbiAgcHJvamVjdElkOiBzdHJpbmcgfCBudWxsXG4gIGNyZWF0ZWRBdDogbnVtYmVyXG4gIGNvbXBsZXRlZEF0PzogbnVtYmVyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9tb2Rvcm9Qcm9qZWN0IHtcbiAgaWQ6IHN0cmluZ1xuICBuYW1lOiBzdHJpbmdcbiAgY29sb3I6IHN0cmluZ1xuICBzb3J0T3JkZXI6IG51bWJlclxuICBjcmVhdGVkQXQ6IG51bWJlclxuICB1cGRhdGVkQXQ6IG51bWJlclxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvbW9kb3JvUmVjb3JkIHtcbiAgaWQ6IHN0cmluZ1xuICB0YXNrSWQ/OiBzdHJpbmdcbiAgdGFza1RpdGxlPzogc3RyaW5nXG4gIHByb2plY3RJZD86IHN0cmluZ1xuICB0eXBlOiBUaW1lck1vZGVcbiAgZHVyYXRpb246IG51bWJlclxuICBjb21wbGV0ZWRBdDogbnVtYmVyXG4gIGRhdGU6IHN0cmluZ1xufVxuXG4vKiogUDEtMu+8mumhueebrue6p+aXtumVv+imhueblu+8iOWcqCByZW5kZXJlciDkvqfoh6rlt7HlrprkuYnvvIzot6jov5vnqIvovrnnlYzlubLlh4DvvIlcbiAqICAtIG51bWJlcu+8muS9v+eUqOatpOWAvFxuICogIC0gbnVsbO+8muaYvuW8j+a4heepuu+8iOaBouWkjeWFqOWxgOm7mOiupO+8iVxuICogIC0gdW5kZWZpbmVk77ya5L+d55WZ546w5pyJ5YC877yI5LiN5L+u5pS577yJXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJvamVjdFRpbWVyT3ZlcnJpZGVzIHtcbiAgd29ya0R1cmF0aW9uPzogbnVtYmVyIHwgbnVsbFxuICBzaG9ydEJyZWFrRHVyYXRpb24/OiBudW1iZXIgfCBudWxsXG4gIGxvbmdCcmVha0R1cmF0aW9uPzogbnVtYmVyIHwgbnVsbFxuICBsb25nQnJlYWtJbnRlcnZhbD86IG51bWJlciB8IG51bGxcbn1cblxuLyoqIE0xNC9NMTXvvJrmr4/kuKrpobnnm67mnIDov5HmjIHkuYXljJbnmoQgdGltZXIgc3RhdGUg5b+r54WnICovXG5leHBvcnQgaW50ZXJmYWNlIFBlcnNpc3RlZFRpbWVyU3RhdGUge1xuICBtb2RlOiBUaW1lck1vZGVcbiAgc3RhdHVzOiAnaWRsZScgfCAncGF1c2VkJ1xuICB0aW1lTGVmdDogbnVtYmVyXG4gIGN1cnJlbnRUYXNrSWQ6IHN0cmluZyB8IG51bGxcbiAgY29uc2VjdXRpdmVDb3VudDogbnVtYmVyXG4gIHVwZGF0ZWRBdDogbnVtYmVyXG4gIC8qKiBGbG93dGltZe+8muacrOasoeS4k+azqOe0r+iuoeenkuaVsO+8iOWQkeWQjuWFvOWuue+8jOaXp+W/q+eFp+aXoOatpOWtl+aute+8iSAqL1xuICBlbGFwc2VkPzogbnVtYmVyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9tb2Rvcm9TZXR0aW5ncyB7XG4gIHdvcmtEdXJhdGlvbjogbnVtYmVyXG4gIHNob3J0QnJlYWtEdXJhdGlvbjogbnVtYmVyXG4gIGxvbmdCcmVha0R1cmF0aW9uOiBudW1iZXJcbiAgbG9uZ0JyZWFrSW50ZXJ2YWw6IG51bWJlclxuICBzb3VuZEVuYWJsZWQ6IGJvb2xlYW5cbiAgbm90aWZpY2F0aW9uRW5hYmxlZDogYm9vbGVhblxuICBhdXRvU3RhcnRCcmVhazogYm9vbGVhblxuICBhdXRvU3RhcnRXb3JrOiBib29sZWFuXG4gIC8qKiBNMTLvvJrpk4Plo7DpooTorr4gaWQgKi9cbiAgcmluZ3RvbmU/OiBzdHJpbmdcbiAgLyoqIOiuoeaXtumjjuagvO+8muWAkuiuoeaXtueVquiMhCAvIEZsb3d0aW1lIOato+iuoeaXtu+8iOS7heS9nOeUqOS6jiB3b3JrIOmYtuaute+8iSAqL1xuICB0aW1lclN0eWxlPzogJ3BvbW9kb3JvJyB8ICdmbG93dGltZSdcbiAgLyoqIOS4peagvOaooeW8j++8mndvcmsg6K6h5pe25Lit56aBIOaaguWBnC/ot7Pov4cv6YeN572uL+WIh+aooeW8jyAqL1xuICBzdHJpY3RNb2RlPzogYm9vbGVhblxuICAvKiog5Lil5qC85qih5byP5a2Q6aG577ya6K6h5pe25Lit56a75byA56qX5Y+jIOKGkiDkvZzlup/mnKznlarojIQgKi9cbiAgc3RyaWN0Qmx1ckZhaWxzPzogYm9vbGVhblxuICAvKiog5a6M5oiQ5LiO6aKE6K2m55qE6K+t6Z+z5pKt5oql77yIc3BlZWNoU3ludGhlc2lz77yJICovXG4gIHZvaWNlRW5hYmxlZD86IGJvb2xlYW5cbiAgLyoqIFAwLTPvvJrlo7Dmma/nmb3lmarpn7PvvIhub25lL3JhaW4vd2F2ZXMvZm9yZXN0L2NhZmUvZmlyZXBsYWNl77yJICovXG4gIHNvdW5kc2NhcGU/OiBzdHJpbmdcbiAgLyoqIFAwLTPvvJrlo7Dmma/pn7Pph48gMC4uMSAqL1xuICBzb3VuZHNjYXBlVm9sdW1lPzogbnVtYmVyXG4gIC8qKiBQMi0577ya5LyR5oGv6Zi25q616Ieq5Yqo5YWo5bGPICovXG4gIGZ1bGxzY3JlZW5CcmVhaz86IGJvb2xlYW5cbn1cblxuZXhwb3J0IHR5cGUgUG9tb2Rvcm9SaW5ndG9uZUlkID0gJ2JlbGwnIHwgJ2NoaW1lJyB8ICdkaW5nJyB8ICdzaWxlbnQnXG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9tb2Rvcm9TdGF0aXN0aWNzIHtcbiAgdG9kYXk6IHsgdG90YWw6IG51bWJlcjsgd29yazogbnVtYmVyOyBzaG9ydEJyZWFrOiBudW1iZXI7IGxvbmdCcmVhazogbnVtYmVyIH1cbiAgd2VlazogeyB0b3RhbDogbnVtYmVyOyB3b3JrOiBudW1iZXI7IHNob3J0QnJlYWs6IG51bWJlcjsgbG9uZ0JyZWFrOiBudW1iZXIgfVxuICBtb250aDogeyB0b3RhbDogbnVtYmVyOyB3b3JrOiBudW1iZXI7IHNob3J0QnJlYWs6IG51bWJlcjsgbG9uZ0JyZWFrOiBudW1iZXIgfVxufVxuXG5leHBvcnQgdHlwZSBTdGF0c1JhbmdlID0gJ3RvZGF5JyB8ICd3ZWVrJyB8ICdtb250aCcgfCAnY3VzdG9tJ1xuXG5leHBvcnQgaW50ZXJmYWNlIERhaWx5VHJlbmRQb2ludCB7XG4gIGRhdGU6IHN0cmluZ1xuICB3b3JrTWludXRlczogbnVtYmVyXG4gIHNob3J0QnJlYWtNaW51dGVzOiBudW1iZXJcbiAgbG9uZ0JyZWFrTWludXRlczogbnVtYmVyXG4gIGNvbXBsZXRlZFBvbW9kb3JvczogbnVtYmVyXG4gIGNvbXBsZXRlZFRhc2tzOiBudW1iZXJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQcm9qZWN0RGlzdHJpYnV0aW9uUG9pbnQge1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGxcbiAgcHJvamVjdE5hbWU6IHN0cmluZ1xuICBjb2xvcjogc3RyaW5nXG4gIHdvcmtNaW51dGVzOiBudW1iZXJcbiAgY29tcGxldGVkUG9tb2Rvcm9zOiBudW1iZXJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIZWF0bWFwQ2VsbCB7XG4gIGRheTogbnVtYmVyXG4gIGhvdXI6IG51bWJlclxuICBkYXRlOiBzdHJpbmdcbiAgd29ya01pbnV0ZXM6IG51bWJlclxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhc2tDb21wbGV0aW9uU3RhdHMge1xuICB0b3RhbDogbnVtYmVyXG4gIGNvbXBsZXRlZDogbnVtYmVyXG4gIGNvbXBsZXRpb25SYXRlOiBudW1iZXJcbiAgY29tcGxldGVkUG9tb2Rvcm9zOiBudW1iZXJcbiAgYXZnUG9tb2Rvcm9zUGVyVGFzazogbnVtYmVyXG4gIGF2Z0VzdGltYXRlRGV2aWF0aW9uTXM6IG51bWJlclxuICBlc3RpbWF0ZU92ZXJDb3VudDogbnVtYmVyXG4gIGVzdGltYXRlVW5kZXJDb3VudDogbnVtYmVyXG59XG5cbmV4cG9ydCB0eXBlIFBvbW9kb3JvTm90aWZpY2F0aW9uTW9kZSA9ICdub3JtYWwnIHwgJ3N0cm9uZycgfCAnc2lsZW50J1xuXG5leHBvcnQgdHlwZSBQb21vZG9yb1Nob3J0Y3V0QWN0aW9uID0gJ3RvZ2dsZScgfCAnc2tpcCcgfCAncmVzZXQnXG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9tb2Rvcm9TaG9ydGN1dHMge1xuICB0b2dnbGU6IHN0cmluZ1xuICBza2lwOiBzdHJpbmdcbiAgcmVzZXQ6IHN0cmluZ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvbW9kb3JvVHJheVNuYXBzaG90IHtcbiAgaXNSdW5uaW5nOiBib29sZWFuXG4gIGN1cnJlbnRNb2RlOiAnd29yaycgfCAnc2hvcnRCcmVhaycgfCAnbG9uZ0JyZWFrJyB8IG51bGxcbiAgdGFza1RpdGxlOiBzdHJpbmdcbiAgdGltZUxlZnRTZWNvbmRzOiBudW1iZXJcbiAgLyoqIOW9k+WJjeaooeW8j+aAu+aXtumVv++8iOenku+8ie+8jOS+myBNaW5pVGltZXIg6K6h566X6L+b5bqm546vICovXG4gIHRvdGFsU2Vjb25kcz86IG51bWJlclxuICB0b2RheUNvbXBsZXRlZDogbnVtYmVyXG4gIHByb2plY3RJZD86IHN0cmluZyB8IG51bGxcbiAgcHJvamVjdE5hbWU/OiBzdHJpbmdcbiAgLyoqIE0377ya5LiT5rOo5qih5byP5byA5YWzICovXG4gIGZvY3VzTW9kZT86IGJvb2xlYW5cbiAgYmFja2dyb3VuZFByb2plY3RzPzogQXJyYXk8e1xuICAgIGlkOiBzdHJpbmdcbiAgICBuYW1lOiBzdHJpbmdcbiAgICB0aW1lTGVmdFNlY29uZHM6IG51bWJlclxuICAgIG1vZGU6ICd3b3JrJyB8ICdzaG9ydEJyZWFrJyB8ICdsb25nQnJlYWsnXG4gIH0+XG4gIHVwZGF0ZWRBdDogbnVtYmVyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9tb2Rvcm9UYXNrRGV0YWlsIHtcbiAgdGFzazogUG9tb2Rvcm9UYXNrXG4gIHByb2plY3Q6IFBvbW9kb3JvUHJvamVjdCB8IG51bGxcbiAgcmVjb3JkczogUG9tb2Rvcm9SZWNvcmRbXVxuICBzdW1tYXJ5OiBQb21vZG9yb1Rhc2tTdW1tYXJ5IHwgbnVsbFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvbW9kb3JvVGFza1N1bW1hcnkge1xuICB0YXNrSWQ6IHN0cmluZ1xuICBwb21vZG9yb0NvdW50OiBudW1iZXJcbiAgd29ya01zOiBudW1iZXJcbiAgZmlyc3RTdGFydGVkQXQ6IG51bWJlciB8IG51bGxcbiAgbGFzdENvbXBsZXRlZEF0OiBudW1iZXIgfCBudWxsXG4gIGVzdGltYXRlTXM6IG51bWJlciB8IG51bGxcbiAgZXN0aW1hdGVEZXZpYXRpb25NczogbnVtYmVyIHwgbnVsbFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvbW9kb3JvUmVjb3JkRGV0YWlsIHtcbiAgcmVjb3JkOiBQb21vZG9yb1JlY29yZFxuICB0YXNrOiBQb21vZG9yb1Rhc2sgfCBudWxsXG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCBTdG9yZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuZXhwb3J0IGNvbnN0IHVzZVBvbW9kb3JvU3RvcmUgPSBkZWZpbmVTdG9yZSgncG9tb2Rvcm8nLCAoKSA9PiB7XG4gIC8vIOKUgOKUgOKUgCBzdGF0ZSDilIDilIDilIBcbiAgY29uc3QgdGFza3MgPSByZWY8UG9tb2Rvcm9UYXNrW10+KFtdKVxuICBjb25zdCBwcm9qZWN0cyA9IHJlZjxQb21vZG9yb1Byb2plY3RbXT4oW10pXG4gIGNvbnN0IHJlY29yZHMgPSByZWY8UG9tb2Rvcm9SZWNvcmRbXT4oW10pXG4gIGNvbnN0IHRvZGF5UmVjb3JkcyA9IHJlZjxQb21vZG9yb1JlY29yZFtdPihbXSlcbiAgY29uc3QgZnJlZVJlY29yZHMgPSByZWY8UG9tb2Rvcm9SZWNvcmRbXT4oW10pXG4gIGNvbnN0IHN0YXRpc3RpY3MgPSByZWY8UG9tb2Rvcm9TdGF0aXN0aWNzIHwgbnVsbD4obnVsbClcbiAgY29uc3Qgc2V0dGluZ3MgPSByZWY8UG9tb2Rvcm9TZXR0aW5ncyB8IG51bGw+KG51bGwpXG5cbiAgLy8g4pSA4pSA4pSAIFAxLTLvvJrlpJrpobnnm67lubbooYwg4pSA4pSA4pSAXG4gIGNvbnN0IGZvY3VzZWRQcm9qZWN0SWQgPSByZWY8c3RyaW5nIHwgbnVsbD4obnVsbClcbiAgY29uc3QgcHJvamVjdFNldHRpbmdzID0gcmVmPFJlY29yZDxzdHJpbmcsIFByb2plY3RUaW1lck92ZXJyaWRlcz4+KHt9KVxuXG4gIC8vIE0xNC9NMTXvvJrmr4/pobnnm64gdGltZXIgc3RhdGUg5oyB5LmF5YyW77yI5ZCv5Yqo5oGi5aSN77yJXG4gIGNvbnN0IHRpbWVyU3RhdGVzID0gcmVmPFJlY29yZDxzdHJpbmcsIFBlcnNpc3RlZFRpbWVyU3RhdGU+Pih7fSlcblxuICAvLyDilIDilIDilIAg5omp5bGV57uf6K6h77yIUDAtM++8ieKUgOKUgOKUgFxuICBjb25zdCBzdGF0c1JhbmdlID0gcmVmPFN0YXRzUmFuZ2U+KCd3ZWVrJylcbiAgY29uc3QgZGFpbHlUcmVuZCA9IHJlZjxEYWlseVRyZW5kUG9pbnRbXT4oW10pXG4gIGNvbnN0IHByb2plY3REaXN0cmlidXRpb24gPSByZWY8UHJvamVjdERpc3RyaWJ1dGlvblBvaW50W10+KFtdKVxuICBjb25zdCBmb2N1c0hlYXRtYXAgPSByZWY8SGVhdG1hcENlbGxbXT4oW10pXG4gIGNvbnN0IHRhc2tTdGF0cyA9IHJlZjxUYXNrQ29tcGxldGlvblN0YXRzIHwgbnVsbD4obnVsbClcbiAgY29uc3Qgc3RhdHNMb2FkaW5nID0gcmVmKGZhbHNlKVxuXG4gIC8vIE0477ya6L+e57ut5LiT5rOo5aSp5pWw77yIc3RyZWFr77yJXG4gIGNvbnN0IHN0cmVhayA9IHJlZjx7XG4gICAgY3VycmVudDogbnVtYmVyXG4gICAgbG9uZ2VzdDogbnVtYmVyXG4gICAgYWN0aXZlVG9kYXk6IGJvb2xlYW5cbiAgfT4oeyBjdXJyZW50OiAwLCBsb25nZXN0OiAwLCBhY3RpdmVUb2RheTogZmFsc2UgfSlcblxuICBjb25zdCBsb2FkaW5nID0gcmVmKGZhbHNlKVxuICAvLyDilIDilIDilIAg6ZuG5oiQ77yIUDAtNO+8ieKUgOKUgOKUgFxuICBjb25zdCBpbnRlZ3JhdGlvbk1vZGUgPSByZWY8UG9tb2Rvcm9Ob3RpZmljYXRpb25Nb2RlPignbm9ybWFsJylcbiAgY29uc3QgaW50ZWdyYXRpb25TaG9ydGN1dHMgPSByZWY8UG9tb2Rvcm9TaG9ydGN1dHM+KHtcbiAgICB0b2dnbGU6ICdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1AnLFxuICAgIHNraXA6ICdDb21tYW5kT3JDb250cm9sK1NoaWZ0K1MnLFxuICAgIHJlc2V0OiAnQ29tbWFuZE9yQ29udHJvbCtTaGlmdCtSJ1xuICB9KVxuICAvLyBNN++8muS4k+azqOaooeW8j+W8gOWFs1xuICBjb25zdCBmb2N1c01vZGUgPSByZWY8Ym9vbGVhbj4oZmFsc2UpXG4gIGNvbnN0IHRyYXlTbmFwc2hvdCA9IHJlZjxQb21vZG9yb1RyYXlTbmFwc2hvdD4oe1xuICAgIGlzUnVubmluZzogZmFsc2UsXG4gICAgY3VycmVudE1vZGU6IG51bGwsXG4gICAgdGFza1RpdGxlOiAnJyxcbiAgICB0aW1lTGVmdFNlY29uZHM6IDAsXG4gICAgdG9kYXlDb21wbGV0ZWQ6IDAsXG4gICAgdXBkYXRlZEF0OiAwXG4gIH0pXG4gIC8vIOKUgOKUgOKUgCDor6bmg4XpobXvvIhQMS0x77yJ4pSA4pSA4pSAXG4gIGNvbnN0IHRhc2tEZXRhaWxJZCA9IHJlZjxzdHJpbmcgfCBudWxsPihudWxsKVxuICBjb25zdCB0YXNrRGV0YWlsID0gcmVmPFBvbW9kb3JvVGFza0RldGFpbCB8IG51bGw+KG51bGwpXG4gIGNvbnN0IHRhc2tEZXRhaWxMb2FkaW5nID0gcmVmKGZhbHNlKVxuICBjb25zdCBzZWxlY3RlZFJlY29yZElkID0gcmVmPHN0cmluZyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IHJlY29yZERldGFpbCA9IHJlZjxQb21vZG9yb1JlY29yZERldGFpbCB8IG51bGw+KG51bGwpXG4gIGNvbnN0IGludGVncmF0aW9uRmFpbGVkU2hvcnRjdXRzID0gcmVmPFBvbW9kb3JvU2hvcnRjdXRBY3Rpb25bXT4oW10pXG4gIGNvbnN0IGxhc3RFcnJvciA9IHJlZjxzdHJpbmcgfCBudWxsPihudWxsKVxuXG4gIC8vIOKUgOKUgOKUgCBnZXR0ZXJzIOKUgOKUgOKUgFxuICBjb25zdCB0b2RheUZvY3VzTWludXRlcyA9IGNvbXB1dGVkKCgpID0+IHtcbiAgICBpZiAoIXN0YXRpc3RpY3MudmFsdWUgfHwgIXNldHRpbmdzLnZhbHVlKSByZXR1cm4gMFxuICAgIHJldHVybiBzdGF0aXN0aWNzLnZhbHVlLnRvZGF5LndvcmsgKiBzZXR0aW5ncy52YWx1ZS53b3JrRHVyYXRpb25cbiAgfSlcblxuICBjb25zdCBjb21wbGV0ZWRUYXNrcyA9IGNvbXB1dGVkKCgpID0+IHRhc2tzLnZhbHVlLmZpbHRlcigodCkgPT4gdC5jb21wbGV0ZWQpKVxuICBjb25zdCBwZW5kaW5nVGFza3MgPSBjb21wdXRlZCgoKSA9PiB0YXNrcy52YWx1ZS5maWx0ZXIoKHQpID0+ICF0LmNvbXBsZXRlZCkpXG5cbiAgLy8g4pSA4pSA4pSAIGFjdGlvbnMg4pSA4pSA4pSAXG5cbiAgLyoqIOWIneWni+WKoOi9ve+8muaLieWPluS7u+WKoS/orr7nva4v57uf6K6hL+S7iuaXpeiusOW9lSAvIOmhueebruaXtumVv+imhuebliAvIHRpbWVyIHN0YXRlICovXG4gIGFzeW5jIGZ1bmN0aW9uIGxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbG9hZGluZy52YWx1ZSA9IHRydWVcbiAgICBsYXN0RXJyb3IudmFsdWUgPSBudWxsXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IFt0LCBwLCBzLCBzdCwgdHIsIGFsbFNldHRpbmdzLCBhbGxUaW1lclN0YXRlc10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIHdpbmRvdy5hcGkucG9tb2Rvcm8uZ2V0VGFza3MoKSxcbiAgICAgICAgd2luZG93LmFwaS5wb21vZG9yby5wcm9qZWN0cy5nZXRBbGwoKSxcbiAgICAgICAgd2luZG93LmFwaS5wb21vZG9yby5nZXRTZXR0aW5ncygpLFxuICAgICAgICB3aW5kb3cuYXBpLnBvbW9kb3JvLmdldFN0YXRpc3RpY3MoKSxcbiAgICAgICAgd2luZG93LmFwaS5wb21vZG9yby5nZXRUb2RheVJlY29yZHMoKSxcbiAgICAgICAgd2luZG93LmFwaS5wb21vZG9yby5wcm9qZWN0cy5zZXR0aW5ncy5hbGwoKSxcbiAgICAgICAgd2luZG93LmFwaS5wb21vZG9yby50aW1lclN0YXRlLmdldEFsbCgpXG4gICAgICBdKVxuICAgICAgdGFza3MudmFsdWUgPSB0IGFzIFBvbW9kb3JvVGFza1tdXG4gICAgICBwcm9qZWN0cy52YWx1ZSA9IHAgYXMgUG9tb2Rvcm9Qcm9qZWN0W11cbiAgICAgIHNldHRpbmdzLnZhbHVlID0gcyBhcyBQb21vZG9yb1NldHRpbmdzXG4gICAgICBzdGF0aXN0aWNzLnZhbHVlID0gc3QgYXMgUG9tb2Rvcm9TdGF0aXN0aWNzXG4gICAgICB0b2RheVJlY29yZHMudmFsdWUgPSAodHIgYXMgUG9tb2Rvcm9SZWNvcmRbXSkgfHwgW11cbiAgICAgIHByb2plY3RTZXR0aW5ncy52YWx1ZSA9IChhbGxTZXR0aW5ncyBhcyBSZWNvcmQ8c3RyaW5nLCBQcm9qZWN0VGltZXJPdmVycmlkZXM+KSB8fCB7fVxuICAgICAgdGltZXJTdGF0ZXMudmFsdWUgPSAoYWxsVGltZXJTdGF0ZXMgYXMgUmVjb3JkPHN0cmluZywgUGVyc2lzdGVkVGltZXJTdGF0ZT4pIHx8IHt9XG4gICAgICAvLyBNNO+8muiHqueUseeVquiMhOiusOW9lVxuICAgICAgdm9pZCBsb2FkRnJlZVJlY29yZHMoKS5jYXRjaCgoKSA9PiB7fSlcbiAgICAgIC8vIOeEpueCuemhueebru+8muS7heW9k+eUqOaIt+S5i+WJjeaYvuW8j+mAieaLqei/h+S4lOS7jeacieaViOaXtuaJjeaBouWkjVxuICAgICAgaWYgKGZvY3VzZWRQcm9qZWN0SWQudmFsdWUgJiYgIXByb2plY3RzLnZhbHVlLnNvbWUoKHApID0+IHAuaWQgPT09IGZvY3VzZWRQcm9qZWN0SWQudmFsdWUpKSB7XG4gICAgICAgIGZvY3VzZWRQcm9qZWN0SWQudmFsdWUgPSBudWxsXG4gICAgICB9XG4gICAgICAvLyDmjqjpgIHpobnnm67liJfooajliLDkuLvov5vnqIvvvIh0cmF5IC8gZG9jayDoj5zljZXvvIlcbiAgICAgIHZvaWQgcHVzaFByb2plY3RzVG9NYWluKClcbiAgICAgIC8vIE0377ya5Yqg6L295LiT5rOo5qih5byPXG4gICAgICB2b2lkIGxvYWRGb2N1c01vZGUoKVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbGFzdEVycm9yLnZhbHVlID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpXG4gICAgICBjb25zb2xlLmVycm9yKCdbcG9tb2Rvcm8gc3RvcmVdIGxvYWQgZmFpbGVkOicsIGVycilcbiAgICB9IGZpbmFsbHkge1xuICAgICAgbG9hZGluZy52YWx1ZSA9IGZhbHNlXG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gYWRkVGFzayhcbiAgICB0aXRsZTogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiB7XG4gICAgICBkZXNjcmlwdGlvbj86IHN0cmluZ1xuICAgICAgcHJpb3JpdHk/OiBudW1iZXJcbiAgICAgIGVzdGltYXRlTXM/OiBudW1iZXIgfCBudWxsXG4gICAgICBwcm9qZWN0SWQ/OiBzdHJpbmcgfCBudWxsXG4gICAgfVxuICApOiBQcm9taXNlPFBvbW9kb3JvVGFzayB8IG51bGw+IHtcbiAgICBjb25zdCB0YXNrID0gKGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8uYWRkVGFzayh0aXRsZSwgb3B0aW9ucykpIGFzIFBvbW9kb3JvVGFza1xuICAgIHRhc2tzLnZhbHVlLnVuc2hpZnQodGFzaylcbiAgICByZXR1cm4gdGFza1xuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gdXBkYXRlVGFzayhpZDogc3RyaW5nLCB1cGRhdGVzOiBQYXJ0aWFsPFBvbW9kb3JvVGFzaz4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB1cGRhdGVkID0gKGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8udXBkYXRlVGFzayhpZCwgdXBkYXRlcykpIGFzIFBvbW9kb3JvVGFzayB8IG51bGxcbiAgICBpZiAodXBkYXRlZCkge1xuICAgICAgY29uc3QgaWR4ID0gdGFza3MudmFsdWUuZmluZEluZGV4KCh0KSA9PiB0LmlkID09PSBpZClcbiAgICAgIGlmIChpZHggPj0gMCkgdGFza3MudmFsdWVbaWR4XSA9IHVwZGF0ZWRcbiAgICB9XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBkZWxldGVUYXNrKGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB3aW5kb3cuYXBpLnBvbW9kb3JvLmRlbGV0ZVRhc2soaWQpXG4gICAgdGFza3MudmFsdWUgPSB0YXNrcy52YWx1ZS5maWx0ZXIoKHQpID0+IHQuaWQgIT09IGlkKVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gY29tcGxldGVUYXNrKGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB1cGRhdGVkID0gKGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8uY29tcGxldGVUYXNrKGlkKSkgYXMgUG9tb2Rvcm9UYXNrIHwgbnVsbFxuICAgIGlmICh1cGRhdGVkKSB7XG4gICAgICBjb25zdCBpZHggPSB0YXNrcy52YWx1ZS5maW5kSW5kZXgoKHQpID0+IHQuaWQgPT09IGlkKVxuICAgICAgaWYgKGlkeCA+PSAwKSB0YXNrcy52YWx1ZVtpZHhdID0gdXBkYXRlZFxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGFkZFByb2plY3QobmFtZTogc3RyaW5nLCBjb2xvcj86IHN0cmluZyk6IFByb21pc2U8UG9tb2Rvcm9Qcm9qZWN0PiB7XG4gICAgY29uc3QgcHJvamVjdCA9IChhd2FpdCB3aW5kb3cuYXBpLnBvbW9kb3JvLnByb2plY3RzLmFkZChuYW1lLCBjb2xvcikpIGFzIFBvbW9kb3JvUHJvamVjdFxuICAgIHByb2plY3RzLnZhbHVlLnB1c2gocHJvamVjdClcbiAgICByZXR1cm4gcHJvamVjdFxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gdXBkYXRlUHJvamVjdChcbiAgICBpZDogc3RyaW5nLFxuICAgIHVwZGF0ZXM6IHsgbmFtZT86IHN0cmluZzsgY29sb3I/OiBzdHJpbmc7IHNvcnRPcmRlcj86IG51bWJlciB9XG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHVwZGF0ZWQgPSAoYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby5wcm9qZWN0cy51cGRhdGUoXG4gICAgICBpZCxcbiAgICAgIHVwZGF0ZXNcbiAgICApKSBhcyBQb21vZG9yb1Byb2plY3QgfCBudWxsXG4gICAgaWYgKHVwZGF0ZWQpIHtcbiAgICAgIGNvbnN0IGlkeCA9IHByb2plY3RzLnZhbHVlLmZpbmRJbmRleCgocCkgPT4gcC5pZCA9PT0gaWQpXG4gICAgICBpZiAoaWR4ID49IDApIHByb2plY3RzLnZhbHVlW2lkeF0gPSB1cGRhdGVkXG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gZGVsZXRlUHJvamVjdChpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby5wcm9qZWN0cy5kZWxldGUoaWQpXG4gICAgcHJvamVjdHMudmFsdWUgPSBwcm9qZWN0cy52YWx1ZS5maWx0ZXIoKHApID0+IHAuaWQgIT09IGlkKVxuICAgIC8vIOeEpueCuemhueebruiiq+WIoOWImeWIh+WIsOesrOS4gOS4quWJqeS9memhueebrlxuICAgIGlmIChmb2N1c2VkUHJvamVjdElkLnZhbHVlID09PSBpZCkge1xuICAgICAgZm9jdXNlZFByb2plY3RJZC52YWx1ZSA9IHByb2plY3RzLnZhbHVlWzBdPy5pZCA/PyBudWxsXG4gICAgfVxuICAgIC8vIOa4heeQhuacrOWcsOmhueebruimhueblue8k+WtmFxuICAgIGRlbGV0ZSBwcm9qZWN0U2V0dGluZ3MudmFsdWVbaWRdXG4gIH1cblxuICAvLyDilIDilIDilIAgUDEtMu+8mumhueebrue6p+aXtumVv+imhuebliAvIOeEpueCuemhueebriDilIDilIDilIBcblxuICBmdW5jdGlvbiBzZXRGb2N1c2VkUHJvamVjdChpZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgIGZvY3VzZWRQcm9qZWN0SWQudmFsdWUgPSBpZFxuICB9XG5cbiAgLy8g4pSA4pSA4pSAIE0xNC9NMTXvvJrmr4/pobnnm64gdGltZXIgc3RhdGUg5oyB5LmF5YyWIOKUgOKUgOKUgFxuXG4gIGZ1bmN0aW9uIGdldFRpbWVyU3RhdGUocHJvamVjdElkOiBzdHJpbmcpOiBQZXJzaXN0ZWRUaW1lclN0YXRlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRpbWVyU3RhdGVzLnZhbHVlW3Byb2plY3RJZF0gPz8gbnVsbFxuICB9XG5cbiAgLyoqIOeUsSBjb21wb3NhYmxlIOiwg+eUqO+8jOaKiuavj+asoSBzdGF0ZSDlj5jmm7TlhpnliLAgcHJlZl9wcmVmZXJlbmNlcyAqL1xuICBhc3luYyBmdW5jdGlvbiBwZXJzaXN0VGltZXJTdGF0ZShcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBzbmFwc2hvdDogUGVyc2lzdGVkVGltZXJTdGF0ZVxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgLy8g5YWI5oqKIHJ1bm5pbmcg5Lmf6ZmN5Li6IHBhdXNlZCDlho3lrZjvvIjpgb/lhY3ml7bpl7TmvILnp7vvvIlcbiAgICAgIGNvbnN0IHRvU3RvcmU6IFBlcnNpc3RlZFRpbWVyU3RhdGUgPSB7XG4gICAgICAgIC4uLnNuYXBzaG90LFxuICAgICAgICBzdGF0dXM6IHNuYXBzaG90LnN0YXR1cyA9PT0gJ3BhdXNlZCcgPyAncGF1c2VkJyA6ICdpZGxlJyxcbiAgICAgICAgdXBkYXRlZEF0OiBEYXRlLm5vdygpXG4gICAgICB9XG4gICAgICB0aW1lclN0YXRlcy52YWx1ZSA9IHsgLi4udGltZXJTdGF0ZXMudmFsdWUsIFtwcm9qZWN0SWRdOiB0b1N0b3JlIH1cbiAgICAgIGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8udGltZXJTdGF0ZS5zYXZlKHByb2plY3RJZCwgdG9TdG9yZSlcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1twb21vZG9ybyBzdG9yZV0gcGVyc2lzdFRpbWVyU3RhdGUgZmFpbGVkOicsIGVycilcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwcm9qZWN0U2V0dGluZ3NCeUlkKGlkOiBzdHJpbmcgfCBudWxsKTogUHJvamVjdFRpbWVyT3ZlcnJpZGVzIHwgbnVsbCB7XG4gICAgaWYgKCFpZCkgcmV0dXJuIG51bGxcbiAgICByZXR1cm4gcHJvamVjdFNldHRpbmdzLnZhbHVlW2lkXSA/PyBudWxsXG4gIH1cblxuICAvKipcbiAgICog6K6h566X5LiA5Liq6aG555uu55qE44CM5pyJ5pWI5pe26ZW/44CN77ya5YWo5bGAICsg6aG555uu6KaG55uWIOWQiOW5tuOAglxuICAgKiDov5Tlm57lgLzljZXkvY3vvJrliIbpkp/jgIJcbiAgICogLSBudW1iZXIg4oaSIOS9v+eUqFxuICAgKiAtIG51bGwgLyB1bmRlZmluZWQg4oaSIOWbnumAgOWIsCBiYXNl77yIbnVsbCDop4bkuLrlt7LmmL7lvI/muIXnqbrvvIlcbiAgICovXG4gIGZ1bmN0aW9uIGVmZmVjdGl2ZVNldHRpbmdzKFxuICAgIGlkOiBzdHJpbmcgfCBudWxsLFxuICAgIGZhbGxiYWNrPzoge1xuICAgICAgd29ya0R1cmF0aW9uOiBudW1iZXJcbiAgICAgIHNob3J0QnJlYWtEdXJhdGlvbjogbnVtYmVyXG4gICAgICBsb25nQnJlYWtEdXJhdGlvbjogbnVtYmVyXG4gICAgICBsb25nQnJlYWtJbnRlcnZhbD86IG51bWJlclxuICAgIH1cbiAgKToge1xuICAgIHdvcmtEdXJhdGlvbjogbnVtYmVyXG4gICAgc2hvcnRCcmVha0R1cmF0aW9uOiBudW1iZXJcbiAgICBsb25nQnJlYWtEdXJhdGlvbjogbnVtYmVyXG4gICAgbG9uZ0JyZWFrSW50ZXJ2YWw6IG51bWJlclxuICB9IHtcbiAgICBjb25zdCBiYXNlID1cbiAgICAgIGZhbGxiYWNrID8/XG4gICAgICAoc2V0dGluZ3MudmFsdWVcbiAgICAgICAgPyB7XG4gICAgICAgICAgICB3b3JrRHVyYXRpb246IHNldHRpbmdzLnZhbHVlLndvcmtEdXJhdGlvbixcbiAgICAgICAgICAgIHNob3J0QnJlYWtEdXJhdGlvbjogc2V0dGluZ3MudmFsdWUuc2hvcnRCcmVha0R1cmF0aW9uLFxuICAgICAgICAgICAgbG9uZ0JyZWFrRHVyYXRpb246IHNldHRpbmdzLnZhbHVlLmxvbmdCcmVha0R1cmF0aW9uLFxuICAgICAgICAgICAgbG9uZ0JyZWFrSW50ZXJ2YWw6IHNldHRpbmdzLnZhbHVlLmxvbmdCcmVha0ludGVydmFsXG4gICAgICAgICAgfVxuICAgICAgICA6IHsgd29ya0R1cmF0aW9uOiAyNSwgc2hvcnRCcmVha0R1cmF0aW9uOiA1LCBsb25nQnJlYWtEdXJhdGlvbjogMTUsIGxvbmdCcmVha0ludGVydmFsOiA0IH0pXG4gICAgaWYgKCFpZCkgcmV0dXJuIHsgLi4uYmFzZSwgbG9uZ0JyZWFrSW50ZXJ2YWw6IGJhc2UubG9uZ0JyZWFrSW50ZXJ2YWwgPz8gNCB9XG4gICAgY29uc3Qgb3YgPSBwcm9qZWN0U2V0dGluZ3MudmFsdWVbaWRdXG4gICAgaWYgKCFvdikgcmV0dXJuIHsgLi4uYmFzZSwgbG9uZ0JyZWFrSW50ZXJ2YWw6IGJhc2UubG9uZ0JyZWFrSW50ZXJ2YWwgPz8gNCB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHdvcmtEdXJhdGlvbjogb3Yud29ya0R1cmF0aW9uID8/IGJhc2Uud29ya0R1cmF0aW9uLFxuICAgICAgc2hvcnRCcmVha0R1cmF0aW9uOiBvdi5zaG9ydEJyZWFrRHVyYXRpb24gPz8gYmFzZS5zaG9ydEJyZWFrRHVyYXRpb24sXG4gICAgICBsb25nQnJlYWtEdXJhdGlvbjogb3YubG9uZ0JyZWFrRHVyYXRpb24gPz8gYmFzZS5sb25nQnJlYWtEdXJhdGlvbixcbiAgICAgIGxvbmdCcmVha0ludGVydmFsOiBvdi5sb25nQnJlYWtJbnRlcnZhbCA/PyBiYXNlLmxvbmdCcmVha0ludGVydmFsID8/IDRcbiAgICB9XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBzYXZlUHJvamVjdE92ZXJyaWRlKFxuICAgIHByb2plY3RJZDogc3RyaW5nLFxuICAgIG92ZXJyaWRlczogUHJvamVjdFRpbWVyT3ZlcnJpZGVzXG4gICk6IFByb21pc2U8UHJvamVjdFRpbWVyT3ZlcnJpZGVzPiB7XG4gICAgY29uc3QgbmV4dCA9IChhd2FpdCB3aW5kb3cuYXBpLnBvbW9kb3JvLnByb2plY3RzLnNldHRpbmdzLnNhdmUoXG4gICAgICBwcm9qZWN0SWQsXG4gICAgICBvdmVycmlkZXNcbiAgICApKSBhcyBQcm9qZWN0VGltZXJPdmVycmlkZXNcbiAgICBwcm9qZWN0U2V0dGluZ3MudmFsdWUgPSB7IC4uLnByb2plY3RTZXR0aW5ncy52YWx1ZSwgW3Byb2plY3RJZF06IG5leHQgfVxuICAgIHJldHVybiBuZXh0XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBjbGVhclByb2plY3RPdmVycmlkZShwcm9qZWN0SWQ6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IG9rID0gKGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8ucHJvamVjdHMuc2V0dGluZ3MuZGVsZXRlKHByb2plY3RJZCkpIGFzIGJvb2xlYW5cbiAgICBpZiAocHJvamVjdFNldHRpbmdzLnZhbHVlW3Byb2plY3RJZF0pIHtcbiAgICAgIGNvbnN0IG5leHQgPSB7IC4uLnByb2plY3RTZXR0aW5ncy52YWx1ZSB9XG4gICAgICBkZWxldGUgbmV4dFtwcm9qZWN0SWRdXG4gICAgICBwcm9qZWN0U2V0dGluZ3MudmFsdWUgPSBuZXh0XG4gICAgfVxuICAgIHJldHVybiBva1xuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gcmVmcmVzaFByb2plY3RTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBhbGwgPSAoYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby5wcm9qZWN0cy5zZXR0aW5ncy5hbGwoKSkgYXMgUmVjb3JkPFxuICAgICAgc3RyaW5nLFxuICAgICAgUHJvamVjdFRpbWVyT3ZlcnJpZGVzXG4gICAgPlxuICAgIHByb2plY3RTZXR0aW5ncy52YWx1ZSA9IGFsbCB8fCB7fVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gYWRkUmVjb3JkKFxuICAgIHJlY29yZDogT21pdDxQb21vZG9yb1JlY29yZCwgJ2lkJyB8ICdkYXRlJz4gJiB7IHByb2plY3RJZD86IHN0cmluZyB8IG51bGwgfVxuICApOiBQcm9taXNlPFBvbW9kb3JvUmVjb3JkIHwgbnVsbD4ge1xuICAgIGNvbnN0IHIgPSAoYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby5hZGRSZWNvcmQocmVjb3JkKSkgYXMgUG9tb2Rvcm9SZWNvcmRcbiAgICAvLyDliLfmlrDku4rml6XorrDlvZUgKyDnu5/orqHvvIjnroDljJbnrZbnlaXvvJrlrozmiJDlkI7mlbTkvZPliLfmlrDkuIDmrKHvvIlcbiAgICBhd2FpdCByZWZyZXNoU3RhdHMoKVxuICAgIC8vIE0477ya5Yi35pawIHN0cmVha++8iOS+nei1liBkYWlseVRyZW5k77yM5pW05L2T5ouJ5LiA6YGNIHN0YXRz77yJXG4gICAgdm9pZCBsb2FkU3RhdHMoc3RhdHNSYW5nZS52YWx1ZSkuY2F0Y2goKCkgPT4ge30pXG4gICAgdm9pZCBsb2FkRnJlZVJlY29yZHMoKS5jYXRjaCgoKSA9PiB7fSlcbiAgICByZXR1cm4gclxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gcmVmcmVzaFN0YXRzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IFtzdCwgdHJdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgd2luZG93LmFwaS5wb21vZG9yby5nZXRTdGF0aXN0aWNzKCksXG4gICAgICB3aW5kb3cuYXBpLnBvbW9kb3JvLmdldFRvZGF5UmVjb3JkcygpXG4gICAgXSlcbiAgICBzdGF0aXN0aWNzLnZhbHVlID0gc3QgYXMgUG9tb2Rvcm9TdGF0aXN0aWNzXG4gICAgdG9kYXlSZWNvcmRzLnZhbHVlID0gKHRyIGFzIFBvbW9kb3JvUmVjb3JkW10pIHx8IFtdXG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBzYXZlU2V0dGluZ3MocGFydGlhbDogUGFydGlhbDxQb21vZG9yb1NldHRpbmdzPik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG5leHQgPSAoYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby5zYXZlU2V0dGluZ3MocGFydGlhbCkpIGFzIFBvbW9kb3JvU2V0dGluZ3MgfCB1bmRlZmluZWRcbiAgICAvLyDml6fniYjkuLvov5vnqIsgc2F2ZVNldHRpbmdzIOi/lOWbniB2b2lk77ya5Zue6YCA5Yiw5pys5Zyw5ZCI5bm277yM6YG/5YWNIHNldHRpbmdzIOiiq+e9ruepulxuICAgIHNldHRpbmdzLnZhbHVlID0gbmV4dCA/PyAoeyAuLi4oc2V0dGluZ3MudmFsdWUgPz8ge30pLCAuLi5wYXJ0aWFsIH0gYXMgUG9tb2Rvcm9TZXR0aW5ncylcbiAgfVxuXG4gIGZ1bmN0aW9uIHJhbmdlQm91bmRzKFxuICAgIHJhbmdlOiBTdGF0c1JhbmdlLFxuICAgIGN1c3RvbT86IHsgZnJvbTogbnVtYmVyOyB0bzogbnVtYmVyIH1cbiAgKToge1xuICAgIGZyb206IG51bWJlclxuICAgIHRvOiBudW1iZXJcbiAgICBkYXlzOiBudW1iZXJcbiAgfSB7XG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKVxuICAgIGlmIChyYW5nZSA9PT0gJ3RvZGF5Jykge1xuICAgICAgY29uc3Qgc3RhcnQgPSBuZXcgRGF0ZShub3cpXG4gICAgICBzdGFydC5zZXRIb3VycygwLCAwLCAwLCAwKVxuICAgICAgcmV0dXJuIHsgZnJvbTogc3RhcnQuZ2V0VGltZSgpLCB0bzogbm93LmdldFRpbWUoKSwgZGF5czogMSB9XG4gICAgfVxuICAgIGlmIChyYW5nZSA9PT0gJ3dlZWsnKSB7XG4gICAgICBjb25zdCBzdGFydCA9IG5ldyBEYXRlKG5vdylcbiAgICAgIHN0YXJ0LnNldERhdGUobm93LmdldERhdGUoKSAtIDYpXG4gICAgICBzdGFydC5zZXRIb3VycygwLCAwLCAwLCAwKVxuICAgICAgcmV0dXJuIHsgZnJvbTogc3RhcnQuZ2V0VGltZSgpLCB0bzogbm93LmdldFRpbWUoKSwgZGF5czogNyB9XG4gICAgfVxuICAgIGlmIChyYW5nZSA9PT0gJ21vbnRoJykge1xuICAgICAgY29uc3Qgc3RhcnQgPSBuZXcgRGF0ZShub3cpXG4gICAgICBzdGFydC5zZXREYXRlKG5vdy5nZXREYXRlKCkgLSAyOSlcbiAgICAgIHN0YXJ0LnNldEhvdXJzKDAsIDAsIDAsIDApXG4gICAgICByZXR1cm4geyBmcm9tOiBzdGFydC5nZXRUaW1lKCksIHRvOiBub3cuZ2V0VGltZSgpLCBkYXlzOiAzMCB9XG4gICAgfVxuICAgIGlmIChyYW5nZSA9PT0gJ2N1c3RvbScgJiYgY3VzdG9tKSB7XG4gICAgICByZXR1cm4geyBmcm9tOiBjdXN0b20uZnJvbSwgdG86IGN1c3RvbS50bywgZGF5czogMSB9XG4gICAgfVxuICAgIGNvbnN0IHN0YXJ0ID0gbmV3IERhdGUobm93KVxuICAgIHN0YXJ0LnNldERhdGUobm93LmdldERhdGUoKSAtIDYpXG4gICAgc3RhcnQuc2V0SG91cnMoMCwgMCwgMCwgMClcbiAgICByZXR1cm4geyBmcm9tOiBzdGFydC5nZXRUaW1lKCksIHRvOiBub3cuZ2V0VGltZSgpLCBkYXlzOiA3IH1cbiAgfVxuXG4gIC8qKiBNOO+8muS7jiBkYWlseSB0cmVuZCDnrpflh7ogc3RyZWFr44CCICovXG4gIGZ1bmN0aW9uIGNvbXB1dGVTdHJlYWtGcm9tVHJlbmQodHJlbmQ6IERhaWx5VHJlbmRQb2ludFtdKToge1xuICAgIGN1cnJlbnQ6IG51bWJlclxuICAgIGxvbmdlc3Q6IG51bWJlclxuICAgIGFjdGl2ZVRvZGF5OiBib29sZWFuXG4gIH0ge1xuICAgIGlmICghQXJyYXkuaXNBcnJheSh0cmVuZCkgfHwgdHJlbmQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4geyBjdXJyZW50OiAwLCBsb25nZXN0OiAwLCBhY3RpdmVUb2RheTogZmFsc2UgfVxuICAgIH1cbiAgICAvLyBEYWlseVRyZW5kUG9pbnQuZGF0ZSDmmK/mnKzlnLDml7bljLrnmoQgeXl5eS1tbS1kZO+8iOS4u+i/m+eoiyBkYXRlT2Yg5ZCM57qm5a6a77yJXG4gICAgY29uc3QgZGF5S2V5ID0gKHM6IHN0cmluZyB8IG51bWJlcik6IHN0cmluZyA9PiB7XG4gICAgICBpZiAodHlwZW9mIHMgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHJldHVybiBsb2NhbERheUtleShuZXcgRGF0ZShzKSlcbiAgICAgIH1cbiAgICAgIHJldHVybiAocyB8fCAnJykuc2xpY2UoMCwgMTApXG4gICAgfVxuICAgIC8vIOacrOWcsOaXpeacn+mDqOWIhuagvOW8j+WMlu+8m+S4jeiDveeUqCB0b0lTT1N0cmluZygp77yIVVRDIOaXpeacn+WcqCBVVEMrIOaXtuWMuuS8muW3ruS4gOWkqe+8iVxuICAgIGNvbnN0IGxvY2FsRGF5S2V5ID0gKGQ6IERhdGUpOiBzdHJpbmcgPT5cbiAgICAgIGAke2QuZ2V0RnVsbFllYXIoKX0tJHsoZC5nZXRNb250aCgpICsgMSkudG9TdHJpbmcoKS5wYWRTdGFydCgyLCAnMCcpfS0ke2QuZ2V0RGF0ZSgpLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwgJzAnKX1gXG4gICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpXG4gICAgY29uc3QgdG9kYXlLZXkgPSBsb2NhbERheUtleSh0b2RheSlcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpXG4gICAgZm9yIChjb25zdCB0IG9mIHRyZW5kKSB7XG4gICAgICBtYXAuc2V0KGRheUtleSh0LmRhdGUpLCAobWFwLmdldChkYXlLZXkodC5kYXRlKSkgPz8gMCkgKyAodC5jb21wbGV0ZWRQb21vZG9yb3MgPz8gMCkpXG4gICAgfVxuICAgIC8vIOW9k+WJjSBzdHJlYWvvvJrku47ku4rlpKnlvoDliY3mlbDvvIzpgYfliLAgMCDljbPlgZzvvIjlhYHorrhcIuS7iuWkqei/mOayoeW8gOWni1wi5LiN566X5pat77yJXG4gICAgbGV0IGN1cnJlbnQgPSAwXG4gICAgLy8gY3Vyc29yIOacrOi6q+S4jemHjeaWsOi1i+WAvO+8iOWPquiwg+eUqOaWueazleS/ruaUueWGhemDqOaXtumXtO+8ie+8jOeUqCBjb25zdFxuICAgIGNvbnN0IGN1cnNvciA9IG5ldyBEYXRlKClcbiAgICBjdXJzb3Iuc2V0SG91cnMoMCwgMCwgMCwgMClcbiAgICBsZXQgZmlyc3RTa2lwcGVkID0gZmFsc2VcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM2NTsgaSArPSAxKSB7XG4gICAgICBjb25zdCBrID0gbG9jYWxEYXlLZXkoY3Vyc29yKVxuICAgICAgY29uc3QgY291bnQgPSBtYXAuZ2V0KGspID8/IDBcbiAgICAgIGlmIChjb3VudCA+IDApIHtcbiAgICAgICAgY3VycmVudCArPSAxXG4gICAgICB9IGVsc2UgaWYgKGsgPT09IHRvZGF5S2V5ICYmICFmaXJzdFNraXBwZWQpIHtcbiAgICAgICAgZmlyc3RTa2lwcGVkID0gdHJ1ZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGN1cnNvci5zZXREYXRlKGN1cnNvci5nZXREYXRlKCkgLSAxKVxuICAgIH1cbiAgICAvLyDmnIDplb8gc3RyZWFr77ya5Zyo5q+P5pel5bqP5YiX6YeM5omr5o+PXG4gICAgbGV0IGxvbmdlc3QgPSAwXG4gICAgbGV0IHJ1biA9IDBcbiAgICBjb25zdCBzb3J0ZWRLZXlzID0gQXJyYXkuZnJvbShtYXAua2V5cygpKS5zb3J0KClcbiAgICBmb3IgKGNvbnN0IGsgb2Ygc29ydGVkS2V5cykge1xuICAgICAgaWYgKChtYXAuZ2V0KGspID8/IDApID4gMCkge1xuICAgICAgICBydW4gKz0gMVxuICAgICAgICBpZiAocnVuID4gbG9uZ2VzdCkgbG9uZ2VzdCA9IHJ1blxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcnVuID0gMFxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgY3VycmVudCxcbiAgICAgIGxvbmdlc3Q6IE1hdGgubWF4KGxvbmdlc3QsIGN1cnJlbnQpLFxuICAgICAgYWN0aXZlVG9kYXk6IChtYXAuZ2V0KHRvZGF5S2V5KSA/PyAwKSA+IDBcbiAgICB9XG4gIH1cblxuICAvLyDor7fmsYLluo/lj7fvvJrlv6vpgJ/liIfmjaLnu5/orqHljLrpl7Tml7bkuKLlvIPmhaLliLDnmoTml6flk43lupTvvIzpmLLmraLml6fljLrpl7TmlbDmja7opobnm5bmlrDpgInkuK3ljLrpl7RcbiAgbGV0IGxvYWRTdGF0c1NlcSA9IDBcblxuICBhc3luYyBmdW5jdGlvbiBsb2FkU3RhdHMoXG4gICAgcmFuZ2U6IFN0YXRzUmFuZ2UgPSBzdGF0c1JhbmdlLnZhbHVlLFxuICAgIGN1c3RvbT86IHsgZnJvbTogbnVtYmVyOyB0bzogbnVtYmVyIH1cbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc2VxID0gKytsb2FkU3RhdHNTZXFcbiAgICBzdGF0c0xvYWRpbmcudmFsdWUgPSB0cnVlXG4gICAgbGFzdEVycm9yLnZhbHVlID0gbnVsbFxuICAgIHRyeSB7XG4gICAgICBzdGF0c1JhbmdlLnZhbHVlID0gcmFuZ2VcbiAgICAgIGNvbnN0IHsgZnJvbSwgdG8sIGRheXMgfSA9IHJhbmdlQm91bmRzKHJhbmdlLCBjdXN0b20pXG4gICAgICBjb25zdCBbdHJlbmQsIGRpc3RyaWJ1dGlvbiwgaGVhdG1hcCwgdGFza0NvbXBsZXRpb25dID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICB3aW5kb3cuYXBpLnBvbW9kb3JvLnN0YXRzLmdldERhaWx5VHJlbmQoZGF5cyksXG4gICAgICAgIHdpbmRvdy5hcGkucG9tb2Rvcm8uc3RhdHMuZ2V0UHJvamVjdERpc3RyaWJ1dGlvbihmcm9tLCB0byksXG4gICAgICAgIHdpbmRvdy5hcGkucG9tb2Rvcm8uc3RhdHMuZ2V0Rm9jdXNIZWF0bWFwKGRheXMpLFxuICAgICAgICB3aW5kb3cuYXBpLnBvbW9kb3JvLnN0YXRzLmdldFRhc2tDb21wbGV0aW9uU3RhdHMoZnJvbSwgdG8pXG4gICAgICBdKVxuICAgICAgaWYgKHNlcSAhPT0gbG9hZFN0YXRzU2VxKSByZXR1cm4gLy8g5bey5pyJ5pu05paw55qE6K+35rGC77yM5Lii5byD5pys5qyh57uT5p6cXG4gICAgICBkYWlseVRyZW5kLnZhbHVlID0gdHJlbmQgYXMgRGFpbHlUcmVuZFBvaW50W11cbiAgICAgIHByb2plY3REaXN0cmlidXRpb24udmFsdWUgPSBkaXN0cmlidXRpb24gYXMgUHJvamVjdERpc3RyaWJ1dGlvblBvaW50W11cbiAgICAgIGZvY3VzSGVhdG1hcC52YWx1ZSA9IGhlYXRtYXAgYXMgSGVhdG1hcENlbGxbXVxuICAgICAgdGFza1N0YXRzLnZhbHVlID0gdGFza0NvbXBsZXRpb24gYXMgVGFza0NvbXBsZXRpb25TdGF0c1xuICAgICAgLy8gTTjvvJrnrpflh7ogc3RyZWFrIOS4juacgOS9syBzdHJlYWtcbiAgICAgIGNvbnN0IHN0cmVha0luZm8gPSBjb21wdXRlU3RyZWFrRnJvbVRyZW5kKGRhaWx5VHJlbmQudmFsdWUpXG4gICAgICBzdHJlYWsudmFsdWUgPSBzdHJlYWtJbmZvXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoc2VxID09PSBsb2FkU3RhdHNTZXEpIHtcbiAgICAgICAgbGFzdEVycm9yLnZhbHVlID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpXG4gICAgICB9XG4gICAgICBjb25zb2xlLmVycm9yKCdbcG9tb2Rvcm8gc3RvcmVdIGxvYWRTdGF0cyBmYWlsZWQ6JywgZXJyKVxuICAgIH0gZmluYWxseSB7XG4gICAgICBpZiAoc2VxID09PSBsb2FkU3RhdHNTZXEpIHtcbiAgICAgICAgc3RhdHNMb2FkaW5nLnZhbHVlID0gZmFsc2VcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyDilIDilIDilIAg6ZuG5oiQIGFjdGlvbnPvvIhQMC0077yJ4pSA4pSA4pSAXG5cbiAgYXN5bmMgZnVuY3Rpb24gbG9hZEZyZWVSZWNvcmRzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBmcmVlUmVjb3Jkcy52YWx1ZSA9IChhd2FpdCB3aW5kb3cuYXBpLnBvbW9kb3JvLmdldEZyZWVSZWNvcmRzKCkpIGFzIFBvbW9kb3JvUmVjb3JkW11cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1twb21vZG9ybyBzdG9yZV0gbG9hZEZyZWVSZWNvcmRzIGZhaWxlZDonLCBlcnIpXG4gICAgfVxuICB9XG5cbiAgLyoqIE0277ya5oyJ5pe26Ze06IyD5Zu0IC8g6aG555uuIElEIOWPliByZWNvcmRzICovXG4gIGFzeW5jIGZ1bmN0aW9uIGZldGNoUmVjb3Jkc0J5UmFuZ2UoXG4gICAgZnJvbTogbnVtYmVyLFxuICAgIHRvOiBudW1iZXIsXG4gICAgcHJvamVjdElkOiBzdHJpbmcgfCBudWxsID0gbnVsbFxuICApOiBQcm9taXNlPFBvbW9kb3JvUmVjb3JkW10+IHtcbiAgICByZXR1cm4gKGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8uZ2V0UmVjb3Jkc0J5UmFuZ2Uoe1xuICAgICAgZnJvbSxcbiAgICAgIHRvLFxuICAgICAgcHJvamVjdElkXG4gICAgfSkpIGFzIFBvbW9kb3JvUmVjb3JkW11cbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGxvYWRJbnRlZ3JhdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgW21vZGUsIHNob3J0Y3V0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIHdpbmRvdy5hcGkucG9tb2Rvcm8uaW50ZWdyYXRpb24uZ2V0TW9kZSgpLFxuICAgICAgICB3aW5kb3cuYXBpLnBvbW9kb3JvLmludGVncmF0aW9uLmdldFNob3J0Y3V0cygpXG4gICAgICBdKVxuICAgICAgaW50ZWdyYXRpb25Nb2RlLnZhbHVlID0gbW9kZVxuICAgICAgaW50ZWdyYXRpb25TaG9ydGN1dHMudmFsdWUgPSBzaG9ydGN1dHNcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1twb21vZG9ybyBzdG9yZV0gbG9hZEludGVncmF0aW9uIGZhaWxlZDonLCBlcnIpXG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gc2V0SW50ZWdyYXRpb25Nb2RlKG1vZGU6IFBvbW9kb3JvTm90aWZpY2F0aW9uTW9kZSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8uaW50ZWdyYXRpb24uc2V0TW9kZShtb2RlKVxuICAgIGludGVncmF0aW9uTW9kZS52YWx1ZSA9IG1vZGVcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHRlc3RJbnRlZ3JhdGlvbk5vdGlmaWNhdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB3aW5kb3cuYXBpLnBvbW9kb3JvLmludGVncmF0aW9uLnRlc3ROb3RpZmljYXRpb24oKVxuICB9XG5cbiAgLy8gTTfvvJrkuJPms6jmqKHlvI9cbiAgYXN5bmMgZnVuY3Rpb24gc2V0Rm9jdXNNb2RlKGVuYWJsZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBmb2N1c01vZGUudmFsdWUgPSBlbmFibGVkXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8uaW50ZWdyYXRpb24uc2V0Rm9jdXNNb2RlKGVuYWJsZWQpXG4gICAgICAvLyDnq4vljbPmjqjpgIHkuIDku70gc25hcHNob3TvvIzorqkgdHJheSAvIGRvY2sg5ZCM5q2l5qCH6aKYXG4gICAgICBpZiAodHJheVNuYXBzaG90LnZhbHVlKSB7XG4gICAgICAgIGF3YWl0IHB1c2hUcmF5U25hcHNob3QoeyBmb2N1c01vZGU6IGVuYWJsZWQgfSlcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1twb21vZG9ybyBzdG9yZV0gc2V0Rm9jdXNNb2RlIGZhaWxlZDonLCBlcnIpXG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gbG9hZEZvY3VzTW9kZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW5hYmxlZCA9IGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8uaW50ZWdyYXRpb24uZ2V0Rm9jdXNNb2RlKClcbiAgICAgIGZvY3VzTW9kZS52YWx1ZSA9ICEhZW5hYmxlZFxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcignW3BvbW9kb3JvIHN0b3JlXSBsb2FkRm9jdXNNb2RlIGZhaWxlZDonLCBlcnIpXG4gICAgfVxuICB9XG5cbiAgLy8g4pSA4pSA4pSAIFAyLTfvvJpUb2RvaXN0IOS7u+WKoembhuaIkCDilIDilIDilIBcbiAgY29uc3QgVE9ET0lTVF9NQVBfS0VZID0gJ2xlYWYudG9kb2lzdC1tYXAnXG4gIGNvbnN0IHRvZG9pc3RNYXAgPSByZWY8UmVjb3JkPHN0cmluZywgc3RyaW5nPj4obG9hZFRvZG9pc3RNYXAoKSlcblxuICBmdW5jdGlvbiBsb2FkVG9kb2lzdE1hcCgpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmF3ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oVE9ET0lTVF9NQVBfS0VZKVxuICAgICAgcmV0dXJuIHJhdyA/IChKU09OLnBhcnNlKHJhdykgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPikgOiB7fVxuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHt9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcGVyc2lzdFRvZG9pc3RNYXAoKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFRPRE9JU1RfTUFQX0tFWSwgSlNPTi5zdHJpbmdpZnkodG9kb2lzdE1hcC52YWx1ZSkpXG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiDpmpDnp4HmqKHlvI/nrYnlnLrmma/lv73nlaUgKi9cbiAgICB9XG4gIH1cblxuICAvKiog5a+85YWlIFRvZG9pc3Qg5rS75Yqo5Lu75Yqh77yI5oyJ5qCH6aKY5Y676YeN77yM6K6w5b2VIGxvY2FsVGFza0lkIOKGkiB0b2RvaXN0SWQg5pig5bCE77yJICovXG4gIGFzeW5jIGZ1bmN0aW9uIGltcG9ydFRvZG9pc3RUYXNrcygpOiBQcm9taXNlPHsgaW1wb3J0ZWQ6IG51bWJlcjsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8udG9kb2lzdC5pbXBvcnRUYXNrcygpXG4gICAgaWYgKCFyZXMub2sgfHwgIXJlcy50YXNrcykge1xuICAgICAgcmV0dXJuIHsgaW1wb3J0ZWQ6IDAsIGVycm9yOiByZXMuZXJyb3IgPz8gJ+WvvOWFpeWksei0pScgfVxuICAgIH1cbiAgICBjb25zdCBleGlzdGluZyA9IG5ldyBTZXQodGFza3MudmFsdWUubWFwKCh0KSA9PiB0LnRpdGxlKSlcbiAgICBsZXQgaW1wb3J0ZWQgPSAwXG4gICAgZm9yIChjb25zdCB0IG9mIHJlcy50YXNrcykge1xuICAgICAgaWYgKGV4aXN0aW5nLmhhcyh0LnRpdGxlKSkgY29udGludWVcbiAgICAgIGNvbnN0IHRhc2sgPSBhd2FpdCBhZGRUYXNrKHQudGl0bGUpXG4gICAgICBpZiAodGFzaykge1xuICAgICAgICB0b2RvaXN0TWFwLnZhbHVlW3Rhc2suaWRdID0gdC5leHRlcm5hbElkXG4gICAgICAgIGltcG9ydGVkICs9IDFcbiAgICAgIH1cbiAgICB9XG4gICAgcGVyc2lzdFRvZG9pc3RNYXAoKVxuICAgIHJldHVybiB7IGltcG9ydGVkIH1cbiAgfVxuXG4gIC8qKiDmnKzlnLDku7vliqHlrozmiJDlkI7lm57lhpkgVG9kb2lzdO+8iOacieaYoOWwhOaJjeWQjOatpe+8iSAqL1xuICBhc3luYyBmdW5jdGlvbiBzeW5jVGFza0NvbXBsZXRlVG9Ub2RvaXN0KHRhc2tJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZXh0ZXJuYWxJZCA9IHRvZG9pc3RNYXAudmFsdWVbdGFza0lkXVxuICAgIGlmICghZXh0ZXJuYWxJZCkgcmV0dXJuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8udG9kb2lzdC5jb21wbGV0ZShleHRlcm5hbElkKVxuICAgICAgaWYgKHJlcy5vaykge1xuICAgICAgICBkZWxldGUgdG9kb2lzdE1hcC52YWx1ZVt0YXNrSWRdXG4gICAgICAgIHBlcnNpc3RUb2RvaXN0TWFwKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW3BvbW9kb3JvIHN0b3JlXSB0b2RvaXN0IGNvbXBsZXRlIGZhaWxlZDonLCByZXMuZXJyb3IpXG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbcG9tb2Rvcm8gc3RvcmVdIHRvZG9pc3QgY29tcGxldGUgZXJyb3I6JywgZXJyKVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIG5vdGlmeUludGVncmF0aW9uKFxuICAgIGV2ZW50OiAnc3RhcnQnIHwgJ2JyZWFrJyB8ICdjb21wbGV0ZScgfCAncGF1c2UnIHwgJ3JlbWluZCcsXG4gICAgbWVzc2FnZT86IHN0cmluZ1xuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby5pbnRlZ3JhdGlvbi5ub3RpZnkoZXZlbnQsIG1lc3NhZ2UpXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbcG9tb2Rvcm8gc3RvcmVdIG5vdGlmeUludGVncmF0aW9uIGZhaWxlZDonLCBlcnIpXG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gc2V0SW50ZWdyYXRpb25TaG9ydGN1dChcbiAgICBhY3Rpb246IFBvbW9kb3JvU2hvcnRjdXRBY3Rpb24sXG4gICAgYWNjZWxlcmF0b3I6IHN0cmluZ1xuICApOiBQcm9taXNlPHsgZmFpbGVkOiBQb21vZG9yb1Nob3J0Y3V0QWN0aW9uW10gfT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IChhd2FpdCB3aW5kb3cuYXBpLnBvbW9kb3JvLmludGVncmF0aW9uLnNldFNob3J0Y3V0KGFjdGlvbiwgYWNjZWxlcmF0b3IpKSBhcyB7XG4gICAgICBzaG9ydGN1dHM6IFBvbW9kb3JvU2hvcnRjdXRzXG4gICAgICBmYWlsZWQ6IFBvbW9kb3JvU2hvcnRjdXRBY3Rpb25bXVxuICAgIH1cbiAgICBpbnRlZ3JhdGlvblNob3J0Y3V0cy52YWx1ZSA9IHJlc3VsdC5zaG9ydGN1dHNcbiAgICBpbnRlZ3JhdGlvbkZhaWxlZFNob3J0Y3V0cy52YWx1ZSA9IHJlc3VsdC5mYWlsZWRcbiAgICByZXR1cm4geyBmYWlsZWQ6IHJlc3VsdC5mYWlsZWQgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gcmVzZXRJbnRlZ3JhdGlvblNob3J0Y3V0cygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZXN1bHQgPSAoYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby5pbnRlZ3JhdGlvbi5yZXNldFNob3J0Y3V0cygpKSBhcyB7XG4gICAgICBzaG9ydGN1dHM6IFBvbW9kb3JvU2hvcnRjdXRzXG4gICAgICBmYWlsZWQ6IFBvbW9kb3JvU2hvcnRjdXRBY3Rpb25bXVxuICAgIH1cbiAgICBpbnRlZ3JhdGlvblNob3J0Y3V0cy52YWx1ZSA9IHJlc3VsdC5zaG9ydGN1dHNcbiAgICBpbnRlZ3JhdGlvbkZhaWxlZFNob3J0Y3V0cy52YWx1ZSA9IHJlc3VsdC5mYWlsZWRcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHB1c2hUcmF5U25hcHNob3QocGF0Y2g6IFBhcnRpYWw8UG9tb2Rvcm9UcmF5U25hcHNob3Q+KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgbmV4dCA9IChhd2FpdCB3aW5kb3cuYXBpLnBvbW9kb3JvLmludGVncmF0aW9uLnVwZGF0ZVRyYXlTbmFwc2hvdChcbiAgICAgIHBhdGNoXG4gICAgKSkgYXMgUG9tb2Rvcm9UcmF5U25hcHNob3RcbiAgICB0cmF5U25hcHNob3QudmFsdWUgPSBuZXh0XG4gIH1cblxuICAvKiog55uR5ZCs5Li76L+b56iL5o6o6YCB55qE5b+r5o236ZSu5LqL5Lu277yb6L+U5ZueIHVuc3Vic2NyaWJlIOWHveaVsOOAguiwg+eUqOaWuei0n+i0o+WcqCB1bm1vdW50IOaXtua4heeQhiAqL1xuICBmdW5jdGlvbiBiaW5kU2hvcnRjdXRMaXN0ZW5lcihcbiAgICBoYW5kbGVyOiAoZXZlbnQ6IHsgYWN0aW9uOiBQb21vZG9yb1Nob3J0Y3V0QWN0aW9uIH0pID0+IHZvaWRcbiAgKTogKCkgPT4gdm9pZCB7XG4gICAgcmV0dXJuIHdpbmRvdy5hcGkucG9tb2Rvcm8uaW50ZWdyYXRpb24ub25TaG9ydGN1dChoYW5kbGVyKVxuICB9XG5cbiAgLyoqIOebkeWQrOS4u+i/m+eoi+aOqOmAgeeahOOAjOWIh+aNoueEpueCuemhueebruOAjeS6i+S7tu+8iOadpeiHqiB0cmF5IC8gZG9jayDoj5zljZXvvIkgKi9cbiAgZnVuY3Rpb24gYmluZEZvY3VzUHJvamVjdExpc3RlbmVyKGhhbmRsZXI6IChldmVudDogeyBwcm9qZWN0SWQ6IHN0cmluZyB9KSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgcmV0dXJuIHdpbmRvdy5hcGkucG9tb2Rvcm8uaW50ZWdyYXRpb24ub25Gb2N1c1Byb2plY3QoaGFuZGxlcilcbiAgfVxuXG4gIC8qKiDmjqjpgIHpobnnm67liJfooajliLDkuLvov5vnqIvvvIjnlKjkuo4gdHJheSAvIGRvY2sg6I+c5Y2V5riy5p+T5YiH5o2i6aG577yJICovXG4gIGFzeW5jIGZ1bmN0aW9uIHB1c2hQcm9qZWN0c1RvTWFpbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBsaXN0ID0gcHJvamVjdHMudmFsdWUubWFwKChwKSA9PiAoe1xuICAgICAgaWQ6IHAuaWQsXG4gICAgICBuYW1lOiBwLm5hbWUsXG4gICAgICBpc0FjdGl2ZTogZmFsc2VcbiAgICB9KSlcbiAgICBhd2FpdCB3aW5kb3cuYXBpLnBvbW9kb3JvLmludGVncmF0aW9uLnVwZGF0ZVByb2plY3RzKGxpc3QsIGZvY3VzZWRQcm9qZWN0SWQudmFsdWUpXG4gIH1cblxuICAvLyDilIDilIDilIAgUDEtMe+8muivpuaDhemhtSDilIDilIDilIBcblxuICBhc3luYyBmdW5jdGlvbiBvcGVuVGFza0RldGFpbCh0YXNrSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRhc2tEZXRhaWxJZC52YWx1ZSA9IHRhc2tJZFxuICAgIHRhc2tEZXRhaWwudmFsdWUgPSBudWxsXG4gICAgc2VsZWN0ZWRSZWNvcmRJZC52YWx1ZSA9IG51bGxcbiAgICByZWNvcmREZXRhaWwudmFsdWUgPSBudWxsXG4gICAgdGFza0RldGFpbExvYWRpbmcudmFsdWUgPSB0cnVlXG4gICAgbGFzdEVycm9yLnZhbHVlID0gbnVsbFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBkZXRhaWwgPSAoYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby50YXNrLmRldGFpbCh0YXNrSWQpKSBhcyBQb21vZG9yb1Rhc2tEZXRhaWwgfCBudWxsXG4gICAgICBpZiAodGFza0RldGFpbElkLnZhbHVlID09PSB0YXNrSWQpIHtcbiAgICAgICAgdGFza0RldGFpbC52YWx1ZSA9IGRldGFpbFxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbGFzdEVycm9yLnZhbHVlID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpXG4gICAgICBjb25zb2xlLmVycm9yKCdbcG9tb2Rvcm8gc3RvcmVdIG9wZW5UYXNrRGV0YWlsIGZhaWxlZDonLCBlcnIpXG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGlmICh0YXNrRGV0YWlsSWQudmFsdWUgPT09IHRhc2tJZCkge1xuICAgICAgICB0YXNrRGV0YWlsTG9hZGluZy52YWx1ZSA9IGZhbHNlXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY2xvc2VUYXNrRGV0YWlsKCk6IHZvaWQge1xuICAgIHRhc2tEZXRhaWxJZC52YWx1ZSA9IG51bGxcbiAgICB0YXNrRGV0YWlsLnZhbHVlID0gbnVsbFxuICAgIHNlbGVjdGVkUmVjb3JkSWQudmFsdWUgPSBudWxsXG4gICAgcmVjb3JkRGV0YWlsLnZhbHVlID0gbnVsbFxuICAgIHRhc2tEZXRhaWxMb2FkaW5nLnZhbHVlID0gZmFsc2VcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGxvYWRSZWNvcmREZXRhaWwocmVjb3JkSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHNlbGVjdGVkUmVjb3JkSWQudmFsdWUgPSByZWNvcmRJZFxuICAgIHJlY29yZERldGFpbC52YWx1ZSA9IG51bGxcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGV0YWlsID0gKGF3YWl0IHdpbmRvdy5hcGkucG9tb2Rvcm8ucmVjb3JkLmdldChyZWNvcmRJZCkpIGFzIFBvbW9kb3JvUmVjb3JkRGV0YWlsIHwgbnVsbFxuICAgICAgaWYgKHNlbGVjdGVkUmVjb3JkSWQudmFsdWUgPT09IHJlY29yZElkKSB7XG4gICAgICAgIHJlY29yZERldGFpbC52YWx1ZSA9IGRldGFpbFxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcignW3BvbW9kb3JvIHN0b3JlXSBsb2FkUmVjb3JkRGV0YWlsIGZhaWxlZDonLCBlcnIpXG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gc2F2ZVJlY29yZE5vdGUocmVjb3JkSWQ6IHN0cmluZywgbm90ZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVwZGF0ZWQgPSAoYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby5yZWNvcmQudXBkYXRlTm90ZShcbiAgICAgICAgcmVjb3JkSWQsXG4gICAgICAgIG5vdGVcbiAgICAgICkpIGFzIFBvbW9kb3JvUmVjb3JkIHwgbnVsbFxuICAgICAgaWYgKHVwZGF0ZWQgJiYgdGFza0RldGFpbC52YWx1ZSkge1xuICAgICAgICB0YXNrRGV0YWlsLnZhbHVlID0ge1xuICAgICAgICAgIC4uLnRhc2tEZXRhaWwudmFsdWUsXG4gICAgICAgICAgcmVjb3JkczogdGFza0RldGFpbC52YWx1ZS5yZWNvcmRzLm1hcCgocikgPT4gKHIuaWQgPT09IHJlY29yZElkID8gdXBkYXRlZCA6IHIpKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodXBkYXRlZCAmJiByZWNvcmREZXRhaWwudmFsdWU/LnJlY29yZC5pZCA9PT0gcmVjb3JkSWQpIHtcbiAgICAgICAgcmVjb3JkRGV0YWlsLnZhbHVlID0geyAuLi5yZWNvcmREZXRhaWwudmFsdWUsIHJlY29yZDogdXBkYXRlZCB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbcG9tb2Rvcm8gc3RvcmVdIHNhdmVSZWNvcmROb3RlIGZhaWxlZDonLCBlcnIpXG4gICAgICB0aHJvdyBlcnJcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC8vIHN0YXRlXG4gICAgdGFza3MsXG4gICAgcHJvamVjdHMsXG4gICAgcmVjb3JkcyxcbiAgICB0b2RheVJlY29yZHMsXG4gICAgc3RhdGlzdGljcyxcbiAgICBzZXR0aW5ncyxcbiAgICBzdGF0c1JhbmdlLFxuICAgIGRhaWx5VHJlbmQsXG4gICAgcHJvamVjdERpc3RyaWJ1dGlvbixcbiAgICBmb2N1c0hlYXRtYXAsXG4gICAgdGFza1N0YXRzLFxuICAgIHN0YXRzTG9hZGluZyxcbiAgICBpbnRlZ3JhdGlvbk1vZGUsXG4gICAgaW50ZWdyYXRpb25TaG9ydGN1dHMsXG4gICAgaW50ZWdyYXRpb25GYWlsZWRTaG9ydGN1dHMsXG4gICAgdHJheVNuYXBzaG90LFxuICAgIHRhc2tEZXRhaWxJZCxcbiAgICB0YXNrRGV0YWlsLFxuICAgIHRhc2tEZXRhaWxMb2FkaW5nLFxuICAgIHNlbGVjdGVkUmVjb3JkSWQsXG4gICAgcmVjb3JkRGV0YWlsLFxuICAgIGZvY3VzZWRQcm9qZWN0SWQsXG4gICAgcHJvamVjdFNldHRpbmdzLFxuICAgIGxvYWRpbmcsXG4gICAgbGFzdEVycm9yLFxuICAgIC8vIGdldHRlcnNcbiAgICB0b2RheUZvY3VzTWludXRlcyxcbiAgICBjb21wbGV0ZWRUYXNrcyxcbiAgICBwZW5kaW5nVGFza3MsXG4gICAgLy8gYWN0aW9uc1xuICAgIGxvYWQsXG4gICAgYWRkVGFzayxcbiAgICB1cGRhdGVUYXNrLFxuICAgIGRlbGV0ZVRhc2ssXG4gICAgY29tcGxldGVUYXNrLFxuICAgIGFkZFByb2plY3QsXG4gICAgdXBkYXRlUHJvamVjdCxcbiAgICBkZWxldGVQcm9qZWN0LFxuICAgIGFkZFJlY29yZCxcbiAgICByZWZyZXNoU3RhdHMsXG4gICAgc2F2ZVNldHRpbmdzLFxuICAgIGxvYWRTdGF0cyxcbiAgICBsb2FkSW50ZWdyYXRpb24sXG4gICAgc2V0SW50ZWdyYXRpb25Nb2RlLFxuICAgIHRlc3RJbnRlZ3JhdGlvbk5vdGlmaWNhdGlvbixcbiAgICBub3RpZnlJbnRlZ3JhdGlvbixcbiAgICBzZXRJbnRlZ3JhdGlvblNob3J0Y3V0LFxuICAgIHJlc2V0SW50ZWdyYXRpb25TaG9ydGN1dHMsXG4gICAgcHVzaFRyYXlTbmFwc2hvdCxcbiAgICBiaW5kU2hvcnRjdXRMaXN0ZW5lcixcbiAgICBiaW5kRm9jdXNQcm9qZWN0TGlzdGVuZXIsXG4gICAgcHVzaFByb2plY3RzVG9NYWluLFxuICAgIG9wZW5UYXNrRGV0YWlsLFxuICAgIGNsb3NlVGFza0RldGFpbCxcbiAgICBsb2FkUmVjb3JkRGV0YWlsLFxuICAgIHNhdmVSZWNvcmROb3RlLFxuICAgIC8vIFAxLTLvvJrlpJrpobnnm67lubbooYxcbiAgICBzZXRGb2N1c2VkUHJvamVjdCxcbiAgICBwcm9qZWN0U2V0dGluZ3NCeUlkLFxuICAgIGVmZmVjdGl2ZVNldHRpbmdzLFxuICAgIHNhdmVQcm9qZWN0T3ZlcnJpZGUsXG4gICAgY2xlYXJQcm9qZWN0T3ZlcnJpZGUsXG4gICAgcmVmcmVzaFByb2plY3RTZXR0aW5ncyxcbiAgICAvLyBNMTQvTTE1XG4gICAgZ2V0VGltZXJTdGF0ZSxcbiAgICBwZXJzaXN0VGltZXJTdGF0ZSxcbiAgICB0aW1lclN0YXRlcyxcbiAgICAvLyBNOFxuICAgIHN0cmVhayxcbiAgICAvLyBNNFxuICAgIGZyZWVSZWNvcmRzLFxuICAgIGxvYWRGcmVlUmVjb3JkcyxcbiAgICAvLyBNNlxuICAgIGZldGNoUmVjb3Jkc0J5UmFuZ2UsXG4gICAgLy8gTTdcbiAgICBmb2N1c01vZGUsXG4gICAgc2V0Rm9jdXNNb2RlLFxuICAgIGxvYWRGb2N1c01vZGUsXG4gICAgLy8gUDItN++8mlRvZG9pc3RcbiAgICB0b2RvaXN0TWFwLFxuICAgIGltcG9ydFRvZG9pc3RUYXNrcyxcbiAgICBzeW5jVGFza0NvbXBsZXRlVG9Ub2RvaXN0XG4gIH1cbn0pXG4iXSwibWFwcGluZ3MiOiJBQW1CQSxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLFVBQVUsV0FBVztBQTZMdkIsYUFBTSxtQkFBbUIsWUFBWSxZQUFZLE1BQU07QUFFNUQsUUFBTSxRQUFRLElBQW9CLENBQUMsQ0FBQztBQUNwQyxRQUFNLFdBQVcsSUFBdUIsQ0FBQyxDQUFDO0FBQzFDLFFBQU0sVUFBVSxJQUFzQixDQUFDLENBQUM7QUFDeEMsUUFBTSxlQUFlLElBQXNCLENBQUMsQ0FBQztBQUM3QyxRQUFNLGNBQWMsSUFBc0IsQ0FBQyxDQUFDO0FBQzVDLFFBQU0sYUFBYSxJQUErQixJQUFJO0FBQ3RELFFBQU0sV0FBVyxJQUE2QixJQUFJO0FBR2xELFFBQU0sbUJBQW1CLElBQW1CLElBQUk7QUFDaEQsUUFBTSxrQkFBa0IsSUFBMkMsQ0FBQyxDQUFDO0FBR3JFLFFBQU0sY0FBYyxJQUF5QyxDQUFDLENBQUM7QUFHL0QsUUFBTSxh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
import { computed, onBeforeUnmount, reactive, readonly, ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const WARN_THRESHOLDS = [60, 30];
const DEFAULT_STATE = (projectId, mode = "work") => ({
  projectId,
  mode,
  status: "idle",
  timeLeft: 0,
  currentTaskId: null,
  consecutiveCount: 0,
  lastTickAt: 0,
  startedAt: null,
  justFinishedLongBreak: false,
  elapsed: 0,
  warnBase: 0,
  warned: [],
  specialBreak: false,
  specialBreakTotalSec: null
});
function durationFor(mode, global, overrides) {
  const m = mode === "work" ? overrides?.workDuration ?? global.workDuration : mode === "shortBreak" ? overrides?.shortBreakDuration ?? global.shortBreakDuration : overrides?.longBreakDuration ?? global.longBreakDuration;
  return Math.max(1, Math.floor(m * 60));
}
function flowtimeBreakSeconds(elapsedSec) {
  return Math.min(20 * 60, Math.max(60, Math.floor(elapsedSec / 5)));
}
export function useMultiPomodoroTimer(options) {
  const focusedProjectId = ref(options.defaultProjectId);
  const timers = reactive(/* @__PURE__ */ new Map());
  let tickHandle = null;
  function ensureTimer(projectId) {
    let t = timers.get(projectId);
    if (!t) {
      t = reactive(DEFAULT_STATE(projectId));
      t.timeLeft = durationFor(
        t.mode,
        options.globalSettings(),
        options.getProjectOverrides(projectId)
      );
      timers.set(projectId, t);
    }
    return t;
  }
  function snapshotPersist(state) {
    if (!options.persist) return;
    if (state.status === "running") return;
    options.persist(state.projectId, {
      mode: state.mode,
      status: state.status === "paused" ? "paused" : "idle",
      timeLeft: state.timeLeft,
      currentTaskId: state.currentTaskId,
      consecutiveCount: state.consecutiveCount,
      elapsed: state.elapsed,
      updatedAt: Date.now()
    });
  }
  function effectiveDuration(state) {
    return durationFor(
      state.mode,
      options.globalSettings(),
      options.getProjectOverrides(state.projectId)
    );
  }
  function setTimerToDuration(state) {
    state.timeLeft = effectiveDuration(state);
  }
  function isFlowtimeWork(state) {
    return state.mode === "work" && (options.isFlowtime?.() ?? false);
  }
  function strictBlocked(state) {
    return state.mode === "work" && state.status === "running" && (options.isStrict?.() ?? false);
  }
  function startAll() {
    if (tickHandle) return;
    tickHandle = setInterval(tickAll, 1e3);
  }
  function tickAll() {
    const now = Date.now();
    for (const state of timers.values()) {
      if (state.status !== "running") continue;
      let elapsedSec = 1;
      if (state.lastTickAt > 0) {
        elapsedSec = Math.max(1, Math.floor((now - state.lastTickAt) / 1e3));
      }
      state.lastTickAt = now;
      if (isFlowtimeWork(state)) {
        state.elapsed += elapsedSec;
        state.timeLeft = state.elapsed;
        continue;
      }
      if (state.timeLeft > 0) {
        state.timeLeft = Math.max(0, state.timeLeft - elapsedSec);
      }
      for (const threshold of WARN_THRESHOLDS) {
        if (state.warnBase > threshold && state.timeLeft <= threshold && !state.warned.includes(threshold)) {
          state.warned.push(threshold);
          void options.onWarning?.(state.projectId, threshold);
        }
      }
      if (state.timeLeft <= 0) {
        void completeInternal(state, true);
      }
    }
  }
  async function completeInternal(state, byTimer, override) {
    const wasRunning = state.status === "running";
    const specialTotalSec = state.specialBreakTotalSec;
    state.status = "paused";
    state.timeLeft = 0;
    const task = state.currentTaskId ? options.taskById(state.currentTaskId) : null;
    await options.onComplete({
      projectId: state.projectId,
      type: state.mode,
      duration: override?.durationSec ?? (specialTotalSec != null ? specialTotalSec : effectiveDuration(state)),
      taskId: state.currentTaskId,
      taskTitle: task?.title ?? null,
      taskById: options.taskById
    });
    const prevConsecutive = state.consecutiveCount;
    const prevMode = state.mode;
    if (prevMode === "work") {
      state.consecutiveCount = prevConsecutive + 1;
    }
    state.justFinishedLongBreak = prevMode === "longBreak";
    const nextMode = (() => {
      if (prevMode !== "work") return "work";
      const projOverrides = options.getProjectOverrides(state.projectId);
      const globalRaw = options.globalSettings();
      const fallbackInterval = globalRaw.longBreakInterval ?? 4;
      const longBreakInterval = Math.max(2, projOverrides?.longBreakInterval ?? fallbackInterval);
      const completed = prevConsecutive + 1;
      return completed > 0 && completed % longBreakInterval === 0 ? "longBreak" : "shortBreak";
    })();
    state.mode = nextMode;
    state.startedAt = null;
    state.lastTickAt = 0;
    state.status = byTimer ? "paused" : "idle";
    setTimerToDuration(state);
    if (override?.nextBreakSec && nextMode !== "work") {
      state.timeLeft = Math.max(60, Math.floor(override.nextBreakSec));
    }
    state.elapsed = 0;
    state.warned = [];
    state.specialBreak = false;
    state.specialBreakTotalSec = null;
    state.warnBase = state.timeLeft;
    if (byTimer) {
      await options.notify(
        state.projectId,
        state.mode === "work" ? "break" : "start",
        state.mode === "work" ? "休息结束，下一轮开始" : "专注结束，进入休息"
      );
    }
    const auto = options.shouldAutoStart?.() ?? { break: false, work: false };
    const shouldAuto = prevMode === "work" ? auto.break : auto.work;
    if (shouldAuto) {
      state.status = "running";
      state.startedAt = Date.now();
      state.lastTickAt = Date.now();
      startAll();
      await options.notify(state.projectId, "start");
    } else if (wasRunning) {
      state.status = "paused";
    }
    snapshotPersist(state);
  }
  function focus(projectId) {
    ensureTimer(projectId);
    focusedProjectId.value = projectId;
  }
  function start(projectId) {
    const id = projectId ?? focusedProjectId.value;
    const state = ensureTimer(id);
    if (state.status === "running") return;
    if (isFlowtimeWork(state)) {
      if (state.status === "idle") {
        state.elapsed = 0;
        state.timeLeft = 0;
      }
    } else if (state.timeLeft <= 0) {
      setTimerToDuration(state);
    }
    state.justFinishedLongBreak = false;
    state.warned = [];
    state.warnBase = isFlowtimeWork(state) ? 0 : state.timeLeft;
    state.status = "running";
    state.startedAt = Date.now();
    state.lastTickAt = Date.now();
    startAll();
    void options.notify(id, "start");
  }
  function pause(projectId) {
    const id = projectId ?? focusedProjectId.value;
    const state = ensureTimer(id);
    if (state.status !== "running") return;
    if (strictBlocked(state)) return;
    state.status = "paused";
    state.lastTickAt = 0;
    state.startedAt = null;
    void options.notify(id, "pause");
    snapshotPersist(state);
  }
  function toggle(projectId) {
    const id = projectId ?? focusedProjectId.value;
    const state = ensureTimer(id);
    if (state.status === "running") pause(id);
    else start(id);
  }
  async function skip(projectId) {
    const id = projectId ?? focusedProjectId.value;
    const state = ensureTimer(id);
    if (strictBlocked(state)) return;
    if (isFlowtimeWork(state)) {
      await finishFlowtime(id);
      return;
    }
    await completeInternal(state, false);
  }
  function reset(projectId) {
    const id = projectId ?? focusedProjectId.value;
    const state = ensureTimer(id);
    if (strictBlocked(state)) return;
    state.status = "idle";
    state.lastTickAt = 0;
    state.startedAt = null;
    state.warned = [];
    state.specialBreak = false;
    state.specialBreakTotalSec = null;
    if (isFlowtimeWork(state)) {
      state.elapsed = 0;
      state.timeLeft = 0;
    } else {
      state.timeLeft = effectiveDuration(state);
      state.warnBase = state.timeLeft;
    }
    snapshotPersist(state);
  }
  async function finishFlowtime(projectId) {
    const id = projectId ?? focusedProjectId.value;
    const state = ensureTimer(id);
    if (!isFlowtimeWork(state)) {
      await completeInternal(state, false);
      return;
    }
    if (state.elapsed < 10) {
      reset(id);
      return;
    }
    await completeInternal(state, false, {
      durationSec: state.elapsed,
      nextBreakSec: flowtimeBreakSeconds(state.elapsed)
    });
  }
  function failStrict(projectId) {
    const id = projectId ?? focusedProjectId.value;
    const state = ensureTimer(id);
    if (state.status !== "running") return;
    state.status = "idle";
    state.lastTickAt = 0;
    state.startedAt = null;
    state.warned = [];
    if (isFlowtimeWork(state)) {
      state.elapsed = 0;
      state.timeLeft = 0;
    } else {
      state.timeLeft = effectiveDuration(state);
      state.warnBase = state.timeLeft;
    }
    snapshotPersist(state);
    options.onStrictFail?.(id);
  }
  function startSpecialBreak(minutes, projectId) {
    const id = projectId ?? focusedProjectId.value;
    const state = ensureTimer(id);
    if (strictBlocked(state)) return;
    if (state.status === "running") {
      state.status = "paused";
    }
    state.mode = "shortBreak";
    state.specialBreak = true;
    state.specialBreakTotalSec = Math.max(60, Math.floor(minutes * 60));
    state.timeLeft = state.specialBreakTotalSec;
    state.warned = [];
    state.warnBase = state.timeLeft;
    state.status = "running";
    state.startedAt = Date.now();
    state.lastTickAt = Date.now();
    startAll();
    void options.notify(id, "start", "特殊休息开始");
  }
  function setMode(mode, projectId) {
    const id = projectId ?? focusedProjectId.value;
    const state = ensureTimer(id);
    if (strictBlocked(state)) return;
    if (state.status === "running") {
      state.status = "paused";
    }
    state.mode = mode;
    state.warned = [];
    state.specialBreak = false;
    state.specialBreakTotalSec = null;
    if (isFlowtimeWork(state)) {
      state.elapsed = 0;
      state.timeLeft = 0;
      state.warnBase = 0;
    } else {
      setTimerToDuration(state);
      state.warnBase = state.timeLeft;
    }
    snapshotPersist(state);
  }
  function setCurrentTask(taskId, projectId) {
    const id = projectId ?? focusedProjectId.value;
    const state = ensureTimer(id);
    state.currentTaskId = taskId;
    snapshotPersist(state);
  }
  function getTimer(projectId) {
    return ensureTimer(projectId);
  }
  function isActive(projectId) {
    const t = timers.get(projectId);
    return !!t && t.status === "running";
  }
  function activeProjects() {
    return Array.from(timers.values()).filter((t) => t.status === "running");
  }
  function restorePersisted(projectId, snapshot) {
    const state = ensureTimer(projectId);
    state.mode = snapshot.mode;
    state.status = snapshot.status === "paused" ? "paused" : "idle";
    state.elapsed = Math.max(0, snapshot.elapsed ?? 0);
    state.timeLeft = typeof snapshot.timeLeft === "number" && snapshot.timeLeft > 0 ? snapshot.timeLeft : isFlowtimeWork(state) ? state.elapsed : effectiveDuration(state);
    state.currentTaskId = snapshot.currentTaskId ?? null;
    state.consecutiveCount = Math.max(0, snapshot.consecutiveCount ?? 0);
    state.lastTickAt = 0;
    state.startedAt = null;
    state.warnBase = isFlowtimeWork(state) ? 0 : state.timeLeft;
    state.warned = [];
  }
  function stopAll() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
    for (const state of timers.values()) {
      if (state.status !== "running") {
        snapshotPersist(state);
      } else {
        state.status = "paused";
        state.startedAt = null;
        state.lastTickAt = 0;
        snapshotPersist(state);
      }
    }
  }
  const focusedTimer = computed(() => timers.get(focusedProjectId.value) ?? null);
  onBeforeUnmount(() => {
    stopAll();
  });
  return {
    focusedProjectId,
    timers: readonly(timers),
    focusedTimer,
    focus,
    start,
    pause,
    toggle,
    skip,
    reset,
    finishFlowtime,
    failStrict,
    startSpecialBreak,
    setMode,
    setCurrentTask,
    restorePersisted,
    getTimer,
    isActive,
    activeProjects,
    effectiveDuration,
    startAll,
    stopAll
  };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZU11bHRpUG9tb2Rvcm9UaW1lci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIExlYWYgwrcgdXNlTXVsdGlQb21vZG9yb1RpbWVyXG4gKlxuICogUDEtMu+8muWkmumhueebruW5tuihjCB0aW1lciDnirbmgIHmnLpcbiAqXG4gKiDmlbDmja7nu5PmnoTvvJpcbiAqIC0gdGltZXJzOiByZWFjdGl2ZSBNYXA8cHJvamVjdElkLCBUaW1lclN0YXRlPlxuICogLSBmb2N1c2VkUHJvamVjdElkOiDlvZPliY3jgIznhKbngrnpobnnm67jgI3vvIjkuLvop4blm77mmL7npLrvvIlcbiAqXG4gKiDorr7orqHljp/liJnvvJpcbiAqIC0g5ZCM5LiA5pe26Ze05Y+v5aSa5Liq6aG555uuIGFjdGl2Ze+8m+avj+S4qumhueebrueLrOeri+iuoeaXtlxuICogLSDliIfmjaLnhKbngrnkuI3kvJrmmoLlgZzlkI7lj7Dpobnnm65cbiAqIC0g5YWo5bGA5b+r5o236ZSuICsg5Li7IFVJIOmDveS9nOeUqOWcqCBmb2N1c2VkUHJvamVjdElkIOS4ilxuICogLSDmiYDmnIkgdGltZXIg5ZyoIHNldEludGVydmFsIOS4reW5tuihjCB0aWNrXG4gKlxuICogdjIg5paw5aKe77yI55Wq6IyE6ZKfIFAwL1AxIOaJp+ihjOi9ru+8ie+8mlxuICogLSBGbG93dGltZSDmraPorqHml7bvvJp0aW1lclN0eWxlPSdmbG93dGltZScg5pe2IHdvcmsg5qih5byP5LuOIDAg5byA5aeL5q2j5ZCR6K6h5pWw77yMXG4gKiAgIOS4jeiHquWKqOe7k+adn++8m+eUsSBmaW5pc2hGbG93dGltZSgpIOaYvuW8j+WujOaIkOW5tuaMieOAjOaXtumVvy8144CN5o6o5a+85LyR5oGv5pe26ZW/XG4gKiAtIOS4peagvOaooeW8j++8mmlzU3RyaWN0KCkg5Li6IHRydWUg5pe277yMd29yayDorqHml7bkuK3npoHmraIg5pqC5YGcL+i3s+i/hy/ph43nva4v5YiH5qih5byP77ybXG4gKiAgIOemu+W8gOeql+WPo+S9nOW6n+eUsSBmYWlsU3RyaWN0KCkg5pi+5byP6Kem5Y+R77yIaW5kZXgudnVlIOebkeWQrCB3aW5kb3cgYmx1cu+8iVxuICogLSDpmLbmrrXkuLTov5HpooTorabvvJrlgJLorqHml7botorov4cgNjBzIC8gMzBzIOmYiOWAvOaXtuWbnuiwgyBvbldhcm5pbmfvvIjmr4/ova7mr4/pmIjlgLzoh7PlpJrkuIDmrKHvvIlcbiAqL1xuXG5pbXBvcnQgeyBjb21wdXRlZCwgb25CZWZvcmVVbm1vdW50LCByZWFjdGl2ZSwgcmVhZG9ubHksIHJlZiB9IGZyb20gJ3Z1ZSdcblxuZXhwb3J0IGludGVyZmFjZSBQcm9qZWN0VGltZXJPdmVycmlkZXMge1xuICB3b3JrRHVyYXRpb24/OiBudW1iZXIgfCBudWxsXG4gIHNob3J0QnJlYWtEdXJhdGlvbj86IG51bWJlciB8IG51bGxcbiAgbG9uZ0JyZWFrRHVyYXRpb24/OiBudW1iZXIgfCBudWxsXG4gIC8qKiDpobnnm67nuqfjgIzmr4/lrozmiJDlh6DkuKogd29yayDov5vkuIDmrKEgbG9uZ0JyZWFr44CN6KaG55uW77ybZmFsbGJhY2sg5YWo5bGAIGxvbmdCcmVha0ludGVydmFsICovXG4gIGxvbmdCcmVha0ludGVydmFsPzogbnVtYmVyIHwgbnVsbFxufVxuXG5leHBvcnQgdHlwZSBUaW1lck1vZGUgPSAnd29yaycgfCAnc2hvcnRCcmVhaycgfCAnbG9uZ0JyZWFrJ1xuZXhwb3J0IHR5cGUgVGltZXJTdGF0dXMgPSAnaWRsZScgfCAncnVubmluZycgfCAncGF1c2VkJ1xuXG5leHBvcnQgaW50ZXJmYWNlIFRpbWVyU3RhdGUge1xuICBwcm9qZWN0SWQ6IHN0cmluZ1xuICBtb2RlOiBUaW1lck1vZGVcbiAgc3RhdHVzOiBUaW1lclN0YXR1c1xuICB0aW1lTGVmdDogbnVtYmVyXG4gIGN1cnJlbnRUYXNrSWQ6IHN0cmluZyB8IG51bGxcbiAgY29uc2VjdXRpdmVDb3VudDogbnVtYmVyXG4gIGxhc3RUaWNrQXQ6IG51bWJlclxuICBzdGFydGVkQXQ6IG51bWJlciB8IG51bGxcbiAgLyoqIOmVv+S8keaBr+WImue7k+adn+agh+W/l++8iOeUqOS6jiBVSSDmmL7npLogcmVzdW1lIGJhbm5lcu+8iSAqL1xuICBqdXN0RmluaXNoZWRMb25nQnJlYWs6IGJvb2xlYW5cbiAgLyoqIEZsb3d0aW1l77ya5pys5qyh5LiT5rOo5bey57Sv6K6h56eS5pWw77yId29yayDmraPorqHml7bml7YgPSB0aW1lTGVmdO+8iSAqL1xuICBlbGFwc2VkOiBudW1iZXJcbiAgLyoqIOmihOitpu+8muacrOi9ruW8gOWni+aXtueahOWJqeS9meenkuaVsO+8iOeUqOS6juWIpOaWremYiOWAvOaYr+WQpuWcqOacrOi9ruWGhei2iui/h++8iSAqL1xuICB3YXJuQmFzZTogbnVtYmVyXG4gIC8qKiDpooTorabvvJrmnKzova7lt7Lop6blj5Hov4fnmoTpmIjlgLwgKi9cbiAgd2FybmVkOiBudW1iZXJbXVxuICAvKiogUDItOO+8muS4gOasoeaAp+eJueauiuS8keaBr++8iOWNiOS8keetie+8ie+8jOWujOaIkC/liIfmqKHlvI/lkI7oh6rliqjmuIXpmaQgKi9cbiAgc3BlY2lhbEJyZWFrOiBib29sZWFuXG4gIC8qKiBQMi0477ya54m55q6K5LyR5oGv5oC756eS5pWw77yI55So5LqO5oyJ5a6e6ZmF5pe26ZW/5YaZ6K6w5b2V77yM6ICM6Z2e6YWN572u55qE55+t5LyR5oGv5pe26ZW/77yJICovXG4gIHNwZWNpYWxCcmVha1RvdGFsU2VjOiBudW1iZXIgfCBudWxsXG59XG5cbmludGVyZmFjZSBVc2VNdWx0aVBvbW9kb3JvVGltZXJPcHRpb25zIHtcbiAgZ2xvYmFsU2V0dGluZ3M6ICgpID0+IHtcbiAgICB3b3JrRHVyYXRpb246IG51bWJlclxuICAgIHNob3J0QnJlYWtEdXJhdGlvbjogbnVtYmVyXG4gICAgbG9uZ0JyZWFrRHVyYXRpb246IG51bWJlclxuICAgIGxvbmdCcmVha0ludGVydmFsPzogbnVtYmVyXG4gIH1cbiAgZ2V0UHJvamVjdE92ZXJyaWRlczogKHByb2plY3RJZDogc3RyaW5nKSA9PiBQcm9qZWN0VGltZXJPdmVycmlkZXMgfCBudWxsXG4gIG9uQ29tcGxldGU6IChwYXlsb2FkOiB7XG4gICAgcHJvamVjdElkOiBzdHJpbmdcbiAgICB0eXBlOiBUaW1lck1vZGVcbiAgICBkdXJhdGlvbjogbnVtYmVyXG4gICAgdGFza0lkOiBzdHJpbmcgfCBudWxsXG4gICAgdGFza1RpdGxlOiBzdHJpbmcgfCBudWxsXG4gICAgdGFza0J5SWQ6IChpZDogc3RyaW5nKSA9PiB7IHRpdGxlOiBzdHJpbmcgfSB8IHVuZGVmaW5lZFxuICB9KSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPlxuICBub3RpZnk6IChcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBldmVudDogJ3N0YXJ0JyB8ICdwYXVzZScgfCAnY29tcGxldGUnIHwgJ2JyZWFrJyxcbiAgICBtZXNzYWdlPzogc3RyaW5nXG4gICkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD5cbiAgdGFza0J5SWQ6IChpZDogc3RyaW5nKSA9PiB7IHRpdGxlOiBzdHJpbmcgfSB8IHVuZGVmaW5lZFxuICBkZWZhdWx0UHJvamVjdElkOiBzdHJpbmdcbiAgc2hvdWxkQXV0b1N0YXJ0PzogKCkgPT4geyBicmVhazogYm9vbGVhbjsgd29yazogYm9vbGVhbiB9XG4gIHBlcnNpc3Q/OiAocHJvamVjdElkOiBzdHJpbmcsIHN0YXRlOiBQZXJzaXN0ZWRUaW1lclN0YXRlKSA9PiB2b2lkXG4gIC8qKiDlhajlsYDmmK/lkKbkuLogRmxvd3RpbWUg5q2j6K6h5pe26aOO5qC8ICovXG4gIGlzRmxvd3RpbWU/OiAoKSA9PiBib29sZWFuXG4gIC8qKiDlhajlsYDkuKXmoLzmqKHlvI/vvIh3b3JrIOiuoeaXtuS4reemgSDmmoLlgZwv6Lez6L+HL+mHjee9ri/liIfmqKHlvI/vvIkgKi9cbiAgaXNTdHJpY3Q/OiAoKSA9PiBib29sZWFuXG4gIC8qKiDpmLbmrrXkuLTov5HpooTorabvvIjotorov4cgNjBzIC8gMzBzIOaXtuinpuWPke+8iSAqL1xuICBvbldhcm5pbmc/OiAocHJvamVjdElkOiBzdHJpbmcsIHNlY29uZHNMZWZ0OiBudW1iZXIpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+XG4gIC8qKiDkuKXmoLzmqKHlvI/lpLHotKXvvIjnprvlvIDnqpflj6PnrYnvvInlm57osIPvvIznlKjkuo4gVUkg5o+Q56S6ICovXG4gIG9uU3RyaWN0RmFpbD86IChwcm9qZWN0SWQ6IHN0cmluZykgPT4gdm9pZFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBlcnNpc3RlZFRpbWVyU3RhdGUge1xuICBtb2RlOiBUaW1lck1vZGVcbiAgc3RhdHVzOiAnaWRsZScgfCAncGF1c2VkJ1xuICB0aW1lTGVmdDogbnVtYmVyXG4gIGN1cnJlbnRUYXNrSWQ6IHN0cmluZyB8IG51bGxcbiAgY29uc2VjdXRpdmVDb3VudDogbnVtYmVyXG4gIHVwZGF0ZWRBdDogbnVtYmVyXG4gIC8qKiBGbG93dGltZSDntK/orqHnp5LmlbDvvIjlj6/pgInvvIzlkJHlkI7lhbzlrrnml6flv6vnhafvvIkgKi9cbiAgZWxhcHNlZD86IG51bWJlclxufVxuXG5jb25zdCBXQVJOX1RIUkVTSE9MRFMgPSBbNjAsIDMwXVxuXG5jb25zdCBERUZBVUxUX1NUQVRFID0gKHByb2plY3RJZDogc3RyaW5nLCBtb2RlOiBUaW1lck1vZGUgPSAnd29yaycpOiBUaW1lclN0YXRlID0+ICh7XG4gIHByb2plY3RJZCxcbiAgbW9kZSxcbiAgc3RhdHVzOiAnaWRsZScsXG4gIHRpbWVMZWZ0OiAwLFxuICBjdXJyZW50VGFza0lkOiBudWxsLFxuICBjb25zZWN1dGl2ZUNvdW50OiAwLFxuICBsYXN0VGlja0F0OiAwLFxuICBzdGFydGVkQXQ6IG51bGwsXG4gIGp1c3RGaW5pc2hlZExvbmdCcmVhazogZmFsc2UsXG4gIGVsYXBzZWQ6IDAsXG4gIHdhcm5CYXNlOiAwLFxuICB3YXJuZWQ6IFtdLFxuICBzcGVjaWFsQnJlYWs6IGZhbHNlLFxuICBzcGVjaWFsQnJlYWtUb3RhbFNlYzogbnVsbFxufSlcblxuZnVuY3Rpb24gZHVyYXRpb25Gb3IoXG4gIG1vZGU6IFRpbWVyTW9kZSxcbiAgZ2xvYmFsOiB7IHdvcmtEdXJhdGlvbjogbnVtYmVyOyBzaG9ydEJyZWFrRHVyYXRpb246IG51bWJlcjsgbG9uZ0JyZWFrRHVyYXRpb246IG51bWJlciB9LFxuICBvdmVycmlkZXM6IFByb2plY3RUaW1lck92ZXJyaWRlcyB8IG51bGxcbik6IG51bWJlciB7XG4gIGNvbnN0IG0gPVxuICAgIG1vZGUgPT09ICd3b3JrJ1xuICAgICAgPyAob3ZlcnJpZGVzPy53b3JrRHVyYXRpb24gPz8gZ2xvYmFsLndvcmtEdXJhdGlvbilcbiAgICAgIDogbW9kZSA9PT0gJ3Nob3J0QnJlYWsnXG4gICAgICAgID8gKG92ZXJyaWRlcz8uc2hvcnRCcmVha0R1cmF0aW9uID8/IGdsb2JhbC5zaG9ydEJyZWFrRHVyYXRpb24pXG4gICAgICAgIDogKG92ZXJyaWRlcz8ubG9uZ0JyZWFrRHVyYXRpb24gPz8gZ2xvYmFsLmxvbmdCcmVha0R1cmF0aW9uKVxuICByZXR1cm4gTWF0aC5tYXgoMSwgTWF0aC5mbG9vcihtICogNjApKVxufVxuXG4vKiogRmxvd3RpbWUg5LyR5oGv5o6o5a+877ya5LiT5rOo5pe26ZW/IC8gNe+8jOS4i+mZkCAxIOWIhumSn+OAgeS4iumZkCAyMCDliIbpkp8gKi9cbmZ1bmN0aW9uIGZsb3d0aW1lQnJlYWtTZWNvbmRzKGVsYXBzZWRTZWM6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiBNYXRoLm1pbigyMCAqIDYwLCBNYXRoLm1heCg2MCwgTWF0aC5mbG9vcihlbGFwc2VkU2VjIC8gNSkpKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlTXVsdGlQb21vZG9yb1RpbWVyKG9wdGlvbnM6IFVzZU11bHRpUG9tb2Rvcm9UaW1lck9wdGlvbnMpIHtcbiAgY29uc3QgZm9jdXNlZFByb2plY3RJZCA9IHJlZjxzdHJpbmc+KG9wdGlvbnMuZGVmYXVsdFByb2plY3RJZClcbiAgY29uc3QgdGltZXJzID0gcmVhY3RpdmU8TWFwPHN0cmluZywgVGltZXJTdGF0ZT4+KG5ldyBNYXAoKSlcbiAgbGV0IHRpY2tIYW5kbGU6IFJldHVyblR5cGU8dHlwZW9mIHNldEludGVydmFsPiB8IG51bGwgPSBudWxsXG5cbiAgZnVuY3Rpb24gZW5zdXJlVGltZXIocHJvamVjdElkOiBzdHJpbmcpOiBUaW1lclN0YXRlIHtcbiAgICBsZXQgdCA9IHRpbWVycy5nZXQocHJvamVjdElkKVxuICAgIGlmICghdCkge1xuICAgICAgdCA9IHJlYWN0aXZlKERFRkFVTFRfU1RBVEUocHJvamVjdElkKSkgYXMgVGltZXJTdGF0ZVxuICAgICAgLy8g5Yid5aeL5YyWIHRpbWVMZWZ0IOS4uuW9k+WJjeaooeW8j+eahOacieaViOaXtumVv++8iOmBv+WFjeaYvuekuiAwMDowMO+8iVxuICAgICAgdC50aW1lTGVmdCA9IGR1cmF0aW9uRm9yKFxuICAgICAgICB0Lm1vZGUsXG4gICAgICAgIG9wdGlvbnMuZ2xvYmFsU2V0dGluZ3MoKSxcbiAgICAgICAgb3B0aW9ucy5nZXRQcm9qZWN0T3ZlcnJpZGVzKHByb2plY3RJZClcbiAgICAgIClcbiAgICAgIHRpbWVycy5zZXQocHJvamVjdElkLCB0KVxuICAgIH1cbiAgICByZXR1cm4gdFxuICB9XG5cbiAgZnVuY3Rpb24gc25hcHNob3RQZXJzaXN0KHN0YXRlOiBUaW1lclN0YXRlKTogdm9pZCB7XG4gICAgaWYgKCFvcHRpb25zLnBlcnNpc3QpIHJldHVyblxuICAgIGlmIChzdGF0ZS5zdGF0dXMgPT09ICdydW5uaW5nJykgcmV0dXJuXG4gICAgb3B0aW9ucy5wZXJzaXN0KHN0YXRlLnByb2plY3RJZCwge1xuICAgICAgbW9kZTogc3RhdGUubW9kZSxcbiAgICAgIHN0YXR1czogc3RhdGUuc3RhdHVzID09PSAncGF1c2VkJyA/ICdwYXVzZWQnIDogJ2lkbGUnLFxuICAgICAgdGltZUxlZnQ6IHN0YXRlLnRpbWVMZWZ0LFxuICAgICAgY3VycmVudFRhc2tJZDogc3RhdGUuY3VycmVudFRhc2tJZCxcbiAgICAgIGNvbnNlY3V0aXZlQ291bnQ6IHN0YXRlLmNvbnNlY3V0aXZlQ291bnQsXG4gICAgICBlbGFwc2VkOiBzdGF0ZS5lbGFwc2VkLFxuICAgICAgdXBkYXRlZEF0OiBEYXRlLm5vdygpXG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGVmZmVjdGl2ZUR1cmF0aW9uKHN0YXRlOiBUaW1lclN0YXRlKTogbnVtYmVyIHtcbiAgICByZXR1cm4gZHVyYXRpb25Gb3IoXG4gICAgICBzdGF0ZS5tb2RlLFxuICAgICAgb3B0aW9ucy5nbG9iYWxTZXR0aW5ncygpLFxuICAgICAgb3B0aW9ucy5nZXRQcm9qZWN0T3ZlcnJpZGVzKHN0YXRlLnByb2plY3RJZClcbiAgICApXG4gIH1cblxuICBmdW5jdGlvbiBzZXRUaW1lclRvRHVyYXRpb24oc3RhdGU6IFRpbWVyU3RhdGUpOiB2b2lkIHtcbiAgICBzdGF0ZS50aW1lTGVmdCA9IGVmZmVjdGl2ZUR1cmF0aW9uKHN0YXRlKVxuICB9XG5cbiAgZnVuY3Rpb24gaXNGbG93dGltZVdvcmsoc3RhdGU6IFRpbWVyU3RhdGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RhdGUubW9kZSA9PT0gJ3dvcmsnICYmIChvcHRpb25zLmlzRmxvd3RpbWU/LigpID8/IGZhbHNlKVxuICB9XG5cbiAgLyoqIOS4peagvOaooeW8j+WuiOWNq++8mndvcmsg6K6h5pe25Lit5piv5ZCm56aB5q2i6K+l5pON5L2cICovXG4gIGZ1bmN0aW9uIHN0cmljdEJsb2NrZWQoc3RhdGU6IFRpbWVyU3RhdGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc3RhdGUubW9kZSA9PT0gJ3dvcmsnICYmIHN0YXRlLnN0YXR1cyA9PT0gJ3J1bm5pbmcnICYmIChvcHRpb25zLmlzU3RyaWN0Py4oKSA/PyBmYWxzZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0YXJ0QWxsKCk6IHZvaWQge1xuICAgIGlmICh0aWNrSGFuZGxlKSByZXR1cm5cbiAgICB0aWNrSGFuZGxlID0gc2V0SW50ZXJ2YWwodGlja0FsbCwgMTAwMClcbiAgfVxuXG4gIGZ1bmN0aW9uIHRpY2tBbGwoKTogdm9pZCB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKVxuICAgIGZvciAoY29uc3Qgc3RhdGUgb2YgdGltZXJzLnZhbHVlcygpKSB7XG4gICAgICBpZiAoc3RhdGUuc3RhdHVzICE9PSAncnVubmluZycpIGNvbnRpbnVlXG4gICAgICBsZXQgZWxhcHNlZFNlYyA9IDFcbiAgICAgIGlmIChzdGF0ZS5sYXN0VGlja0F0ID4gMCkge1xuICAgICAgICBlbGFwc2VkU2VjID0gTWF0aC5tYXgoMSwgTWF0aC5mbG9vcigobm93IC0gc3RhdGUubGFzdFRpY2tBdCkgLyAxMDAwKSlcbiAgICAgIH1cbiAgICAgIHN0YXRlLmxhc3RUaWNrQXQgPSBub3dcblxuICAgICAgLy8gRmxvd3RpbWUg5q2j6K6h5pe277ya5Y+q57Sv5Yqg77yM5rC45LiN5Zug6K6h5pe257uT5p2fXG4gICAgICBpZiAoaXNGbG93dGltZVdvcmsoc3RhdGUpKSB7XG4gICAgICAgIHN0YXRlLmVsYXBzZWQgKz0gZWxhcHNlZFNlY1xuICAgICAgICBzdGF0ZS50aW1lTGVmdCA9IHN0YXRlLmVsYXBzZWRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgaWYgKHN0YXRlLnRpbWVMZWZ0ID4gMCkge1xuICAgICAgICBzdGF0ZS50aW1lTGVmdCA9IE1hdGgubWF4KDAsIHN0YXRlLnRpbWVMZWZ0IC0gZWxhcHNlZFNlYylcbiAgICAgIH1cblxuICAgICAgLy8g5Li06L+R6aKE6K2m77ya5pys6L2u5LuO6ZiI5YC85LiK5pa56LaK6L+H5pe26Kem5Y+R5LiA5qyhXG4gICAgICBmb3IgKGNvbnN0IHRocmVzaG9sZCBvZiBXQVJOX1RIUkVTSE9MRFMpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHN0YXRlLndhcm5CYXNlID4gdGhyZXNob2xkICYmXG4gICAgICAgICAgc3RhdGUudGltZUxlZnQgPD0gdGhyZXNob2xkICYmXG4gICAgICAgICAgIXN0YXRlLndhcm5lZC5pbmNsdWRlcyh0aHJlc2hvbGQpXG4gICAgICAgICkge1xuICAgICAgICAgIHN0YXRlLndhcm5lZC5wdXNoKHRocmVzaG9sZClcbiAgICAgICAgICB2b2lkIG9wdGlvbnMub25XYXJuaW5nPy4oc3RhdGUucHJvamVjdElkLCB0aHJlc2hvbGQpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHN0YXRlLnRpbWVMZWZ0IDw9IDApIHtcbiAgICAgICAgdm9pZCBjb21wbGV0ZUludGVybmFsKHN0YXRlLCB0cnVlKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGNvbXBsZXRlSW50ZXJuYWwoXG4gICAgc3RhdGU6IFRpbWVyU3RhdGUsXG4gICAgYnlUaW1lcjogYm9vbGVhbixcbiAgICBvdmVycmlkZT86IHsgZHVyYXRpb25TZWM/OiBudW1iZXI7IG5leHRCcmVha1NlYz86IG51bWJlciB9XG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHdhc1J1bm5pbmcgPSBzdGF0ZS5zdGF0dXMgPT09ICdydW5uaW5nJ1xuICAgIGNvbnN0IHNwZWNpYWxUb3RhbFNlYyA9IHN0YXRlLnNwZWNpYWxCcmVha1RvdGFsU2VjXG4gICAgc3RhdGUuc3RhdHVzID0gJ3BhdXNlZCdcbiAgICBzdGF0ZS50aW1lTGVmdCA9IDBcblxuICAgIGNvbnN0IHRhc2sgPSBzdGF0ZS5jdXJyZW50VGFza0lkID8gb3B0aW9ucy50YXNrQnlJZChzdGF0ZS5jdXJyZW50VGFza0lkKSA6IG51bGxcbiAgICBhd2FpdCBvcHRpb25zLm9uQ29tcGxldGUoe1xuICAgICAgcHJvamVjdElkOiBzdGF0ZS5wcm9qZWN0SWQsXG4gICAgICB0eXBlOiBzdGF0ZS5tb2RlLFxuICAgICAgZHVyYXRpb246XG4gICAgICAgIG92ZXJyaWRlPy5kdXJhdGlvblNlYyA/P1xuICAgICAgICAoc3BlY2lhbFRvdGFsU2VjICE9IG51bGwgPyBzcGVjaWFsVG90YWxTZWMgOiBlZmZlY3RpdmVEdXJhdGlvbihzdGF0ZSkpLFxuICAgICAgdGFza0lkOiBzdGF0ZS5jdXJyZW50VGFza0lkLFxuICAgICAgdGFza1RpdGxlOiB0YXNrPy50aXRsZSA/PyBudWxsLFxuICAgICAgdGFza0J5SWQ6IG9wdGlvbnMudGFza0J5SWRcbiAgICB9KVxuXG4gICAgY29uc3QgcHJldkNvbnNlY3V0aXZlID0gc3RhdGUuY29uc2VjdXRpdmVDb3VudFxuICAgIGNvbnN0IHByZXZNb2RlID0gc3RhdGUubW9kZVxuICAgIGlmIChwcmV2TW9kZSA9PT0gJ3dvcmsnKSB7XG4gICAgICBzdGF0ZS5jb25zZWN1dGl2ZUNvdW50ID0gcHJldkNvbnNlY3V0aXZlICsgMVxuICAgIH1cbiAgICAvLyDplb/kvJHmga/nu5PmnZ/moIflv5fvvJrkvpsgVUkg5pi+56S6IHJlc3VtZSBiYW5uZXJcbiAgICBzdGF0ZS5qdXN0RmluaXNoZWRMb25nQnJlYWsgPSBwcmV2TW9kZSA9PT0gJ2xvbmdCcmVhaydcblxuICAgIGNvbnN0IG5leHRNb2RlOiBUaW1lck1vZGUgPSAoKCkgPT4ge1xuICAgICAgaWYgKHByZXZNb2RlICE9PSAnd29yaycpIHJldHVybiAnd29yaydcbiAgICAgIGNvbnN0IHByb2pPdmVycmlkZXMgPSBvcHRpb25zLmdldFByb2plY3RPdmVycmlkZXMoc3RhdGUucHJvamVjdElkKVxuICAgICAgY29uc3QgZ2xvYmFsUmF3ID0gb3B0aW9ucy5nbG9iYWxTZXR0aW5ncygpIGFzIHsgbG9uZ0JyZWFrSW50ZXJ2YWw/OiBudW1iZXIgfVxuICAgICAgY29uc3QgZmFsbGJhY2tJbnRlcnZhbCA9IGdsb2JhbFJhdy5sb25nQnJlYWtJbnRlcnZhbCA/PyA0XG4gICAgICBjb25zdCBsb25nQnJlYWtJbnRlcnZhbCA9IE1hdGgubWF4KDIsIHByb2pPdmVycmlkZXM/LmxvbmdCcmVha0ludGVydmFsID8/IGZhbGxiYWNrSW50ZXJ2YWwpXG4gICAgICBjb25zdCBjb21wbGV0ZWQgPSBwcmV2Q29uc2VjdXRpdmUgKyAxXG4gICAgICByZXR1cm4gY29tcGxldGVkID4gMCAmJiBjb21wbGV0ZWQgJSBsb25nQnJlYWtJbnRlcnZhbCA9PT0gMCA/ICdsb25nQnJlYWsnIDogJ3Nob3J0QnJlYWsnXG4gICAgfSkoKVxuXG4gICAgc3RhdGUubW9kZSA9IG5leHRNb2RlXG4gICAgc3RhdGUuc3RhcnRlZEF0ID0gbnVsbFxuICAgIHN0YXRlLmxhc3RUaWNrQXQgPSAwXG4gICAgc3RhdGUuc3RhdHVzID0gYnlUaW1lciA/ICdwYXVzZWQnIDogJ2lkbGUnXG4gICAgc2V0VGltZXJUb0R1cmF0aW9uKHN0YXRlKVxuICAgIGlmIChvdmVycmlkZT8ubmV4dEJyZWFrU2VjICYmIG5leHRNb2RlICE9PSAnd29yaycpIHtcbiAgICAgIHN0YXRlLnRpbWVMZWZ0ID0gTWF0aC5tYXgoNjAsIE1hdGguZmxvb3Iob3ZlcnJpZGUubmV4dEJyZWFrU2VjKSlcbiAgICB9XG4gICAgc3RhdGUuZWxhcHNlZCA9IDBcbiAgICBzdGF0ZS53YXJuZWQgPSBbXVxuICAgIHN0YXRlLnNwZWNpYWxCcmVhayA9IGZhbHNlXG4gICAgc3RhdGUuc3BlY2lhbEJyZWFrVG90YWxTZWMgPSBudWxsXG4gICAgc3RhdGUud2FybkJhc2UgPSBzdGF0ZS50aW1lTGVmdFxuXG4gICAgaWYgKGJ5VGltZXIpIHtcbiAgICAgIGF3YWl0IG9wdGlvbnMubm90aWZ5KFxuICAgICAgICBzdGF0ZS5wcm9qZWN0SWQsXG4gICAgICAgIHN0YXRlLm1vZGUgPT09ICd3b3JrJyA/ICdicmVhaycgOiAnc3RhcnQnLFxuICAgICAgICBzdGF0ZS5tb2RlID09PSAnd29yaycgPyAn5LyR5oGv57uT5p2f77yM5LiL5LiA6L2u5byA5aeLJyA6ICfkuJPms6jnu5PmnZ/vvIzov5vlhaXkvJHmga8nXG4gICAgICApXG4gICAgfVxuXG4gICAgY29uc3QgYXV0byA9IG9wdGlvbnMuc2hvdWxkQXV0b1N0YXJ0Py4oKSA/PyB7IGJyZWFrOiBmYWxzZSwgd29yazogZmFsc2UgfVxuICAgIGNvbnN0IHNob3VsZEF1dG8gPSBwcmV2TW9kZSA9PT0gJ3dvcmsnID8gYXV0by5icmVhayA6IGF1dG8ud29ya1xuICAgIGlmIChzaG91bGRBdXRvKSB7XG4gICAgICBzdGF0ZS5zdGF0dXMgPSAncnVubmluZydcbiAgICAgIHN0YXRlLnN0YXJ0ZWRBdCA9IERhdGUubm93KClcbiAgICAgIHN0YXRlLmxhc3RUaWNrQXQgPSBEYXRlLm5vdygpXG4gICAgICBzdGFydEFsbCgpXG4gICAgICBhd2FpdCBvcHRpb25zLm5vdGlmeShzdGF0ZS5wcm9qZWN0SWQsICdzdGFydCcpXG4gICAgfSBlbHNlIGlmICh3YXNSdW5uaW5nKSB7XG4gICAgICBzdGF0ZS5zdGF0dXMgPSAncGF1c2VkJ1xuICAgIH1cblxuICAgIHNuYXBzaG90UGVyc2lzdChzdGF0ZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGZvY3VzKHByb2plY3RJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgZW5zdXJlVGltZXIocHJvamVjdElkKVxuICAgIGZvY3VzZWRQcm9qZWN0SWQudmFsdWUgPSBwcm9qZWN0SWRcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0YXJ0KHByb2plY3RJZD86IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGlkID0gcHJvamVjdElkID8/IGZvY3VzZWRQcm9qZWN0SWQudmFsdWVcbiAgICBjb25zdCBzdGF0ZSA9IGVuc3VyZVRpbWVyKGlkKVxuICAgIGlmIChzdGF0ZS5zdGF0dXMgPT09ICdydW5uaW5nJykgcmV0dXJuXG4gICAgaWYgKGlzRmxvd3RpbWVXb3JrKHN0YXRlKSkge1xuICAgICAgLy8gRmxvd3RpbWXvvJppZGxlIOaXtuS7jiAwIOW8gOWni++8m+aaguWBnOWQjue7p+e7reWImeS/neeVmee0r+iuoVxuICAgICAgaWYgKHN0YXRlLnN0YXR1cyA9PT0gJ2lkbGUnKSB7XG4gICAgICAgIHN0YXRlLmVsYXBzZWQgPSAwXG4gICAgICAgIHN0YXRlLnRpbWVMZWZ0ID0gMFxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhdGUudGltZUxlZnQgPD0gMCkge1xuICAgICAgc2V0VGltZXJUb0R1cmF0aW9uKHN0YXRlKVxuICAgIH1cbiAgICBzdGF0ZS5qdXN0RmluaXNoZWRMb25nQnJlYWsgPSBmYWxzZVxuICAgIHN0YXRlLndhcm5lZCA9IFtdXG4gICAgc3RhdGUud2FybkJhc2UgPSBpc0Zsb3d0aW1lV29yayhzdGF0ZSkgPyAwIDogc3RhdGUudGltZUxlZnRcbiAgICBzdGF0ZS5zdGF0dXMgPSAncnVubmluZydcbiAgICBzdGF0ZS5zdGFydGVkQXQgPSBEYXRlLm5vdygpXG4gICAgc3RhdGUubGFzdFRpY2tBdCA9IERhdGUubm93KClcbiAgICBzdGFydEFsbCgpXG4gICAgdm9pZCBvcHRpb25zLm5vdGlmeShpZCwgJ3N0YXJ0JylcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhdXNlKHByb2plY3RJZD86IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGlkID0gcHJvamVjdElkID8/IGZvY3VzZWRQcm9qZWN0SWQudmFsdWVcbiAgICBjb25zdCBzdGF0ZSA9IGVuc3VyZVRpbWVyKGlkKVxuICAgIGlmIChzdGF0ZS5zdGF0dXMgIT09ICdydW5uaW5nJykgcmV0dXJuXG4gICAgaWYgKHN0cmljdEJsb2NrZWQoc3RhdGUpKSByZXR1cm5cbiAgICBzdGF0ZS5zdGF0dXMgPSAncGF1c2VkJ1xuICAgIHN0YXRlLmxhc3RUaWNrQXQgPSAwXG4gICAgc3RhdGUuc3RhcnRlZEF0ID0gbnVsbFxuICAgIHZvaWQgb3B0aW9ucy5ub3RpZnkoaWQsICdwYXVzZScpXG4gICAgc25hcHNob3RQZXJzaXN0KHN0YXRlKVxuICB9XG5cbiAgZnVuY3Rpb24gdG9nZ2xlKHByb2plY3RJZD86IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGlkID0gcHJvamVjdElkID8/IGZvY3VzZWRQcm9qZWN0SWQudmFsdWVcbiAgICBjb25zdCBzdGF0ZSA9IGVuc3VyZVRpbWVyKGlkKVxuICAgIGlmIChzdGF0ZS5zdGF0dXMgPT09ICdydW5uaW5nJykgcGF1c2UoaWQpXG4gICAgZWxzZSBzdGFydChpZClcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHNraXAocHJvamVjdElkPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgaWQgPSBwcm9qZWN0SWQgPz8gZm9jdXNlZFByb2plY3RJZC52YWx1ZVxuICAgIGNvbnN0IHN0YXRlID0gZW5zdXJlVGltZXIoaWQpXG4gICAgaWYgKHN0cmljdEJsb2NrZWQoc3RhdGUpKSByZXR1cm5cbiAgICAvLyBGbG93dGltZSDnmoQgd29ya++8mnNraXAg6K+t5LmJID0g57uT5p2f5pys5qyh5LiT5rOo77yI5oyJ57Sv6K6h5pe26ZW/6K6w5b2V77yJXG4gICAgaWYgKGlzRmxvd3RpbWVXb3JrKHN0YXRlKSkge1xuICAgICAgYXdhaXQgZmluaXNoRmxvd3RpbWUoaWQpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgYXdhaXQgY29tcGxldGVJbnRlcm5hbChzdGF0ZSwgZmFsc2UpXG4gIH1cblxuICBmdW5jdGlvbiByZXNldChwcm9qZWN0SWQ/OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBpZCA9IHByb2plY3RJZCA/PyBmb2N1c2VkUHJvamVjdElkLnZhbHVlXG4gICAgY29uc3Qgc3RhdGUgPSBlbnN1cmVUaW1lcihpZClcbiAgICBpZiAoc3RyaWN0QmxvY2tlZChzdGF0ZSkpIHJldHVyblxuICAgIHN0YXRlLnN0YXR1cyA9ICdpZGxlJ1xuICAgIHN0YXRlLmxhc3RUaWNrQXQgPSAwXG4gICAgc3RhdGUuc3RhcnRlZEF0ID0gbnVsbFxuICAgIHN0YXRlLndhcm5lZCA9IFtdXG4gICAgc3RhdGUuc3BlY2lhbEJyZWFrID0gZmFsc2VcbiAgICBzdGF0ZS5zcGVjaWFsQnJlYWtUb3RhbFNlYyA9IG51bGxcbiAgICBpZiAoaXNGbG93dGltZVdvcmsoc3RhdGUpKSB7XG4gICAgICBzdGF0ZS5lbGFwc2VkID0gMFxuICAgICAgc3RhdGUudGltZUxlZnQgPSAwXG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlLnRpbWVMZWZ0ID0gZWZmZWN0aXZlRHVyYXRpb24oc3RhdGUpXG4gICAgICBzdGF0ZS53YXJuQmFzZSA9IHN0YXRlLnRpbWVMZWZ0XG4gICAgfVxuICAgIHNuYXBzaG90UGVyc2lzdChzdGF0ZSlcbiAgfVxuXG4gIC8qKiBGbG93dGltZe+8muaYvuW8j+e7k+adn+acrOasoeato+iuoeaXtuS4k+azqO+8jOaMiee0r+iuoeaXtumVv+iusOW9leW5tuaOqOWvvOS8keaBryAqL1xuICBhc3luYyBmdW5jdGlvbiBmaW5pc2hGbG93dGltZShwcm9qZWN0SWQ/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBpZCA9IHByb2plY3RJZCA/PyBmb2N1c2VkUHJvamVjdElkLnZhbHVlXG4gICAgY29uc3Qgc3RhdGUgPSBlbnN1cmVUaW1lcihpZClcbiAgICBpZiAoIWlzRmxvd3RpbWVXb3JrKHN0YXRlKSkge1xuICAgICAgYXdhaXQgY29tcGxldGVJbnRlcm5hbChzdGF0ZSwgZmFsc2UpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgaWYgKHN0YXRlLmVsYXBzZWQgPCAxMCkge1xuICAgICAgLy8g5LiT5rOo5LiN6LazIDEwIOenkuS4jeiusOW9le+8jOebtOaOpeW9kumbtlxuICAgICAgcmVzZXQoaWQpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgYXdhaXQgY29tcGxldGVJbnRlcm5hbChzdGF0ZSwgZmFsc2UsIHtcbiAgICAgIGR1cmF0aW9uU2VjOiBzdGF0ZS5lbGFwc2VkLFxuICAgICAgbmV4dEJyZWFrU2VjOiBmbG93dGltZUJyZWFrU2Vjb25kcyhzdGF0ZS5lbGFwc2VkKVxuICAgIH0pXG4gIH1cblxuICAvKiog5Lil5qC85qih5byP77ya5L2c5bqf5b2T5YmN55Wq6IyE77yI56a75byA56qX5Y+j562J5Zy65pmv77yJ77yM5LiN5YaZ5YWl6K6w5b2VICovXG4gIGZ1bmN0aW9uIGZhaWxTdHJpY3QocHJvamVjdElkPzogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgaWQgPSBwcm9qZWN0SWQgPz8gZm9jdXNlZFByb2plY3RJZC52YWx1ZVxuICAgIGNvbnN0IHN0YXRlID0gZW5zdXJlVGltZXIoaWQpXG4gICAgaWYgKHN0YXRlLnN0YXR1cyAhPT0gJ3J1bm5pbmcnKSByZXR1cm5cbiAgICBzdGF0ZS5zdGF0dXMgPSAnaWRsZSdcbiAgICBzdGF0ZS5sYXN0VGlja0F0ID0gMFxuICAgIHN0YXRlLnN0YXJ0ZWRBdCA9IG51bGxcbiAgICBzdGF0ZS53YXJuZWQgPSBbXVxuICAgIGlmIChpc0Zsb3d0aW1lV29yayhzdGF0ZSkpIHtcbiAgICAgIHN0YXRlLmVsYXBzZWQgPSAwXG4gICAgICBzdGF0ZS50aW1lTGVmdCA9IDBcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdGUudGltZUxlZnQgPSBlZmZlY3RpdmVEdXJhdGlvbihzdGF0ZSlcbiAgICAgIHN0YXRlLndhcm5CYXNlID0gc3RhdGUudGltZUxlZnRcbiAgICB9XG4gICAgc25hcHNob3RQZXJzaXN0KHN0YXRlKVxuICAgIG9wdGlvbnMub25TdHJpY3RGYWlsPy4oaWQpXG4gIH1cblxuICAvKipcbiAgICogUDItOO+8muS4gOasoeaAp+eJueauiuS8keaBr++8iOWNiOmkkCAvIOaZmumlreetie+8ie+8jOS4jeWNoOeUqOeVquiMhOW+queOr+KAlOKAlFxuICAgKiDnm7TmjqXov5vlhaXmjIflrprml7bplb/nmoTnn63kvJHmga/lubboh6rliqjlvIDlp4vvvJvlrozmiJDlkI7lm57liLDmraPluLggd29yayDoioLlpY/jgIJcbiAgICovXG4gIGZ1bmN0aW9uIHN0YXJ0U3BlY2lhbEJyZWFrKG1pbnV0ZXM6IG51bWJlciwgcHJvamVjdElkPzogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgaWQgPSBwcm9qZWN0SWQgPz8gZm9jdXNlZFByb2plY3RJZC52YWx1ZVxuICAgIGNvbnN0IHN0YXRlID0gZW5zdXJlVGltZXIoaWQpXG4gICAgaWYgKHN0cmljdEJsb2NrZWQoc3RhdGUpKSByZXR1cm5cbiAgICBpZiAoc3RhdGUuc3RhdHVzID09PSAncnVubmluZycpIHtcbiAgICAgIHN0YXRlLnN0YXR1cyA9ICdwYXVzZWQnXG4gICAgfVxuICAgIHN0YXRlLm1vZGUgPSAnc2hvcnRCcmVhaydcbiAgICBzdGF0ZS5zcGVjaWFsQnJlYWsgPSB0cnVlXG4gICAgc3RhdGUuc3BlY2lhbEJyZWFrVG90YWxTZWMgPSBNYXRoLm1heCg2MCwgTWF0aC5mbG9vcihtaW51dGVzICogNjApKVxuICAgIHN0YXRlLnRpbWVMZWZ0ID0gc3RhdGUuc3BlY2lhbEJyZWFrVG90YWxTZWNcbiAgICBzdGF0ZS53YXJuZWQgPSBbXVxuICAgIHN0YXRlLndhcm5CYXNlID0gc3RhdGUudGltZUxlZnRcbiAgICBzdGF0ZS5zdGF0dXMgPSAncnVubmluZydcbiAgICBzdGF0ZS5zdGFydGVkQXQgPSBEYXRlLm5vdygpXG4gICAgc3RhdGUubGFzdFRpY2tBdCA9IERhdGUubm93KClcbiAgICBzdGFydEFsbCgpXG4gICAgdm9pZCBvcHRpb25zLm5vdGlmeShpZCwgJ3N0YXJ0JywgJ+eJueauiuS8keaBr+W8gOWniycpXG4gIH1cblxuICBmdW5jdGlvbiBzZXRNb2RlKG1vZGU6IFRpbWVyTW9kZSwgcHJvamVjdElkPzogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgaWQgPSBwcm9qZWN0SWQgPz8gZm9jdXNlZFByb2plY3RJZC52YWx1ZVxuICAgIGNvbnN0IHN0YXRlID0gZW5zdXJlVGltZXIoaWQpXG4gICAgaWYgKHN0cmljdEJsb2NrZWQoc3RhdGUpKSByZXR1cm5cbiAgICBpZiAoc3RhdGUuc3RhdHVzID09PSAncnVubmluZycpIHtcbiAgICAgIHN0YXRlLnN0YXR1cyA9ICdwYXVzZWQnXG4gICAgfVxuICAgIHN0YXRlLm1vZGUgPSBtb2RlXG4gICAgc3RhdGUud2FybmVkID0gW11cbiAgICBzdGF0ZS5zcGVjaWFsQnJlYWsgPSBmYWxzZVxuICAgIHN0YXRlLnNwZWNpYWxCcmVha1RvdGFsU2VjID0gbnVsbFxuICAgIGlmIChpc0Zsb3d0aW1lV29yayhzdGF0ZSkpIHtcbiAgICAgIHN0YXRlLmVsYXBzZWQgPSAwXG4gICAgICBzdGF0ZS50aW1lTGVmdCA9IDBcbiAgICAgIHN0YXRlLndhcm5CYXNlID0gMFxuICAgIH0gZWxzZSB7XG4gICAgICBzZXRUaW1lclRvRHVyYXRpb24oc3RhdGUpXG4gICAgICBzdGF0ZS53YXJuQmFzZSA9IHN0YXRlLnRpbWVMZWZ0XG4gICAgfVxuICAgIHNuYXBzaG90UGVyc2lzdChzdGF0ZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldEN1cnJlbnRUYXNrKHRhc2tJZDogc3RyaW5nIHwgbnVsbCwgcHJvamVjdElkPzogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgaWQgPSBwcm9qZWN0SWQgPz8gZm9jdXNlZFByb2plY3RJZC52YWx1ZVxuICAgIGNvbnN0IHN0YXRlID0gZW5zdXJlVGltZXIoaWQpXG4gICAgc3RhdGUuY3VycmVudFRhc2tJZCA9IHRhc2tJZFxuICAgIHNuYXBzaG90UGVyc2lzdChzdGF0ZSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFRpbWVyKHByb2plY3RJZDogc3RyaW5nKTogVGltZXJTdGF0ZSB7XG4gICAgcmV0dXJuIGVuc3VyZVRpbWVyKHByb2plY3RJZClcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzQWN0aXZlKHByb2plY3RJZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgdCA9IHRpbWVycy5nZXQocHJvamVjdElkKVxuICAgIHJldHVybiAhIXQgJiYgdC5zdGF0dXMgPT09ICdydW5uaW5nJ1xuICB9XG5cbiAgZnVuY3Rpb24gYWN0aXZlUHJvamVjdHMoKTogVGltZXJTdGF0ZVtdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aW1lcnMudmFsdWVzKCkpLmZpbHRlcigodCkgPT4gdC5zdGF0dXMgPT09ICdydW5uaW5nJylcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc3RvcmVQZXJzaXN0ZWQoXG4gICAgcHJvamVjdElkOiBzdHJpbmcsXG4gICAgc25hcHNob3Q6IFBpY2s8XG4gICAgICBQZXJzaXN0ZWRUaW1lclN0YXRlLFxuICAgICAgJ21vZGUnIHwgJ3N0YXR1cycgfCAndGltZUxlZnQnIHwgJ2N1cnJlbnRUYXNrSWQnIHwgJ2NvbnNlY3V0aXZlQ291bnQnXG4gICAgPiAmIHsgZWxhcHNlZD86IG51bWJlciB9XG4gICk6IHZvaWQge1xuICAgIGNvbnN0IHN0YXRlID0gZW5zdXJlVGltZXIocHJvamVjdElkKVxuICAgIHN0YXRlLm1vZGUgPSBzbmFwc2hvdC5tb2RlXG4gICAgc3RhdGUuc3RhdHVzID0gc25hcHNob3Quc3RhdHVzID09PSAncGF1c2VkJyA/ICdwYXVzZWQnIDogJ2lkbGUnXG4gICAgc3RhdGUuZWxhcHNlZCA9IE1hdGgubWF4KDAsIHNuYXBzaG90LmVsYXBzZWQgPz8gMClcbiAgICBzdGF0ZS50aW1lTGVmdCA9XG4gICAgICB0eXBlb2Ygc25hcHNob3QudGltZUxlZnQgPT09ICdudW1iZXInICYmIHNuYXBzaG90LnRpbWVMZWZ0ID4gMFxuICAgICAgICA/IHNuYXBzaG90LnRpbWVMZWZ0XG4gICAgICAgIDogaXNGbG93dGltZVdvcmsoc3RhdGUpXG4gICAgICAgICAgPyBzdGF0ZS5lbGFwc2VkXG4gICAgICAgICAgOiBlZmZlY3RpdmVEdXJhdGlvbihzdGF0ZSlcbiAgICBzdGF0ZS5jdXJyZW50VGFza0lkID0gc25hcHNob3QuY3VycmVudFRhc2tJZCA/PyBudWxsXG4gICAgc3RhdGUuY29uc2VjdXRpdmVDb3VudCA9IE1hdGgubWF4KDAsIHNuYXBzaG90LmNvbnNlY3V0aXZlQ291bnQgPz8gMClcbiAgICBzdGF0ZS5sYXN0VGlja0F0ID0gMFxuICAgIHN0YXRlLnN0YXJ0ZWRBdCA9IG51bGxcbiAgICBzdGF0ZS53YXJuQmFzZSA9IGlzRmxvd3RpbWVXb3JrKHN0YXRlKSA/IDAgOiBzdGF0ZS50aW1lTGVmdFxuICAgIHN0YXRlLndhcm5lZCA9IFtdXG4gIH1cblxuICBmdW5jdGlvbiBzdG9wQWxsKCk6IHZvaWQge1xuICAgIGlmICh0aWNrSGFuZGxlKSB7XG4gICAgICBjbGVhckludGVydmFsKHRpY2tIYW5kbGUpXG4gICAgICB0aWNrSGFuZGxlID0gbnVsbFxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHN0YXRlIG9mIHRpbWVycy52YWx1ZXMoKSkge1xuICAgICAgaWYgKHN0YXRlLnN0YXR1cyAhPT0gJ3J1bm5pbmcnKSB7XG4gICAgICAgIHNuYXBzaG90UGVyc2lzdChzdGF0ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0YXRlLnN0YXR1cyA9ICdwYXVzZWQnXG4gICAgICAgIHN0YXRlLnN0YXJ0ZWRBdCA9IG51bGxcbiAgICAgICAgc3RhdGUubGFzdFRpY2tBdCA9IDBcbiAgICAgICAgc25hcHNob3RQZXJzaXN0KHN0YXRlKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGZvY3VzZWRUaW1lciA9IGNvbXB1dGVkKCgpID0+IHRpbWVycy5nZXQoZm9jdXNlZFByb2plY3RJZC52YWx1ZSkgPz8gbnVsbClcblxuICBvbkJlZm9yZVVubW91bnQoKCkgPT4ge1xuICAgIHN0b3BBbGwoKVxuICB9KVxuXG4gIHJldHVybiB7XG4gICAgZm9jdXNlZFByb2plY3RJZCxcbiAgICB0aW1lcnM6IHJlYWRvbmx5KHRpbWVycyksXG4gICAgZm9jdXNlZFRpbWVyLFxuICAgIGZvY3VzLFxuICAgIHN0YXJ0LFxuICAgIHBhdXNlLFxuICAgIHRvZ2dsZSxcbiAgICBza2lwLFxuICAgIHJlc2V0LFxuICAgIGZpbmlzaEZsb3d0aW1lLFxuICAgIGZhaWxTdHJpY3QsXG4gICAgc3RhcnRTcGVjaWFsQnJlYWssXG4gICAgc2V0TW9kZSxcbiAgICBzZXRDdXJyZW50VGFzayxcbiAgICByZXN0b3JlUGVyc2lzdGVkLFxuICAgIGdldFRpbWVyLFxuICAgIGlzQWN0aXZlLFxuICAgIGFjdGl2ZVByb2plY3RzLFxuICAgIGVmZmVjdGl2ZUR1cmF0aW9uLFxuICAgIHN0YXJ0QWxsLFxuICAgIHN0b3BBbGxcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBVc2VNdWx0aVBvbW9kb3JvVGltZXJSZXR1cm4gPSBSZXR1cm5UeXBlPHR5cGVvZiB1c2VNdWx0aVBvbW9kb3JvVGltZXI+XG4iXSwibWFwcGluZ3MiOiJBQXVCQSxTQUFTLFVBQVUs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
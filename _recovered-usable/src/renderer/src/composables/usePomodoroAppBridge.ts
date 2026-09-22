/* 2026-09-22 由 dev-server 缓存的编译产物机械还原：非原始源码，类型标注已被 esbuild 剥除，
   import 说明符已尽量改回裸包名。过了 node --check 语法校验，未做运行验证。 */
import { computed, watch } from "vue";
import { usePomodoroStore } from "/src/stores/pomodoro.ts";
import { useMultiPomodoroTimer } from "/src/views/pomodoro/composables/useMultiPomodoroTimer.ts";
let timerInstance = null;
const strictFailListeners = /* @__PURE__ */ new Set();
export function subscribeStrictFail(cb) {
  strictFailListeners.add(cb);
  return () => strictFailListeners.delete(cb);
}
export function ensurePomodoroBridgeSync() {
  if (!timerInstance) {
    timerInstance = createTimer();
    installAsync(timerInstance).catch((e) => {
      console.warn("[pomodoro-bridge] install failed:", e);
    });
  }
  return timerInstance;
}
function createTimer() {
  const store = usePomodoroStore();
  const settings = computed(
    () => store.settings ?? {
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4,
      soundEnabled: true,
      notificationEnabled: true,
      autoStartBreak: false,
      autoStartWork: false
    }
  );
  const tasks = computed(() => store.tasks);
  const projects = computed(() => store.projects);
  const effective = computed(() => store.effectiveSettings(store.focusedProjectId ?? ""));
  return useMultiPomodoroTimer({
    globalSettings: () => ({
      workDuration: effective.value.workDuration,
      shortBreakDuration: effective.value.shortBreakDuration,
      longBreakDuration: effective.value.longBreakDuration,
      longBreakInterval: settings.value.longBreakInterval
    }),
    getProjectOverrides: (id) => store.projectSettingsById(id),
    onComplete: async (payload) => {
      const task = payload.taskById(payload.taskId ?? "");
      await store.addRecord({
        taskId: payload.taskId ?? void 0,
        taskTitle: task?.title ?? payload.taskTitle ?? void 0,
        projectId: payload.projectId,
        type: payload.type,
        duration: payload.duration,
        completedAt: Date.now()
      });
      if (settings.value.soundEnabled) playSound();
      speak(settings, payload.type === "work" ? "番茄完成，休息一下" : "休息结束，继续加油");
      if (settings.value.notificationEnabled) {
        const mode = store.integrationMode;
        if (mode !== "silent") {
          if (payload.type === "work") {
            await store.notifyIntegration("complete", "恭喜完成一个番茄钟！");
          } else {
            await store.notifyIntegration("break", "休息时间结束，准备开始工作");
          }
        }
      }
    },
    notify: async (_projectId, event, message) => {
      if (!settings.value.notificationEnabled) return;
      if (store.integrationMode === "silent") return;
      if (event === "start") {
        const t = timerInstance?.focusedTimer.value;
        const m = t?.mode ?? "work";
        const modeText = m === "work" ? "工作" : m === "shortBreak" ? "短休息" : "长休息";
        await store.notifyIntegration("start", message ?? `开始${modeText}时间`);
      } else if (event === "pause") {
        await store.notifyIntegration("pause");
      }
    },
    taskById: (id) => {
      const t = tasks.value.find((task) => task.id === id);
      return t ? { title: t.title } : void 0;
    },
    defaultProjectId: store.focusedProjectId ?? projects.value[0]?.id ?? "",
    shouldAutoStart: () => ({
      break: settings.value.autoStartBreak,
      work: settings.value.autoStartWork
    }),
    persist: (projectId, state) => {
      if (!projectId) return;
      void store.persistTimerState(projectId, state).catch(() => {
      });
    },
    // P0-2：Flowtime 正计时风格（仅作用于 work 阶段）
    isFlowtime: () => (store.settings?.timerStyle ?? "pomodoro") === "flowtime",
    // P1-4：严格模式（work 计时中禁 暂停/跳过/重置/切模式）
    isStrict: () => store.settings?.strictMode === true,
    // P1-5：阶段临近预警（60s / 30s，每阶段每阈值一次）
    onWarning: async (_projectId, secondsLeft) => {
      if (!settings.value.notificationEnabled) return;
      if (store.integrationMode === "silent") return;
      const label = secondsLeft <= 30 ? "30 秒" : "1 分钟";
      await store.notifyIntegration("remind", `本阶段还剩 ${label}，准备收尾`);
      speak(settings, `还剩${label}`);
    },
    // P1-4：严格模式失败（离开窗口）提示——UI 展示交给订阅方（视图）
    onStrictFail: () => {
      for (const cb of strictFailListeners) cb();
    }
  });
}
async function installAsync(timer) {
  const store = usePomodoroStore();
  await store.load();
  const allStates = store.timerStates || {};
  for (const [projectId, snap] of Object.entries(allStates)) {
    timer.restorePersisted(projectId, snap);
  }
  timer.startAll();
  if (store.focusedProjectId) {
    timer.focus(store.focusedProjectId);
  }
  await store.loadIntegration();
  store.bindShortcutListener(({ action }) => {
    if (action === "toggle") timer.toggle();
    else if (action === "skip") void timer.skip();
    else timer.reset();
  });
  store.bindFocusProjectListener(({ projectId }) => {
    if (!projectId || projectId === store.focusedProjectId) return;
    store.setFocusedProject(projectId);
    timer.focus(projectId);
  });
  await store.pushProjectsToMain();
  watch(
    () => store.focusedProjectId,
    (id) => {
      if (id) timer.focus(id);
    }
  );
  const focusedTimerState = computed(() => timer.focusedTimer.value);
  const currentMode = computed(() => focusedTimerState.value?.mode ?? "work");
  const isRunning = computed(() => (focusedTimerState.value?.status ?? "idle") === "running");
  const timeLeft = computed(() => focusedTimerState.value?.timeLeft ?? 0);
  const currentTaskId = computed(() => focusedTimerState.value?.currentTaskId ?? null);
  const isSpecialBreak = computed(() => focusedTimerState.value?.specialBreak === true);
  const isFlowtime = computed(() => (store.settings?.timerStyle ?? "pomodoro") === "flowtime");
  const flowtimeWork = computed(() => isFlowtime.value && currentMode.value === "work");
  const effective = computed(() => store.effectiveSettings(store.focusedProjectId ?? ""));
  const duration = computed(() => {
    if (flowtimeWork.value) return 0;
    if (isSpecialBreak.value) return focusedTimerState.value?.specialBreakTotalSec ?? 0;
    if (currentMode.value === "work") return effective.value.workDuration * 60;
    if (currentMode.value === "shortBreak") return effective.value.shortBreakDuration * 60;
    return effective.value.longBreakDuration * 60;
  });
  const currentTask = computed(() => {
    const id = currentTaskId.value;
    if (!id) return null;
    return store.tasks.find((t) => t.id === id) ?? null;
  });
  async function pushSnapshot() {
    try {
      const currentTaskTitle = currentTask.value?.title ?? "";
      const focusedProjectName = store.projects.find((p) => p.id === store.focusedProjectId)?.name ?? "";
      const background = timer.activeProjects().filter((s) => s.projectId !== timer.focusedProjectId.value).map((s) => {
        const project = store.projects.find((p) => p.id === s.projectId);
        return {
          id: s.projectId,
          name: project?.name ?? "项目",
          timeLeftSeconds: s.timeLeft,
          mode: s.mode
        };
      });
      await store.pushTraySnapshot({
        isRunning: isRunning.value,
        currentMode: currentMode.value,
        taskTitle: currentTaskTitle,
        timeLeftSeconds: timeLeft.value,
        totalSeconds: duration.value,
        todayCompleted: store.statistics?.today.work ?? 0,
        projectId: store.focusedProjectId,
        projectName: focusedProjectName,
        backgroundProjects: background
      });
    } catch (err) {
      console.error("[pomodoro-bridge] pushTraySnapshot failed:", err);
    }
  }
  let lastSnapshotPush = 0;
  watch([isRunning, currentMode, currentTaskId, () => store.statistics?.today.work ?? 0], () => {
    lastSnapshotPush = 0;
    void pushSnapshot();
  });
  watch(timeLeft, () => {
    const now = Date.now();
    if (now - lastSnapshotPush < 5e3) return;
    lastSnapshotPush = now;
    void pushSnapshot();
  });
  watch(
    [isRunning, currentMode],
    ([running, mode]) => {
      try {
        void window.api.focusShield.setActive(running && mode === "work");
      } catch {
      }
    },
    { immediate: true }
  );
  await pushSnapshot();
}
function speak(settings, text) {
  if (!settings.value.voiceEnabled) return;
  if (!("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    window.speechSynthesis.speak(u);
  } catch (err) {
    console.warn("[pomodoro-bridge] speak failed:", err);
  }
}
function playSound() {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    oscillator.onended = () => {
      void audioContext.close().catch(() => {
      });
    };
  } catch (err) {
    console.error("[pomodoro-bridge] playSound failed:", err);
  }
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZVBvbW9kb3JvQXBwQnJpZGdlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGVhZiDCtyDnlarojITpkp/lupTnlKjnuqfmoaXvvIhJQSB2MiDpmLbmrrVB77ya6IO25ZuK44CM5byA5aeL5LiT5rOo44CN5YaF6IGU6aG155qE5YmN572u77yJXG4gKlxuICog5oqK5Y6f6KeG5Zu+5bGC55qE44CM6K6h5pe25Zmo5a6e5L6LICsg5YWo5bGA5b+r5o236ZSu57uR5a6aICsgdHJheSDlv6vnhafmjqjpgIHjgI3kuIvmsonkuLogYXBwIOe6p+WNleS+i++8mlxuICogLSDkuLvnqpflj6Pku7vmhI/ot6/nlLHkuIvorqHml7blmajpg73lnKjot5HvvIjijJjih6dQIOWFqOWxgOWPr+eUqO+8jOaJmOebmCAvIOi/t+S9oOeqlyAvIOiDtuWbiuS4k+azqOmhteWunuaXtuW/q+eFp++8iVxuICogLSDog7blm4ogRm9jdXNQYWdlIOe7jyBpbnRlZ3JhdGlvbiDlv6vnhafpgJrpgZPlsZXnpLrnirbmgIHvvIznu48gZGlzcGF0Y2hTaG9ydGN1dCDov5znqIvmk43mjqdcbiAqXG4gKiDliJ3lp4vljJbnuqblrprvvJpcbiAqIC0gQXBwLnZ1ZSDlnKjkuLvnqpflj6PmjILovb3ml7bosIPnlKggZW5zdXJlUG9tb2Rvcm9CcmlkZ2VTeW5jKCnvvIhpc1ByaW1hcnlXaW5kb3cg5Yik5a6a77yMXG4gKiAgIOmBv+WFjSBtaW5pIOetieeql+WPo+mHjeWkjeWIm+W7uuiuoeaXtuWZqOWunuS+i++8iVxuICogLSDnlarojITpkp/op4blm74gc2V0dXAg5Lmf6LCD55So5a6D5Y+W5ZCM5LiA5Liq5Y2V5L6L77yI5bmC562J77yJ77ybZG9jayDlvIDlh7rnmoTni6znq4sgL3BvbW9kb3JvXG4gKiAgIOeql+WPo+S8muW+l+WIsOiHquW3seeahOWxgOmDqOWunuS+i++8jOS4juaUuemAoOWJjeOAjOinhuWbvue6p+WunuS+i+OAjeihjOS4uuS4gOiHtFxuICovXG5pbXBvcnQgeyBjb21wdXRlZCwgd2F0Y2ggfSBmcm9tICd2dWUnXG5pbXBvcnQgeyB1c2VQb21vZG9yb1N0b3JlIH0gZnJvbSAnLi4vc3RvcmVzL3BvbW9kb3JvJ1xuaW1wb3J0IHsgdXNlTXVsdGlQb21vZG9yb1RpbWVyIH0gZnJvbSAnLi4vdmlld3MvcG9tb2Rvcm8vY29tcG9zYWJsZXMvdXNlTXVsdGlQb21vZG9yb1RpbWVyJ1xuXG50eXBlIFBvbW9kb3JvVGltZXIgPSBSZXR1cm5UeXBlPHR5cGVvZiB1c2VNdWx0aVBvbW9kb3JvVGltZXI+XG5cbmxldCB0aW1lckluc3RhbmNlOiBQb21vZG9yb1RpbWVyIHwgbnVsbCA9IG51bGxcbmNvbnN0IHN0cmljdEZhaWxMaXN0ZW5lcnMgPSBuZXcgU2V0PCgpID0+IHZvaWQ+KClcblxuLyoqIOS4peagvOaooeW8j+Wksei0pe+8iOemu+W8gOeql+WPo++8ieaPkOekuueahOiuoumYhe+8jOinhuWbvueUqOWug+WcqOiHquW3seeahCBVSSDkuIrlsZXnpLogaGludCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN1YnNjcmliZVN0cmljdEZhaWwoY2I6ICgpID0+IHZvaWQpOiAoKSA9PiB2b2lkIHtcbiAgc3RyaWN0RmFpbExpc3RlbmVycy5hZGQoY2IpXG4gIHJldHVybiAoKSA9PiBzdHJpY3RGYWlsTGlzdGVuZXJzLmRlbGV0ZShjYilcbn1cblxuLyoqXG4gKiDlj5blhajlsYDorqHml7blmajljZXkvovvvJvkuI3lrZjlnKjliJnlkIzmraXliJvlu7rlubblvILmraXlrozmiJDmlbDmja7liqDovb0gLyDnu5HlrpogLyDlv6vnhafmjqjpgIHjgIJcbiAqIOW5guetie+8muS4u+eql+WPo+S4rSBBcHAudnVlIOWFiOihjOiwg+eUqOWQju+8jOinhuWbvuaLv+WIsOeahOaYr+WQjOS4gOWunuS+i+OAglxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlUG9tb2Rvcm9CcmlkZ2VTeW5jKCk6IFBvbW9kb3JvVGltZXIge1xuICBpZiAoIXRpbWVySW5zdGFuY2UpIHtcbiAgICB0aW1lckluc3RhbmNlID0gY3JlYXRlVGltZXIoKVxuICAgIC8vIGluc3RhbGxBc3luYyDlhoXpg6jmnIkgYXdhaXTvvIhwdXNoUHJvamVjdHNUb01haW4g562J77yJ77yM5aSx6LSl5b+F6aG75o6l5L2P77yaXG4gICAgLy8g5ZCm5YiZ5pyq5aSE55CGIHJlamVjdGlvbu+8jOS4lOWQjue7reW/q+eFp+aOqOmAgS/miqTnm77kuIrmiqXnmoQgd2F0Y2gg5YWo6YOo5LiN5rOo5YaM77yI6Z2Z6buY5aSx6IGU77yJXG4gICAgaW5zdGFsbEFzeW5jKHRpbWVySW5zdGFuY2UpLmNhdGNoKChlKSA9PiB7XG4gICAgICBjb25zb2xlLndhcm4oJ1twb21vZG9yby1icmlkZ2VdIGluc3RhbGwgZmFpbGVkOicsIGUpXG4gICAgfSlcbiAgfVxuICByZXR1cm4gdGltZXJJbnN0YW5jZVxufVxuXG5mdW5jdGlvbiBjcmVhdGVUaW1lcigpOiBQb21vZG9yb1RpbWVyIHtcbiAgY29uc3Qgc3RvcmUgPSB1c2VQb21vZG9yb1N0b3JlKClcblxuICBjb25zdCBzZXR0aW5ncyA9IGNvbXB1dGVkKFxuICAgICgpID0+XG4gICAgICBzdG9yZS5zZXR0aW5ncyA/PyB7XG4gICAgICAgIHdvcmtEdXJhdGlvbjogMjUsXG4gICAgICAgIHNob3J0QnJlYWtEdXJhdGlvbjogNSxcbiAgICAgICAgbG9uZ0JyZWFrRHVyYXRpb246IDE1LFxuICAgICAgICBsb25nQnJlYWtJbnRlcnZhbDogNCxcbiAgICAgICAgc291bmRFbmFibGVkOiB0cnVlLFxuICAgICAgICBub3RpZmljYXRpb25FbmFibGVkOiB0cnVlLFxuICAgICAgICBhdXRvU3RhcnRCcmVhazogZmFsc2UsXG4gICAgICAgIGF1dG9TdGFydFdvcms6IGZhbHNlXG4gICAgICB9XG4gIClcbiAgY29uc3QgdGFza3MgPSBjb21wdXRlZCgoKSA9PiBzdG9yZS50YXNrcylcbiAgY29uc3QgcHJvamVjdHMgPSBjb21wdXRlZCgoKSA9PiBzdG9yZS5wcm9qZWN0cylcbiAgY29uc3QgZWZmZWN0aXZlID0gY29tcHV0ZWQoKCkgPT4gc3RvcmUuZWZmZWN0aXZlU2V0dGluZ3Moc3RvcmUuZm9jdXNlZFByb2plY3RJZCA/PyAnJykpXG5cbiAgcmV0dXJuIHVzZU11bHRpUG9tb2Rvcm9UaW1lcih7XG4gICAgZ2xvYmFsU2V0dGluZ3M6ICgpID0+ICh7XG4gICAgICB3b3JrRHVyYXRpb246IGVmZmVjdGl2ZS52YWx1ZS53b3JrRHVyYXRpb24sXG4gICAgICBzaG9ydEJyZWFrRHVyYXRpb246IGVmZmVjdGl2ZS52YWx1ZS5zaG9ydEJyZWFrRHVyYXRpb24sXG4gICAgICBsb25nQnJlYWtEdXJhdGlvbjogZWZmZWN0aXZlLnZhbHVlLmxvbmdCcmVha0R1cmF0aW9uLFxuICAgICAgbG9uZ0JyZWFrSW50ZXJ2YWw6IHNldHRpbmdzLnZhbHVlLmxvbmdCcmVha0ludGVydmFsXG4gICAgfSksXG4gICAgZ2V0UHJvamVjdE92ZXJyaWRlczogKGlkKSA9PiBzdG9yZS5wcm9qZWN0U2V0dGluZ3NCeUlkKGlkKSxcbiAgICBvbkNvbXBsZXRlOiBhc3luYyAocGF5bG9hZCkgPT4ge1xuICAgICAgY29uc3QgdGFzayA9IHBheWxvYWQudGFza0J5SWQocGF5bG9hZC50YXNrSWQgPz8gJycpXG4gICAgICBhd2FpdCBzdG9yZS5hZGRSZWNvcmQoe1xuICAgICAgICB0YXNrSWQ6IHBheWxvYWQudGFza0lkID8/IHVuZGVmaW5lZCxcbiAgICAgICAgdGFza1RpdGxlOiB0YXNrPy50aXRsZSA/PyBwYXlsb2FkLnRhc2tUaXRsZSA/PyB1bmRlZmluZWQsXG4gICAgICAgIHByb2plY3RJZDogcGF5bG9hZC5wcm9qZWN0SWQsXG4gICAgICAgIHR5cGU6IHBheWxvYWQudHlwZSxcbiAgICAgICAgZHVyYXRpb246IHBheWxvYWQuZHVyYXRpb24sXG4gICAgICAgIGNvbXBsZXRlZEF0OiBEYXRlLm5vdygpXG4gICAgICB9KVxuICAgICAgaWYgKHNldHRpbmdzLnZhbHVlLnNvdW5kRW5hYmxlZCkgcGxheVNvdW5kKClcbiAgICAgIHNwZWFrKHNldHRpbmdzLCBwYXlsb2FkLnR5cGUgPT09ICd3b3JrJyA/ICfnlarojITlrozmiJDvvIzkvJHmga/kuIDkuIsnIDogJ+S8keaBr+e7k+adn++8jOe7p+e7reWKoOayuScpXG4gICAgICBpZiAoc2V0dGluZ3MudmFsdWUubm90aWZpY2F0aW9uRW5hYmxlZCkge1xuICAgICAgICBjb25zdCBtb2RlID0gc3RvcmUuaW50ZWdyYXRpb25Nb2RlXG4gICAgICAgIGlmIChtb2RlICE9PSAnc2lsZW50Jykge1xuICAgICAgICAgIGlmIChwYXlsb2FkLnR5cGUgPT09ICd3b3JrJykge1xuICAgICAgICAgICAgYXdhaXQgc3RvcmUubm90aWZ5SW50ZWdyYXRpb24oJ2NvbXBsZXRlJywgJ+aBreWWnOWujOaIkOS4gOS4queVquiMhOmSn++8gScpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF3YWl0IHN0b3JlLm5vdGlmeUludGVncmF0aW9uKCdicmVhaycsICfkvJHmga/ml7bpl7Tnu5PmnZ/vvIzlh4blpIflvIDlp4vlt6XkvZwnKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgbm90aWZ5OiBhc3luYyAoX3Byb2plY3RJZCwgZXZlbnQsIG1lc3NhZ2UpID0+IHtcbiAgICAgIGlmICghc2V0dGluZ3MudmFsdWUubm90aWZpY2F0aW9uRW5hYmxlZCkgcmV0dXJuXG4gICAgICBpZiAoc3RvcmUuaW50ZWdyYXRpb25Nb2RlID09PSAnc2lsZW50JykgcmV0dXJuXG4gICAgICBpZiAoZXZlbnQgPT09ICdzdGFydCcpIHtcbiAgICAgICAgLy8gZXZlbnQgPT09ICdzdGFydCcg5pe2IG1vZGUg5bey5Zyo5YmN5LiA5LiqIHNldE1vZGUgLyBjb21wbGV0ZUludGVybmFsIOS4reWumuWlve+8jFxuICAgICAgICAvLyDpgJrov4cgdGltZXIg5ou/55yf5a6eIG1vZGXvvIzogIzpnZ7lt7Lnu4/ov4fmnJ/miJbooqvopobnm5bnmoQgY3VycmVudE1vZGUgcmVmXG4gICAgICAgIGNvbnN0IHQgPSB0aW1lckluc3RhbmNlPy5mb2N1c2VkVGltZXIudmFsdWVcbiAgICAgICAgY29uc3QgbSA9IHQ/Lm1vZGUgPz8gJ3dvcmsnXG4gICAgICAgIGNvbnN0IG1vZGVUZXh0ID0gbSA9PT0gJ3dvcmsnID8gJ+W3peS9nCcgOiBtID09PSAnc2hvcnRCcmVhaycgPyAn55+t5LyR5oGvJyA6ICfplb/kvJHmga8nXG4gICAgICAgIGF3YWl0IHN0b3JlLm5vdGlmeUludGVncmF0aW9uKCdzdGFydCcsIG1lc3NhZ2UgPz8gYOW8gOWniyR7bW9kZVRleHR95pe26Ze0YClcbiAgICAgIH0gZWxzZSBpZiAoZXZlbnQgPT09ICdwYXVzZScpIHtcbiAgICAgICAgYXdhaXQgc3RvcmUubm90aWZ5SW50ZWdyYXRpb24oJ3BhdXNlJylcbiAgICAgIH1cbiAgICB9LFxuICAgIHRhc2tCeUlkOiAoaWQ6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgdCA9IHRhc2tzLnZhbHVlLmZpbmQoKHRhc2spID0+IHRhc2suaWQgPT09IGlkKVxuICAgICAgcmV0dXJuIHQgPyB7IHRpdGxlOiB0LnRpdGxlIH0gOiB1bmRlZmluZWRcbiAgICB9LFxuICAgIGRlZmF1bHRQcm9qZWN0SWQ6IHN0b3JlLmZvY3VzZWRQcm9qZWN0SWQgPz8gcHJvamVjdHMudmFsdWVbMF0/LmlkID8/ICcnLFxuICAgIHNob3VsZEF1dG9TdGFydDogKCkgPT4gKHtcbiAgICAgIGJyZWFrOiBzZXR0aW5ncy52YWx1ZS5hdXRvU3RhcnRCcmVhayxcbiAgICAgIHdvcms6IHNldHRpbmdzLnZhbHVlLmF1dG9TdGFydFdvcmtcbiAgICB9KSxcbiAgICBwZXJzaXN0OiAocHJvamVjdElkLCBzdGF0ZSkgPT4ge1xuICAgICAgLy8gY29tcG9zYWJsZSDlj6rlnKggaWRsZS9wYXVzZWQg5pe25Lya6LCD55So77yb5YaZ5ZueIHN0b3JlICsgSVBDXG4gICAgICBpZiAoIXByb2plY3RJZCkgcmV0dXJuXG4gICAgICB2b2lkIHN0b3JlLnBlcnNpc3RUaW1lclN0YXRlKHByb2plY3RJZCwgc3RhdGUpLmNhdGNoKCgpID0+IHt9KVxuICAgIH0sXG4gICAgLy8gUDAtMu+8mkZsb3d0aW1lIOato+iuoeaXtumjjuagvO+8iOS7heS9nOeUqOS6jiB3b3JrIOmYtuaute+8iVxuICAgIGlzRmxvd3RpbWU6ICgpID0+IChzdG9yZS5zZXR0aW5ncz8udGltZXJTdHlsZSA/PyAncG9tb2Rvcm8nKSA9PT0gJ2Zsb3d0aW1lJyxcbiAgICAvLyBQMS0077ya5Lil5qC85qih5byP77yId29yayDorqHml7bkuK3npoEg5pqC5YGcL+i3s+i/hy/ph43nva4v5YiH5qih5byP77yJXG4gICAgaXNTdHJpY3Q6ICgpID0+IHN0b3JlLnNldHRpbmdzPy5zdHJpY3RNb2RlID09PSB0cnVlLFxuICAgIC8vIFAxLTXvvJrpmLbmrrXkuLTov5HpooTorabvvIg2MHMgLyAzMHPvvIzmr4/pmLbmrrXmr4/pmIjlgLzkuIDmrKHvvIlcbiAgICBvbldhcm5pbmc6IGFzeW5jIChfcHJvamVjdElkLCBzZWNvbmRzTGVmdCkgPT4ge1xuICAgICAgaWYgKCFzZXR0aW5ncy52YWx1ZS5ub3RpZmljYXRpb25FbmFibGVkKSByZXR1cm5cbiAgICAgIGlmIChzdG9yZS5pbnRlZ3JhdGlvbk1vZGUgPT09ICdzaWxlbnQnKSByZXR1cm5cbiAgICAgIGNvbnN0IGxhYmVsID0gc2Vjb25kc0xlZnQgPD0gMzAgPyAnMzAg56eSJyA6ICcxIOWIhumSnydcbiAgICAgIGF3YWl0IHN0b3JlLm5vdGlmeUludGVncmF0aW9uKCdyZW1pbmQnLCBg5pys6Zi25q616L+Y5YmpICR7bGFiZWx977yM5YeG5aSH5pS25bC+YClcbiAgICAgIHNwZWFrKHNldHRpbmdzLCBg6L+Y5YmpJHtsYWJlbH1gKVxuICAgIH0sXG4gICAgLy8gUDEtNO+8muS4peagvOaooeW8j+Wksei0pe+8iOemu+W8gOeql+WPo++8ieaPkOekuuKAlOKAlFVJIOWxleekuuS6pOe7meiuoumYheaWue+8iOinhuWbvu+8iVxuICAgIG9uU3RyaWN0RmFpbDogKCkgPT4ge1xuICAgICAgZm9yIChjb25zdCBjYiBvZiBzdHJpY3RGYWlsTGlzdGVuZXJzKSBjYigpXG4gICAgfVxuICB9KVxufVxuXG5hc3luYyBmdW5jdGlvbiBpbnN0YWxsQXN5bmModGltZXI6IFBvbW9kb3JvVGltZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc3RvcmUgPSB1c2VQb21vZG9yb1N0b3JlKClcblxuICAvLyDilIDilIAg5pWw5o2u5Yqg6L29ICsg5oyB5LmF5YyW6K6h5pe25oGi5aSN77yI5Y6f6KeG5Zu+IGxvYWREYXRh77yJ4pSA4pSAXG4gIGF3YWl0IHN0b3JlLmxvYWQoKVxuICBjb25zdCBhbGxTdGF0ZXMgPSBzdG9yZS50aW1lclN0YXRlcyB8fCB7fVxuICBmb3IgKGNvbnN0IFtwcm9qZWN0SWQsIHNuYXBdIG9mIE9iamVjdC5lbnRyaWVzKGFsbFN0YXRlcykpIHtcbiAgICB0aW1lci5yZXN0b3JlUGVyc2lzdGVkKHByb2plY3RJZCwgc25hcClcbiAgfVxuICB0aW1lci5zdGFydEFsbCgpXG4gIGlmIChzdG9yZS5mb2N1c2VkUHJvamVjdElkKSB7XG4gICAgdGltZXIuZm9jdXMoc3RvcmUuZm9jdXNlZFByb2plY3RJZClcbiAgfVxuXG4gIC8vIOKUgOKUgCDpm4bmiJDnu5HlrprvvIjljp/op4blm74gb25Nb3VudGVk77yJ4pSA4pSAXG4gIGF3YWl0IHN0b3JlLmxvYWRJbnRlZ3JhdGlvbigpXG4gIHN0b3JlLmJpbmRTaG9ydGN1dExpc3RlbmVyKCh7IGFjdGlvbiB9KSA9PiB7XG4gICAgaWYgKGFjdGlvbiA9PT0gJ3RvZ2dsZScpIHRpbWVyLnRvZ2dsZSgpXG4gICAgZWxzZSBpZiAoYWN0aW9uID09PSAnc2tpcCcpIHZvaWQgdGltZXIuc2tpcCgpXG4gICAgZWxzZSB0aW1lci5yZXNldCgpXG4gIH0pXG4gIHN0b3JlLmJpbmRGb2N1c1Byb2plY3RMaXN0ZW5lcigoeyBwcm9qZWN0SWQgfSkgPT4ge1xuICAgIGlmICghcHJvamVjdElkIHx8IHByb2plY3RJZCA9PT0gc3RvcmUuZm9jdXNlZFByb2plY3RJZCkgcmV0dXJuXG4gICAgc3RvcmUuc2V0Rm9jdXNlZFByb2plY3QocHJvamVjdElkKVxuICAgIHRpbWVyLmZvY3VzKHByb2plY3RJZClcbiAgfSlcbiAgYXdhaXQgc3RvcmUucHVzaFByb2plY3RzVG9NYWluKClcblxuICAvLyDnhKbngrnpobnnm67lkIzmraXvvJpzdG9yZSDihpIgdGltZXLvvIjljp/op4blm74gd2F0Y2jvvIlcbiAgd2F0Y2goXG4gICAgKCkgPT4gc3RvcmUuZm9jdXNlZFByb2plY3RJZCxcbiAgICAoaWQpID0+IHtcbiAgICAgIGlmIChpZCkgdGltZXIuZm9jdXMoaWQpXG4gICAgfVxuICApXG5cbiAgLy8g4pSA4pSAIHRyYXkg5b+r54Wn5o6o6YCB77yI5Y6f6KeG5Zu+IHdhdGNoZXJzICsgcHVzaFRyYXlTbmFwc2hvdFNhZmXvvInilIDilIBcbiAgY29uc3QgZm9jdXNlZFRpbWVyU3RhdGUgPSBjb21wdXRlZCgoKSA9PiB0aW1lci5mb2N1c2VkVGltZXIudmFsdWUpXG4gIGNvbnN0IGN1cnJlbnRNb2RlID0gY29tcHV0ZWQoKCkgPT4gZm9jdXNlZFRpbWVyU3RhdGUudmFsdWU/Lm1vZGUgPz8gJ3dvcmsnKVxuICBjb25zdCBpc1J1bm5pbmcgPSBjb21wdXRlZCgoKSA9PiAoZm9jdXNlZFRpbWVyU3RhdGUudmFsdWU/LnN0YXR1cyA/PyAnaWRsZScpID09PSAncnVubmluZycpXG4gIGNvbnN0IHRpbWVMZWZ0ID0gY29tcHV0ZWQoKCkgPT4gZm9jdXNlZFRpbWVyU3RhdGUudmFsdWU/LnRpbWVMZWZ0ID8/IDApXG4gIGNvbnN0IGN1cnJlbnRUYXNrSWQgPSBjb21wdXRlZCgoKSA9PiBmb2N1c2VkVGltZXJTdGF0ZS52YWx1ZT8uY3VycmVudFRhc2tJZCA/PyBudWxsKVxuICBjb25zdCBpc1NwZWNpYWxCcmVhayA9IGNvbXB1dGVkKCgpID0+IGZvY3VzZWRUaW1lclN0YXRlLnZhbHVlPy5zcGVjaWFsQnJlYWsgPT09IHRydWUpXG4gIGNvbnN0IGlzRmxvd3RpbWUgPSBjb21wdXRlZCgoKSA9PiAoc3RvcmUuc2V0dGluZ3M/LnRpbWVyU3R5bGUgPz8gJ3BvbW9kb3JvJykgPT09ICdmbG93dGltZScpXG4gIGNvbnN0IGZsb3d0aW1lV29yayA9IGNvbXB1dGVkKCgpID0+IGlzRmxvd3RpbWUudmFsdWUgJiYgY3VycmVudE1vZGUudmFsdWUgPT09ICd3b3JrJylcbiAgY29uc3QgZWZmZWN0aXZlID0gY29tcHV0ZWQoKCkgPT4gc3RvcmUuZWZmZWN0aXZlU2V0dGluZ3Moc3RvcmUuZm9jdXNlZFByb2plY3RJZCA/PyAnJykpXG4gIGNvbnN0IGR1cmF0aW9uID0gY29tcHV0ZWQoKCkgPT4ge1xuICAgIGlmIChmbG93dGltZVdvcmsudmFsdWUpIHJldHVybiAwXG4gICAgaWYgKGlzU3BlY2lhbEJyZWFrLnZhbHVlKSByZXR1cm4gZm9jdXNlZFRpbWVyU3RhdGUudmFsdWU/LnNwZWNpYWxCcmVha1RvdGFsU2VjID8/IDBcbiAgICBpZiAoY3VycmVudE1vZGUudmFsdWUgPT09ICd3b3JrJykgcmV0dXJuIGVmZmVjdGl2ZS52YWx1ZS53b3JrRHVyYXRpb24gKiA2MFxuICAgIGlmIChjdXJyZW50TW9kZS52YWx1ZSA9PT0gJ3Nob3J0QnJlYWsnKSByZXR1cm4gZWZmZWN0aXZlLnZhbHVlLnNob3J0QnJlYWtEdXJhdGlvbiAqIDYwXG4gICAgcmV0dXJuIGVmZmVjdGl2ZS52YWx1ZS5sb25nQnJlYWtEdXJhdGlvbiAqIDYwXG4gIH0pXG4gIGNvbnN0IGN1cnJlbnRUYXNrID0gY29tcHV0ZWQoKCkgPT4ge1xuICAgIGNvbnN0IGlkID0gY3VycmVudFRhc2tJZC52YWx1ZVxuICAgIGlmICghaWQpIHJldHVybiBudWxsXG4gICAgcmV0dXJuIHN0b3JlLnRhc2tzLmZpbmQoKHQpID0+IHQuaWQgPT09IGlkKSA/PyBudWxsXG4gIH0pXG5cbiAgYXN5bmMgZnVuY3Rpb24gcHVzaFNuYXBzaG90KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjdXJyZW50VGFza1RpdGxlID0gY3VycmVudFRhc2sudmFsdWU/LnRpdGxlID8/ICcnXG4gICAgICBjb25zdCBmb2N1c2VkUHJvamVjdE5hbWUgPVxuICAgICAgICBzdG9yZS5wcm9qZWN0cy5maW5kKChwKSA9PiBwLmlkID09PSBzdG9yZS5mb2N1c2VkUHJvamVjdElkKT8ubmFtZSA/PyAnJ1xuICAgICAgY29uc3QgYmFja2dyb3VuZCA9IHRpbWVyXG4gICAgICAgIC5hY3RpdmVQcm9qZWN0cygpXG4gICAgICAgIC5maWx0ZXIoKHMpID0+IHMucHJvamVjdElkICE9PSB0aW1lci5mb2N1c2VkUHJvamVjdElkLnZhbHVlKVxuICAgICAgICAubWFwKChzKSA9PiB7XG4gICAgICAgICAgY29uc3QgcHJvamVjdCA9IHN0b3JlLnByb2plY3RzLmZpbmQoKHApID0+IHAuaWQgPT09IHMucHJvamVjdElkKVxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpZDogcy5wcm9qZWN0SWQsXG4gICAgICAgICAgICBuYW1lOiBwcm9qZWN0Py5uYW1lID8/ICfpobnnm64nLFxuICAgICAgICAgICAgdGltZUxlZnRTZWNvbmRzOiBzLnRpbWVMZWZ0LFxuICAgICAgICAgICAgbW9kZTogcy5tb2RlXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgYXdhaXQgc3RvcmUucHVzaFRyYXlTbmFwc2hvdCh7XG4gICAgICAgIGlzUnVubmluZzogaXNSdW5uaW5nLnZhbHVlLFxuICAgICAgICBjdXJyZW50TW9kZTogY3VycmVudE1vZGUudmFsdWUsXG4gICAgICAgIHRhc2tUaXRsZTogY3VycmVudFRhc2tUaXRsZSxcbiAgICAgICAgdGltZUxlZnRTZWNvbmRzOiB0aW1lTGVmdC52YWx1ZSxcbiAgICAgICAgdG90YWxTZWNvbmRzOiBkdXJhdGlvbi52YWx1ZSxcbiAgICAgICAgdG9kYXlDb21wbGV0ZWQ6IHN0b3JlLnN0YXRpc3RpY3M/LnRvZGF5LndvcmsgPz8gMCxcbiAgICAgICAgcHJvamVjdElkOiBzdG9yZS5mb2N1c2VkUHJvamVjdElkLFxuICAgICAgICBwcm9qZWN0TmFtZTogZm9jdXNlZFByb2plY3ROYW1lLFxuICAgICAgICBiYWNrZ3JvdW5kUHJvamVjdHM6IGJhY2tncm91bmRcbiAgICAgIH0pXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbcG9tb2Rvcm8tYnJpZGdlXSBwdXNoVHJheVNuYXBzaG90IGZhaWxlZDonLCBlcnIpXG4gICAgfVxuICB9XG5cbiAgbGV0IGxhc3RTbmFwc2hvdFB1c2ggPSAwXG4gIHdhdGNoKFtpc1J1bm5pbmcsIGN1cnJlbnRNb2RlLCBjdXJyZW50VGFza0lkLCAoKSA9PiBzdG9yZS5zdGF0aXN0aWNzPy50b2RheS53b3JrID8/IDBdLCAoKSA9PiB7XG4gICAgbGFzdFNuYXBzaG90UHVzaCA9IDBcbiAgICB2b2lkIHB1c2hTbmFwc2hvdCgpXG4gIH0pXG4gIHdhdGNoKHRpbWVMZWZ0LCAoKSA9PiB7XG4gICAgLy8gdGltZUxlZnQg5q+P56eS5Y+Y5YyW77yM6IqC5rWB5o6o6YCB77yI5pyA5aSaIDUg56eS5LiA5qyh77yJXG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKVxuICAgIGlmIChub3cgLSBsYXN0U25hcHNob3RQdXNoIDwgNTAwMCkgcmV0dXJuXG4gICAgbGFzdFNuYXBzaG90UHVzaCA9IG5vd1xuICAgIHZvaWQgcHVzaFNuYXBzaG90KClcbiAgfSlcbiAgLy8g5LiT5rOo5oqk55u+77ya5bel5L2c6K6h5pe26L+b6KGM5Lit5LiK5oql77yI5Li76L+b56iL5o2u5q2k5ZCv5Yqo5YmN5Y+w5bqU55So5bGP6JS95qOA5rWL77yJXG4gIHdhdGNoKFxuICAgIFtpc1J1bm5pbmcsIGN1cnJlbnRNb2RlXSxcbiAgICAoW3J1bm5pbmcsIG1vZGVdKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICB2b2lkIHdpbmRvdy5hcGkuZm9jdXNTaGllbGQuc2V0QWN0aXZlKHJ1bm5pbmcgJiYgbW9kZSA9PT0gJ3dvcmsnKVxuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8qIOmAmumBk+S4jeWPr+eUqOaXtumdmem7mO+8iOiAgSBwcmVsb2FkIC8g6Z2e5Li756qX5Y+j77yJICovXG4gICAgICB9XG4gICAgfSxcbiAgICB7IGltbWVkaWF0ZTogdHJ1ZSB9XG4gIClcbiAgYXdhaXQgcHVzaFNuYXBzaG90KClcbn1cblxuZnVuY3Rpb24gc3BlYWsoc2V0dGluZ3M6IHsgdmFsdWU6IHsgdm9pY2VFbmFibGVkPzogYm9vbGVhbiB9IH0sIHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICBpZiAoIXNldHRpbmdzLnZhbHVlLnZvaWNlRW5hYmxlZCkgcmV0dXJuXG4gIGlmICghKCdzcGVlY2hTeW50aGVzaXMnIGluIHdpbmRvdykpIHJldHVyblxuICB0cnkge1xuICAgIGNvbnN0IHUgPSBuZXcgU3BlZWNoU3ludGhlc2lzVXR0ZXJhbmNlKHRleHQpXG4gICAgdS5sYW5nID0gJ3poLUNOJ1xuICAgIHdpbmRvdy5zcGVlY2hTeW50aGVzaXMuc3BlYWsodSlcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS53YXJuKCdbcG9tb2Rvcm8tYnJpZGdlXSBzcGVhayBmYWlsZWQ6JywgZXJyKVxuICB9XG59XG5cbmZ1bmN0aW9uIHBsYXlTb3VuZCgpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhdWRpb0NvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KClcbiAgICBjb25zdCBvc2NpbGxhdG9yID0gYXVkaW9Db250ZXh0LmNyZWF0ZU9zY2lsbGF0b3IoKVxuICAgIGNvbnN0IGdhaW5Ob2RlID0gYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKVxuXG4gICAgb3NjaWxsYXRvci5jb25uZWN0KGdhaW5Ob2RlKVxuICAgIGdhaW5Ob2RlLmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKVxuXG4gICAgb3NjaWxsYXRvci5mcmVxdWVuY3kudmFsdWUgPSA4MDBcbiAgICBvc2NpbGxhdG9yLnR5cGUgPSAnc2luZSdcblxuICAgIGdhaW5Ob2RlLmdhaW4uc2V0VmFsdWVBdFRpbWUoMC4zLCBhdWRpb0NvbnRleHQuY3VycmVudFRpbWUpXG4gICAgZ2Fpbk5vZGUuZ2Fpbi5leHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lKDAuMDEsIGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZSArIDAuNSlcblxuICAgIG9zY2lsbGF0b3Iuc3RhcnQoYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lKVxuICAgIG9zY2lsbGF0b3Iuc3RvcChhdWRpb0NvbnRleHQuY3VycmVudFRpbWUgKyAwLjUpXG4gICAgLy8g5pKt5pS+5a6M5q+V5ZCO5YWz6ZetIEF1ZGlvQ29udGV4dO+8jOmBv+WFjeazhOa8j1xuICAgIG9zY2lsbGF0b3Iub25lbmRlZCA9ICgpID0+IHtcbiAgICAgIHZvaWQgYXVkaW9Db250ZXh0LmNsb3NlKCkuY2F0Y2goKCkgPT4ge30pXG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbcG9tb2Rvcm8tYnJpZGdlXSBwbGF5U291bmQgZmFpbGVkOicsIGVycilcbiAgfVxufVxuIl0sIm1hcHBpbmdzIjoiQUFhQSxTQUFTLFVBQVUsYUFBYTtBQUNoQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDZCQUE2QjtBQUl0QyxJQUFJLGdCQUFzQztBQUMxQyxNQUFNLHNCQUFzQixvQkFBSSxJQUFnQjtBQUd6QyxnQkFBUyxvQkFBb0IsSUFBNEI7QUFDOUQsc0JBQW9CLElBQUksRUFBRTtBQUMxQixTQUFPLE1BQU0sb0JBQW9CLE9BQU8sRUFBRTtBQUM1QztBQU1PLGdCQUFTLDJCQUEwQztBQUN4RCxNQUFJLENBQUMsZUFBZTtBQUNsQixvQkFBZ0IsWUFBWTtBQUc1QixpQkFBYSxhQUFhLEVBQUUsTUFBTSxDQUFDLE1BQU07QUFDdkMsY0FBUSxLQUFLLHFDQUFxQyxDQUFDO0FBQUEsSUFDckQsQ0FBQztBQUFBLEVBQ0g7QUFDQSxTQUFPO0FBQ1Q7QUFFQSxTQUFTLGNBQTZCO0FBQ3BDLFFBQU0sUUFBUSxpQkFBaUI7QUFF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
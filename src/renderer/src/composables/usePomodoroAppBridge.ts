/**
 * Frond · 番茄钟应用级桥（IA v2 阶段A：胶囊「开始专注」内联页的前置）
 *
 * 把原视图层的「计时器实例 + 全局快捷键绑定 + tray 快照推送」下沉为 app 级单例：
 * - 主窗口任意路由下计时器都在跑（⌘⇧P 全局可用，托盘 / 迷你窗 / 胶囊专注页实时快照）
 * - 胶囊 FocusPage 经 integration 快照通道展示状态，经 dispatchShortcut 远程操控
 *
 * 初始化约定：
 * - App.vue 在主窗口挂载时调用 ensurePomodoroBridgeSync()（isPrimaryWindow 判定，
 *   避免 mini / pin / 截图等窗口重复创建计时器实例）
 * - 番茄钟视图 setup 也调用它取同一个单例（幂等）；dock 开出的独立 /pomodoro
 *   窗口会得到自己的局部实例，与改造前「视图级实例」行为一致
 */
import { computed, watch } from 'vue'
import { usePomodoroStore } from '../stores/pomodoro'
import { useMultiPomodoroTimer } from '../views/pomodoro/composables/useMultiPomodoroTimer'

type PomodoroTimer = ReturnType<typeof useMultiPomodoroTimer>

let timerInstance: PomodoroTimer | null = null
const strictFailListeners = new Set<() => void>()

/** 严格模式失败（离开窗口）提示的订阅，视图用它在自己的 UI 上展示 hint */
export function subscribeStrictFail(cb: () => void): () => void {
  strictFailListeners.add(cb)
  return () => strictFailListeners.delete(cb)
}

/**
 * 取全局计时器单例；不存在则同步创建并异步完成数据加载 / 绑定 / 快照推送。
 * 幂等：主窗口中 App.vue 先行调用后，视图拿到的是同一实例。
 */
export function ensurePomodoroBridgeSync(): PomodoroTimer {
  if (!timerInstance) {
    timerInstance = createTimer()
    // installAsync 内部有 await（pushProjectsToMain 等），失败必须接住：
    // 否则未处理 rejection，且后续快照推送/护盾上报的 watch 全部不注册（静默失联）
    installAsync(timerInstance).catch((e) => {
      console.warn('[pomodoro-bridge] install failed:', e)
    })
  }
  return timerInstance
}

function createTimer(): PomodoroTimer {
  const store = usePomodoroStore()

  const settings = computed(
    () =>
      store.settings ?? {
        workDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        longBreakInterval: 4,
        soundEnabled: true,
        notificationEnabled: true,
        autoStartBreak: false,
        autoStartWork: false
      }
  )
  const tasks = computed(() => store.tasks)
  const projects = computed(() => store.projects)
  const effective = computed(() => store.effectiveSettings(store.focusedProjectId ?? ''))

  return useMultiPomodoroTimer({
    globalSettings: () => ({
      workDuration: effective.value.workDuration,
      shortBreakDuration: effective.value.shortBreakDuration,
      longBreakDuration: effective.value.longBreakDuration,
      longBreakInterval: settings.value.longBreakInterval
    }),
    getProjectOverrides: (id) => store.projectSettingsById(id),
    onComplete: async (payload) => {
      const task = payload.taskById(payload.taskId ?? '')
      await store.addRecord({
        taskId: payload.taskId ?? undefined,
        taskTitle: task?.title ?? payload.taskTitle ?? undefined,
        projectId: payload.projectId,
        type: payload.type,
        duration: payload.duration,
        completedAt: Date.now()
      })
      if (settings.value.soundEnabled) playSound()
      speak(settings, payload.type === 'work' ? '番茄完成，休息一下' : '休息结束，继续加油')
      if (settings.value.notificationEnabled) {
        const mode = store.integrationMode
        if (mode !== 'silent') {
          if (payload.type === 'work') {
            await store.notifyIntegration('complete', '恭喜完成一个番茄钟！')
          } else {
            await store.notifyIntegration('break', '休息时间结束，准备开始工作')
          }
        }
      }
    },
    notify: async (_projectId, event, message) => {
      if (!settings.value.notificationEnabled) return
      if (store.integrationMode === 'silent') return
      if (event === 'start') {
        // event === 'start' 时 mode 已在前一个 setMode / completeInternal 中定好，
        // 通过 timer 拿真实 mode，而非已经过期或被覆盖的 currentMode ref
        const t = timerInstance?.focusedTimer.value
        const m = t?.mode ?? 'work'
        const modeText = m === 'work' ? '工作' : m === 'shortBreak' ? '短休息' : '长休息'
        await store.notifyIntegration('start', message ?? `开始${modeText}时间`)
      } else if (event === 'pause') {
        await store.notifyIntegration('pause')
      }
    },
    taskById: (id: string) => {
      const t = tasks.value.find((task) => task.id === id)
      return t ? { title: t.title } : undefined
    },
    defaultProjectId: store.focusedProjectId ?? projects.value[0]?.id ?? '',
    shouldAutoStart: () => ({
      break: settings.value.autoStartBreak,
      work: settings.value.autoStartWork
    }),
    persist: (projectId, state) => {
      // composable 只在 idle/paused 时会调用；写回 store + IPC
      if (!projectId) return
      void store.persistTimerState(projectId, state).catch(() => {})
    },
    // P0-2：Flowtime 正计时风格（仅作用于 work 阶段）
    isFlowtime: () => (store.settings?.timerStyle ?? 'pomodoro') === 'flowtime',
    // P1-4：严格模式（work 计时中禁 暂停/跳过/重置/切模式）
    isStrict: () => store.settings?.strictMode === true,
    // P1-5：阶段临近预警（60s / 30s，每阶段每阈值一次）
    onWarning: async (_projectId, secondsLeft) => {
      if (!settings.value.notificationEnabled) return
      if (store.integrationMode === 'silent') return
      const label = secondsLeft <= 30 ? '30 秒' : '1 分钟'
      await store.notifyIntegration('remind', `本阶段还剩 ${label}，准备收尾`)
      speak(settings, `还剩${label}`)
    },
    // P1-4：严格模式失败（离开窗口）提示——UI 展示交给订阅方（视图）
    onStrictFail: () => {
      for (const cb of strictFailListeners) cb()
    }
  })
}

async function installAsync(timer: PomodoroTimer): Promise<void> {
  const store = usePomodoroStore()

  // ── 数据加载 + 持久化计时恢复（原视图 loadData）──
  await store.load()
  const allStates = store.timerStates || {}
  for (const [projectId, snap] of Object.entries(allStates)) {
    timer.restorePersisted(projectId, snap)
  }
  timer.startAll()
  if (store.focusedProjectId) {
    timer.focus(store.focusedProjectId)
  }

  // ── 集成绑定（原视图 onMounted）──
  await store.loadIntegration()
  store.bindShortcutListener(({ action }) => {
    if (action === 'toggle') timer.toggle()
    else if (action === 'skip') void timer.skip()
    else timer.reset()
  })
  store.bindFocusProjectListener(({ projectId }) => {
    if (!projectId || projectId === store.focusedProjectId) return
    store.setFocusedProject(projectId)
    timer.focus(projectId)
  })
  await store.pushProjectsToMain()

  // 焦点项目同步：store → timer（原视图 watch）
  watch(
    () => store.focusedProjectId,
    (id) => {
      if (id) timer.focus(id)
    }
  )

  // ── tray 快照推送（原视图 watchers + pushTraySnapshotSafe）──
  const focusedTimerState = computed(() => timer.focusedTimer.value)
  const currentMode = computed(() => focusedTimerState.value?.mode ?? 'work')
  const isRunning = computed(() => (focusedTimerState.value?.status ?? 'idle') === 'running')
  const timeLeft = computed(() => focusedTimerState.value?.timeLeft ?? 0)
  const currentTaskId = computed(() => focusedTimerState.value?.currentTaskId ?? null)
  const isSpecialBreak = computed(() => focusedTimerState.value?.specialBreak === true)
  const isFlowtime = computed(() => (store.settings?.timerStyle ?? 'pomodoro') === 'flowtime')
  const flowtimeWork = computed(() => isFlowtime.value && currentMode.value === 'work')
  const effective = computed(() => store.effectiveSettings(store.focusedProjectId ?? ''))
  const duration = computed(() => {
    if (flowtimeWork.value) return 0
    if (isSpecialBreak.value) return focusedTimerState.value?.specialBreakTotalSec ?? 0
    if (currentMode.value === 'work') return effective.value.workDuration * 60
    if (currentMode.value === 'shortBreak') return effective.value.shortBreakDuration * 60
    return effective.value.longBreakDuration * 60
  })
  const currentTask = computed(() => {
    const id = currentTaskId.value
    if (!id) return null
    return store.tasks.find((t) => t.id === id) ?? null
  })

  async function pushSnapshot(): Promise<void> {
    try {
      const currentTaskTitle = currentTask.value?.title ?? ''
      const focusedProjectName =
        store.projects.find((p) => p.id === store.focusedProjectId)?.name ?? ''
      const background = timer
        .activeProjects()
        .filter((s) => s.projectId !== timer.focusedProjectId.value)
        .map((s) => {
          const project = store.projects.find((p) => p.id === s.projectId)
          return {
            id: s.projectId,
            name: project?.name ?? '项目',
            timeLeftSeconds: s.timeLeft,
            mode: s.mode
          }
        })
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
      })
    } catch (err) {
      console.error('[pomodoro-bridge] pushTraySnapshot failed:', err)
    }
  }

  let lastSnapshotPush = 0
  watch([isRunning, currentMode, currentTaskId, () => store.statistics?.today.work ?? 0], () => {
    lastSnapshotPush = 0
    void pushSnapshot()
  })
  watch(timeLeft, () => {
    // timeLeft 每秒变化，节流推送（最多 5 秒一次）
    const now = Date.now()
    if (now - lastSnapshotPush < 5000) return
    lastSnapshotPush = now
    void pushSnapshot()
  })
  // 专注护盾：工作计时进行中上报（主进程据此启动前台应用屏蔽检测）
  watch(
    [isRunning, currentMode],
    ([running, mode]) => {
      try {
        void window.api.focusShield.setActive(running && mode === 'work')
      } catch {
        /* 通道不可用时静默（老 preload / 非主窗口） */
      }
    },
    { immediate: true }
  )
  await pushSnapshot()
}

function speak(settings: { value: { voiceEnabled?: boolean } }, text: string): void {
  if (!settings.value.voiceEnabled) return
  if (!('speechSynthesis' in window)) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    window.speechSynthesis.speak(u)
  } catch (err) {
    console.warn('[pomodoro-bridge] speak failed:', err)
  }
}

function playSound(): void {
  try {
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
    // 播放完毕后关闭 AudioContext，避免泄漏
    oscillator.onended = () => {
      void audioContext.close().catch(() => {})
    }
  } catch (err) {
    console.error('[pomodoro-bridge] playSound failed:', err)
  }
}

const detail = computed(() => store.taskDetail)
const summary = computed(() => store.taskDetail?.summary ?? null)
const records = computed(() => store.taskDetail?.records ?? [])
const freeRecords = computed(() => store.freeRecords)
const taskDetailLoading = computed(() => store.taskDetailLoading)
const selectedRecordId = computed(() => store.selectedRecordId)

const lastExportMessage = ref<string | null>(null)
const lastExportOk = ref(false)

watch(
  () => [props.open, props.taskId] as const,
  async ([isOpen, id]) => {
    if (isOpen && id) {
      await store.openTaskDetail(id)
    } else if (!isOpen) {
      store.closeTaskDetail()
    }
  },
  { immediate: true }
)

function close(): void {
  emit('close')
}

function goScreenshotView(): void {
  window.location.hash = '#/screenshot'
}

function goRecordingView(): void {
  // 路由表中录屏模块是 /screenRecorder（#/recording 不存在 → 主内容区空白）
  window.location.hash = '#/screenRecorder'
}

function selectRecord(id: string): void {
  store.loadRecordDetail(id)
}

function modeLabel(type: 'work' | 'shortBreak' | 'longBreak'): string {

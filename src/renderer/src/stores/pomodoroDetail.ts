import { ref } from 'vue'
import type { PomodoroRecordDetail, PomodoroTaskDetail } from './pomodoroTypes'

/**
 * Frond · 番茄钟任务/记录详情域（B60 批C 从 stores/pomodoro.ts 拆出）
 *
 * 拆分动因：sourceSizeRatchet（>1000 行先拆再写）。本域自洽——只依赖
 * pomodoro:* IPC 与自身状态；主 store 以同名解构透出，消费方无感。
 * lastError 归主 store 所有，经 onError 回调写入。
 */
export function usePomodoroDetail(onError: (message: string) => void) {
  const taskDetailId = ref<string | null>(null)
  const taskDetail = ref<PomodoroTaskDetail | null>(null)
  const taskDetailLoading = ref(false)
  const selectedRecordId = ref<string | null>(null)
  const recordDetail = ref<PomodoroRecordDetail | null>(null)

  async function openTaskDetail(taskId: string): Promise<void> {
    taskDetailId.value = taskId
    taskDetail.value = null
    selectedRecordId.value = null
    recordDetail.value = null
    taskDetailLoading.value = true
    onError('')
    try {
      const detail = (await window.api.pomodoro.task.detail(taskId)) as PomodoroTaskDetail | null
      if (taskDetailId.value === taskId) {
        taskDetail.value = detail
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
      console.error('[pomodoro store] openTaskDetail failed:', err)
    } finally {
      if (taskDetailId.value === taskId) {
        taskDetailLoading.value = false
      }
    }
  }

  function closeTaskDetail(): void {
    taskDetailId.value = null
    taskDetail.value = null
    selectedRecordId.value = null
    recordDetail.value = null
    taskDetailLoading.value = false
  }

  async function loadRecordDetail(recordId: string): Promise<void> {
    selectedRecordId.value = recordId
    recordDetail.value = null
    try {
      const detail = (await window.api.pomodoro.record.get(recordId)) as PomodoroRecordDetail | null
      if (selectedRecordId.value === recordId) {
        recordDetail.value = detail
      }
    } catch (err) {
      console.error('[pomodoro store] loadRecordDetail failed:', err)
    }
  }

  /** B60-12：收起单番茄详情面板——此前抽屉里写的是死变量 selectedRecordIdLocal */
  function closeRecordDetail(): void {
    selectedRecordId.value = null
    recordDetail.value = null
  }

  async function saveRecordNote(recordId: string, note: string): Promise<void> {
    try {
      const updated = await window.api.pomodoro.record.updateNote(recordId, note)
      if (updated && taskDetail.value) {
        taskDetail.value = {
          ...taskDetail.value,
          records: taskDetail.value.records.map((r) => (r.id === recordId ? updated : r))
        }
      }
      if (updated && recordDetail.value?.record.id === recordId) {
        recordDetail.value = { ...recordDetail.value, record: updated }
      }
    } catch (err) {
      console.error('[pomodoro store] saveRecordNote failed:', err)
      throw err
    }
  }

  return {
    taskDetailId,
    taskDetail,
    taskDetailLoading,
    selectedRecordId,
    recordDetail,
    openTaskDetail,
    closeTaskDetail,
    loadRecordDetail,
    closeRecordDetail,
    saveRecordNote
  }
}

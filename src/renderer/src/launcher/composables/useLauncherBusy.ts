/**
 * Leaf · 胶囊统一加载态（UI 对标 I9，Raycast isLoading 语义）
 *
 * 模块级共享忙碌计数：内联页慢路径（剪贴板读取/日程拉取/OCR 索引…）
 * begin/end 成对调用，LauncherApp 在 busyCount > 0 时于胶囊顶部渲染不确定进度条。
 */

import { ref, type Ref } from 'vue'

const busyCount = ref(0)

export function beginBusy(): void {
  busyCount.value++
}

export function endBusy(): void {
  busyCount.value = Math.max(0, busyCount.value - 1)
}

export function useLauncherBusy(): {
  busyCount: Ref<number>
  beginBusy: () => void
  endBusy: () => void
} {
  return { busyCount, beginBusy, endBusy }
}

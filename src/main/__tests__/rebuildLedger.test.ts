/**
 * Frond · 重建件台账门禁
 *
 * 背景：2026-09-23 的删除事故后，有一批文件是「照调用点猜出来的」——它们与原件
 * 长得一样，但行为细节是推断的。HANDOFF §10.6 原话：「只按调用方契约对齐过，
 * 没逐字还原过，行为细节可能是我猜的」，并且明确「没跟事故前画面对过」。
 * 这些文件散布在插件运行时、番茄钟、录屏剪辑等核心路径上，任何一处猜错，
 * 用户都会直接看到。
 *
 * 问题在于：这份台账此前**只存在于 HANDOFF 文档里**，于是必然漂 ——
 * 文档标题写着 37（含已随 §11 删除的截图批），实测是 34。
 *
 * 本文件把台账变成可执行的门禁：
 *   1. 数量精确等于 34 —— 新增或删除重建件都必须显式改这里，不许静默漂
 *   2. 34 个已知路径逐个存在 —— 防止「删一个、误标一个」把数量凑回 34
 *   3. 每个文件都带「2026-09-2X 重建」标记 —— 标记丢了，后来者就会当原件信
 *
 * ⚠ 重建件 ≠ 坏代码。它们只是「未验证的推断」，所以改动时要比改普通文件更谨慎。
 * 这个台账的作用是让这件事在 review 时**可见**，而不是禁止改动。
 *
 * 后续逐条补判别性断言的顺序（HANDOFF §10.6，按「一旦猜错就用户立刻看得见」）：
 *   第一梯队 —— 录屏剪辑：ClipEditor / ClipTimeline / ExportDialog / PreviewPanel
 *   第二梯队 —— 番茄钟 7 件组件（TimerRing / ModeSelector / FocusRecordPanel /
 *              TaskListPanel / TaskEditDialog / SettingsDialog / FocusAssets）
 *   第三梯队 —— 迁移与设置类页面：MigrationCenterView / SourceSelector 等
 * 注：录屏那一梯队的「数据链路」已由 e2e/recording-clip.spec.mjs 覆盖；
 * 这里要补的是**渲染件本身**（时间轴非空、导出对话框默认参数等 UI 断言）。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC_DIR = join(__dirname, '..', '..')

/**
 * 标记格式：`2026-09-2X 重建件（…）` 或 `2026-09-2X 重建：…`，两种写法都算。
 * 注意：这里刻意用占位 `2X` 而不是具体日期——写全了就会命中本文件自己的正则，
 * 让「重建件计数」多出一个（本文件不是重建件，是台账本身）。
 */
const REBUILD_MARKER = /2026-09-2[23]\s*重建/

/**
 * 34 个重建件的权威清单（相对 src/）。
 * 这份清单就是「台账」，加一个或删一个都必须同时改上面的数字断言。
 */
const KNOWN_REBUILD_FILES = [
  // ── 主进程（3）──
  'main/services/recording/__tests__/systemAudioPatterns.test.ts',
  'main/modules/pomodoroShortcuts.ts',
  'main/utils/imageConvert.ts',

  // ── 番茄钟组件（15）──
  'renderer/src/views/pomodoro/components/ModeSelector.vue',
  'renderer/src/views/pomodoro/components/FocusRecordPanel.vue',
  'renderer/src/views/pomodoro/components/HourHeatmap.vue',
  'renderer/src/views/pomodoro/components/FocusAssets.vue',
  'renderer/src/views/pomodoro/components/ProjectChip.vue',
  'renderer/src/views/pomodoro/components/TaskCompletionStats.vue',
  'renderer/src/views/pomodoro/components/PomodoroDetailPanel.vue',
  'renderer/src/views/pomodoro/components/SettingsDialog.vue',
  'renderer/src/views/pomodoro/components/TodayStatsBar.vue',
  'renderer/src/views/pomodoro/components/TaskListPanel.vue',
  'renderer/src/views/pomodoro/components/TrendChart.vue',
  'renderer/src/views/pomodoro/components/TimerRing.vue',
  'renderer/src/views/pomodoro/components/TaskEditDialog.vue',
  'renderer/src/views/pomodoro/components/ProjectDonut.vue',
  'renderer/src/views/pomodoro/components/TaskList.vue',

  // ── 录屏（9）──
  'renderer/src/views/screenRecorder/pages/ClipPage.vue',
  'renderer/src/views/screenRecorder/pages/HistoryPage.vue',
  'renderer/src/views/screenRecorder/components/TransitionSelector.vue',
  'renderer/src/views/screenRecorder/components/SourceSelector.vue',
  'renderer/src/views/screenRecorder/components/ClipEditor.vue',
  'renderer/src/views/screenRecorder/components/ClipTimeline.vue',
  'renderer/src/views/screenRecorder/components/RecordingHistory.vue',
  'renderer/src/views/screenRecorder/components/ExportDialog.vue',
  'renderer/src/views/screenRecorder/components/PreviewPanel.vue',

  // ── 代码片段（2）──
  'renderer/src/views/snippets/components/Sidebar.vue',
  'renderer/src/views/snippets/components/SnippetList.vue',

  // ── 通用组件与页面（5）──
  'renderer/src/views/MigrationCenterView.vue',
  'renderer/src/components/TagInput.vue',
  'renderer/src/components/CodePreview.vue',
  'renderer/src/components/BackgroundSwitch.vue',
  'renderer/src/components/LaserPointer.vue'
]

/** 递归收集 src 下所有文件（相对 src 的路径） */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      walk(full, out)
    } else {
      out.push(relative(SRC_DIR, full))
    }
  }
  return out
}

/** 带重建标记的文件（相对 src 的路径） */
function rebuildFiles(): string[] {
  return walk(SRC_DIR)
    .filter((rel) => {
      const full = join(SRC_DIR, rel)
      try {
        if (statSync(full).size > 2 * 1024 * 1024) return false // 大文件跳过
        return REBUILD_MARKER.test(readFileSync(full, 'utf-8'))
      } catch {
        return false
      }
    })
    .sort()
}

describe('重建件台账', () => {
  it('扫描到足够的源文件（体量哨兵：防止扫描退化成扫了个空目录）', () => {
    const all = walk(SRC_DIR)
    expect(all.length).toBeGreaterThan(300)
  })

  it('重建件数量精确等于 34（新增/删除都必须显式改这里，不许静默漂）', () => {
    const found = rebuildFiles()
    expect(found).toHaveLength(34)
  })

  it('34 个已知路径逐个存在（防止「删一个、误标一个」把数量凑回来）', () => {
    const found = new Set(rebuildFiles())

    const missing = KNOWN_REBUILD_FILES.filter((rel) => !existsSync(join(SRC_DIR, rel)))
    expect(missing, '清单里的文件在磁盘上找不到了').toEqual([])

    const lostMarker = KNOWN_REBUILD_FILES.filter((rel) => !found.has(rel))
    expect(lostMarker, '这些文件丢了重建件标记（后来者会当原件信）').toEqual([])

    // 清单本身不能有重复项，否则「34」是假的
    expect(new Set(KNOWN_REBUILD_FILES).size).toBe(KNOWN_REBUILD_FILES.length)
    expect(KNOWN_REBUILD_FILES).toHaveLength(34)
  })

  it('没有清单外的文件被标成重建件（防漏登记）', () => {
    const known = new Set(KNOWN_REBUILD_FILES)
    const unregistered = rebuildFiles().filter((rel) => !known.has(rel))
    expect(unregistered, '这些文件带重建标记但不在台账里，请补进 KNOWN_REBUILD_FILES').toEqual([])
  })
})

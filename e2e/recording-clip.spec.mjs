/**
 * Frond · 录屏数据链路 E2E 测试
 *
 * 覆盖行为层此前零覆盖的录屏主链路：建行 → 分段（暂停/恢复）→ 结束写回 →
 * 库列表 → 软删，外加录制设置的 get/patch/reset 往返。
 *
 * 为什么不真录屏：真实录制要屏幕录制权限 + 会产出大文件，在 e2e 里既不稳也慢。
 * 但**这条链路的数据层完全可测** —— `recording.start` 的职责就是「新建一行
 * status='recording' 并返回 id 供渲染端使用」（recording.ts:224-236），
 * 不碰任何采集设备。于是从建行到 finalize 的全部状态迁移都能在无权限环境下验证。
 *
 * 关于「剪辑」：`rec_clips` 表已随 027 迁移下线（migrationConsistency.test.ts
 * 会守住这条），现在的产物形态是 finalize 写回的 file_path / file_size / duration_ms。
 *
 * 三个「踩过才知道」的点，都写进断言里了：
 *   1. 窗口按 url 匹配 /index.html（不用 firstWindow，它会拿到截图覆盖层窗口）
 *   2. `window.api.recording` 没有 `delete`，删除走 `remove` / `deleteOne`
 *      （两者都指向 recording.delete 通道）
 *   3. `seg_index` 从 **0** 起（RecordingSegmentRepository.open：
 *      COALESCE(MAX(seg_index), -1) + 1），不是从 1
 *
 * 每个 test 自己建自己的录制行 —— 不跨 test 传状态。此前用模块级变量串链路时，
 * 后续 test 拿到的 id 是 null（Playwright 的 test 隔离会让模块状态不可依赖），
 * 表现为一堆莫名其妙的 "not found null"。自给自足后单条 `-g` 也能跑。
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null
let mainPage = null

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getMainWindow = async () => {
  if (mainPage && !mainPage.isClosed()) return mainPage

  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url())) {
          mainPage = w
          return w
        }
      } catch {
        // 窗口可能已关闭
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('30s 内没等到主窗口（out/renderer/index.html）')
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
function expectIpcOk(res, label) {
  expect(res, `${label}：IPC 没有返回`).toBeDefined()
  expect(res?.error, `${label}：IPC 报错`).toBeUndefined()
  return res
}

/** 建一行 status='recording'，返回 recordingId。每个用例自给自足。 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
async function createRecording(page, tag) {
  const started = await page.evaluate(async (name) => {
    try {
      return await window.api.recording.start({ fileName: name })
    } catch (e) {
      return { error: e.message }
    }
  }, `E2E ${tag}-${Date.now()}.mp4`)
  expectIpcOk(started, 'recording.start')
  expect(started.recordingId).toBeTruthy()
  return started.recordingId
}

test.beforeAll(async () => {
  const env = { ...process.env }
  const userData = join(ROOT, 'test-results', 'e2e-userdata-recording')
  // 清空：断言里有「列表里有没有这条」，残留会让结果随上次运行漂
  rmSync(userData, { recursive: true, force: true })
  env.FROND_USER_DATA_DIR = userData
  env.FROND_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE

  // env 必须是顶层选项（HANDOFF §5）：写成 launchOptions.env 会被静默丢弃
  app = await electron.launch({ args: [MAIN_ENTRY], env })
  await getMainWindow()
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. 开始录制：建出一行 status=recording，且字段原样回读', async () => {
  const page = await getMainWindow()
  const fileName = 'E2E 录制-' + Date.now() + '.mp4'

  const started = await page.evaluate(async (name) => {
    try {
      return await window.api.recording.start({ fileName: name })
    } catch (e) {
      return { error: e.message }
    }
  }, fileName)
  expectIpcOk(started, 'recording.start')
  expect(started.recordingId).toBeTruthy()

  const got = await page.evaluate(async (id) => {
    try {
      return await window.api.recording.get({ id })
    } catch (e) {
      return { error: e.message }
    }
  }, started.recordingId)

  expectIpcOk(got, 'recording.get')
  expect(got.recording).toBeTruthy()
  expect(got.recording.id).toBe(started.recordingId)
  expect(got.recording.fileName).toBe(fileName)
  expect(got.recording.status).toBe('recording')
})

test('2. 录制中的行出现在库列表里', async () => {
  const page = await getMainWindow()
  const id = await createRecording(page, 'list')

  const listed = await page.evaluate(async () => {
    try {
      return await window.api.recording.list({})
    } catch (e) {
      return { error: e.message }
    }
  })

  expectIpcOk(listed, 'recording.list')
  expect(Array.isArray(listed.items)).toBe(true)
  expect(listed.total).toBeGreaterThanOrEqual(1)
  expect(listed.items.map((r) => r.id)).toContain(id)
})

test('3. 分段：seg_index 从 0 起，关闭后重开递增到 1', async () => {
  const page = await getMainWindow()
  const id = await createRecording(page, 'segments')

  const first = await page.evaluate(async (rid) => {
    try {
      return await window.api.recording.segments.open({ recordingId: rid })
    } catch (e) {
      return { error: e.message }
    }
  }, id)
  expectIpcOk(first, 'recording.segments.open(#1)')
  expect(first.segmentId).toBeTruthy()
  // 仓库实现：COALESCE(MAX(seg_index), -1) + 1 —— 空表时第一个分片是 0
  expect(first.segIndex).toBe(0)

  const closed = await page.evaluate(async (rid) => {
    try {
      return await window.api.recording.segments.close({ recordingId: rid })
    } catch (e) {
      return { error: e.message }
    }
  }, id)
  expectIpcOk(closed, 'recording.segments.close')

  const second = await page.evaluate(async (rid) => {
    try {
      return await window.api.recording.segments.open({ recordingId: rid })
    } catch (e) {
      return { error: e.message }
    }
  }, id)
  expectIpcOk(second, 'recording.segments.open(#2)')
  // 段序号必须递增：两段共用同一个 index 会让 UNIQUE(recording_id, seg_index) 撞车
  expect(second.segIndex).toBe(1)
})

test('4. 分段账本：列出两段，且总时长为数字', async () => {
  const page = await getMainWindow()
  const id = await createRecording(page, 'ledger')

  await page.evaluate(async (rid) => {
    await window.api.recording.segments.open({ recordingId: rid })
    await window.api.recording.segments.close({ recordingId: rid })
    await window.api.recording.segments.open({ recordingId: rid })
  }, id)

  const listed = await page.evaluate(async (rid) => {
    try {
      return await window.api.recording.segments.list({ recordingId: rid })
    } catch (e) {
      return { error: e.message }
    }
  }, id)
  expectIpcOk(listed, 'recording.segments.list')
  expect(Array.isArray(listed.items)).toBe(true)
  expect(listed.items).toHaveLength(2)
  expect(listed.items.map((s) => s.segIndex).sort()).toEqual([0, 1])

  const total = await page.evaluate(async (rid) => {
    try {
      return await window.api.recording.segments.totalDuration({ recordingId: rid })
    } catch (e) {
      return { error: e.message }
    }
  }, id)
  expectIpcOk(total, 'recording.segments.totalDuration')
  expect(typeof total.totalMs).toBe('number')
  expect(total.totalMs).toBeGreaterThanOrEqual(0)
})

test('5. 结束录制：写回文件信息并把状态推成 completed', async () => {
  const page = await getMainWindow()
  const id = await createRecording(page, 'finalize')

  const finalized = await page.evaluate(async (rid) => {
    try {
      return await window.api.recording.finalize({
        recordingId: rid,
        finalFilePath: '/tmp/e2e-recording-' + rid + '.mp4',
        fileSize: 1024,
        durationMs: 5000
      })
    } catch (e) {
      return { error: e.message }
    }
  }, id)
  expectIpcOk(finalized, 'recording.finalize')
  expect(finalized.ok).toBe(true)

  const got = await page.evaluate(async (rid) => {
    try {
      return await window.api.recording.get({ id: rid })
    } catch (e) {
      return { error: e.message }
    }
  }, id)
  expectIpcOk(got, 'recording.get(after finalize)')
  expect(got.recording.status).toBe('completed')
  expect(got.recording.durationMs).toBe(5000)
  expect(got.recording.fileSize).toBe(1024)
})

test('6. 软删：从库列表消失（行仍在库里，只是 deleted_at 非空）', async () => {
  const page = await getMainWindow()
  const id = await createRecording(page, 'delete')

  const deleted = await page.evaluate(async (rid) => {
    try {
      // 注意不是 recording.delete —— 桥上没有这个方法
      return await window.api.recording.remove({ id: rid })
    } catch (e) {
      return { error: e.message }
    }
  }, id)
  expectIpcOk(deleted, 'recording.remove')
  expect(deleted.ok).toBe(true)

  const listed = await page.evaluate(async () => {
    try {
      return await window.api.recording.list({})
    } catch (e) {
      return { error: e.message }
    }
  })
  expectIpcOk(listed, 'recording.list(after delete)')
  expect(listed.items.map((r) => r.id)).not.toContain(id)

  // 软删后对读接口不可见 —— findById 的 SQL 带 `AND deleted_at IS NULL`
  // （RecordingRepository.ts:101），所以 get 返回 null 而不是那行。行本身还在库里，
  // 只是被这条过滤挡掉了；这里把语义钉住，免得有人把过滤删了还以为是改进。
  const afterDelete = await page.evaluate(async (rid) => {
    try {
      return await window.api.recording.get({ id: rid })
    } catch (e) {
      return { error: e.message }
    }
  }, id)
  expectIpcOk(afterDelete, 'recording.get(after soft delete)')
  expect(afterDelete.recording).toBeNull()
})

test('7. 查询不存在的 id：返回 recording=null 而不是抛错', async () => {
  const page = await getMainWindow()

  const got = await page.evaluate(async () => {
    try {
      return await window.api.recording.get({ id: 'e2e-nonexistent-' + Date.now() })
    } catch (e) {
      return { error: e.message }
    }
  })

  expectIpcOk(got, 'recording.get(nonexistent)')
  expect(got.recording).toBeNull()
})

test('8. 录制设置：get 给默认值，patch 只改传入字段，reset 回到默认', async () => {
  const page = await getMainWindow()

  const initial = await page.evaluate(async () => {
    try {
      return await window.api.recording.settings.get()
    } catch (e) {
      return { error: e.message }
    }
  })
  expectIpcOk(initial, 'recording.settings.get')
  // DEFAULT_RECORDING_SETTINGS（RecordingSettingsRepository.ts:46）
  expect(initial.fps).toBe(30)
  expect(initial.quality).toBe('medium')
  expect(initial.cursor).toBe('halo')

  const patched = await page.evaluate(async () => {
    try {
      return await window.api.recording.settings.patch({ fps: 60 })
    } catch (e) {
      return { error: e.message }
    }
  })
  expectIpcOk(patched, 'recording.settings.patch')
  expect(patched.fps).toBe(60)
  // merge 语义：没传的字段必须保持原值，不能被清成 undefined
  expect(patched.quality).toBe('medium')
  expect(patched.cursor).toBe('halo')

  const reread = await page.evaluate(async () => {
    try {
      return await window.api.recording.settings.get()
    } catch (e) {
      return { error: e.message }
    }
  })
  expectIpcOk(reread, 'recording.settings.get(after patch)')
  expect(reread.fps).toBe(60)

  const reset = await page.evaluate(async () => {
    try {
      return await window.api.recording.settings.reset()
    } catch (e) {
      return { error: e.message }
    }
  })
  expectIpcOk(reset, 'recording.settings.reset')
  expect(reset.fps).toBe(30)
  expect(reset.quality).toBe('medium')
})

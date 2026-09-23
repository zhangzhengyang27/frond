<!-- 2026-09-23 重建：原文件被截断，仅存 133 行真实代码（脚本主体），脚本头部与模板为重建 -->
<script setup lang="ts">
/**
 * Frond · 数据迁移中心
 *
 * SettingsView 之外的「数据治理」专属页，让用户对所有持久化数据有完整掌控：
 * - 导出 / 导入 / 恢复出厂：frond.db 整体备份还原
 * - legacy-backup：旧 electron-store JSON 归档的时间线，可还原 / 删除
 *
 * 危险操作走应用内二次确认（UModal），不用原生 window.confirm。
 * 待核：以下 state / requestConfirm / fmtSize 由存留调用反推（结构与同名早期副本一致）
 */
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UButton from '@components/ui/UButton.vue'
import UEmpty from '@components/ui/UEmpty.vue'
import UModal from '@components/ui/UModal.vue'

interface ArchiveInfo {
  /** archive 目录的绝对路径 */
  path: string
  /** 时间戳（与目录名一致，ISO 格式） */
  ts: string
  /** 每个 JSON 文件名 + 字节数 */
  files: Array<{ name: string; size: number }>
  /** 目录总字节数 */
  totalSize: number
}

const archives = ref<ArchiveInfo[]>([])
const loading = ref(false)
const busyKey = ref<string | null>(null)
const lastMessage = ref<{ kind: 'ok' | 'err'; text: string } | null>(null)

// ---- 应用内二次确认（替代 window.confirm）----
interface ConfirmRequest {
  title: string
  body: string
  confirmLabel: string
  variant: 'primary' | 'danger'
  action: () => Promise<void>
}

const pendingConfirm = ref<ConfirmRequest | null>(null)
const confirming = ref(false)

const confirmVisible = computed({
  get: () => pendingConfirm.value !== null,
  set: (open: boolean) => {
    if (!open) pendingConfirm.value = null
  }
})

function requestConfirm(
  title: string,
  body: string,
  confirmLabel: string,
  action: () => Promise<void>,
  variant: 'primary' | 'danger' = 'danger'
): void {
  pendingConfirm.value = { title, body, confirmLabel, variant, action }
}

async function runConfirmed(): Promise<void> {
  const req = pendingConfirm.value
  if (!req) return
  confirming.value = true
  try {
    await req.action()
  } finally {
    confirming.value = false
    pendingConfirm.value = null
  }
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

function fmtTs(ts: string): string {
  // ts 形如 "2026-07-26T10-30-00-000Z"，替换 - 为 : 让 Date 能解析
  const normalized = ts.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return ts
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const totalArchiveBytes = computed(() => archives.value.reduce((sum, a) => sum + a.totalSize, 0))

async function loadArchives(): Promise<void> {
  loading.value = true
  try {
    archives.value = await window.api.migration.listArchives()
  } catch (e) {
    lastMessage.value = { kind: 'err', text: `读取归档失败：${(e as Error).message}` }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadArchives()
})

async function onExport(): Promise<void> {
  busyKey.value = 'export'
  try {
    const path = await window.api.migration.exportDb()
    if (path) lastMessage.value = { kind: 'ok', text: `已导出到 ${path}` }
  } catch (e) {
    lastMessage.value = { kind: 'err', text: `导出失败：${(e as Error).message}` }
  } finally {
    busyKey.value = null
  }
}

async function doImport(): Promise<void> {
  busyKey.value = 'import'
  try {
    const r = await window.api.migration.importDb()
    if (r.imported) {
      lastMessage.value = { kind: 'ok', text: '导入成功，应用即将重启…' }
      // 主进程会发 setTimeout 重启，这里 UI 不必再处理
    }
  } catch (e) {
    lastMessage.value = { kind: 'err', text: `导入失败：${(e as Error).message}` }
    busyKey.value = null
  }
}

function onImport(): void {
  requestConfirm(
    '导入数据库',
    '导入数据库将覆盖当前所有数据，操作不可撤销。是否继续？',
    '覆盖导入',
    doImport
  )
}

async function doFactoryReset(): Promise<void> {
  busyKey.value = 'reset'
  try {
    const ok = await window.api.migration.factoryReset()
    if (ok) {
      lastMessage.value = { kind: 'ok', text: '已恢复出厂，应用即将重启…' }
    }
  } catch (e) {
    lastMessage.value = { kind: 'err', text: `恢复出厂失败：${(e as Error).message}` }
    busyKey.value = null
  }
}

function onFactoryReset(): void {
  requestConfirm(
    '恢复出厂设置',
    '恢复出厂将清空所有数据（标签 / 番茄钟 / 截图 / 录制 / 收藏），操作不可撤销。建议先导出备份。是否继续？',
    '清空并重置',
    doFactoryReset
  )
}

async function doRestoreArchive(a: ArchiveInfo): Promise<void> {
  busyKey.value = `restore-${a.path}`
  try {
    const r = await window.api.migration.restoreArchive(a.path)
    if (r.ok) {
      lastMessage.value = {
        kind: 'ok',
        text: `已还原 ${r.restored.length} 个文件${r.errors.length > 0 ? `（${r.errors.length} 个失败）` : ''}`
      }
      await loadArchives()
    } else {
      lastMessage.value = {
        kind: 'err',
        text: `还原失败：${r.errors.join('；')}`
      }
    }
  } catch (e) {
    lastMessage.value = { kind: 'err', text: `还原失败：${(e as Error).message}` }
  } finally {
    busyKey.value = null
  }
}

function onRestoreArchive(a: ArchiveInfo): void {
  requestConfirm(
    '还原旧版归档',
    `将归档 ${fmtTs(a.ts)} 还原到 userData 根目录？下次启动应用会重新把这些 JSON 导入 SQLite（并再次归档）。如非必要，建议改用「导出 / 导入 SQLite」。`,
    '还原归档',
    () => doRestoreArchive(a),
    'primary'
  )
}

async function doDeleteArchive(a: ArchiveInfo): Promise<void> {
  busyKey.value = `delete-${a.path}`
  try {
    const r = await window.api.migration.deleteArchive(a.path)
    if (r.ok) {
      lastMessage.value = { kind: 'ok', text: '归档已删除' }
      await loadArchives()
    } else {
      lastMessage.value = { kind: 'err', text: `删除失败：${r.error ?? 'unknown'}` }
    }
  } catch (e) {
    lastMessage.value = { kind: 'err', text: `删除失败：${(e as Error).message}` }
  } finally {
    busyKey.value = null
  }
}

function onDeleteArchive(a: ArchiveInfo): void {
  requestConfirm('删除归档', `删除归档 ${fmtTs(a.ts)}？该操作不可撤销。`, '删除', () =>
    doDeleteArchive(a)
  )
}
</script>

<template>
  <div class="mx-auto w-full max-w-[760px] px-10 py-12">
    <header class="mb-8">
      <h1 class="text-xl font-semibold tracking-tight text-fg-primary">数据迁移中心</h1>
      <p class="mt-1 text-sm leading-relaxed text-fg-secondary">
        导出 / 导入整库、恢复出厂，以及旧版 JSON 归档的时间线。危险操作会先在这里二次确认。
      </p>
    </header>

    <p
      v-if="lastMessage"
      class="mb-6 rounded-md border px-4 py-3 text-sm"
      :class="
        lastMessage.kind === 'ok'
          ? 'border-line-subtle bg-surface-1 text-fg-secondary'
          : 'border-danger/30 bg-danger/5 text-danger'
      "
    >
      {{ lastMessage.text }}
    </p>

    <!-- 整库备份还原 -->
    <section class="mb-10">
      <h2 class="mb-3 text-xs font-medium tracking-wider text-fg-muted uppercase">SQLite 整库</h2>
      <div
        class="flex flex-wrap items-center gap-2 rounded-lg border border-line-subtle bg-surface-1 p-5 shadow-sm"
      >
        <UButton :loading="busyKey === 'export'" @click="onExport">
          <AppIcon icon="ri-download-line" :size="14" />
          <span>导出数据库</span>
        </UButton>
        <UButton variant="secondary" :loading="busyKey === 'import'" @click="onImport">
          <AppIcon icon="ri-upload-line" :size="14" />
          <span>导入数据库</span>
        </UButton>
        <UButton variant="danger" :loading="busyKey === 'reset'" @click="onFactoryReset">
          <AppIcon icon="ri-delete-bin-line" :size="14" />
          <span>恢复出厂</span>
        </UButton>
        <span class="ml-auto text-xs text-fg-muted">导入与恢复出厂后应用会自动重启</span>
      </div>
    </section>

    <!-- 旧版归档时间线 -->
    <section>
      <div class="mb-3 flex items-center gap-3">
        <h2 class="text-xs font-medium tracking-wider text-fg-muted uppercase">
          旧版 JSON 归档（{{ archives.length }}）
        </h2>
        <span v-if="archives.length" class="text-xs text-fg-faint">
          共 {{ fmtSize(totalArchiveBytes) }}
        </span>
        <button
          class="ml-auto flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary"
          type="button"
          :disabled="loading"
          @click="loadArchives"
        >
          <AppIcon icon="ri-refresh-line" :size="13" />
          <span>重新扫描</span>
        </button>
      </div>

      <div
        class="rounded-lg border border-line-subtle bg-surface-1 p-5 shadow-sm"
        :class="loading ? 'text-fg-muted' : ''"
      >
        <p v-if="loading" class="m-0 text-sm">扫描归档目录…</p>
        <UEmpty v-else-if="archives.length === 0" title="没有待处理的旧版归档">
          <template #icon>
            <AppIcon icon="ri-archive-line" :size="22" />
          </template>
        </UEmpty>
        <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
          <li
            v-for="a in archives"
            :key="a.path"
            class="flex items-center gap-3 rounded-md border border-line-subtle px-3 py-2.5"
          >
            <AppIcon icon="ri-folder-archive-line" :size="16" class="text-fg-tertiary" />
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate text-sm text-fg-primary">{{ fmtTs(a.ts) }}</p>
              <p class="m-0 mt-0.5 text-xs text-fg-muted">
                {{ a.files.length }} 个文件 · {{ fmtSize(a.totalSize) }}
              </p>
            </div>
            <UButton
              size="sm"
              :loading="busyKey === `restore-${a.path}`"
              @click="onRestoreArchive(a)"
            >
              还原
            </UButton>
            <UButton size="sm" variant="ghost" @click="onDeleteArchive(a)">删除</UButton>
          </li>
        </ul>
      </div>
    </section>

    <!-- 二次确认 -->
    <UModal v-model="confirmVisible" :title="pendingConfirm?.title || '确认操作'" size="sm">
      <p class="text-sm leading-relaxed text-fg-secondary">{{ pendingConfirm?.body }}</p>
      <template #footer>
        <UButton variant="ghost" :disabled="confirming" @click="confirmVisible = false">
          取消
        </UButton>
        <UButton
          :variant="pendingConfirm?.variant === 'primary' ? 'primary' : 'danger'"
          :loading="confirming"
          @click="runConfirmed"
        >
          {{ pendingConfirm?.confirmLabel || '确认' }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>

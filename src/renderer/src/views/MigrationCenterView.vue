~~~ 第 1 行未留存 ~~~
~~~ 第 2 行未留存 ~~~
~~~ 第 3 行未留存 ~~~
~~~ 第 4 行未留存 ~~~
~~~ 第 5 行未留存 ~~~
~~~ 第 6 行未留存 ~~~
~~~ 第 7 行未留存 ~~~
~~~ 第 8 行未留存 ~~~
~~~ 第 9 行未留存 ~~~
~~~ 第 10 行未留存 ~~~
~~~ 第 11 行未留存 ~~~
~~~ 第 12 行未留存 ~~~
~~~ 第 13 行未留存 ~~~
~~~ 第 14 行未留存 ~~~
~~~ 第 15 行未留存 ~~~
~~~ 第 16 行未留存 ~~~
~~~ 第 17 行未留存 ~~~
~~~ 第 18 行未留存 ~~~
~~~ 第 19 行未留存 ~~~
~~~ 第 20 行未留存 ~~~
~~~ 第 21 行未留存 ~~~
~~~ 第 22 行未留存 ~~~
~~~ 第 23 行未留存 ~~~
~~~ 第 24 行未留存 ~~~
~~~ 第 25 行未留存 ~~~
~~~ 第 26 行未留存 ~~~
~~~ 第 27 行未留存 ~~~
~~~ 第 28 行未留存 ~~~
~~~ 第 29 行未留存 ~~~
~~~ 第 30 行未留存 ~~~
~~~ 第 31 行未留存 ~~~
~~~ 第 32 行未留存 ~~~
~~~ 第 33 行未留存 ~~~
~~~ 第 34 行未留存 ~~~
~~~ 第 35 行未留存 ~~~
~~~ 第 36 行未留存 ~~~
~~~ 第 37 行未留存 ~~~
~~~ 第 38 行未留存 ~~~
~~~ 第 39 行未留存 ~~~
~~~ 第 40 行未留存 ~~~
~~~ 第 41 行未留存 ~~~
~~~ 第 42 行未留存 ~~~
~~~ 第 43 行未留存 ~~~
~~~ 第 44 行未留存 ~~~
~~~ 第 45 行未留存 ~~~
~~~ 第 46 行未留存 ~~~
~~~ 第 47 行未留存 ~~~
~~~ 第 48 行未留存 ~~~
~~~ 第 49 行未留存 ~~~
~~~ 第 50 行未留存 ~~~
~~~ 第 51 行未留存 ~~~
~~~ 第 52 行未留存 ~~~
~~~ 第 53 行未留存 ~~~
~~~ 第 54 行未留存 ~~~
~~~ 第 55 行未留存 ~~~
~~~ 第 56 行未留存 ~~~
~~~ 第 57 行未留存 ~~~
~~~ 第 58 行未留存 ~~~
~~~ 第 59 行未留存 ~~~
~~~ 第 60 行未留存 ~~~
~~~ 第 61 行未留存 ~~~
~~~ 第 62 行未留存 ~~~
~~~ 第 63 行未留存 ~~~
~~~ 第 64 行未留存 ~~~
~~~ 第 65 行未留存 ~~~
~~~ 第 66 行未留存 ~~~
~~~ 第 67 行未留存 ~~~
~~~ 第 68 行未留存 ~~~
~~~ 第 69 行未留存 ~~~
~~~ 第 70 行未留存 ~~~
~~~ 第 71 行未留存 ~~~
~~~ 第 72 行未留存 ~~~
~~~ 第 73 行未留存 ~~~
~~~ 第 74 行未留存 ~~~
~~~ 第 75 行未留存 ~~~
~~~ 第 76 行未留存 ~~~
~~~ 第 77 行未留存 ~~~
~~~ 第 78 行未留存 ~~~
~~~ 第 79 行未留存 ~~~
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
~~~ 第 92 行未留存 ~~~
~~~ 第 93 行未留存 ~~~
~~~ 第 94 行未留存 ~~~
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

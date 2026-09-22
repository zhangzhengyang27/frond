function fmtTs(ts: string): string {
  // ts 形如 "2026-07-26T10-30-00-000Z"，替换 - 为 : 让 Date 能解析
  const normalized = ts.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return ts
  return formatDateTime(d.getTime())
}

const totalArchiveBytes = computed(() => archives.value.reduce((sum, a) => sum + a.totalSize, 0))

async function loadArchives(): Promise<void> {

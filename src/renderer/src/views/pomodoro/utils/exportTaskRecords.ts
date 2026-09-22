        .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 30)
    : 'all'
  const fmt = (ts: number): string => new Date(ts).toISOString().slice(0, 10)
  return `leaf_pomodoro_bulk_${safeProject}_${fmt(from)}_to_${fmt(to)}`
}

export async function exportBulkAsCSV(args: BulkExportArgs): Promise<ExportResult> {
  const payload = {

/**
 * Leaf · 标记服务（rec_markers 表的领域门面）
 *
 * 收敛说明：本服务原为 electron-store（markers.json）+ 内存 Map 镜像，
 * 与 SQLite 的 rec_markers 表（MarkerRepository）长期并存两套标记系统。
 * 现统一为：本服务保持既有 API（timestamp 单位秒）不变、存储落到
 * rec_markers（time_ms 单位毫秒），渲染端 marker.* 通道无感知。
 * 旧 markers.json 由 dataMigrations.migrateMarkersFromLegacyStore 一次性导入。
 */
import { markerRepository, type MarkerRow } from '../db/repos'

/**
 * 标记接口（对外单位：timestamp 秒；存储单位：time_ms 毫秒）
 */
export interface Marker {
  id: string
  timestamp: number // 秒
  label: string
  color?: string
  recordingId?: string // 关联的录制 ID（如果有）
}

export class MarkerService {
  private static instance: MarkerService | null = null

  static getInstance(): MarkerService {
    if (!MarkerService.instance) {
      MarkerService.instance = new MarkerService()
    }
    return MarkerService.instance
  }

  private rowToMarker(row: MarkerRow): Marker {
    return {
      id: row.id,
      timestamp: row.time_ms / 1000,
      label: row.label ?? '',
      color: row.color ?? undefined,
      recordingId: row.recording_id
    }
  }

  /** 校验标记归属（旧行为：只操作属于该 recordingId 的标记） */
  private rowOfRecording(recordingId: string, markerId: string): MarkerRow | null {
    try {
      const row = markerRepository.get(markerId)
      return row.recording_id === recordingId ? row : null
    } catch {
      return null
    }
  }

  addMarker(recordingId: string, timestamp: number, label: string = '标记'): Marker {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const row = markerRepository.add({
      id,
      recording_id: recordingId,
      time_ms: Math.round(timestamp * 1000),
      label,
      color: '#ff4444'
    })
    return this.rowToMarker(row)
  }

  removeMarker(recordingId: string, markerId: string): boolean {
    if (!this.rowOfRecording(recordingId, markerId)) return false
    return markerRepository.remove(markerId)
  }

  getMarkers(recordingId: string): Marker[] {
    return markerRepository.listByRecording(recordingId).map((row) => this.rowToMarker(row))
  }

  updateMarker(
    recordingId: string,
    markerId: string,
    updates: Partial<Marker>
  ): Marker | null {
    if (!this.rowOfRecording(recordingId, markerId)) return null
    const fields: { timeMs?: number; label?: string | null; color?: string | null } = {}
    if (updates.timestamp !== undefined) fields.timeMs = Math.round(updates.timestamp * 1000)
    if (updates.label !== undefined) fields.label = updates.label
    if (updates.color !== undefined) fields.color = updates.color
    if (!markerRepository.update(markerId, fields)) return null
    const row = markerRepository.get(markerId)
    return this.rowToMarker(row)
  }

  clearMarkers(recordingId: string): void {
    markerRepository.removeAllForRecording(recordingId)
  }

  /** 迁移标记（录制保存时：临时 ID → 正式录制 ID） */
  migrateMarkers(fromRecordingId: string, toRecordingId: string): boolean {
    return markerRepository.reassignRecording(fromRecordingId, toRecordingId) > 0
  }

  /** 导出标记为 CSV */
  exportToCSV(recordingId: string): string {
    const markers = this.getMarkers(recordingId)
    if (markers.length === 0) {
      return '时间,标签\n'
    }

    const header = '时间,标签\n'
    const rows = markers
      .map((m) => {
        const time = this.formatTime(m.timestamp)
        return `${time},"${m.label}"`
      })
      .join('\n')

    return header + rows
  }

  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
}

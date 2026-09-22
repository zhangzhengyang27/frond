import { MarkerService } from '../services/MarkerService'
import { typedHandle } from './typedIpc'

export function registerMarkersIpcHandlers(): void {
  const markerService = MarkerService.getInstance()

  typedHandle('marker:addMarker', (_event, { recordingId, timestamp, label }) =>
    markerService.addMarker(recordingId, timestamp, label)
  )
  typedHandle('marker:removeMarker', (_event, { recordingId, markerId }) =>
    markerService.removeMarker(recordingId, markerId)
  )
  typedHandle('marker:getMarkers', (_event, { recordingId }) =>
    markerService.getMarkers(recordingId)
  )
  typedHandle('marker:updateMarker', (_event, { recordingId, markerId, updates }) =>
    markerService.updateMarker(recordingId, markerId, updates)
  )

  // 清空标记
  ipcMain.handle('marker:clearMarkers', (_event, recordingId: string) => {
    markerService.clearMarkers(recordingId)
  })

  // 导出标记为 CSV
  ipcMain.handle('marker:exportToCSV', (_event, recordingId: string) => {
    return markerService.exportToCSV(recordingId)
  })
}

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
  typedHandle('marker:clearMarkers', (_event, { recordingId }) =>
    markerService.clearMarkers(recordingId)
  )

  // 导出标记为 CSV
  typedHandle('marker:exportToCSV', (_event, { recordingId }) =>
    markerService.exportToCSV(recordingId)
  )
}

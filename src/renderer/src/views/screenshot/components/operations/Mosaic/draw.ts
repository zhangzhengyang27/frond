import type { HistoryItemSource } from '../../../types'
import type { MosaicData } from './index.vue'

export default function draw(
  ctx: CanvasRenderingContext2D,
  action: HistoryItemSource<MosaicData, null>
): void {
  const { tiles, size } = action.data
  tiles.forEach((tile) => {
    const r = Math.round(tile.color[0])
    const g = Math.round(tile.color[1])
    const b = Math.round(tile.color[2])
    const a = tile.color[3] / 255

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
    ctx.fillRect(tile.x - size / 2, tile.y - size / 2, size, size)
  })
}

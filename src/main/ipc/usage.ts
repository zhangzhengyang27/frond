import type { UsageDataStore } from '../stores/UsageDataStore'
import { typedHandle } from './typedIpc'

export function registerUsageIpcHandlers(usageStore: UsageDataStore): void {
  typedHandle('usage:recordUse', (_event, { moduleId }) => {
    usageStore.recordUse(moduleId)
  })

  typedHandle('usage:getRecent', (_event, { limit }) => usageStore.getRecent(limit))
  typedHandle('usage:getStats', () => usageStore.getUsageStats())

  typedHandle('usage:clearRecent', () => {
    usageStore.clearRecent()
  })

  typedHandle('usage:addFavorite', (_event, { moduleId }) => {
    usageStore.addFavorite(moduleId)
  })

  typedHandle('usage:removeFavorite', (_event, { moduleId }) => {
    usageStore.removeFavorite(moduleId)
  })

  typedHandle('usage:isFavorite', (_event, { moduleId }) => usageStore.isFavorite(moduleId))
  typedHandle('usage:getFavorites', () => usageStore.getFavorites())
  typedHandle('usage:toggleFavorite', (_event, { moduleId }) => usageStore.toggleFavorite(moduleId))
}

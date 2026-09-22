import { usageRepository } from '../db/repos/UsageRepository'

/**
 * UsageDataStore — 5-7 纯转发层。
 *
 * 表里只存 module_id 字符串，渲染端负责用 constants/modules.ts 把 id → 渲染元数据
 * （label / icon / path）。
 */
export class UsageDataStore {
  recordUse(moduleId: string): void {
    usageRepository.recordUse(moduleId)
  }

  getRecent(limit = 6): string[] {
    return usageRepository.getRecent(limit)
  }

  /** 全量使用统计：moduleId → { useCount, usedAt }（排序自学习用） */
  getUsageStats(): Array<{ moduleId: string; useCount: number; usedAt: number }> {
    return [...usageRepository.getUsageStats().entries()].map(([moduleId, s]) => ({
      moduleId,
      ...s
    }))
  }

  clearRecent(): void {
    usageRepository.clearRecent()
  }

  addFavorite(moduleId: string): void {
    usageRepository.addFavorite(moduleId)
  }

  removeFavorite(moduleId: string): void {
    usageRepository.removeFavorite(moduleId)
  }

  isFavorite(moduleId: string): boolean {
    return usageRepository.isFavorite(moduleId)
  }

  getFavorites(): string[] {
    return usageRepository.getFavorites()
  }

  toggleFavorite(moduleId: string): boolean {
    return usageRepository.toggleFavorite(moduleId)
  }
}

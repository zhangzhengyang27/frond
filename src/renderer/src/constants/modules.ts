/**
 * Leaf · 渲染端模块列表
 *
 * 真理源在 src/shared/modules.ts（模块 + PENDING + 类型），
 * 本文件只是 re-export 门面，让 Sidebar / Hub / CommandPalette / 路由表统一从这里 import。
 */

export type {
  ModuleGroup,
  ModuleCategory,
  ModuleMeta,
  PendingModule
} from '../../../shared/modules'
export {
  MODULES,
  PENDING_MODULES,
  findModule,
  findModuleByRoute,
  getModulesByGroup,
  getModulesByCategory,
  GROUP_LABELS
} from '../../../shared/modules'

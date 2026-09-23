<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PENDING_MODULES, getModulesByCategory, type ModuleMeta } from '../../constants/modules'
import { SYSTEM_PAGES } from '@shared/commands'
import AppIcon from '@components/AppIcon.vue'
import UTooltip from '../ui/UTooltip.vue'

const route = useRoute()
const router = useRouter()

/** 折叠状态：默认收起，由顶部图标按钮手动切换并持久化（v4：移除 hover 自动展开） */
const EXPAND_KEY = 'frond.sidebar-expanded'
const expanded = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(EXPAND_KEY) === '1'
)

const toggleExpanded = (): void => {
  expanded.value = !expanded.value
  try {
    localStorage.setItem(EXPAND_KEY, expanded.value ? '1' : '0')
  } catch {
    /* 隐私模式等场景下忽略持久化失败 */
  }
}

/** 侧边栏条目（IA v2 三分组：工具 / 启动器 / 系统） */
interface SidebarItem {
  key: string
  label: string
  icon: string
  path: string
  /** 命中路由名或路径的判定依据 */
  routeName: string
  /** 模块类条目跳转时记录使用（usage 只认模块 id；系统页不记录） */
  moduleId?: string
}

const byCategory = getModulesByCategory()

const toItems = (mods: Array<ModuleMeta | (typeof PENDING_MODULES)[number]>): SidebarItem[] =>
  mods.map((m) => ({
    key: m.id,
    label: m.label,
    icon: m.icon,
    path: m.path,
    routeName: m.routeName,
    moduleId: m.id
  }))

/** 工具组：模块 + PENDING（代码片段挂工具组尾，DECISIONS-002） */
const toolItems = computed<SidebarItem[]>(() => [
  ...toItems(byCategory.tool),
  ...toItems(PENDING_MODULES)
])
/** 启动器组 */
const launcherItems = computed<SidebarItem[]>(() => toItems(byCategory.launcher))
/** 系统组：设置 / 数据迁移 / 关于（shared 注册表） */
const systemItems = computed<SidebarItem[]>(() =>
  SYSTEM_PAGES.map((p) => ({
    key: p.id,
    label: p.label,
    icon: p.icon,
    path: p.path,
    routeName: p.routeName
  }))
)

const groups = computed<Array<{ id: string; label: string; items: SidebarItem[] }>>(() => [
  { id: 'tools', label: '工具', items: toolItems.value },
  { id: 'launcher', label: '启动器', items: launcherItems.value },
  { id: 'system', label: '系统', items: systemItems.value }
])

const isActive = (item: SidebarItem): boolean =>
  item.routeName ? String(route.name || '') === item.routeName : route.path === item.path

/** 模块跳转：统一在当前窗口内路由跳转，不再新开窗口 */
const navigate = (item: SidebarItem): void => {
  if (item.moduleId) void window.api.usage.recordUse(item.moduleId)
  router.push(item.path)
}

/** 唤起启动器胶囊窗 */
function openLauncher(): void {
  void window.api.launcher.show?.()
}
</script>

<template>
  <!-- 玻璃浮层式侧栏：flex 容器内自适应高度，
       依赖 --shell-topbar-h / --shell-sidebar-w token（替代魔法数字，BUGS.md B14） -->
  <aside
    class="FrondSidebar sticky z-20 flex h-[calc(100vh-var(--shell-topbar-h))] shrink-0 flex-col overflow-hidden border-r border-line-subtle bg-glass-bg backdrop-blur-[var(--glass-blur)] transition-[width] duration-spring ease-out"
    :class="expanded ? 'w-[var(--shell-sidebar-w-expanded)]' : 'w-[var(--shell-sidebar-w)]'"
    :style="{ top: 'var(--shell-topbar-h)' }"
  >
    <!-- 唤起启动器（核心入口） -->
    <div class="px-2 pt-3">
      <button
        type="button"
        class="flex h-11 w-full items-center gap-3 rounded-md bg-gradient-to-r from-brand-500 to-brand-600 px-3 text-left text-white shadow-sm transition-all duration-fast hover:shadow-md hover:brightness-110 focus-visible:shadow-ring-focus focus-visible:outline-none"
        @click="openLauncher"
      >
        <AppIcon icon="search-eye" :size="20" class="shrink-0" />
        <span v-if="expanded" class="whitespace-nowrap text-sm font-medium">唤起启动器</span>
        <span v-if="expanded" class="ml-auto text-[10px] opacity-70">⌥Space</span>
      </button>
    </div>

    <!-- 折叠 / 展开开关 -->
    <div class="flex flex-col gap-0.5 px-2 pt-2">
      <UTooltip :content="expanded ? '收起侧栏' : '展开侧栏'" position="right" :disabled="expanded">
        <button
          type="button"
          class="flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-fg-tertiary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary focus-visible:shadow-ring-focus focus-visible:outline-none"
          @click="toggleExpanded"
        >
          <AppIcon
            :icon="expanded ? 'ri-menu-fold-line' : 'ri-menu-unfold-line'"
            :size="21"
            class="shrink-0"
          />
          <span v-if="expanded" class="whitespace-nowrap text-sm font-medium">收起侧栏</span>
        </button>
      </UTooltip>
    </div>

    <!-- 三分组导航（IA v2：工具 / 启动器 / 系统） -->
    <nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
      <template v-for="(group, gi) in groups" :key="group.id">
        <!-- 展开态：组标签；折叠态：组间分隔线 -->
        <div
          v-if="expanded && group.items.length > 0"
          class="mb-1 mt-3 flex items-center gap-2 px-3 first:mt-0"
        >
          <span class="text-[10px] font-medium tracking-wider text-fg-muted uppercase">{{
            group.label
          }}</span>
          <div class="h-px flex-1 bg-line-subtle" />
        </div>
        <div
          v-else-if="!expanded && gi > 0 && group.items.length > 0"
          class="mx-3 my-2 h-px bg-line-subtle"
        />

        <UTooltip
          v-for="item in group.items"
          :key="item.key"
          :content="item.label"
          position="right"
          :disabled="expanded"
        >
          <button
            type="button"
            class="group relative flex h-11 w-full items-center gap-3 rounded-md px-3 text-left transition-colors duration-fast focus-visible:shadow-ring-focus focus-visible:outline-none"
            :class="
              isActive(item)
                ? 'bg-brand-500/10 text-fg-brand'
                : 'text-fg-secondary hover:bg-surface-hover hover:text-fg-primary'
            "
            @click="navigate(item)"
          >
            <!-- active 指示条 -->
            <span
              v-if="isActive(item)"
              class="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-500"
            />
            <AppIcon :icon="item.icon" :size="21" class="shrink-0" />
            <span v-if="expanded" class="whitespace-nowrap text-sm font-medium">{{
              item.label
            }}</span>
          </button>
        </UTooltip>
      </template>
    </nav>
  </aside>
</template>

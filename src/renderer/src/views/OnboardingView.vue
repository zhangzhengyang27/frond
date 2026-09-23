<script setup lang="ts">
/**
 * Frond · 首次启动引导（Onboarding）
 *
 * 5 步骤全屏向导：
 *   1. 欢迎：Frond 是什么 + 解决什么问题
 *   2. 系统权限：辅助功能 / 日历 / 屏幕录制的真状态 + 就地申请 + 跳转设置（P-3.5）
 *   3. 主题：light / dark / auto，立即生效
 *   4. 常用模块：9 模块 chips 多选（影响 Hub「收藏」区）
 *   5. 快捷键：⌘K 命令面板 / ⌘2-4 跳模块 / ⌘, 设置
 *
 * 设计取舍：
 * - 全屏覆盖（不是 modal）：让用户专注看完，不被 UI 干扰
 * - 提供「跳过」按钮：高级用户 / 老用户不想被引导
 * - 步骤切换 left / right slide 动效（CSS transition）
 * - 第 2 步的系统权限面板**挂上才读**（日历那一项要起一个 osascript 进程）；
 *   这一步不拦「跳过」，设置 → 高级 里有同一块面板可以补授权
 * - 状态存 prefRepository.set('onboarding:completed', 'true')，
 *   设置页可「resetOnboarding」重看
 * - v2 修复：旧版用了 bg-bg-* / text-text-* / border-border-* 等
 *   未在 Tailwind 中定义的「幽灵类」，样式全部静默失效（BUGS.md B17）；
 *   现统一为 v2 token（fg-* / surface-* / line-*）
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@components/AppIcon.vue'
import { MODULES, type ModuleMeta } from '@shared/modules'
import UButton from '@components/ui/UButton.vue'
import PermissionPanel from '@components/PermissionPanel.vue'
import { useTheme, type Theme } from '../composables/useTheme'
import { markOnboardingCompleted } from '../router'

const router = useRouter()
const { theme, setTheme, initTheme } = useTheme()
initTheme()

type Step = 1 | 2 | 3 | 4 | 5
const TOTAL_STEPS = 5

const step = ref<Step>(1)
const selectedTheme = ref<Theme>(theme.value)
const pickedModules = ref<Set<string>>(new Set())
const direction = ref<'forward' | 'back'>('forward')

const themeOptions: Array<{
  id: Theme
  label: string
  description: string
  icon: string
  preview: 'light' | 'dark' | 'auto'
}> = [
  {
    id: 'light',
    label: '浅色',
    description: '明亮、清晰',
    icon: 'sun-line',
    preview: 'light'
  },
  {
    id: 'dark',
    label: '深色',
    description: '舒适、护眼',
    icon: 'moon-line',
    preview: 'dark'
  },
  {
    id: 'auto',
    label: '跟随系统',
    description: '随 macOS / Windows 切换',
    icon: 'computer-line',
    preview: 'auto'
  }
]

const recommendedModules = computed((): ModuleMeta[] => MODULES.slice(0, 9))

const shortcuts = [
  { keys: '⌘K', desc: '唤起命令面板（搜索模块 / 跳转 / 动作）' },
  { keys: '⌘2-4', desc: '按数字键直接跳到对应模块（录屏 / 番茄钟 / 启动器管理）' },
  { keys: '⌘,', desc: '打开设置中心' },
  { keys: '⌘⇧P', desc: '唤起命令面板（备用快捷键）' }
]

const canNext = computed(() => {
  if (step.value === 4) return pickedModules.value.size > 0
  return true
})

const pickModule = (id: string): void => {
  if (pickedModules.value.has(id)) pickedModules.value.delete(id)
  else pickedModules.value.add(id)
  pickedModules.value = new Set(pickedModules.value) // trigger reactivity
}

const next = async (): Promise<void> => {
  direction.value = 'forward'
  if (step.value === 3) {
    // 主题选择立即生效
    await setTheme(selectedTheme.value)
  }
  if (step.value === TOTAL_STEPS) {
    await finish()
    return
  }
  step.value = (step.value + 1) as Step
}

const prev = (): void => {
  direction.value = 'back'
  if (step.value === 1) return
  step.value = (step.value - 1) as Step
}

const close = async (): Promise<void> => {
  // 跳过：标完成 + 关闭
  await finish(false)
}

const finish = async (goHome = true): Promise<void> => {
  // 1. 写常用模块 → usage.addFavorite
  const ids = [...pickedModules.value]
  for (const id of ids) {
    try {
      await window.api.usage.addFavorite(id)
    } catch {
      /* ignore */
    }
  }
  // 2. 写 favoriteModules 备份（设置页可恢复）
  await window.api.preferences.setFavoriteModules(ids)
  // 3. 标 onboarding 完成（IPC + router 共享单例）
  await window.api.preferences.setOnboardingCompleted()
  markOnboardingCompleted()
  // 4. 关闭
  if (goHome) {
    await router.push('/')
  } else {
    // 跳过：跳到当前路由（保留用户当前位置）
    // 实际上 Onboarding 是在 Hub 之前拦截，跳到 Hub
    await router.push('/')
  }
}

onMounted(showInitial)

/** 进来时检测是否已完成（外部重置过）*/
async function showInitial(): Promise<void> {
  // 不需要再 check isOnboardingCompleted（前提条件已确保）
  // 默认主题预览 = 当前主题
  selectedTheme.value = theme.value
}

const stepLabel = computed(() => `步骤 ${step.value} / ${TOTAL_STEPS}`)
</script>

<template>
  <div
    class="frond-onboarding fixed inset-0 z-modal flex items-center justify-center bg-overlay backdrop-blur-md"
  >
    <!-- 跳过按钮（右上角） -->
    <button
      type="button"
      class="absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-fg-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary"
      @click="close"
    >
      <span>跳过引导</span>
      <AppIcon icon="close-line" :size="16" />
    </button>

    <!-- 卡片容器 -->
    <div
      class="relative w-full max-w-3xl overflow-hidden rounded-lg border border-line-subtle bg-surface-3 shadow-lg"
    >
      <div
        class="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-glass-highlight"
        aria-hidden="true"
      />

      <!-- 进度条 -->
      <div class="flex h-1 bg-surface-0">
        <div
          class="bg-brand-500 transition-all duration-slow ease-frond"
          :style="{ width: `${(step / TOTAL_STEPS) * 100}%` }"
        />
      </div>

      <div class="relative min-h-[480px] overflow-hidden">
        <Transition :name="direction === 'forward' ? 'slide-forward' : 'slide-back'" mode="out-in">
          <!-- Step 1: 欢迎 -->
          <section
            v-if="step === 1"
            key="step-1"
            class="flex min-h-[480px] flex-col items-center justify-center px-10 py-12 text-center"
          >
            <div
              class="mb-6 flex size-16 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-3xl shadow-glow"
            >
              🌿
            </div>
            <h2 class="mb-3 text-2xl font-semibold tracking-tight text-fg-primary">
              欢迎来到 Frond
            </h2>
            <p class="max-w-md text-base leading-relaxed text-fg-secondary">
              <span class="text-fg-primary">你的桌面工具箱</span>
              —— 把常用功能（录屏 / 番茄钟 / ...）集中在一个轻量 Electron 应用里，
              <span class="text-fg-primary">不卡顿、不打扰、不联网</span>。
            </p>
            <div class="mt-8 grid grid-cols-3 gap-3 text-left">
              <div
                v-for="f in [
                  { icon: 'flashlight-line', title: '快', body: '全局快捷键 0.1s 唤起' },
                  { icon: 'shapes', title: '简', body: '9 模块一屏一览' },
                  { icon: 'shield-check-line', title: '稳', body: '本地优先 SQLite 持久化' }
                ]"
                :key="f.title"
                class="flex flex-col gap-1 rounded-md border border-line-subtle bg-surface-0 p-4"
              >
                <AppIcon :icon="f.icon" class="text-xl text-fg-brand" />
                <div class="text-sm font-semibold text-fg-primary">{{ f.title }}</div>
                <div class="text-xs text-fg-secondary">{{ f.body }}</div>
              </div>
            </div>
          </section>

          <!-- Step 2: 系统权限 -->
          <section
            v-else-if="step === 2"
            key="step-perm"
            class="flex min-h-[480px] flex-col px-10 py-12"
          >
            <div
              class="mb-2 text-center text-xs font-medium tracking-wider text-fg-tertiary uppercase"
            >
              {{ stepLabel }}
            </div>
            <h2 class="mb-2 text-center text-2xl font-semibold tracking-tight text-fg-primary">
              给 Frond 该有的系统权限
            </h2>
            <p class="mb-6 text-center text-sm text-fg-secondary">
              没授权时这些功能不是「坏了」，是按了没反应。现在不开也行，之后在设置里随时补
            </p>
            <div class="flex-1">
              <PermissionPanel />
            </div>
          </section>

          <!-- Step 3: 主题 -->
          <!-- Step 3: 主题 -->
          <section
            v-else-if="step === 3"
            key="step-theme"
            class="flex min-h-[480px] flex-col px-10 py-12"
          >
            <div
              class="mb-2 text-center text-xs font-medium tracking-wider text-fg-tertiary uppercase"
            >
              {{ stepLabel }}
            </div>
            <h2 class="mb-2 text-center text-2xl font-semibold tracking-tight text-fg-primary">
              选择你的主题
            </h2>
            <p class="mb-8 text-center text-sm text-fg-secondary">
              偏好会立即生效，后续可在「设置 → 外观」中随时切换
            </p>
            <div class="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
              <button
                v-for="t in themeOptions"
                :key="t.id"
                type="button"
                class="group flex flex-col gap-3 rounded-md border bg-surface-0 p-6 text-left transition-all duration-normal focus-visible:shadow-ring-focus focus-visible:outline-none"
                :class="
                  selectedTheme === t.id
                    ? 'border-brand-500/50 shadow-ring-focus'
                    : 'border-line-subtle hover:border-line-strong'
                "
                @click="selectedTheme = t.id"
              >
                <!-- 主题预览：亮 / 暗 / 半分（auto） -->
                <div
                  class="flex h-32 items-center justify-center overflow-hidden rounded-md border border-line-subtle"
                >
                  <div
                    class="h-full w-full p-4"
                    :class="t.preview === 'dark' ? 'bg-gray-950' : 'bg-gray-50'"
                  >
                    <div class="flex h-full flex-col gap-2">
                      <div
                        class="h-3 w-1/2 rounded-full"
                        :class="t.preview === 'dark' ? 'bg-gray-700' : 'bg-gray-200'"
                      />
                      <div
                        class="h-2 w-3/4 rounded-full"
                        :class="t.preview === 'dark' ? 'bg-gray-800' : 'bg-gray-100'"
                      />
                      <div
                        class="h-8 w-full rounded-md"
                        :class="t.preview === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'"
                      />
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <AppIcon :icon="t.icon" class="text-lg text-fg-brand" />
                  <span class="font-semibold text-fg-primary">{{ t.label }}</span>
                </div>
                <p class="text-xs text-fg-secondary">{{ t.description }}</p>
                <div
                  v-if="selectedTheme === t.id"
                  class="mt-auto inline-flex items-center gap-1 text-xs font-medium text-fg-brand"
                >
                  <AppIcon icon="checkbox-circle-fill" :size="14" />
                  <span>已选择</span>
                </div>
              </button>
            </div>
          </section>

          <!-- Step 4: 常用模块 -->
          <section
            v-else-if="step === 4"
            key="step-modules"
            class="flex min-h-[480px] flex-col px-10 py-12"
          >
            <div
              class="mb-2 text-center text-xs font-medium tracking-wider text-fg-tertiary uppercase"
            >
              {{ stepLabel }}
            </div>
            <h2 class="mb-2 text-center text-2xl font-semibold tracking-tight text-fg-primary">
              选 3-5 个常用模块
            </h2>
            <p class="mb-6 text-center text-sm text-fg-secondary">
              Hub 会把它们放到「收藏」区；模块快捷键固定为 ⌘+模块序号（如 ⌘4 启动器）
            </p>
            <div class="flex-1 overflow-y-auto">
              <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
                <button
                  v-for="m in recommendedModules"
                  :key="m.id"
                  type="button"
                  class="flex items-center gap-3 rounded-md border bg-surface-0 p-3 text-left transition-all duration-normal focus-visible:shadow-ring-focus focus-visible:outline-none"
                  :class="
                    pickedModules.has(m.id)
                      ? 'border-brand-500/50 shadow-ring-focus'
                      : 'border-line-subtle hover:border-line-strong'
                  "
                  @click="pickModule(m.id)"
                >
                  <div
                    class="flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors"
                    :class="
                      pickedModules.has(m.id)
                        ? 'border-brand-500/25 bg-brand-500/15 text-fg-brand'
                        : 'border-line-subtle bg-surface-2 text-fg-tertiary'
                    "
                  >
                    <AppIcon :icon="m.icon" :size="18" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium text-fg-primary">{{ m.label }}</div>
                    <div class="truncate text-xs text-fg-secondary">{{ m.description }}</div>
                  </div>
                  <AppIcon
                    v-if="pickedModules.has(m.id)"
                    icon="checkbox-circle-fill"
                    class="text-lg text-fg-brand"
                  />
                </button>
              </div>
            </div>
            <div class="mt-4 text-center text-xs text-fg-tertiary">
              已选 {{ pickedModules.size }} / 9
              <span v-if="pickedModules.size === 0" class="ml-2 text-warning">
                （至少选 1 个才能继续）
              </span>
            </div>
          </section>

          <!-- Step 5: 快捷键 -->
          <section v-else key="step-shortcuts" class="flex min-h-[480px] flex-col px-10 py-12">
            <div
              class="mb-2 text-center text-xs font-medium tracking-wider text-fg-tertiary uppercase"
            >
              {{ stepLabel }}
            </div>
            <h2 class="mb-2 text-center text-2xl font-semibold tracking-tight text-fg-primary">
              掌握这 4 组快捷键
            </h2>
            <p class="mb-8 text-center text-sm text-fg-secondary">
              把操作从 3 次点击压缩到 1 次按键
            </p>
            <div class="flex-1 space-y-3">
              <div
                v-for="s in shortcuts"
                :key="s.keys"
                class="flex items-center gap-4 rounded-md border border-line-subtle bg-surface-0 p-4"
              >
                <kbd
                  class="inline-flex h-9 min-w-14 items-center justify-center rounded-md border border-line-subtle bg-surface-2 px-3 font-mono text-sm font-semibold text-fg-primary shadow-sm"
                >
                  {{ s.keys }}
                </kbd>
                <span class="flex-1 text-sm text-fg-secondary">{{ s.desc }}</span>
              </div>
            </div>
            <p class="mt-6 text-center text-xs text-fg-tertiary">
              完整快捷键列表在「设置 → 快捷键」中
            </p>
          </section>
        </Transition>
      </div>

      <!-- 底部操作栏 -->
      <div
        class="flex items-center justify-between border-t border-line-subtle bg-surface-0 px-8 py-4"
      >
        <UButton variant="ghost" size="md" :disabled="step === 1" @click="prev">
          <AppIcon icon="arrow-left-line" :size="16" />
          <span>上一步</span>
        </UButton>

        <div class="flex items-center gap-2">
          <span
            v-for="i in TOTAL_STEPS"
            :key="i"
            class="h-1.5 rounded-full transition-all duration-normal"
            :class="
              i === step
                ? 'w-6 bg-brand-500'
                : i < step
                  ? 'w-1.5 bg-brand-300'
                  : 'w-1.5 bg-surface-active'
            "
          />
        </div>

        <UButton variant="primary" size="md" :disabled="!canNext" @click="next">
          <span>{{ step === TOTAL_STEPS ? '开始使用' : '下一步' }}</span>
          <AppIcon :icon="step === TOTAL_STEPS ? 'check-line' : 'arrow-right-line'" :size="16" />
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-back-enter-active,
.slide-back-leave-active {
  transition: all var(--motion-slow) cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-forward-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.slide-forward-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}
.slide-back-enter-from {
  opacity: 0;
  transform: translateX(-40px);
}
.slide-back-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>

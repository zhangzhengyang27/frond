/**
 * Leaf · 胶囊玻璃档（P-6 浅色纯白那一格）
 *
 * 现状是浅色主题下胶囊完全不透明（--launcher-bg: #ffffff、--launcher-blur: blur(0)），
 * 系统的 vibrancy 白做了。这一格加的是**用户可选**的透明度，不是改默认观感：
 * 默认档 `opaque` 什么都不覆盖，样式里 var() 的兜底值就是原来的 token 值，
 * 所以现有用户的胶囊一个像素都不会变（改视觉 token 值要过 DESIGN_TOKENS 那条纪律，
 * 不该被一个功能顺手带过去）。
 *
 * 透明度用 `color-mix(在 --launcher-bg 上掺透明)` 派生，而不是另写一套 rgba 常量：
 * 这样深色档自动是「深色半透明毛玻璃」、浅色档自动是「白色半透明」，
 * 不必为两种主题各维护一组数值（也就不会漂移）。
 */

/**
 * 覆盖范围（实测口径，别再当成"整窗都透了"）：
 * 两个底色变量只写在胶囊自己的样式里（`LauncherApp.vue` 的面板 + 悬浮层，共 19 处），
 * 内页（NotesPage / FilesPage / AIChatPage / FormPage …）仍是 44 处直读
 * `var(--launcher-bg-elevated)` 的实色表面。所以开了 soft/clear 之后看到的是
 * 「透的框 + 不透的内容」，而不是整块毛玻璃。
 * 要做到后者得让 token 本身过一层玻璃（`--launcher-bg: var(--leaf-capsule-bg, 基色)`，
 * 基色另存一个名字否则自引用成环），那是连同 theme bridge 键数一起改的活，
 * 已登记在 V5 计划的待办里，不在这一格顺手做。
 *
 * `blur` 这一项：胶囊窗是透明窗 + 系统 vibrancy（见 `main/launcher/window.ts` 的创建参数），
 * CSS `backdrop-filter` 在这种窗里没有可采样的页内背景，所以**通透感来自底色 alpha +
 * 系统材质**，不是这串 blur。它留着是因为浅色/深色 token 本来就带这个键，
 * 删掉反而要动一批计算样式断言。
 */
export type CapsuleGlass = 'opaque' | 'soft' | 'clear'

export const CAPSULE_GLASS_VALUES: readonly CapsuleGlass[] = ['opaque', 'soft', 'clear']

export interface GlassVars {
  /** 面板底色；null = 不覆盖，走 token 原值（完全不透明） */
  bg: string | null
  /** 背景模糊；null = 不覆盖 */
  blur: string | null
  /** 悬浮层（详情面板 / 弹层）同步用的底色 */
  elevated: string | null
}

export const CAPSULE_GLASS: Record<CapsuleGlass, GlassVars> = {
  opaque: { bg: null, blur: null, elevated: null },
  soft: {
    bg: 'color-mix(in srgb, var(--launcher-bg) 92%, transparent)',
    elevated: 'color-mix(in srgb, var(--launcher-bg-elevated) 92%, transparent)',
    blur: 'blur(18px)'
  },
  clear: {
    bg: 'color-mix(in srgb, var(--launcher-bg) 78%, transparent)',
    elevated: 'color-mix(in srgb, var(--launcher-bg-elevated) 78%, transparent)',
    blur: 'blur(26px)'
  }
}

export const DEFAULT_CAPSULE_GLASS: CapsuleGlass = 'opaque'

/** 只认三档；其余（存量脏数据 / 手改库）回落默认档 = 观感不变 */
export function normalizeGlass(raw: unknown): CapsuleGlass {
  return raw === 'soft' || raw === 'clear' ? raw : DEFAULT_CAPSULE_GLASS
}

export const GLASS_CSS_VARS: Record<keyof GlassVars, string> = {
  bg: '--leaf-capsule-bg',
  blur: '--leaf-capsule-blur',
  elevated: '--leaf-capsule-bg-elevated'
}

/**
 * 落到根元素上。null 用 removeProperty 而不是 setProperty(空串)：
 * 实测两者在 Chromium 里等价（CSSOM 把空值当删除），但「删掉变量」才是这里要表达的语义，
 * 不必让默认档依赖那条容易读错的规范细节。
 */
export function applyGlassVars(
  target: {
    style: { setProperty(k: string, v: string): void; removeProperty(k: string): void }
  },
  glass: CapsuleGlass
): void {
  const vars = CAPSULE_GLASS[normalizeGlass(glass)]
  for (const key of Object.keys(vars) as Array<keyof GlassVars>) {
    const value = vars[key]
    // null = 这一档不覆盖，交回 tokens.css。必须 removeProperty：
    // setProperty(name, '') 留下的是「guaranteed-invalid」的空自定义属性，
    // 消费端 `var(--leaf-capsule-blur)` 没写兜底值时会整体失效（玻璃档直接不见），
    // 与「不覆盖」差一个世界 —— opaque 档的承诺就是观感与改动前完全一致。
    if (value === null) target.style.removeProperty(GLASS_CSS_VARS[key])
    else target.style.setProperty(GLASS_CSS_VARS[key], value)
  }
}

# 插件宿主能力扩展 + 测试基建 实施计划（计划 1/3）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给插件协议补齐 spec 定义的 4 项 UI 能力（icon 颜色块/图片、列表分组、showHud、tag 徽章）并确立插件 lib.js 测试基建，为后续 21 个插件批量重写（计划 2/3）打底。

**Architecture:** 新字段清洗函数全部放 `src/shared/plugin-protocol.ts`（fail-closed 风格与既有清洗器一致），data 模式（`runtime.ts setDeclaredList` 内联清洗抽为 shared 纯函数）与 React 模式（`sanitizeViewListItem`/`parsePluginView`）两路接入；渲染端 `PluginListPage.vue` 消费新字段（分组头聚合渲染、dataUrl 缩略图、tintColor 透传 AppIcon、tag 徽章）；showHud 走 `plugapi:hud` → 主进程 → `launcher:plugin-hud` 推送 → 胶囊 `PluginHud.vue` 独立组件。

**Tech Stack:** TypeScript + Vue 3（`<script setup>`）/ vitest（happy-dom 用于 .vue 测试）/ Electron typedHandle IPC。

**Spec:** `docs/superpowers/specs/2026-10-05-builtin-plugins-redesign-design.md`（第 3 节宿主能力扩展、第 4 节公约第 1 条测试基建、第 9 节风险）

## Global Constraints（spec 原文数值，逐条硬编码进清洗器）

- dataUrl：必须以 `data:image/png;base64,` 开头，**字符串总长 ≤ 65536 字符**，超限剥除整个 icon 对象的 dataUrl 字段（icon 其余字段保留）。
- tintColor：仅 `#rgb` / `#rrggbb`（正则 `^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`），非法剥除该字段。
- section：trim 后 ≤ 40 字符，空串剥除。
- tag 文本：trim 后 ≤ 12 字符，空串剥除该元素；tone 只认 `default/success/warn/danger`，其余剥除 tone（tag 保留）。
- HUD title：trim 后 ≤ 80 字符，空串拒绝（handler 返回 false）。
- 向后兼容：旧插件不传新字段行为不变；icon 纯字符串仍是合法形状。
- data 模式现有限额不变：条目 ≤300、title ≤200、subtitle ≤300、detail ≤5000、动作 ≤10、payload ≤2000、accessories ≤3。
- 「有意的行为修正」（Task 2 中注明即可，不额外测试旧 bug）：data 模式 accessories 元素从 `map(String)`（非字符串变 `[object Object]`）改为逐元素清洗剔除；icon 字符串分支统一 trim + 截 40 字符（与 React 侧对齐）。
- 门禁命令：`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm lint:css`。
- 主进程/preload 改动不热更：Task 4 完成后必须完整重启 dev（`pnpm dev` 前先杀干净 electron 子进程）冒烟。

## Review Focus（spec 隐含但任务测试未覆盖、最易咬人的输入）

1. **插件提交 65536 字符恰好压线的 dataUrl** —— 应被接受；65537 应剥 dataUrl 但保留 tintColor/value（Task 1 测试钉住边界两值）。
2. **section 大小写与空格**：`" 结果 "` 与 `"结果"` 应归一为同一组（trim 后聚合）；`section: ""` 应视为无组（Task 1 + Task 3 测试钉住）。
3. **组头不占键盘选择位**：分组渲染后 ArrowDown/Enter 的 selectedIndex 必须仍对应 `props.items` 下标，跳过组头（Task 3 测试钉住）。
4. **HUD 同文本连发**：1.5s 内两次相同 title 只显示一次并刷新计时，不闪烁重挂（Task 4 测试钉住）。
5. **旧插件零回归**：只传 `icon: "ri-plug-2"` + 纯 string accessories 的旧形状条目，渲染与升级前逐字节一致（Task 1/2/3 各自的向后兼容用例钉住）。

---

### Task 1: shared 协议新类型 + 清洗函数（TDD）

**Files:**
- Modify: `src/shared/plugin-protocol.ts`（`PluginListItem` 16-31 行、`PluginViewListItem` 265-274 行、`sanitizeViewListItem` 305-340 行附近追加）
- Test: `src/shared/__tests__/pluginListProtocol.test.ts`（新建）

**Interfaces:**
- Consumes: 无（纯新增）。
- Produces（Task 2/3/4 依赖的精确签名）:

```ts
/** icon 对象形状（spec 3.1） */
export interface PluginListItemIcon {
  value: string
  tintColor?: string | undefined
  dataUrl?: string | undefined
}
/** icon 合法形状：纯字符串（向后兼容）或对象 */
export type PluginListIcon = string | PluginListItemIcon

/** tag 徽章（spec 3.4） */
export interface PluginAccessoryTag {
  tag: string
  tone?: 'default' | 'success' | 'warn' | 'danger'
}

export const PLUGIN_MAX_ICON_DATAURL = 65536
export const PLUGIN_MAX_SECTION_LEN = 40
export const PLUGIN_MAX_TAG_LEN = 12
export const PLUGIN_MAX_HUD_TITLE = 80

export function sanitizePluginListIcon(raw: unknown): PluginListIcon | undefined
export function sanitizePluginSection(raw: unknown): string | undefined
export function sanitizePluginAccessories(raw: unknown): Array<string | PluginAccessoryTag> | undefined
export function sanitizePluginHudTitle(raw: unknown): string | null
```

- 同任务内 `PluginListItem` 与 `PluginViewListItem` 的字段签名改为：`icon?: PluginListIcon | undefined`、`accessories?: Array<string | PluginAccessoryTag> | undefined`、`section?: string | undefined`。

- [ ] **Step 1: 写失败测试**（新建 `src/shared/__tests__/pluginListProtocol.test.ts`，参照同目录 `pluginArguments.test.ts` 的 import 风格）

```ts
import { describe, it, expect } from 'vitest'
import {
  sanitizePluginListIcon,
  sanitizePluginSection,
  sanitizePluginAccessories,
  sanitizePluginHudTitle,
  PLUGIN_MAX_ICON_DATAURL
} from '../plugin-protocol'

describe('sanitizePluginListIcon', () => {
  it('纯字符串向后兼容：trim + 截 40 字符', () => {
    expect(sanitizePluginListIcon('ri-plug-2')).toBe('ri-plug-2')
    expect(sanitizePluginListIcon('  ri-git-branch  ')).toBe('ri-git-branch')
    expect(sanitizePluginListIcon('x'.repeat(50))).toBe('x'.repeat(40))
  })
  it('对象：value 必填非空，其余字段剥离保留', () => {
    expect(sanitizePluginListIcon({ value: 'ri-git-branch', tintColor: '#ff0' })).toEqual({
      value: 'ri-git-branch',
      tintColor: '#ff0'
    })
    expect(sanitizePluginListIcon({ value: '  ri-plug-2 ' })).toEqual({ value: 'ri-plug-2' })
  })
  it('tintColor 仅 #rgb/#rrggbb，非法剥除', () => {
    expect(sanitizePluginListIcon({ value: 'a', tintColor: 'red' })).toEqual({ value: 'a' })
    expect(sanitizePluginListIcon({ value: 'a', tintColor: '#ffff' })).toEqual({ value: 'a' })
    expect(sanitizePluginListIcon({ value: 'a', tintColor: '#A1B2C3' })).toEqual({
      value: 'a',
      tintColor: '#A1B2C3'
    })
  })
  it(`dataUrl：合法前缀且 ≤ ${PLUGIN_MAX_ICON_DATAURL} 保留；压线接受、超限剥除但保留 value/tintColor`, () => {
    const ok = 'data:image/png;base64,' + 'A'.repeat(100)
    expect(sanitizePluginListIcon({ value: 'a', dataUrl: ok })).toEqual({ value: 'a', dataUrl: ok })
    const edge = 'data:image/png;base64,' + 'A'.repeat(PLUGIN_MAX_ICON_DATAURL - 22) // 总长恰 65536
    expect(sanitizePluginListIcon({ value: 'a', dataUrl: edge })?.dataUrl).toBe(edge)
    const over = edge + 'X'
    expect(sanitizePluginListIcon({ value: 'a', tintColor: '#fff', dataUrl: over })).toEqual({
      value: 'a',
      tintColor: '#fff'
    })
  })
  it('dataUrl 前缀错 / 非字符串 / value 缺失 → 整体 undefined', () => {
    expect(sanitizePluginListIcon({ value: 'a', dataUrl: 'http://x/y.png' })).toEqual({ value: 'a' })
    expect(sanitizePluginListIcon({ dataUrl: 'data:image/png;base64,AA' })).toBeUndefined()
    expect(sanitizePluginListIcon(42)).toBeUndefined()
  })
})

describe('sanitizePluginSection', () => {
  it('trim + 截 40，空串/非字符串 → undefined', () => {
    expect(sanitizePluginSection('  结果 ')).toBe('结果')
    expect(sanitizePluginSection('s'.repeat(50))).toBe('s'.repeat(40))
    expect(sanitizePluginSection('   ')).toBeUndefined()
    expect(sanitizePluginSection(7)).toBeUndefined()
  })
})

describe('sanitizePluginAccessories', () => {
  it('纯字符串元素向后兼容（trim、截 40、空剔除、≤3）', () => {
    expect(sanitizePluginAccessories([' AA ', ''])).toEqual(['AA'])
    expect(sanitizePluginAccessories(['1', '2', '3', '4'])).toEqual(['1', '2', '3'])
  })
  it('tag 对象：截 12、tone 白名单外剥 tone、非字符串剔除', () => {
    expect(sanitizePluginAccessories([{ tag: ' AAAA ' }])).toEqual([{ tag: 'AAAA' }])
    expect(sanitizePluginAccessories([{ tag: 'AAA', tone: 'nope' }])).toEqual([{ tag: 'AAA' }])
    expect(sanitizePluginAccessories([{ tag: 'AA', tone: 'danger' }])).toEqual([
      { tag: 'AA', tone: 'danger' }
    ])
    expect(sanitizePluginAccessories([{ tone: 'danger' }, 5, 'ok'])).toEqual(['ok'])
  })
  it('非数组 → undefined；空数组 → undefined', () => {
    expect(sanitizePluginAccessories('x')).toBeUndefined()
    expect(sanitizePluginAccessories([])).toBeUndefined()
  })
})

describe('sanitizePluginHudTitle', () => {
  it('trim + 截 80；空 → null', () => {
    expect(sanitizePluginHudTitle(' 已复制 ')).toBe('已复制')
    expect(sanitizePluginHudTitle('h'.repeat(100))).toBe('h'.repeat(80))
    expect(sanitizePluginHudTitle('  ')).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/shared/__tests__/pluginListProtocol.test.ts`
Expected: FAIL —— 4 个导入符号不存在（plugin-protocol.ts 未导出）。

- [ ] **Step 3: 实现**（在 `src/shared/plugin-protocol.ts` 的 `PluginListItem` 定义前插入新类型与常量，接口与清洗函数放在「─── 插件敏感权限」注释块之前；同步把 `PluginListItem`（16-31 行）与 `PluginViewListItem`（265-274 行）的 `icon`/`accessories` 字段类型改为 union、新增 `section` 字段）

```ts
/** icon 对象形状（spec 3.1）：value 为 remixicon 名（不含 ri- 前缀） */
export interface PluginListItemIcon {
  value: string
  tintColor?: string | undefined
  dataUrl?: string | undefined
}
export type PluginListIcon = string | PluginListItemIcon

export interface PluginAccessoryTag {
  tag: string
  tone?: 'default' | 'success' | 'warn' | 'danger'
}

export const PLUGIN_MAX_ICON_DATAURL = 65536
export const PLUGIN_MAX_SECTION_LEN = 40
export const PLUGIN_MAX_TAG_LEN = 12
export const PLUGIN_MAX_HUD_TITLE = 80

const TAG_TONES = new Set(['default', 'success', 'warn', 'danger'])
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const DATAURL_PREFIX = 'data:image/png;base64,'

export function sanitizePluginListIcon(raw: unknown): PluginListIcon | undefined {
  if (typeof raw === 'string') {
    const v = raw.trim().slice(0, 40)
    return v === '' ? undefined : v
  }
  if (typeof raw !== 'object' || raw === null) return undefined
  const rec = raw as Record<string, unknown>
  if (typeof rec.value !== 'string') return undefined
  const value = rec.value.trim().slice(0, 40)
  if (value === '') return undefined
  const icon: PluginListItemIcon = { value }
  if (typeof rec.tintColor === 'string' && HEX_COLOR_RE.test(rec.tintColor.trim())) {
    icon.tintColor = rec.tintColor.trim()
  }
  if (
    typeof rec.dataUrl === 'string' &&
    rec.dataUrl.startsWith(DATAURL_PREFIX) &&
    rec.dataUrl.length <= PLUGIN_MAX_ICON_DATAURL
  ) {
    icon.dataUrl = rec.dataUrl
  }
  return icon
}

export function sanitizePluginSection(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const v = raw.trim().slice(0, PLUGIN_MAX_SECTION_LEN)
  return v === '' ? undefined : v
}

export function sanitizePluginAccessories(
  raw: unknown
): Array<string | PluginAccessoryTag> | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: Array<string | PluginAccessoryTag> = []
  for (const el of raw) {
    if (out.length >= 3) break
    if (typeof el === 'string') {
      const v = el.trim().slice(0, 40)
      if (v !== '') out.push(v)
    } else if (typeof el === 'object' && el !== null) {
      const rec = el as Record<string, unknown>
      if (typeof rec.tag !== 'string') continue
      const tag = rec.tag.trim().slice(0, PLUGIN_MAX_TAG_LEN)
      if (tag === '') continue
      const acc: PluginAccessoryTag = { tag }
      if (typeof rec.tone === 'string' && TAG_TONES.has(rec.tone)) {
        acc.tone = rec.tone as PluginAccessoryTag['tone']
      }
      out.push(acc)
    }
  }
  return out.length > 0 ? out : undefined
}

export function sanitizePluginHudTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().slice(0, PLUGIN_MAX_HUD_TITLE)
  return v === '' ? null : v
}
```

再改两个接口的字段（fail-closed 语义不变，只是形状扩宽）：

```ts
// PluginListItem 与 PluginViewListItem 各自：
  /** remixicon 名或 { value, tintColor, dataUrl }（缺省 plug-2） */
  icon?: PluginListIcon | undefined
  /** 右侧配件：文本或 tag 徽章（≤3） */
  accessories?: Array<string | PluginAccessoryTag> | undefined
  /** 分组名（渲染层相邻同名聚合为组头） */
  section?: string | undefined
```

- [ ] **Step 4: 跑测试确认通过 + 全量 typecheck**

Run: `pnpm vitest run src/shared/__tests__/pluginListProtocol.test.ts && pnpm typecheck:node`
Expected: 测试 PASS；typecheck 会报 `runtime.ts`/`PluginListPage.vue` 等消费方的 icon/accessories 类型收窄错误 —— 若有，先把消费方报错处按新 union 类型补窄化（`typeof icon === 'string'` 判断），保持行为不变（渲染改造在 Task 3）。

- [ ] **Step 5: Commit**

```bash
git add src/shared/plugin-protocol.ts src/shared/__tests__/pluginListProtocol.test.ts src/main/launcher/runtime.ts src/renderer/src/launcher/pages/PluginListPage.vue
git commit -m "feat(plugin-protocol): 条目 icon 颜色块/图片、分组、tag 徽章的类型与 fail-closed 清洗"
```

---

### Task 2: data 模式清洗抽纯函数 + 两路接入（runtime / parsePluginView）

**Files:**
- Modify: `src/shared/plugin-protocol.ts`（新增 `sanitizeDataModeListItem`；`parsePluginView` 397-413 行 section 注入；`sanitizeViewListItem` 305-340 行接入 icon/accessories/section 清洗）
- Modify: `src/main/launcher/runtime.ts:127-201`（`setDeclaredList` 内联清洗改为调用 shared 纯函数）
- Test: `src/shared/__tests__/pluginDataModeItem.test.ts`（新建）；`src/shared/__tests__/pluginListProtocol.test.ts`（追加 React 路用例）

**Interfaces:**
- Consumes: Task 1 的 `sanitizePluginListIcon` / `sanitizePluginSection` / `sanitizePluginAccessories`。
- Produces:

```ts
/**
 * data 模式（renderList）单条清洗。返回 null 的条件 = runtime 现行整批拒绝条件：
 * raw 非 object / title 非 string / actions 非数组。其余字段逐项清洗（限额：
 * title 200 / subtitle 300 / detail 5000 / payload 2000 / actions 10 / accessories 3）。
 * reactMode 仅控制 callbackId 是否透传（runtime 现行为：ctx.plugin.api === 'react'）。
 */
export function sanitizeDataModeListItem(
  item: unknown,
  opts: { reactMode: boolean }
): PluginListItem | null
```

- [ ] **Step 1: 写失败测试**（`src/shared/__tests__/pluginDataModeItem.test.ts`）

```ts
import { describe, it, expect } from 'vitest'
import { sanitizeDataModeListItem } from '../plugin-protocol'

const baseItem = {
  title: '结果',
  actions: [{ label: '复制', type: 'copy', payload: 'x' }]
}

describe('sanitizeDataModeListItem', () => {
  it('向后兼容：旧形状条目字段逐项等价清洗', () => {
    const out = sanitizeDataModeListItem(
      { ...baseItem, subtitle: '副标题', icon: 'ri-plug-2', accessories: ['1 KB'], detail: '正文', detailFormat: 'markdown' },
      { reactMode: false }
    )
    expect(out).toEqual({
      title: '结果',
      subtitle: '副标题',
      icon: 'ri-plug-2',
      accessories: ['1 KB'],
      detail: '正文',
      detailFormat: 'markdown',
      actions: [{ label: '复制', type: 'copy', payload: 'x' }]
    })
  })
  it('null 条件与 runtime 现行整批拒绝一致：非 object / title 非 string / actions 非数组', () => {
    expect(sanitizeDataModeListItem(null, { reactMode: false })).toBeNull()
    expect(sanitizeDataModeListItem({ actions: [] }, { reactMode: false })).toBeNull()
    expect(sanitizeDataModeListItem({ title: 't', actions: 'x' }, { reactMode: false })).toBeNull()
  })
  it('新字段：icon 对象 / tag 徽章 / section 透传清洗', () => {
    const out = sanitizeDataModeListItem(
      {
        ...baseItem,
        icon: { value: 'ri-plug-2', tintColor: '#f00' },
        accessories: [{ tag: 'AA', tone: 'success' }],
        section: ' 分组一 '
      },
      { reactMode: false }
    )
    expect(out?.icon).toEqual({ value: 'ri-plug-2', tintColor: '#f00' })
    expect(out?.accessories).toEqual([{ tag: 'AA', tone: 'success' }])
    expect(out?.section).toBe('分组一')
  })
  it('data 模式不透传 callbackId；react 模式透传', () => {
    const item = { ...baseItem, actions: [{ label: 'a', type: 'callback', callbackId: 'cb1' }] }
    expect(sanitizeDataModeListItem(item, { reactMode: false })?.actions[0]?.callbackId).toBeUndefined()
    expect(sanitizeDataModeListItem(item, { reactMode: true })?.actions[0]?.callbackId).toBe('cb1')
  })
  it('限额钉子：title 200 / subtitle 300 / detail 5000 / actions 10 / accessories 3', () => {
    const out = sanitizeDataModeListItem(
      {
        title: 't'.repeat(300),
        subtitle: 's'.repeat(400),
        detail: 'd'.repeat(6000),
        accessories: ['1', '2', '3', '4'],
        actions: Array.from({ length: 12 }, (_, i) => ({ label: `a${i}`, type: 'copy', payload: 'p' }))
      },
      { reactMode: false }
    )
    expect(out?.title.length).toBe(200)
    expect(out?.subtitle?.length).toBe(300)
    expect(out?.detail?.length).toBe(5000)
    expect(out?.accessories?.length).toBe(3)
    expect(out?.actions.length).toBe(10)
  })
})
```

并在 `src/shared/__tests__/pluginListProtocol.test.ts` 追加 React 路用例：

```ts
describe('parsePluginView section 注入（spec 3.2）', () => {
  it('sections 组名注入条目 section 字段，顺序保持', () => {
    const view = {
      $t: 'list',
      sections: [
        { title: 'SHA256', items: [{ title: 'a', actions: [] }] },
        { title: 'SHA1', items: [{ title: 'b', actions: [] }] }
      ]
    }
    const out = parsePluginView(view)
    expect(out.map((i) => i.section)).toEqual(['SHA256', 'SHA1'])
    expect(out.map((i) => i.title)).toEqual(['a', 'b'])
  })
  it('sanitizeViewListItem 接收条目自带 section / icon 对象 / tag 徽章', () => {
    const out = parsePluginView({
      $t: 'list',
      items: [
        {
          title: 'x',
          section: '组',
          icon: { value: 'ri-plug-2', tintColor: '#0f0' },
          accessories: [{ tag: 'OK', tone: 'success' }],
          actions: []
        }
      ]
    })
    expect(out[0]?.section).toBe('组')
    expect(out[0]?.icon).toEqual({ value: 'ri-plug-2', tintColor: '#0f0' })
    expect(out[0]?.accessories).toEqual([{ tag: 'OK', tone: 'success' }])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/shared/__tests__/pluginDataModeItem.test.ts src/shared/__tests__/pluginListProtocol.test.ts`
Expected: 新文件 FAIL（`sanitizeDataModeListItem` 未导出）、追加用例 FAIL（section 未注入）。

- [ ] **Step 3: 实现**

3a. `plugin-protocol.ts` 新增（放在 Task 1 清洗函数之后）——逻辑从 `runtime.ts setDeclaredList:137-177` 原样搬移，仅 icon/accessories/section 三处替换为 Task 1 清洗器：

```ts
export function sanitizeDataModeListItem(
  item: unknown,
  opts: { reactMode: boolean }
): PluginListItem | null {
  if (typeof item !== 'object' || item === null) return null
  const rec = item as Record<string, unknown>
  if (typeof rec.title !== 'string' || !Array.isArray(rec.actions)) return null
  const actions: PluginItemAction[] = rec.actions.slice(0, 10).map((a) => {
    const action = (a ?? {}) as Record<string, unknown>
    return {
      label: String(action.label ?? '执行').slice(0, 60),
      type: (['copy', 'open', 'callback'].includes(String(action.type))
        ? String(action.type)
        : 'callback') as PluginItemAction['type'],
      ...(typeof action.payload === 'string' && { payload: action.payload.slice(0, 2000) }),
      // #11 回调 id 仅 react 模式透传（审查 M7：数据模式不得走 Callback 分支）
      ...(opts.reactMode &&
      typeof action.callbackId === 'string' &&
      action.callbackId.trim() !== '' && { callbackId: action.callbackId.slice(0, 64) })
    }
  })
  const out: PluginListItem = { title: rec.title.slice(0, 200), actions }
  if (typeof rec.subtitle === 'string') out.subtitle = rec.subtitle.slice(0, 300)
  const icon = sanitizePluginListIcon(rec.icon)
  if (icon !== undefined) out.icon = icon
  const accessories = sanitizePluginAccessories(rec.accessories)
  if (accessories !== undefined) out.accessories = accessories
  const section = sanitizePluginSection(rec.section)
  if (section !== undefined) out.section = section
  if (typeof rec.detail === 'string') out.detail = rec.detail.slice(0, 5000)
  if (rec.detailFormat === 'markdown' || rec.detailFormat === 'text') {
    out.detailFormat = rec.detailFormat
  }
  return out
}
```

3b. `runtime.ts setDeclaredList` 137-177 行的 for 循环体替换为：

```ts
  const list: PluginListItem[] = []
  for (const raw of items.slice(0, PLUGIN_MAX_VIEW_ITEMS)) {
    const item = sanitizeDataModeListItem(raw, { reactMode: ctx.plugin.api === 'react' })
    // 保持现行语义：非法条目整批拒绝（不静默剔除）
    if (!item) return { ok: false, error: raw === null || typeof raw !== 'object' ? 'bad item' : 'item needs title and actions' }
    list.push(item)
  }
```

（`ctx.plugin.api` 若在该作用域不可达，从 `viewsByWebContents.get(senderId)` 的 ctx 上取 —— 现函数已有 `ctx`。）

3c. `sanitizeViewListItem`（305-340 行）内接入：`icon` 行改为 `const icon = sanitizePluginListIcon(rec.icon); if (icon !== undefined) item.icon = icon`；`accessories` 块改为 `const acc = sanitizePluginAccessories(rec.accessories); if (acc) item.accessories = acc`；追加 `const sec = sanitizePluginSection(rec.section); if (sec) item.section = sec`。

3d. `parsePluginView`（406-412 行）sections 分支注入组名：

```ts
  if (Array.isArray(node.sections)) {
    for (const section of node.sections.slice(0, 20)) {
      if (typeof section !== 'object' || section === null) continue
      const title = sanitizePluginSection((section as PluginViewSection).title)
      const start = out.length
      pushItems((section as PluginViewSection).items)
      if (title) for (let i = start; i < out.length; i++) out[i]!.section = title
    }
  }
```

- [ ] **Step 4: 跑测试 + typecheck 全绿**

Run: `pnpm vitest run src/shared/__tests__/pluginDataModeItem.test.ts src/shared/__tests__/pluginListProtocol.test.ts && pnpm typecheck:node`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/shared/plugin-protocol.ts src/shared/__tests__/pluginDataModeItem.test.ts src/shared/__tests__/pluginListProtocol.test.ts src/main/launcher/runtime.ts
git commit -m "refactor(plugin): data 模式条目清洗抽 shared 纯函数，两路接入 icon/section/tag 新字段"
```

---

### Task 3: PluginListPage.vue 渲染分组 / 颜色块 / 图片 / tag 徽章

**Files:**
- Modify: `src/renderer/src/launcher/pages/PluginListPage.vue`（模板 7-25 行列表区、script 49-213 行、style 尾部追加）
- Test: `src/renderer/src/launcher/pages/__tests__/PluginListPage.render.test.ts`（新建）

**Interfaces:**
- Consumes: Task 1/2 的 `PluginListItem.icon: PluginListIcon`、`section?: string`、`accessories?: Array<string | PluginAccessoryTag>`；`AppIcon.vue` 的 `color` prop（已存在，`AppIcon.vue:7`）。
- Produces: 渲染行为（DOM class：`plist-header` 组头、`plist-thumb` 缩略图、`plist-tag`/`plist-tag--success|warn|danger` 徽章）；`handleKey`/`runItem`/`selectedIndex` 对外契约不变。

- [ ] **Step 1: 写失败测试**（`// @vitest-environment happy-dom`，参照 `PopoverSelect.test.ts` 的 mount 模式；capsule 依赖用 `globalThis.window.api` stub —— 若 mount 因 `CapsulePage` 内部依赖报错，用 `stubs: { CapsulePage: { template: '<div><slot /><slot name="detail" /></div>' } }` 透传插槽）

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PluginListPage from '../PluginListPage.vue'
import type { PluginListItem } from '@shared/plugin-protocol'

const base: PluginListItem = {
  title: 'A',
  icon: 'ri-plug-2',
  actions: [{ label: '复制', type: 'copy', payload: 'x' }]
}

function mountPage(items: PluginListItem[]) {
  return mount(PluginListPage, {
    props: { pluginId: 'p', items },
    global: {
      stubs: { CapsulePage: { template: '<div><slot /><slot name="detail" /></div>' } }
    }
  })
}

describe('PluginListPage 新字段渲染（spec 3.1/3.2/3.4）', () => {
  it('旧形状零回归：纯字符串 icon + string accessories 不出现组头/缩略图/tag', () => {
    const w = mountPage([base])
    expect(w.find('.plist-header').exists()).toBe(false)
    expect(w.find('.plist-thumb').exists()).toBe(false)
    expect(w.find('.plist-tag').exists()).toBe(false)
    expect(w.find('.plist-accessory').text()).toBe('1 KB')
  })
  it('相邻同名 section 聚合一个组头；不同名断开；无 section 打断', () => {
    const w = mountPage([
      { ...base, title: '1', section: '组A' },
      { ...base, title: '2', section: ' 组A ' }, // trim 后同名 → 不重复组头
      { ...base, title: '3', section: '组B' },
      { ...base, title: '4' }, // 无组 → 打断
      { ...base, title: '5', section: '组A' } // 再出现 → 新组头
    ])
    const headers = w.findAll('.plist-header')
    expect(headers.map((h) => h.text())).toEqual(['组A', '组B', '组A'])
  })
  it('tintColor 透传 AppIcon color；dataUrl 渲染 img.plist-thumb 且不渲染 AppIcon', () => {
    const w = mountPage([
      { ...base, icon: { value: 'ri-drop', tintColor: '#ff0000' } },
      { ...base, title: 'B', icon: { value: 'ri-drop', dataUrl: 'data:image/png;base64,AAA' } }
    ])
    const first = w.findAll('.plist-icon')[0]!
    expect(first.find('svg, i').attributes('style') ?? '').toContain('--ff0000') // AppIcon color 落到内联样式
    const second = w.findAll('.plist-icon')[1]!
    expect(second.find('img.plist-thumb').attributes('src')).toBe('data:image/png;base64,AAA')
  })
  it('tag 徽章：tone class 映射；string 元素仍是 .plist-accessory', () => {
    const w = mountPage([
      { ...base, accessories: ['纯文本', { tag: 'AA', tone: 'success' }, { tag: 'X' }] }
    ])
    const tags = w.findAll('.plist-tag')
    expect(tags).toHaveLength(2)
    expect(tags[0]!.classes()).toContain('plist-tag--success')
    expect(tags[1]!.classes()).not.toContain('plist-tag--success')
  })
  it('组头不占选择位：moveSelection 语义不变（首个条目默认选中）', () => {
    const w = mountPage([
      { ...base, title: '1', section: '组' },
      { ...base, title: '2', section: '组' }
    ])
    const items = w.findAll('.plist-item')
    expect(items).toHaveLength(2)
    expect(items[0]!.classes()).toContain('selected')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/renderer/src/launcher/pages/__tests__/PluginListPage.render.test.ts`
Expected: FAIL —— `.plist-header` / `.plist-thumb` / `.plist-tag` 不存在；tintColor 用例 FAIL。

- [ ] **Step 3: 实现**

3a. script 追加（`selectedIndex` 定义之后）：

```ts
import type { PluginListItem, PluginListIcon } from '@shared/plugin-protocol'

/** 相邻同名 section 聚合为组头行；组头不占 items 下标（键盘选择仍按 items 索引） */
const rows = computed<Array<{ kind: 'header'; label: string } | { kind: 'item'; index: number }>>(
  () => {
    const out: Array<{ kind: 'header'; label: string } | { kind: 'item'; index: number }> = []
    let last: string | null = null
    props.items.forEach((item, index) => {
      const s = item.section ?? null
      if (s && s !== last) {
        out.push({ kind: 'header', label: s })
        last = s
      } else if (!s) {
        last = null
      }
      out.push({ kind: 'item', index })
    })
    return out
  }
)

function iconName(item: PluginListItem): string {
  const i = item.icon as PluginListIcon | undefined
  if (typeof i === 'string') return i || 'plug-2'
  return i?.value || 'plug-2'
}
function iconTint(item: PluginListItem): string | undefined {
  const i = item.icon
  return i && typeof i === 'object' ? i.tintColor : undefined
}
function iconThumb(item: PluginListItem): string | undefined {
  const i = item.icon
  return i && typeof i === 'object' ? i.dataUrl : undefined
}
function isTag(a: string | { tag: string; tone?: string }): a is { tag: string; tone?: string } {
  return typeof a === 'object'
}
```

3b. 模板列表区（8-25 行）替换为遍历 `rows`（外层组头 + 内层条目；条目模板除 icon/accessories 外原样保留）：

```html
      <div v-else class="plist-list">
        <template v-for="(row, ri) in rows" :key="row.kind === 'header' ? `h${ri}-${row.label}` : `i${row.index}`">
          <div v-if="row.kind === 'header'" class="plist-header">{{ row.label }}</div>
          <div
            v-else
            class="plist-item"
            :class="{ selected: row.index === selectedIndex }"
            @mouseenter="selectedIndex = row.index"
            @click="runDefault(row.index)"
          >
            <div class="plist-icon">
              <img v-if="iconThumb(items[row.index]!)" class="plist-thumb" :src="iconThumb(items[row.index])" alt="" />
              <AppIcon v-else :icon="iconName(items[row.index]!)" :color="iconTint(items[row.index])" :size="16" />
            </div>
            <div class="plist-text">
              <div class="plist-title">{{ items[row.index]!.title }}</div>
              <div v-if="items[row.index]!.subtitle" class="plist-sub">{{ items[row.index]!.subtitle }}</div>
            </div>
            <template v-for="(a, ai) in items[row.index]!.accessories ?? []" :key="ai">
              <span v-if="!isTag(a)" class="plist-accessory">{{ a }}</span>
              <span v-else class="plist-accessory plist-tag" :class="a.tone && a.tone !== 'default' ? `plist-tag--${a.tone}` : ''">{{ a.tag }}</span>
            </template>
          </div>
        </template>
      </div>
```

3c. style 尾部追加（胶囊域变量 + 系统色回退，tone 三色按 spec 用 macOS 系统色）：

```css
.plist-header {
  padding: 8px 10px 2px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--launcher-text-muted);
  text-transform: uppercase;
}

.plist-thumb {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  object-fit: cover;
}

.plist-tag--success { color: #34c759; }
.plist-tag--warn { color: #ff9f0a; }
.plist-tag--danger { color: #ff453a; }
```

- [ ] **Step 4: 跑测试 + 渲染端 typecheck**

Run: `pnpm vitest run src/renderer/src/launcher/pages/__tests__/PluginListPage.render.test.ts && pnpm typecheck:web && pnpm lint:css`
Expected: PASS（AppIcon color 透传若用 `--ff0000` 断言不稳，改为断言 icon 元素存在且 style 含该色值的小写形式）。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/launcher/pages/PluginListPage.vue src/renderer/src/launcher/pages/__tests__/PluginListPage.render.test.ts
git commit -m "feat(launcher): 插件列表渲染分组头/颜色块/缩略图/tag 徽章——宿主消费新协议字段"
```

---

### Task 4: showHud 全链路

**Files:**
- Modify: `src/shared/ipc-contract.ts:627` 附近（plugapi 段加一行）
- Modify: `src/preload/plugin.ts`（`notify` 68 行后加 `showHud`）
- Modify: `src/main/launcher/ipc.ts`（`plugapi:notify` 642-650 行后加 handler）
- Modify: `src/preload/index.ts:658-662` 附近（加 `onPluginHud`）+ `src/preload/index.d.ts` 同步类型
- Create: `src/renderer/src/launcher/components/PluginHud.vue`
- Modify: `src/renderer/src/launcher/LauncherApp.vue`（挂载组件 + `onPluginHud` 监听；挂载点 = 胶囊窗模板根部容器内、fixed 定位）
- Test: `src/renderer/src/launcher/components/__tests__/PluginHud.test.ts`（新建）；`src/shared/__tests__/pluginListProtocol.test.ts`（sanitizePluginHudTitle 已在 Task 1 覆盖）

**Interfaces:**
- Consumes: Task 1 `sanitizePluginHudTitle`；ipc-contract typedHandle 模式；`preload/index.ts` `onPluginChanged` 的监听器模式（`ipcRenderer.on('launcher:plugin-changed', ...)`）。
- Produces:
  - 插件 API：`launcherApi.showHud(title: string): Promise<boolean>`（插件侧任意插件可用，无需 manifest 权限）。
  - 渲染端监听：`window.api.launcher.onPluginHud(cb: (payload: { title: string; pluginName: string }) => void): () => void`。
  - `PluginHud.vue` `expose({ show })`，`show(title: string): void` —— 1.5s 自动淡出，同文本刷新计时。
  - e2e 计数通道名：`plugapi:hud`；推送通道名：`launcher:plugin-hud`。

- [ ] **Step 1: 写失败测试**（`PluginHud.test.ts`，happy-dom；组件用 fake timers 验证计时与去重）

```ts
// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PluginHud from '../PluginHud.vue'

afterEach(() => vi.useRealTimers())

describe('PluginHud（spec 3.3）', () => {
  it('show() 显示 title，1.5s 后自动消失', () => {
    vi.useFakeTimers()
    const w = mount(PluginHud)
    w.vm.show('已复制')
    expect(w.find('.plugin-hud').text()).toContain('已复制')
    vi.advanceTimersByTime(1500)
    expect(w.find('.plugin-hud').exists()).toBe(false)
  })
  it('同文本连发只显示一条并刷新计时（不闪烁）', () => {
    vi.useFakeTimers()
    const w = mount(PluginHud)
    w.vm.show('已复制')
    vi.advanceTimersByTime(1200)
    w.vm.show('已复制') // 1.2s 时再来一条 → 计时重启
    vi.advanceTimersByTime(1200)
    expect(w.find('.plugin-hud').exists()).toBe(true) // 距第二次 show 只过了 1.2s
    vi.advanceTimersByTime(300)
    expect(w.find('.plugin-hud').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/renderer/src/launcher/components/__tests__/PluginHud.test.ts`
Expected: FAIL —— 组件不存在。

- [ ] **Step 3: 实现**

3a. `PluginHud.vue`：

```vue
<template>
  <Transition name="hud-fade">
    <div v-if="text" class="plugin-hud">{{ text }}</div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * 插件 showHud 轻提示（spec 3.3）：1.5s 自动淡出；同文本连发只刷新计时。
 * 固定在胶囊窗底部居中，pointer-events: none 不挡交互。
 */
import { onBeforeUnmount, ref } from 'vue'

const HIDE_AFTER_MS = 1500
const text = ref('')
let timer: ReturnType<typeof setTimeout> | null = null

function show(title: string): void {
  text.value = title
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    text.value = ''
    timer = null
  }, HIDE_AFTER_MS)
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

defineExpose({ show })
</script>

<style scoped>
.plugin-hud {
  position: fixed;
  left: 50%;
  bottom: 56px;
  transform: translateX(-50%);
  max-width: 70%;
  padding: 7px 16px;
  border-radius: 999px;
  background: var(--launcher-bg-elevated);
  border: 1px solid var(--launcher-border);
  color: var(--launcher-text);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  z-index: 60;
}

.hud-fade-enter-active,
.hud-fade-leave-active {
  transition: opacity 0.15s ease;
}
.hud-fade-enter-from,
.hud-fade-leave-to {
  opacity: 0;
}
</style>
```

3b. `ipc-contract.ts` plugapi 段（`'plugapi:notify'` 627 行后）加：

```ts
  'plugapi:hud': { req: { title: unknown }; res: boolean }
```

3c. `preload/plugin.ts`（`notify` 68 行后）加：

```ts
  /** 轻提示 HUD（胶囊窗内 1.5s 自动消失；纯 UI 反馈，无需 manifest 权限） */
  showHud: (title: string) => typedInvoke('plugapi:hud', { title }),
```

3d. `ipc.ts`（`plugapi:notify` handler 之后）加：

```ts
  typedHandle('plugapi:hud', (e, { title }) => {
    countE2E('plugapi:hud')
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return false
    const text = sanitizePluginHudTitle(title)
    if (!text) return false
    const win = getLauncherWindow()
    if (!win || win.isDestroyed()) return false
    win.webContents.send('launcher:plugin-hud', { title: text, pluginName: ctx.plugin.name })
    return true
  })
```

（`sanitizePluginHudTitle` 从 `@shared/plugin-protocol` import；`getLauncherWindow` 该文件已在用 —— `plugapi:setExpandHeight` handler 同款。）

3e. `preload/index.ts`（`onPluginChanged` 658-662 行后）加（照同款模式）：

```ts
    onPluginHud: (cb: (payload: { title: string; pluginName: string }) => void): (() => void) => {
      const l = (_: unknown, payload: { title: string; pluginName: string }): void => cb(payload)
      ipcRenderer.on('launcher:plugin-hud', l as never)
      return () => ipcRenderer.removeListener('launcher:plugin-hud', l as never)
    },
```

并在 `src/preload/index.d.ts` 的 launcher API 声明处同步此方法签名。

3f. `LauncherApp.vue`：模板根部容器内加 `<PluginHud ref="pluginHud" />`；script 里 `const pluginHud = ref<InstanceType<typeof PluginHud> | null>(null)`，在既有 `onPluginChanged` 监听注册（1514 行）旁边加：

```ts
    window.api.launcher.onPluginHud(({ title }) => pluginHud.value?.show(title))
```

- [ ] **Step 4: 跑测试 + 全量校验**

Run: `pnpm vitest run src/renderer/src/launcher/components/__tests__/PluginHud.test.ts && pnpm typecheck && pnpm lint && pnpm test`
Expected: 全绿（全量 test 兜住 plugin-api-parity —— showHud 是 preload 新增暴露面，内置插件尚未调用，parity 仍绿）。

- [ ] **Step 5: 完整重启冒烟（主进程改动不热更）**

```bash
pkill -f "electron" || true   # 杀干净 electron 子进程（记忆教训）
pnpm dev                      # 另开终端观察
```

冒烟：把 example-plugin 的某命令临时加一行 `launcherApi.showHud('HUD 冒烟')`（冒烟后还原，不提交），打开该插件 → 胶囊窗底部出现「HUD 冒烟」1.5s 消失。

- [ ] **Step 6: Commit**

```bash
git add src/shared/ipc-contract.ts src/preload/plugin.ts src/main/launcher/ipc.ts src/preload/index.ts src/preload/index.d.ts src/renderer/src/launcher/components/PluginHud.vue src/renderer/src/launcher/components/__tests__/PluginHud.test.ts src/renderer/src/launcher/LauncherApp.vue
git commit -m "feat(plugin): showHud 轻提示全链路——plugapi:hud → launcher:plugin-hud → 胶囊 PluginHud"
```

---

### Task 5: 插件 lib.js 测试基建打样（base64）

**Files:**
- Create: `plugins/com.frond.base64/lib.js`（从现 `index.html` 内联脚本抽出纯函数部分：`base64Encode` / `base64Decode` / URL-safe 变换）
- Modify: `plugins/com.frond.base64/index.html`（`<script src="lib.js"></script>` 引入 + 内联代码删除被抽函数、改用全局对象）
- Modify: `plugins/com.frond.base64/plugin.json`（version `1.0.1` → `1.0.2`；builtinPlugins 按版本重装）
- Test: `plugins/com.frond.base64/lib.test.js`（新建）

**Interfaces:**
- Consumes: 无宿主新字段（打样的是测试基建，不是新协议）。
- Produces（计划 2 所有插件照抄的 lib.js 模式）:

```js
// lib.js UMD 模板：vitest(node) 走 module.exports；插件页挂 globalThis
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondBase64Lib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // …纯函数…
  return { encode, decode, toUrlSafe, fromUrlSafe, isProbablyBase64 }
})
```

- vitest 已收录 `plugins/**/*.test.js`（vitest.config.mts exclude 列表未排除 plugins/，默认 include 匹配 `*.test.js`）——本任务跑通即证明，不改 vitest 配置。

- [ ] **Step 1: 写失败测试**（`plugins/com.frond.base64/lib.test.js`）

```js
import { describe, it, expect } from 'vitest'
import { encode, decode, isProbablyBase64 } from './lib.js'

describe('base64 lib（计划 2 的插件测试基建样板）', () => {
  it('encode/decode 往返（含中文/emoji）', () => {
    for (const s of ['hello', '你好，世界', 'emoji 👍', 'a'.repeat(300)]) {
      expect(decode(encode(s))).toBe(s)
    }
  })
  it('decode 非法输入返回 null（不抛错）', () => {
    expect(decode('!!!not-base64!!!')).toBeNull()
    expect(decode('')).toBeNull()
  })
  it('isProbablyBase64 判定：合法 base64 → true，普通句子 → false', () => {
    expect(isProbablyBase64(encode('hello'))).toBe(true)
    expect(isProbablyBase64('hello world!')).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run plugins/com.frond.base64/lib.test.js`
Expected: FAIL —— `./lib.js` 不存在。

- [ ] **Step 3: 实现 lib.js + index.html 引用**

读 `plugins/com.frond.base64/index.html`，把其中的编码/解码纯函数（含 UTF-8 处理）原样搬入 `lib.js`（UMD 模板见上），`index.html` 里改为 `const Lib = window.FrondBase64Lib` 后调用（或直接 `encode(...)`——UMD 已挂 globalThis）。`plugin.json` version 改 `1.0.2`。

- [ ] **Step 4: 跑测试 + lint + 插件页加载冒烟**

Run: `pnpm vitest run plugins/com.frond.base64/lib.test.js && pnpm lint -- --no-warn-ignored plugins/com.frond.base64/lib.js plugins/com.frond.base64/lib.test.js && pnpm typecheck`
Expected: 全绿。
冒烟：`pnpm dev` 下打开 Frond 插件管理 → Base64 → 输入文本确认编码/解码行为与重构前一致（lib.js 经 `plugin://` 加载，`resolvePluginFileIn` 无扩展名限制，已核实 `pluginStore.ts:172-186`）。

- [ ] **Step 5: Commit**

```bash
git add plugins/com.frond.base64/lib.js plugins/com.frond.base64/lib.test.js plugins/com.frond.base64/index.html plugins/com.frond.base64/plugin.json
git commit -m "feat(plugins): base64 抽 lib.js + vitest 单测——插件测试基建打样"
```

---

### Task 6: 全量门禁回归 + 冒烟清单

**Files:**
- 无新改动（纯验证任务）；若门禁发现回归，修复后随本任务提交。

**Interfaces:**
- Consumes: Task 1-5 全部产出。
- Produces: 计划 2/3 可以开工的绿色基线。

- [ ] **Step 1: 全量门禁**

Run: `pnpm typecheck && pnpm lint && pnpm lint:css && pnpm test && pnpm test:e2e:smoke`
Expected: 全绿。e2e smoke 前先完整 build（记忆教训：e2e 先 build）。

- [ ] **Step 2: 手工冒烟清单**（`pnpm dev`，逐条过）

1. 打开任一未重写插件（如 JSON 格式化）→ 输入 → 列表/详情/复制动作与升级前一致（旧形状零回归）。
2. 打开正则测试（唯一用命令参数的插件）→ 三参数表单仍工作。
3. 打开 Base64（Task 5 重构过）→ 编码/解码一致 + lib.js 经 plugin:// 正常加载。
4. 临时 HUD 冒烟（Task 4 已验）不再重复。
5. 番茄钟/日历等非插件胶囊页不受渲染层改动影响（PluginListPage 隔离在插件页内）。

- [ ] **Step 3: Commit（如有回归修复）+ 推进确认**

```bash
git status   # 确认无未提交改动；有则修复提交
git log --oneline -6   # 本计划 6 个提交应可见
```

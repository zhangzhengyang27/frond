# Leaf × Raycast 差距清账 · 执行计划 V5

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 2026-09-20 那次全仓盘点查出的 Raycast 差距逐层清零，从「交互模型」这块地基开始，一直到插件进程模型、分发信任、AI、同步、观感与无障碍。

**Architecture:** 分七期串行推进，每期独立可发布、独立可验证（typecheck → vitest → eslint → electron-vite build → playwright 五道闸）。期与期之间只允许「接口依赖」不允许「进度依赖」——任何一期做完都必须是一个绿灯状态。

**Tech Stack:** Electron 38 + electron-vite + Vue 3.5（宿主渲染层，无 React）+ better-sqlite3（FTS5）+ TypeScript 双端；插件面 = sandbox BrowserView + `react-reconciler` 0.34 SDK；测试 = vitest（colocated）+ playwright（`e2e/*.spec.mjs`）。

---

## 0. 本轮拍板（写计划的事实前提）

| # | 决定 | 来源 | 影响 |
| --- | --- | --- | --- |
| D1 | 生态只走「自建分发」，**不做**跑未改动的 Raycast 商店扩展 | 用户拍板 2026-09-20 | P-2 不引入 Node worker 运行时；`PLUGIN_DEV.md:219` 那条非目标声明**维持**，不需要撤销 |
| D2 | 无 Apple Developer 账号 | 用户拍板 2026-09-20 | P-3 把签名/公证/更新通道做到「只差证书」，产物继续未签名；不留假绿 |
| D3 | `POSITIONING.md` 的「明确不做」**推翻**：AI 平台化（BYOM/MCP/Automations/Screen Awareness）+ 账号与双向云同步**纳入** | 用户拍板 2026-09-20 | P-4 / P-5 立项；POSITIONING 与 ROADMAP 的清单由 Task 0.2 改写 |
| D4 | **多语言 i18n 不做**（D3 的例外，用户 2026-09-20 追加更正） | 用户拍板 2026-09-20 | 不设 i18n 期；`ROADMAP.md:65` 该行保留 |
| D5 | 无 Windows 真机 | 用户拍板 2026-09-20 | Windows 项只到 CI 单测矩阵 + 静态审查；两条 file-index e2e 保持 skip，守卫注释写明「无真机」 |

> **注意 D3 与既有定位的冲突不要偷偷吞掉**：Task 0.2 要在 `docs/DECISIONS.md` 新开一条 Decision（承接 Decision-009 的编号顺序），并把「本地优先」重述为「本地优先 + 可选端到端加密同步」，而不是直接删字。

---

## 1. 七期总览与顺序

```
P-0 文档与决策落档        0.5d  ─┐ 只做这一件事：把「事实源」摆正，否则后面每期都在跟过期文档打架
                                 │
P-1 交互模型层 ★地基      ~6d   ─┤ 动作模型 / keep-open / 收藏全类型 / async detail / 行内参数
                                 │   ↑ 其余各期的 UI 都要复用这里的动作模型，必须先落
P-6 观感与性能            ~4d    ─┤ 与 P-1 并行可做（浅色玻璃 / token 化 / 动画 / 列表虚拟化）
                                 │
P-2 插件进程模型 + SDK    ~9d   ─┤ Action(无 UI) 命令 / 后台执行 / 通用视图栈 / SDK 接通宿主 23 方法
P-3 分发与信任            ~6d   ─┤ 远程索引+校验和 / 权限引导页 / semver / 来源审计   （依赖 D2）
P-4 AI 平台化三期        ~12d   ─┤ BYOM 多 provider / MCP 最小面 / Automations / Screen Awareness
P-5 账号与双向云同步      ~8d   ─┤ 依赖 P-4 之前的数据面收敛；风险最高，放最后
P-7 无障碍与注册表合一    ~4d   ─┘ 工程债收尾
```

**顺序理由（不要改成并行铺开）**：P-1 的动作模型是「一条结果可以有多个带键动作」这个抽象本身。P-2 的 Action 命令、P-3 的权限提示、P-4 的「问 AI」一级动作全部要在它上面长出来。先做 P-4 会得到一套只在 AI 页里能用的临时实现，然后返工。

**每期的完成判据（Definition of Done）**：见各期「验收」小节。判据必须是可观察的真副作用断言，不接受「渲染出来了」——本仓库为此踩过表单回传 flake（`HANDOFF.md §3`）。

---

## 2. P-0：文档与决策落档（先做，半天）

### Task 0.1：给 V4 差距分析打过期标记

**Files:**
- Modify: `docs/RAYCAST_GAP_ANALYSIS_V4.md`（文件头，第 1–9 行区间）

- [ ] **Step 1: 在标题下方插入过期声明**

在 `# Leaf × Raycast 差距分析 V4（2026-09-17）` 之后、`> 前版 V1–V3 已归档…` 之前插入：

```markdown
> ⚠️ **§2/§5 的 ❌ 清单已过期（2026-09-20 复核）**：自 09-17 起 53 个提交已落地
> fuzzy 容错层、多参数命令（text/password/dropdown）、自建文件索引、Hyper Key、系统日历四档、
> React SDK + @raycast-api 兼容层、用户主题文件、pop-to-root 三态、热键冲突检测。
> 逐条核对后的真差距与执行分解见 `docs/RAYCAST_PARITY_PLAN_V5.md`。
> 本文仍有效的部分：§3 Leaf 独有点、§4 定位冲突标注、§6 资料来源。
```

- [ ] **Step 2: 提交**

```bash
git add docs/RAYCAST_GAP_ANALYSIS_V4.md
git commit -m "docs: V4 差距分析标注过期条目（真差距重排见 PARITY_PLAN_V5）"
```

### Task 0.2：落 Decision 并改写「不做」清单

**Files:**
- Modify: `docs/DECISIONS.md`（末尾追加，编号承接现有最大号 +1）
- Modify: `docs/POSITIONING.md:32-42`
- Modify: `docs/ROADMAP.md:63-65`

- [ ] **Step 1: 在 `DECISIONS.md` 追加一条**

```markdown
## Decision-0XX · 推翻「明确不做」清单中的 AI 平台化与账号/云同步（2026-09-20）

**决策**：对齐 Raycast 的差距清账中，以下原「不做」项转为立项——AI 平台化
（BYOM 多 provider / MCP 最小面 / Automations / Screen Awareness）、账号与双向云同步。
**维持不做**：多语言 i18n（唯一例外，用户同日追加更正）、跑未改动的 Raycast 商店扩展、
移动端。

**Why**：以「能力清单」衡量 Raycast 已在 2.0 之后把 AI 与听写移入 Pro 并在 2026-09-10
改按用量计费，Leaf 的 BYOK 单端点 Chat 已不构成 parity；账号/同步同理。
**How to apply**：「本地优先」重述为「本地优先 + 可选端到端加密同步」——同步必须是
用户显式开启、默认关闭、密钥不出本机；任何要求先登录才能用的功能都违背这条决策。
落点与分期见 `docs/RAYCAST_PARITY_PLAN_V5.md` P-4 / P-5。
```

- [ ] **Step 2: 同步改 `POSITIONING.md` 与 `ROADMAP.md` 的清单**

把 `POSITIONING.md` 中 `❌ AI 平台化` / `❌ 账号系统` / `❌ 云同步` 三行改为 `✅（2026-09-20 立项，见 Decision-0XX）`，`❌ 多语言` 保留并在「不做的事」小节补一行注：「多语言维持不做（2026-09-20 复核，唯一维持项）」；`ROADMAP.md:63-65` 的「明确不做」整段同步。

- [ ] **Step 3: 顺带修三处已核实的事实错误**

| 文件:行 | 现状 | 改成 |
| --- | --- | --- |
| `PLUGIN_DEV.md:81` | 动作「最多 6 个」 | `runtime.ts:93` 实为 **10**——而且是裸字面量 `.slice(0, 10)`，**没有** `PLUGIN_MAX_VIEW_ACTIONS` 常量（改文档时顺手补一个，与 `PLUGIN_MAX_VIEW_ITEMS` 同处） |
| `PLUGIN_DEV.md:81` | 列表「上限 100 条」 | `PLUGIN_MAX_VIEW_ITEMS = 300`（`plugin-protocol.ts:260`，`runtime.ts:74` 使用） |
| `PLUGIN_DEV.md:201` | 不支持的 Raycast API「调用即抛错」 | `leaf-raycast-api/src/index.ts:45-49` 实为 `console.warn` 一次 + 安全降级 |

- [ ] **Step 4: 提交**

```bash
git add docs/DECISIONS.md docs/POSITIONING.md docs/ROADMAP.md PLUGIN_DEV.md
git commit -m "docs: Decision 落档（AI 平台化/账号同步立项、i18n 维持不做）+ 修三处文档事实错误"
```

---

## 3. P-1：交互模型层 ★地基

**真差距（盘点实证，别再复查）**

| 差距 | 证据 |
| --- | --- |
| 动作只有 ⌘K 一条入口，无修饰键二级动作 | `LauncherApp.vue:1081`；全仓无 `metaKey && Enter` 绑定；⌫ 只在剪贴板/回收站页内做删除 |
| 「执行后保持窗口打开」被写死关闭 | `main/launcher/window.ts:60` `const pinned = false`，注释「钉住能力预留」 |
| 收藏只能收模块，不能收任意命令 | `usage_favorites(module_id)` 是自由字符串列（`migrations/007_usage_schema.ts:33`），`preload/index.ts:291-295` 只以 moduleId 暴露，`LauncherApp.vue:533` 只在空态消费 |
| async detail 静默丢弃 | `LauncherApp.vue:592-593`：`detail` 是函数就返回 null，于是除应用类外多数行无详情 |
| 参数收进推上去的 FormPage 且清空搜索词，上下文丢失 | `LauncherApp.vue:969`、`:659-688` |

### Task 1.1：动作模型抽象成「可带键的动作集合」

设计要点：把 `PanelAction` 从「面板行」升级为 `{ id, key?: ModifierKey, label, icon, run }`，`⌘K` 面板与键盘绑定共享同一份数组，**hint 只在真的绑了键时才标**（`useActionPanel.ts:15` 的注释就是上一轮为「按标签猜键」留的教训，不要倒退）。

**Files:**
- Modify: `src/renderer/src/launcher/composables/useActionPanel.ts`
- Create: `src/renderer/src/launcher/composables/modifierKeys.ts`
- Test: `src/renderer/src/launcher/composables/__tests__/modifierKeys.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/renderer/src/launcher/composables/__tests__/modifierKeys.test.ts
import { describe, it, expect } from 'vitest'
import { resolveModifierAction } from '../modifierKeys'
import type { PanelAction } from '../useActionPanel'

const actions: PanelAction[] = [
  { id: 'open', label: '启动应用', icon: 'rocket-line', run: () => {} },
  { id: 'reveal', label: '在 Finder 中显示', icon: 'folder-open-line', key: 'cmd+backspace', run: () => {} },
  { id: 'copy', label: '复制路径', icon: 'file-copy-line', key: 'cmd+shift+c', run: () => {} }
]

describe('resolveModifierAction', () => {
  it('metaKey+Backspace 命中声明了 cmd+backspace 的动作', () => {
    const hit = resolveModifierAction(actions, { metaKey: true, key: 'Backspace' })
    expect(hit?.id).toBe('reveal')
  })
  it('未声明 key 的动作不参与匹配（↵ 之外的裸键不能触发它）', () => {
    expect(resolveModifierAction(actions, { metaKey: true, key: 'Enter' })).toBeNull()
  })
  it('修饰键不全的按键不能误命中 cmd+shift+c', () => {
    expect(resolveModifierAction(actions, { metaKey: true, key: 'c' })).toBeNull()
    expect(
      resolveModifierAction(actions, { metaKey: true, shiftKey: true, key: 'C' })?.id
    ).toBe('copy')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/renderer/src/launcher/composables/__tests__/modifierKeys.test.ts`
Expected: FAIL —— `Failed to resolve import "../modifierKeys"`

- [ ] **Step 3: 写实现**

```ts
// src/renderer/src/launcher/composables/modifierKeys.ts
/** 键盘事件的修饰键+键位最小面（不引第三方库：只需比对三个布尔） */
export interface KeyEventLike {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
}

/** 动作声明的键，形如 'cmd+backspace' / 'cmd+shift+c'（全小写、修饰键在前） */
export type ActionKey = string

export function matchActionKey(ev: KeyEventLike, spec: ActionKey): boolean {
  const parts = spec.split('+')
  const key = parts.pop() as string
  const wantMeta = parts.includes('cmd')
  const wantCtrl = parts.includes('ctrl')
  const wantShift = parts.includes('shift')
  if (!!ev.metaKey !== wantMeta || !!ev.ctrlKey !== wantCtrl || !!ev.shiftKey !== wantShift) return false
  // 字母忽略大小写（Shift 同时给出大写），特殊键按 KeyboardEvent.key 原值
  const actual = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key
  return actual === key
}

export function resolveModifierAction<T extends { key?: ActionKey }>(
  actions: T[],
  ev: KeyEventLike
): T | null {
  return actions.find((a) => a.key && matchActionKey(ev, a.key)) ?? null
}
```

- [ ] **Step 4: `PanelAction` 增 `id` 与 `key?` 两个字段**

在 `useActionPanel.ts:11-18` 的接口上：

```ts
export interface PanelAction {
  /** 稳定标识：动作重排后键位与 e2e 仍能定位到同一条 */
  id: string
  label: string
  icon: string
  /** 修饰键直触绑定；缺省表示「仅 ↵ 或面板选择」，不得在 UI 上假标键帽 */
  key?: ActionKey
  run: () => void
}
```

把该文件里 **18 处** `list.push({ label: … })`（9 个分支）全部补 `id`；同时按 Raycast 语义给二级动作挂键：`app` 与 `file` 的「在 Finder 中显示」→ `id: 'reveal'`, `key: 'cmd+backspace'`；各类「复制路径/复制内容/复制链接」→ `key: 'cmd+shift+c'`；`clipboardItem` 的「粘贴到前台应用」→ `key: 'cmd+shift+v'`。

- [ ] **Step 5: 跑测试 + 类型检查确认通过**

```bash
pnpm exec vitest run src/renderer/src/launcher/composables/__tests__/modifierKeys.test.ts
pnpm typecheck:web
```
Expected: 测试 4 passed；typecheck 0 error（`useActionPanel` 的调用方只读数组，不构造对象，预期无破坏）

- [ ] **Step 6: 提交**

```bash
git add src/renderer/src/launcher/composables
git commit -m "feat(launcher): 动作模型加稳定 id 与修饰键声明（纯函数匹配 + 4 单测）"
```

### Task 1.2：键盘接线（⌘⏎ / ⌫ / ⌘⇧ 系列）

**Files:**
- Modify: `src/renderer/src/launcher/LauncherApp.vue:1081-1195`（既有 keydown 分发段）
- Test: `e2e/capsule-actions.spec.mjs`（新建）

- [ ] **Step 1: 写失败的 e2e（先断言真实副作用，不断言「面板出现了」）**

```js
// e2e/capsule-actions.spec.mjs（片段：断言 ⌘⏎/⌫ 走的是二级动作而非 ↵ 的主动作）
// 复用 launcher.spec.mjs 的 launch/env 写法；LEAF_USER_DATA_DIR 按 spec 名覆盖
test('cmd+backspace on a file result reveals in Finder without closing the capsule', async () => {
  const capsule = await openCapsule()
  await capsule.fill('input', 'LeafTmpProbe')
  await expect(capsule.locator('.result-row').first()).toContainText('LeafTmpProbe')
  await capsule.keyboard.press('Meta+Backspace')
  // 真副作用：reveal 的 IPC 计数 +1（主进程侧用 LEAF_E2E=1 暴露的探针路由）
  const revealed = await probeRevealCount()
  expect(revealed).toBe(1)
  // 且动作面板并未因此被打开（与 ↵ 语义区分开）
  await expect(capsule.locator('[data-testid=action-panel]')).toHaveCount(0)
})
```

Run: `npx playwright test e2e/capsule-actions.spec.mjs`
Expected: FAIL —— `resolveModifierAction` 尚未接进 keydown，计数为 0

- [ ] **Step 2: 接进 keydown**

在 `LauncherApp.vue` 的 keydown 分发里、`Enter` 分支之前插入（`panelActions` 与 `runEntry` 已在作用域内）：

```ts
const modifier = resolveModifierAction(panelActions.value, event)
if (modifier) {
  event.preventDefault()
  actionPanelEntry.value = null
  modifier.run()
  return
}
```

- [ ] **Step 3: 面板行渲染真实键帽**

`LauncherApp.vue:53-81` 的面板模板里，把写死的 `hint` 换成 `action.key ? prettyKey(action.key) : action.hint`，新增导出纯函数 `prettyKey(spec: string): string`（`cmd+backspace → ⌘⌫`、`cmd+shift+c → ⌘⇧C`），放 `modifierKeys.ts`。

- [ ] **Step 4: 跑绿灯 + 提交**

```bash
pnpm exec vitest run src/renderer/src/launcher/composables && npx electron-vite build && npx playwright test e2e/capsule-actions.spec.mjs
git add src/renderer/src/launcher e2e/capsule-actions.spec.mjs
git commit -m "feat(launcher): 修饰键直触二级动作接进 keydown + 面板真实键帽"
```

### Task 1.3：keep-open（把 `window.ts:60` 的写死改成会话级标志）

**Files:**
- Modify: `src/main/launcher/window.ts:57-66,102-151`
- Modify: `src/shared/ipc-contract.ts`（登记 `launcher:setPinned`）、`src/preload/index.ts`、`src/main/launcher/ipc.ts`
- Test: `src/main/launcher/__tests__/pinnedFlag.test.ts`

- [ ] **Step 1: 写失败单测（判据：pinned=true 时 blur 不隐藏）**

- [ ] **Step 2: 主进程把 `const pinned = false` 换成模块级 `let pinned = false` + 导出 `setLauncherPinned(v: boolean): void` / `isLauncherPinned()`，blur 分支读它**
- [ ] **Step 3: 走 `typedHandle` 登记 `launcher:setPinned`（req `{ pinned: boolean }`，res `void`），preload 用 `typedInvoke`；两条闸口会自动要求登记（`src/main/__tests__/ipcContract.test.ts`）**
- [ ] **Step 4: 动作面板加 `id:'keepOpen'` 动作（label 随状态切换「保持打开 / 用完关闭」，键 `cmd+shift+k`），并在胶囊底部状态区显示一个常驻小点提示当前是钉住态**
- [ ] **Step 5: 电池 + 提交**

```bash
pnpm typecheck && pnpm test && pnpm lint && npx electron-vite build && npx playwright test e2e/launcher.spec.mjs
git add -A && git commit -m "feat(launcher): keep-open 会话级钉住（补 window.ts 预留位）+ launcher:setPinned 登记"
```

### Task 1.4：收藏任意命令（存储已够，只补语义与 UI）

`usage_favorites.module_id` 本就是自由字符串，`useUsageBoost` 已按 `entry.key` 全类型记录（`useUsageBoost.test.ts` 顶部注释即 V4 P0-3 结论）。因此这一步**不加迁移**，只做三件事：动作面板加 `id:'favorite'`（`⌘⇧F`）→ `window.api.usage.toggleFavorite(entry.key)`；根搜索结果顶部插入收藏区（收藏项不参与 `usageBoost` 重排，位置固定）；`LauncherApp.vue:533` 的空态消费保持不变。列名 `moduleId` 与实际存的 `entry.key` 不一致，在 `UsageRepository` 上补一行 `// 列名沿用 module_id，实际存 CommandEntry.key` 注释即可，不做重命名迁移（避免牵动备份/同步的表结构）。测试要求：收藏一个 `quicklink:` 条目后重启不丢、且在根列表第一位。

### Task 1.5：async detail 接线

`LauncherApp.vue:592-593` 现在遇到函数型 `detail` 直接返回 null。改成：选中行变化时 `void entry.action.detail?.(entry)` 写入 `detailData` ref，带一个请求序号防止竞态（旧请求回来晚于新请求时丢弃），加载中显示骨架。**验收用「不 hover 前置的直接键盘 ↓ 选中 → 断言详情正文出现」**（本仓库的既有教训）。

### Task 1.6：参数不被丢掉（✅ 2026-09-20）／搜索框内联参数槽（拆为 1.6b）

**1.6 已做**：`qlarg` 原本就会把「标题之外的搜索词」当参数初值，但 `pluginarg` 完全不取，
且规则手写在 `.vue` 里。现在：

- 纯函数 `argPrefill(query, title)`（`launcherInteractions.ts`，3 单测）统一规则：
  标题是查询前缀才取剩余部分，否则不猜
- 插件参数在进表单前存 `pluginArgPrefill` 快照——**不能**在 `pluginArgFields` 里直接读
  `query`：`pushPage` 之后 query 被清空，初值会在下一帧消失。只预填第一个 `text` 参数
  （多参数按空格切剩余词是在猜），`password` / `dropdown` 不预填
- FormPage 的字段级 `initial` 是真读的（`FormPage.vue:264-267`），无需改动

**已知未验证 → 已还（2026-09-20，随 P-2.7）**：`pluginarg` 预填当时没有 e2e，因为 21 个内置插件
零个声明 `arguments`。`com.leaf.regex` 挂上参数 + `search.ts` 补前缀命中后，
`e2e/plugin-args.spec.mjs` 两条把它钉住：第 1 条走全链路（预填 → 补文本 → ⌘↵ → 插件按参数渲染
`匹配 3 处` 与 `/…/g` 副标题），第 2 条是**判异性**用例——长尾查询超出拼写容错预算，只能由前缀规则
命中；把 `entry.acceptsArgs` 短路后第 2 条立刻转红（第 1 条仍绿，因为短查询会被容错层捞回来，
这点值得知道：**前缀规则的真实可见价值在长尾可达与排序确定，不是「让短查询勉强能选」**）。

**1.6b（独立任务，未开工）**：搜索框内联参数槽——命令前缀变不可编辑的 chip、光标落在
第一格、左右方向键换格（对齐 Raycast 行内补全），`FormPage` 只留给「≥3 参数 / 含 dropdown」。
**前置条件**：`LauncherApp.vue` 已 2200 行，先拆成「搜索输入区 + 结果列表」两个组件再动；
拆分本身是一次无行为变更的重构，单独一个 PR + 全套 e2e 回归。

**P-1 验收**：五项各自单测/e2e 全绿；`pnpm test` 相对基线只增不减；`e2e/perf-baseline.spec.mjs` 热唤起断言不退化。

---

## 4. P-2 → P-7：每期任务分解（开工前各自展开成 bite-sized 计划）

> 这五期不在本文写代码级步骤：按 writing-plans 的 scope 规则，一篇计划覆盖六个独立子系统会退化成清单而非可执行步骤，且每期开工都要先精读它自己的落点文件（`runtime.ts` / `market.ts` / `AIService.ts` / 同步层）才能给出真签名。**每期一份独立文件**：`docs/plans/2026-09-XX-p2-plugin-runtime.md` 等，我可以在你点头后按顺序展开。下面每期的「任务」粒度已细到「一个 PR 一条」。

### P-2 插件进程模型 + SDK 接通（D1 约束下）

1. `mode: 'view' | 'action'` 命令声明（`src/shared/plugin-protocol.ts:71` 同层白名单 + `pluginStore.ts:41-47`，**fail-closed 语义不许放宽**）。
   〔✅ 2026-09-20：`sanitizePluginCommandMode` 只认字面量 `view`/`action`，其余（含 `'Action'`、`true`）
   一律剔除按缺省 view——拼错不能让用户按下回车后「什么都没发生」。判定 `isActionCommand`；
   清洗走 `readManifest`（`pluginManifest.test.ts` 一条 + `pluginCommandMode.test.ts` 四条）〕
2. action 命令执行路径：**不建可见 BrowserView**，主进程直接跑 → 现在 `runtime.ts:415 openPlugin` 是唯一出口，这是本期第一处真结构改动。
   〔✅ 2026-09-20：改为「视图仍创建（第三方 JS 要有地方跑）但**不挂到胶囊窗**」。
   `PluginViewContext` 加 `headless` / `attached` / `headlessTimer`，`launcher:getPluginState`
   一并回传 `headless`/`attached` 供验收读真值。规则定为「无界面是缺省，插件真做出 UI 就
   `promoteToVisible` 升级为可见」（`setDeclaredView`/`setDeclaredList`/`setSubInput`/
   `setExpandHeight` 四处），而不是「声明 action 就永远不许有界面」。不自关的 action 视图由
   `ACTION_COMMAND_TIMEOUT_MS = 20s` 兜底回收——第三方代码不能无限占着一个视图。
   e2e 三条：`ping`（通知 + 自关 + 不接管界面）、`ping-view`（声明 action 但渲染列表 → 必须变可见）、
   `ping-hold`（判据取宿主 `headless && !attached`，再等 20s 回收）。
   **判异性已做**：把 `attached: !headless` 与条件挂载退回成「总是挂载」，第三条立刻在
   `headless-running` 断言上转红。
   **顺带查出的新差距（✅ 2026-09-21 已修）**：渲染端打开任何插件都会清空查询词，Action 命令理应例外
   （Raycast 的 action 不打扰搜索框）——归入 P-1.6b 家族。
   清词原本有两处：`runEntry` 的 plugin 分支与 `onPluginChanged` 的两条分支。现在都改成
   「**插件真接管了搜索区才动它**」（`tookSearchBox`：attached / declaredList / declaredForm /
   副输入框任一为真），为此 `launcher:plugin-changed` 的快照补上 `headless` / `attached`
   （`getPluginState` 早就有，推送漏了）。
   判异时值得记下：**真正吃掉查询词的是「插件关闭」那次推送，不是打开那次**——
   只把打开分支退回旧写法（`if (true)`）用例仍然绿，改成无条件清关闭分支才转红
   （`Expected "三模式" / Received ""`）。只测一条分支的判异性会骗人。〕
3. 插件生命周期外执行：`submitSearchItems` 已有「打开时提交 + 持久化索引」的适配（借鉴清单 #5），补一个受限的 `setTimeout`/interval 通道或明确写「不支持后台」。
4. **通用视图栈**：把 `useLauncherPages.ts:16-38` 的 21 个 `v-if/v-else-if` 硬链换成声明式注册表，让插件能 push 视图——这是「插件推不动视图栈」的正解。
5. **SDK 接通宿主已有能力（性价比最高的一格，纯管道）**：`launcherApi` 的 `notify/copyText/openPath/db/preferences/fetch` 已在（`preload/plugin.ts:58-123`），SDK 只导出 6 组件 + 1 hook（`leaf-plugin-sdk/src/index.ts:11-24`）。补 `useToast`/`showToast`/`Alert`/`LocalStorage`/`Cache`/`getPreferenceValues`/`open`/`getSelectedText`，并**逐个消掉 `leaf-raycast-api/src/index.ts:377-411` 那份 warn 清单里的对应条目**——每项都必须同时删掉那条 `notSupported()`，防止「文档说支持、代码仍降级」。
   〔🟡 **2026-09-20 已做第一批**：`packages/leaf-plugin-sdk/src/platform.ts`（8 单测）接
   `showToast`→notify、`copyToClipboard`/`getClipboardText`→copyText/readText、
   `LocalStorage`/`Cache`→插件 KV（`ls:` / `cache:` 前缀分开，Cache 带 ttl 秒、过期读到即删），
   兼容层 `Toast`/`LocalStorage`/`Cache` 三项 notSupported 已删（`Cache` 顺手从
   `LocalStorage` 别名改成 Raycast 真名 `getCacheItem/setCacheItem/removeCacheItem`）。
   **剩余四格需要宿主先长出新能力，不是接线能解决的**：`Alert`（无原生模态框）、
   `getPreferenceValues`（偏好只能按名取，需 list 通道）、`open(url)`（`plugapi:openPath`
   走 `safeOpenablePath`，只认绝对路径且拒绝可执行类型，加 URL 支持要新开一条带 net 权限门控的
   通道）、`getSelectedText`（全仓无此能力）。〕
   〔✅ **2026-09-20 第二批：那四格接掉三格，剩一格写明为什么不做。**
   先纠一句旧话：**「Alert 宿主无原生模态框」是错的**——同仓的 `pluginConfirm.ts` 一直在用
   `dialog.showMessageBox`（卸载确认与权限升级确认），只是没人接给插件。
   - `Alert` / `alert`：新通道 `plugapi:alert`。装配逻辑抽成不 import electron 的
     `pluginAlert.ts`（`buildAlertDialogOptions` / `alertPressedAction`）——**原生模态框在自动化里
     没人点按钮**，能测的只有「按钮怎么摆、按下回什么」，所以那部分必须有单测；
     标题固定拼成「插件名 · 标题」，否则第三方能摆一个长得像系统提示的框骗用户点确认；
     动作 ≤4、正文 ≤600、`style` 只认三种（`sanitizeAlertRequest`）。`enableInput` 没有对应物，
     传了明确 warn 一条而不是静默丢掉。
   - `open(url)`：新通道 `plugapi:openUrl`，**按 `net` 权限收**（它的副作用是把链接交给外部去取，
     与 fetch 同类，不是 `fs.open` 那类本地文件系统）；协议白名单只留 `http/https/mailto`
     ——`file:`、`javascript:`、自定义 scheme（`obsidian://`、`x-apple.systempreferences:`）
     能把参数塞进别的应用。与 fetch 的 SSRF 守卫是**两套策略，不互相套用**：open 的响应体
     由浏览器呈现、插件读不回来，所以只按 scheme 收口。
   - `getPreferenceValues`：新通道 `plugapi:listPreferences`，只回清单声明过的键（未设过落 `default`），
     插件不能拿它探宿主里别人存了什么。**顺带查出一处从没被看过的东西**：
     `manifest.preferences` 以前是 `JSON.parse` 之后**整段照收**的，而 10 个内置插件全都声明了偏好
     并渲染进设置页——类型写错/缺 label/`select` 没候选都会静默流到下游（用户以为是自己没填）。
     现在走与参数声明同一套 fail-closed 清洗 `sanitizePluginPreferences`，并在
     `pluginManifestAudit` 加一条「过一遍真清洗器不丢项」（含「一个带偏好的插件都没有 = 这条规则空过」的防空跑判据）。
   - `getSelectedText` **仍不做**，且把理由写进代码与文档：要 macOS 辅助功能下的 AX API，
     宿主没这一层；常见捷径「模拟 ⌘C 再读剪贴板」在 Leaf 里**不能用**——本应用自己记录剪贴板历史，
     模拟一次复制就是往用户历史里塞一条真数据。归到 P-4⑤ Screen Awareness 的真机待办。
   证据：协议清洗 13 条 + Alert 装配 8 条 + 审计 1 条 + SDK dist 层 5 条 + 兼容层 3 条
   （含**反向钉**：`Alert` 不再有 notSupported 警告，接线做没做看那条警告还在不在）
   + e2e 一条（example-react 新增 `platform` 探针命令：`who=leaf`/`theme=dark` 证明
   readManifest→listPreferences 整条链；open(url) 的**两道闸分开量**——清单声明 net 之后
   `https=true` 且 URL 真的走到 `shell.openExternal`（e2e 把它临时换成记录器，CI 上不开浏览器）、
   `file=false` 且**没**走到。此前两条都是 false，看着像测了白名单，其实两条停在同一道权限门上）。
   三条踩坑值得记：① 探针「主进程里 4ms 采样」替代「测试侧每次一个 IPC 采样」——
   动画只有 90ms，套跑时机器一忙就一次都采不到（表现正是单跑绿、套跑红）；
   ② 新用例必须自足（这条依赖了第一条用例的 install 副作用，单跑必红），
   且 `react-view` 这个 spec 原来不清 userData = 用的是上一次那份 manifest；
   ③ P-6④ 放宽封顶到 50 行后，`capsule-actions` 找应用行的 80 步只够绕 1.6 圈而套跑红——
   **放宽行数的同时把「按圈数写死的探针上限」留在原地，就是我改出来的回归**，已按 50 行重算成 240 步。〕
6. 组件补全：`Grid`/`Menu`/`ProgressBar`/`EmptyView`/`LoadingItems`/`List.isLoading`/`Detail.actions`/`navigation.popToRoot`。
   〔🟡 **2026-09-20 第一批**：`navigation.popToRoot`（SDK 视图栈真实现，已在根视图时按 `pop`
   语义通知宿主关闭；兼容层不再是 notSupported）+ `List.isLoading`/`emptyView`（协议加
   `parsePluginListMeta`，`PluginViewContext` 加 `declaredLoading`/`declaredEmptyMessage`
   随快照下发，`PluginListPage` 在空列表时显示「加载中…」或插件自己的文案；
   兼容层把 `EmptyView` 元素收成一句 `emptyMessage` 并导出该组件，宿主不渲染任意子树）。
   证据：SDK 序列化 2 条 + 兼容层翻译 2 条 + 协议解析 3 条 + `react-view` e2e 一条
   （两个稳定态，**故意不用计时器切换**——瞬态断言在套跑里必偶发）。
   **第二批（同日）：`Detail.actions`** —— SDK `serializeNode` 的 detail 分支此前也丢 children
   （和 `serializeList` 丢 props 同一类毛病），现在从 children 里找 `action-panel` 序列化出
   `actions`；协议侧把动作清洗抽成 `sanitizeViewActions`（条目与 Detail 共用同一个 10 封顶），
   降级出的占位条目带上动作，于是胶囊既有动作行与 `runPluginAction` 原样复用；
   兼容层顺带收下 `Action.Copy`/`Open` 的 `name` 标签（Raycast 两种写法都见过）。
   证据：协议 3 条 + SDK 2 条 + 兼容层 1 条 + e2e 一条（先 poll 到动作落地再触发，
   不靠时序抢跑）。
   剩余：`Grid`/`Menu`/`ProgressBar` 都要新的宿主渲染面，不是翻译能解决的〕
7. 多参数命令 dogfood：21 个内置插件**至今零个**声明 `arguments`（`plugins/*/plugin.json` grep 零命中）——给 `com.leaf.cron` 或 `com.leaf.regex` 挂双参数，把这条能力从「未验证」变「已验证」。
   〔✅ 2026-09-20：`com.leaf.regex` 升到 1.1.0，挂三个参数（`pattern` text+required、`text` text、
   `flags` dropdown，dropdown 顺带验 title→value 还原），`onEnter(data.args)` 真驱动执行；
   `plugins.json` 版本号同步。e2e 见 `e2e/plugin-args.spec.mjs` 两条。
   **同时补上前缀命中这格**（`search.ts` `argPrefixMatch` + `SearchEntryBase.acceptsArgs`）：
   旧规则下整条查询必须作为子串/子序列命中标题，于是「正则测试 \d+」这种「命令 + 尾巴」
   选不中命令、`argPrefill` 是死路。只有声明了参数的命令/带占位符的 Quicklink 吃这条规则，
   且要求标题后面紧跟空白（命令「Git」不会被查询「Github xxx」抢走）。P-1.6 的参数预填因此才可达，
   原记的「未验证」欠账由 `plugin-args.spec` 第 1 条还清〕
8. plugin.json 静态审计测试（必填字段/入口存在/id 与目录一致，`ROADMAP.md:37` 欠账）。
   〔✅ 2026-09-20 `pluginManifestAudit.test.ts` 7 条。**首跑就抓到真漂移**：20 个内置插件清单是
   1.0.1 而市场索引写 1.0.0（宿主「版本字符串不等 = 可更新」，于是这 20 个永远显示有更新），
   且 `com.leaf.quickfolders` 压根没登记进索引；已按清单为准同步并补登记。
   规则里刻意包含「未知权限值 / 非法参数类型 / 参数超 3 个」——宿主对这些是**静默剔除或降级**，
   没有这道闸就是长期悄悄错着〕

### P-3 分发与信任

1. `market.ts` 现只读打进包的 `resources/plugins.json`（`market.ts:70-74`）→ 加**远程索引**（https-only、复用既有 SSRF/DNS 固定与 20MB/30s 上限 `market.ts:145-156,199-235`）。
   〔✅ 2026-09-20：远程索引 = 用户在管理页自配一个 https JSON 地址（`market:remoteIndexUrl` 走
   prefRepository），拉到后缓存进 `userData/market-remote.json`，断网继续浏览上次内容；
   **拉取失败保留旧缓存与旧列表**（网络抖动不该把市场清空，e2e 第 4 条就是这个断言）。
   两条硬规矩：① 远程条目 `download` 只认 https URL（本地相对路径对不在盘上的索引没意义，
   放开等于把 userData 变成插件目录）；② **打包索引胜出**——远程条目 id 撞上第一方插件时被丢弃并
   如实上报条数，否则一份恶意索引就能把 `com.leaf.*` 换成自己的包。
   上限从 `downloadZip` 里抽成 `fetchBoundedHttps`（zip 与索引共用一条，20MB / 索引单独 2MB / 30s /
   `redirect:'error'` / DNS 钉住），闸门另抽 `assertRemoteTargetAllowed(raw, localCheck)`，
   「127.0.0.1 必须被拒」用注入桩验证——真起本机测试服务器来跑这条通道正是我们不允许的形态。
   新通道三条：`launcher:market:indexInfo` / `setIndexUrl` / `refreshIndex`。
   **顺带修掉一个既有真 bug**：`marketIndexPath()` 在未打包但直接 launch `out/main/index.js` 时
   取 `getAppPath()`=out/main，那条 `plugins.json` 从来就不存在，于是市场**静默显示空表**
   （e2e 探针实测 `localFile: .../out/main/plugins.json`、列表 0 条）。补已知布局回退后是 22 条。
   证据：纯函数 8 条单测 + `e2e/market-index.spec.mjs` 5 条（含「拒的是主进程持久化，不只是界面提示」）；
   判异性=删掉 `setRemoteIndexUrl` 的 https 校验，第 3/4/5 条立刻转红，装回即绿〕
2. `sha256` 校验和 + 版本比较：`market.ts:114-116` 现在「字符串不等即视为可更新」，改为 semver 比较并处理回滚。
   〔✅ 2026-09-20 同日两笔：`parseSemver`/`compareSemver`/`isUpdatable`——可比时要求市场版本**确实更新**，
   `1.0.0` 索引对着 `1.0.1` 已装不再算更新（就是上一格里那 20 个插件的病灶）；解不出 semver 才退回
   「不等即可更新」宁多不漏。prerelease 按「正式版 > 预发布」排。单测 6 条，判异性=把函数体退回
   字符串不等，「市场版本更旧也绝不是更新」那条转红〕
3. `MarketEntry`（`market.ts:40-48`）**无 hash/签名字段** → 扩字段 + 安装时校验；签名验证留 `verified: 'unsigned'` 明确值，配合 D2 不假装绿。
   〔✅ 2026-09-20：`MarketEntry.sha256`（64 位十六进制、大小写不敏感、统一小写；**声明了却畸形 → 整条剔除**，
   截断的哈希校不出任何东西）；zip/url 形态在**解压前**校验（损坏或被替换的包不该再走解压），
   本地目录形态给不出哈希所以只能缺省。没有做假 `verified` 字段：界面按真话标「sha256 校验」/「未校验」，
   D2 的「无证书」由文案与 `PLUGIN_DEV.md` 承担，不塞一个恒为 unsigned 的枚举骗自己。
   证据：`normalizeSha256`/`verifyPackageChecksum`/`sha256File`（已知向量 `'abc'`，不拿 crypto 自己证自己）
   + 审计第 8 条「索引过一遍真解析器不丢条目」（注入畸形 sha256 后 20/21 立刻转红）〕
4. 权限变更提示：已声明权限 vs 新清单 diff（`pluginConfirm.ts:12-36` 只有安装确认）。
   〔✅ 2026-09-20：`pluginConfirm.ts` 补 `diffPermissions(before, after, hasInstalled)`（纯函数，
   只比 `isPluginPermission` 认得的值并去重——宿主本来就不认未知权限名，差分它们没有意义）。
   判据 `!fresh && added.length > 0` 命中时换成**重一档**的 `type:'warning'` 对话框：
   标题「插件更新申请更多权限」、逐条只列**新增**的那些（附人话标签，不丢 `net` 这种字面值给用户看）、
   按钮是「保留当前版本 / 仍要更新」且 **defaultId=0**——回车默认是拒绝，不是放行。
   首次安装与「权限没变 / 只变少」仍走原来的确认档，不给用户加无意义的弹窗。
   已装清单从 `getPlugin(manifest.id)` 取，市场更新与本地目录覆盖导入共用同一条闸（两者都过 `confirmPluginImport`）。
   证据：6 条单测（多要 / 放掉 / 不变 / 首装 / 未知值与重复 / 两侧都缺省）。
   **对话框本体是人工验收项**：`LEAF_E2E=1` 下确认闸直接放行（这条旁路本身就是设计——
   系统模态不许被自动化点掉），所以套跑只证得到差分算得对，证不到那一眼长什么样〕
5. **权限引导页**（本期最被用户感知的一格）：辅助功能 / 日历 / 屏幕录制 三项的**状态读取 + 申请 + 跳转系统设置**。现状是零引导——`ipc/screenRecorder.ts:133` 是全仓唯一 `requestPermission`，而文本扩展、窗口管理、专注护盾、Hyper Key、日历读取全部静默依赖授权。onboarding（`OnboardingView.vue:34-99`，4 屏静态）插一步。
   〔✅ 2026-09-20：新增 `src/main/ipc/permissions.ts`（`permissions:probe` / `request` / `openSettings` 三条通道），
   引导页从 4 步变 5 步、权限排在第 2 步。三条口径是刻意分开的：
   **状态读取全走无副作用那条路**（`isTrustedAccessibilityClient(false)`、`getMediaAccessStatus('screen')`、
   只读 `EKEventStore.authorizationStatusForEntityType`——不查事件也不拉弹窗）；
   **申请能力三项不对等**，辅助功能与日历能弹系统框，屏幕录制**没有**编程申请口（`askForMediaAccess` 只收
   麦克风/摄像头），所以那一行只给「打开设置」并写明「授权后要重启 Leaf」，不假装能一键申请；
   非 darwin 一律 `unsupported` + 「当前系统不需要这类授权」，不把 Windows 用户吓成「你缺权限」。
   读取时机：走到第 2 步才读（日历那项要起 osascript 进程），且不拦住「跳过」。
   证据：纯函数 9 条单测（EventKit 枚举 0/1/2/3 各归其位——`2` 是 denied 不是 authorized，
   `CalendarService` 就为此翻过车；`null` 一律 `unknown` 不粉饰）+ `e2e/onboarding-permissions.spec.mjs` 2 条
   （DOM 的 `data-perm-state` 与 `permissions:probe()` 返回值必须一致，屏幕录制行永不出「申请」按钮）。
   判异性=把 `classifyEventKitStatus` 改成 `status >= 2 → granted`，单测立刻转红。
   真机侧另验了探针本身：本机 `osascript` 直接读回 `3`，与界面显示一致。
   **仍未做**：设置页里没有同一块面板（跳过引导后要补授权只能靠各功能自己的提示），
   以及 `permissions:request` 的「申请」按钮与「打开设置」深链是**人工验收项**——
   自动化点它们会往开发机上弹系统对话框、还会打开系统设置面板〕
6. 更新链路做到「只差证书」：publish 占位 `leaf-app/leaf-desktop` 换成可配置的真实仓库、CI 里 `build:mac` 产物与校验脚本；签名 secrets 一格在 `RELEASE.md` 标为「等账号」。
   〔✅ 2026-09-20：**没有账号就换不成真仓库**，所以这一格的做法是把「还是占位」变成 CI 过不去的
   硬判据，而不是留一句文档记着。`scripts/lib/releasePreflight.mjs`（纯函数 + 11 条单测）分两档，
   **两档不许混**：blocking = 占位发布目标 / 版本不是 `x.y.z` / tag 与版本不一致 / 没有上传 token；
   warning = 未签名（D2 现状，刻意不 blocking）、已签名但未公证。
   CLI `pnpm run release:preflight [-- --strict|--target-only]`；release.yml 构建 job 起手跑 `--strict`，
   并生成 `SHA256SUMS` 随 Release 一起发（未签名阶段唯一的完整性凭据，与市场索引 sha256 同一口径）。
   `docs/RELEASE.md` 接上既有清单：五项 secrets 到位即补齐那一格，**不用改代码**（workflow 已透传变量名）。
   顺带为「判定要有单测」把 vitest 的 `scripts/**` 排除收窄成 `scripts/**/*.{js,mjs,cjs}`。
   判异性=真目标 + 配齐签名 → ok 且无 warning；只配 `CSC_LINK` → 只剩「公证」一条；tag 不一致 → blocking〕
7. 21 个内置插件逐个真机验证（`PLUGIN_QA_CHECKLIST.md`，`ROADMAP.md:38` 欠账）。

### P-4 AI 平台化（D3）

按「先本地等价、后平台化」排：① BYOM 多 provider（Ollama / OpenRouter / OpenAI 兼容自定义端点——`AIService.ts` 已是 OpenAI 兼容单端点，扩预设与本地端点探活）→ ② MCP client 最小面（连 stdio server、列 tools、把 tool 注册成命令进根搜索）→ ③ AI 进动作面板（Task 1.1 的动作模型是前置）→ ④ Automations（定时跑「命令 / AI 任务」，复用番茄钟与 `globalShortcuts` 已有的调度面）→ ⑤ Screen Awareness（焦点窗口内容 → 上下文，依赖 P-3 的屏幕录制权限引导）。
**不做**：跑未改动的 Raycast AI 扩展（D1）、模型自带（只连本地/远端端点）。

### P-5 账号与双向云同步（D3，风险最高）

〔🟡 **2026-09-22 现状核对**：行级三方合并的**判据**在 `syncMerge.ts` 里已齐（19 条单测全绿；
本轮补回三条丢掉的：内容只差 `__rev` 不产副本、等修订号打平两份都留、report 型表不拿「远端
没这行」当删除）。接线已落地（`1b5874e`）：`SYNC_TABLE_SPECS` + bundle v2（每行带 `__rev`，子表向父行要）+
`mergeBundle()` 单事务回写并把基线/墓碑记进 `sync_state`，`applyBundle()` 退化成薄壳；
`syncExclusionAudit()` 钉住「每张表要么同步要么点名排除」。dataSync + syncMerge 35/35 通过。〕
〔✅ **2026-09-22 真链路补上了**（`dataSync.chain.test.ts`，5 条）：进程内起一个最小 WebDAV 端
（`__tests__/helpers/minimalDav.ts`，按真客户端探测出的 PROPFIND/MKCOL/PUT/GET 四类请求实现），
两个内存 sqlite 当两台设备，把 `pushDataSync`/`pullDataSync` 整条链子真跑一遍——真 HTTP 往返、
真 AES-256-GCM、真行级合并。生产侧只加了一个注入缝 `SyncDeps`（库 / WebDAV 配置 / 记账位 / 快照点，
全可选，默认走 pref + userData，行为不变）。
**这条测试当场逮到一个真洞**：先推的那台设备**从不记基线**，于是它拉对端 bundle 时看到的是
「本地有这行、远端没有、我也没见过」——按判据只能不删，**删除于是永远传不过去**。
修法：推送成功后 `markPublished(bundle)`（实现＝与自己刚发布的那份合一次，剩下的落子正好就是
「两边都有→记修订号 / 两边都没→盖墓碑」，不另写一套规则就不会与 `mergeBundle` 漂移）。
判异性：把那行 `markPublished` 注释掉，恰好「删除传播 + 不许复活」这条红，其余四条照绿。
覆盖到的：A 推 B 拉落地、**远端存的对象里没有一字节明文**（连 `"tables"` 都搜不到）、
同版本再拉是 noop 且不白落快照、两边同改一行走完一圈两份都在、迟到的旧 bundle 不复活已删行、
口令不同→失败且本地一个字节不动。
**仍然没验的**（别把这条当「任何 WebDAV 都能用」）：真服务器（Nextcloud / 群晖）的鉴权跳转、
锁、分块、PROPFIND Depth 1 列表行为，以及两台真机各自的时钟偏移。〕

现有 `dataSync.ts` 是**后写覆盖 + 拉平前本地快照 5 份**的 LWW 轻量同步（借鉴清单批次 6，8 单测）。本期要做：范围扩到全量集合、冲突保留双副本而非静默覆盖、设备身份用本机派生密钥（**不引入必须登录**，遵守 Decision-0XX 的 How-to-apply）。端到端加密复用现有 AES-256-GCM 通道。开工前先精读 `src/main/modules/{dataSync,sync,cloudBackup}.ts` 与迁移中心 UI（`MigrationCenterView.vue:7,165-292`）。

### P-6 观感与性能（可与 P-1 并行）

1. **浅色模式胶囊是纯白不透明**：`tokens.css:291,306,341` 把 `--launcher-blur` 在两种模式下都设成 `blur(0)`、浅色底 `#ffffff`；系统 vibrancy 之外没有内层透明度档位 → 出一档浅色半透明 + 边框描边，并把「不透明度」变为用户设置。
   〔✅ 2026-09-20：做成**三档用户设置**（不透明 / 半透明 92%+blur18 / 通透 78%+blur26），
   **默认档一个像素都不改**——没有动 `--launcher-*` 任何 token 值（那是 DESIGN_TOKENS 的纪律，
   不该被一个功能顺手带过去）：默认档 `opaque` 对 CSS 变量走 removeProperty，样式里写成
   `background: var(--leaf-capsule-bg, var(--launcher-bg))`，兜底就是原 token。
   透明度用 `color-mix(in srgb, var(--launcher-bg) 92%, transparent)` **从 token 派生**而不是另写一组
   rgba 常量，于是深色档自动是深色毛玻璃、浅色档自动是白色半透明，两种主题不会各漂移一份；
   详情/弹层那 8 处 `--launcher-bg-elevated` 同步跟着档走，否则面板透、浮层不透会露馅。
   偏好走 pref（`launcher:capsuleGlass`）+ `preferences:getCapsuleGlass/setCapsuleGlass`
   + `capsule-glass:changed` 推送，非法/存量缺失值回落 opaque。
   证据：7 条纯函数单测 + `e2e/capsule-glass.spec.mjs` 2 条（量**胶囊根元素的计算样式**，
   改档走设置页按钮而不是直接调 API，三档 alpha 单调且切回默认必须回到原值）。
   三条踩坑都留在这里，因为它们都是「探针错而不是产品错」：
   ① Chromium 把 `color-mix(...)` 序列化成 `color(srgb 1 1 1 / 0.92)` 而不是 `rgba(...)`，
   按 rgba 正则断言会在产品没错时假失败 → 断言只吃解析出来的 alpha 数值；
   ② `--launcher-blur: blur(0)` 的计算值是 `blur(0px)` 不是 `none`，默认档断言写 `none` 同样假失败；
   ③ 胶囊窗按 URL 找到 ≠ 页面已加载，不 poll 到 `.launcher` 存在就取值会时好时坏报「根元素没找到」。
   另外把这一条原本写的一句**错误理由**改掉了：`setProperty(k, '')` 在 Chromium 里等价于删除属性
   （CSSOM 规定空值即移除），并不存在「空串击穿 var() 兜底」；实现仍用 removeProperty，
   但理由换成「显式表达不覆盖」，单测退回写空串的写法时靠 `el.set` 记录仍能判红。〕
2. `SettingsView.vue` **105 处写死色值 / 0 个 token 类**（违反 `DESIGN_TOKENS.md:103-108`），暗色模式下设置窗仍浅色 → 分 4 个 PR token 化。
3. **用户主题换不到启动器**：`--launcher-*` 被明文排除在联动外（`tokens.css:291-345`、DESIGN_TOKENS「不做什么」，属 Decision-010）。D3 之后这条要复审：让 `userThemes` 的派生覆盖 `--launcher-*` 三元组，其余维持。
   〔✅ 2026-09-20：复审结论落成 **Decision-012**——只联动**表面与文本**这 12 个键
   （底色/悬浮层/弹层/描边/hairline/四级文本/选中底/hover/input 底），
   **强调色与几何一个都不动**：Raycast 红是识别色不是主题变量，与主窗 `--brand-500`
   不随 `core.accent` 覆写是同一条口径；胶囊窗尺寸由主进程算，主题插一脚只会对不齐。
   两个刻意的取向：深浅**看 core.bg 亮度而不是 appearance 字符串**（否则深色主题会把
   Raycast 式毛玻璃变成死色块——深色档必须保留底色 alpha 0.74）；
   `core` 是 hsl/颜色名这类无法数值化的形态时**一个键都不发**，宁可整套保持 tokens.css
   也不发半套。落点只加了一个纯函数 `launcherThemeVars()`，由 `themeToCssVars()` 合并，
   注入器与胶囊入口一行没改（`launcher-entry.ts` 早就跑 `initTheme`→`initUserTheme`）。
   证据：6 条派生单测（12 个键逐一点名 + 每个键必须真在 tokens.css 里被读 + accent/几何零命中
   + 文本四档 alpha 严格递减且互不相同）+ 1 条注入端测试（喂**真实派生表**过渲染端白名单正则：
   白名单丢弃是静默的，只测 shared 侧发现不了「派生出 rgba 但注入端只认 #hex」）
   + `e2e/user-theme.spec.mjs` 新增第 2 条（真开胶囊读 `.launcher` 计算样式，切回内置回到基线）。
   两条踩坑都是探针侧的，记在这里：**按 title 认主窗**会被胶囊窗抢走（两个窗的 title 都含 Leaf，
   胶囊一开后续点击就落在胶囊页里，表现为等按钮等到超时）→ 改成按 URL 认并且**找不到就直接报错**
   而不是回落 `firstWindow()`（静默回落会把「找错窗」伪装成「产品没反应」）；
   把**切换瞬间的计算样式**当基线（320ms `theme-anim` 的插值色 `rgba(224,223,224,0.957)`
   既不是主题也不是内置，切回来永远对不上）→ 读到连续两次一致为止再比。〕
4. 列表性能：结果封顶 20（`useUnifiedSearch.ts:195`）、无虚拟化、每候选每键 `new Fuse([normText])`（`fuzzyEngine.ts:50`）。**注意 `HANDOFF.md §8` 第 3 条已对「Fuse 实例复用」判过不做（实测省 11%，约 0.1ms/次按键）——那是封顶 20 条时的数字**；封顶扩到 200 要重新量，不要直接引用旧结论，也不要直接引用我上一轮口头说的「Fuse 每键重实例化 = 真实风险」。
   〔✅ 2026-09-20：**重量过了，两个结论都被数据推翻了一半。**
   工具是 `e2e/perf-results.spec.mjs`：真开胶囊、真填查询、**页内 MutationObserver** 量到
   「DOM 不再变化」为止。三个口径是一起看的：
   `firstMutationMs` = 敲下键到第一次 DOM 变（**同步那一半**：打分 + 首屏绘制，减去 150ms 防抖就是它真正的价钱）、
   `churnMs` = 首次到最后一次突变（异步源陆续到达的窗口）、`settleMs` = 敲下键到彻底安静（含防抖）。
   A/B 的做法是改 `useUnifiedSearch.ts` 的常量 → 重新 build → 再跑一遍，
   **不在产品里留只有测试会碰的运行期旋钮**。同一台机器、10 个探测词、先全套热身再采数：

   | 查询 | 现状封顶 8/20 | 放宽 200/200 | 落地档 30/50 |
   | --- | --- | --- | --- |
   | `a` | 13 行 / churn 447 | 140 行 / 451 | 35 行 / 454 |
   | `e` | 13 / 456 | 140 / 420 | 35 / 418 |
   | `i` | 13 / 511 | 138 / 478 | 35 / 462 |
   | `s` | 13 / 540 | 151 / 535 | 35 / 480 |
   | `co` | 16 / 307 | 97 / 313 | 38 / 268 |
   | `se` | 16 / 128 | 126 / 118 | 38 / 110 |
   | `er` | 16 / 71 | 71 / 87 | 38 / 62 |
   | `clip` | 14 / 74 | 38 / 50 | 36 / 59 |

   **结论 1：多渲染十倍行是免费的。**同一查询从 13 行到 140 行，churn 差值全在噪声里
   （−36ms ~ +6ms）→ **虚拟化不做**，这一格不是欠账而是被测量否掉的候选。
   **结论 2：同步那一半根本不是瓶颈。**落地档下 `firstMutationMs` 十个词全在 **153-161ms**，
   而防抖本身就吃 150ms —— 也就是「打分 + 首屏」只花 **3-11ms**（30 行命令 + 全量候选池）。
   本轮没有重做「复用 Fuse 实例」那一组 A/B，但已经不需要：可省的都在**分数**上，
   而分数那一段量出来是个位数毫秒。旧文档里那句「实测省 11%」就此作废，
   结论（不做）改由这条 3-11ms 支撑。
   **结论 3：那 450-540ms 的尾巴是文件搜索 IO 晚到**——单字母查询在三种封顶下都一样慢，
   两字母词只要 60-110ms，且慢的部分全在 `firstMutation` 之后。真要减短延迟得动文件那一侧
   （1 字符查询该不该查文件），那是新的一格不是这一格。
   **结论 4：封顶 20 平时根本到不了**——真正卡住面板长度的是命令那一档 8
   （文件 5 / 剪贴板 3 / 片段 3 是异步补充），所以「扩到 200」原本是个空动作。
   既然渲染免费，放宽就是纯产品取舍：**命令 8 → 30、总 cap 20 → 50**，
   并留下不变量 `RESULT_CAP > COMMAND_ROW_CAP`（否则那 11 行异步补充永远被挤掉）。
   改完 65 条 e2e 全绿（含列表长度的用例没有一条假设 ≤20 行）。
   顺手把五个 cap 抽成命名常量，理由不是好看：下一个要重新量的人得能改一个数就跑。〕
5. 窗口：显/隐动画（现在完全没有）、Compact Mode（空查询收缩成一条栏）、尺寸与位置记忆（现在固定 750×520、`positionAtCursor` 光标屏居中，无 per-display 记忆）。

### P-7 无障碍与注册表合一

launcher 内 `aria-*` 实际为 3 处（`LauncherApp.vue:33`、`FormPage.vue:11-14`、`ClipboardPage.vue:62`）、`launcher.html` 无 `lang`、结果列表是无 role 的 div；补 `role=listbox/option` + `aria-selected` + 焦点管理。另一格是**两套命令注册表合一**：`shared/commands.ts` 静态清单与 `shared/commandRegistry.ts`（仅 3 个 provider，`CommandLoader.ts:20-22`）在 `useCommandSources.ts:191-199` 并行合并，导致同一命令两个 id（`ai:chat` 与 `firstparty:ai`）——README 的「统一命令注册表」目前是名不副实。

---

## 5. 覆盖自查（上一轮报告 → 本期号）

| 报告里的差距 | 落点 |
| --- | --- |
| 无修饰键动作 / 无 keep-open / 无收藏排序 / detail 空 / 参数清词 | P-1.1–1.6 |
| 无 View/Action 之分、插件不能推视图、无后台 | P-2.1–2.4 |
| React API 面只接 6/23、缺组件、多参数零 dogfood、文档数字错 | P-2.5–2.8、P-0.3 |
| 第三方扩展 0 / 无远程索引 / 无校验和 / 无 semver | P-3.1–3.4 |
| 权限引导为零 | P-3.5 |
| 未签名未公证 / publish 占位 / 无 remote | P-3.6（D2 限定为「只差证书」）+ 远端仓库需你给 URL |
| AI 代差（BYOM/MCP/Automations/Screen Awareness） | P-4 |
| 云同步能力 | P-5 |
| 浅色无玻璃 / 设置窗违反自家 token / 主题换不到胶囊 / 封顶与虚拟化 / 无动画与 compact | P-6 |
| 无障碍为零 / 双注册表 / Windows 未实机 | P-7 / D5（维持未验证并写明） |

**未覆盖并已说明理由**：跑未改动 Raycast 扩展（D1 不做）、多语言（D4 不做）、移动端（维持不做，长期观望）、Apple Developer 证书本身（外部资源，非代码任务）。

---

## 6. 全程闸口（每个 Task 的 Step「跑绿灯」都指这一串）

```bash
cd packages/leaf-plugin-sdk && npm run build && cd ../..   # 改 SDK/example 必须重建，否则测旧字节码（HANDOFF §2）
cd example-react && npm run build && cd ../..
pnpm typecheck && pnpm test && pnpm lint
npx electron-vite build && npx playwright test
```

约束提醒（都踩过）：批量替换前先清工作区；`prettier --write` 不要跑在既有大文件上；IPC 新增通道必须走 `typedHandle`/`typedInvoke` 并进 `ipcContract`（登记条目数只增不减，现 391）；`plugin.ts` 里那份内联 `typedInvoke` 不要「顺手」合并回共享模块（sandbox preload 只能 require 内置模块，`HANDOFF §8` 坑 a）。

---

## 补记（2026-09-22）：P-4② / P-2③ / P-2④ 三格的落地状态

这三格在本会话内做完后，被同日 .git 重建回退过一次；下面的「已落地」按当前树重跑过的证据写，
未跑过的照实说未跑。

### P-4②「工具进根搜索」（✅ 单测绿，e2e 未跑）

- 主进程：`toolArgSpecs` 只取 inputSchema 顶层标量、必填排前，转不动的记进 `droppedArgs`；
  工具清单连上时落一次盘（`mcp.toolCache`），**列出命令不 spawn**——回车那一刻才由
  `runMcpTool` 认 id + 工具名（工具名必须在活会话表里，缓存过期不能变成让服务器随便收名字）。
- 命令源：`McpCommandProvider` 产出 **CommandEntry**（不再是 Registry provider）。改回去的理由写在
  文件头：命令表被推送刷新时只该重拉变了的那一路。
- `mcp.servers` / `mcp.toolCache` 排除出云同步——不是「同步了不方便」而是「同步了会泄」。
- 判异记录：旧子进程迟到的 `exit` 会误删新会话（界面显示已连接、调用报未连接）。修法是
  `sessions.get(id) === session` 守卫；把守卫删掉，那条竞态用例在 5s 处超时转红。

### P-2④ 第二半：插件能压视图栈（✅ 判据单测 7 条，界面未验证）

栈只在插件**明说** `push` 时生长。第一版想靠数据指纹猜「这是不是新的一层」，写完单测就把自己
否了：搜索型插件的条目数一直在变，任何从条数/标题推的指纹都会把一次搜索的逐次重绘认成一路
往下钻，用户按返回退的是上一次结果 —— 判据挪进 `shared/pluginViewStack.ts`（含当前层的栈、
上限 8 层丢最底下、第一层不许弹），runtime 的 `declared*` 改成它的镜像（不动渲染端读法），
新通道 `plugapi:popView` / `launcher:popPluginView`，胶囊的 ESC 与返回箭头先退插件的层再关插件。
变异检查：`replaceLayer` 改成总生长 → 3 条红；`popLayer` 允许弹根层 → 那条红。

### P-2④「通用视图栈」第一批（✅ 注册表单测绿）

`launcherPageViews.ts` 把 24 节 `v-if/v-else-if` 收成一个 `<component :is>`：少一条 def 就是编译错误。
两条重放时容易漏的口径：① 默认 `key = 页面 id`（同名组件在 `:is` 下会被 Vue 复用实例，
`qlarg → pluginarg` 会留着上一页的输入值）；② 按键路由改成 `pageRef.value?.handleKey?.(e)`
（`FilesPage` 本就不处理按键，统一挂 ref 之后不能抛 TypeError）。
同批修掉的老毛病：`launcher:command-table-changed` 以前只发给胶囊窗，主窗 ⌘K 面板长期拿着过期的表。

### P-2③「插件生命周期外执行」（✅ 排程判据单测绿；e2e 未跑，见下）

选择做**受限通道**而不是「明确写不支持」。四道闸全在宿主侧：`owner` 由 sender 身份定、
每插件 3 条、总盘子 20 条留给用户、`firesPerDay` 一天封顶 96 次（≈每 15 分钟），
外加「只能排 `mode:'action'` 的命令」和「胶囊里正有插件在用就跳过」。
两处不假装：`runPluginCommandDetached` 的「成功」只代表**投递到了插件**；成败只到插件自己知道，
所以设置页写「已交给插件」而不是「执行成功」。权限单列 `schedule`，不并进 `net`/`fs.open`。

### 这批复原本身踩到的坑（给下一个被回退折磨的人）

- **`file-history` 只存改前态**，别指望它给出成品；成品只能从 transcript 的 Write/Edit/脚本重放。
- 重放会在**自己已经改过的**文件上再叠一层（`ipc-contract` 成对重复声明、`preload/plugin.ts`
  双份 `all:`、`plugin-protocol` 把别人刚补回的清洗段又贴一遍）。每跑一批就 `tsc`+`vitest` 一轮，
  重复声明类错误（TS2300/TS2393/esbuild already declared）是最快的探测器。
- 重放到别人今天恢复出的版本上，口径是「**他们的为基底，只加我的增量**」；两处同义符号
  （`PluginPreference` / `PluginPreferenceDeclaration`）用别名接，不要再造一份实现。

### 仍未跑通 / 仍未回来

- 渲染层 12 个 launcher 页面盘上不存在且全盘无副本（`SnippetsPage`/`SettingsPage`/`AIChatPage`/
  `BrowserTabsPage`/`SystemInfoPage`/`WindowSwitcherPage`/`TrashPage`/`FocusStatsPage`/
  `DictionaryPage`/`NotesPage`/`ReminderPage`/`CalendarPage`）——**这是 P-2④ 之前就被记录在案的
  恢复缺口，不是这三格造成的**。在它补齐前 `electron-vite build` 与 e2e 起不来，
  所以上面三格只标了「单测绿」，e2e 一栏留空。
- 上面三条 e2e：`mcp-tool-search.spec.mjs`、`plugin-schedule.spec.mjs` 在树里但没跑过；
  `ai-action` / `capsule-compact` / `settings-theme` 三份按重放结果回填后待跑。

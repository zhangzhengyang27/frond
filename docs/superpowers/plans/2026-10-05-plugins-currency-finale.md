# currency React 标杆 + 收尾 实施计划（计划 3/3）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 currency 重写为 React SDK 标杆插件（spec 5.5），example-plugin 同步演示新协议字段（spec 5.7），PLUGIN_DEV.md 补新能力章节（spec 8.8 收尾），e2e 覆盖颜色块/dataUrl 条目渲染，全量回归收口。

**Architecture:** currency 保持安装位置 `plugins/com.frond.currency/`（builtinPlugins 自动安装依赖它），React 源码 `src/main.tsx` 经 esbuild 打成自包含 `dist/main.js` **入库**（安装=整目录拷贝，node_modules 绝不能进插件目录——构建用 esbuild `nodePaths` 锚到 example-react/node_modules 解析 react/SDK）。e2e 沿用 FROND_E2E='1' + probeCounts 惯例。

**Tech Stack:** esbuild iife bundle（照 example-react/build.mjs）；frond-plugin-sdk（List/ActionPanel/useNavigation/Form）；vitest + playwright。

**Spec:** `docs/superpowers/specs/2026-10-05-builtin-plugins-redesign-design.md`（第 5.5/5.7 节、第 8 节实施顺序 8、第 10 节测试策略）

## Global Constraints

- `dist/main.js` 是契约名（index.html 按此路径引；改名=静默白屏）。
- bundle 必须 `format: 'iife'` + `define: { 'process.env.NODE_ENV': '"production"' }`（插件 sandbox BrowserView 无 process、无模块解析）。
- currency `plugin.json` version `2.0.0` + `"api": "react"` + permissions 补 `"clipboard.write"`；`plugins.json` 同步 2.0.0（pluginManifestAudit 兜底）。
- currency 汇率源不变 `https://open.er-api.com/v6/latest/<base>`；db 缓存 key `rates`，值 `{ base, rates, ts }`，24h 有效。
- e2e 环境外网不可依赖：currency e2e 断言「React 视图已提交并渲染（列表或错误/缓存态条目均算）」，不断言具体汇率数值。
- 每任务：vitest/eslint/typecheck → commit 点名加文件。

---

### Task 1: currency React 标杆

**Files:**
- Create: `plugins/com.frond.currency/src/main.tsx`、`plugins/com.frond.currency/dist/main.js`（构建产物入库）、`plugins/com.frond.currency/index.html`（重写为 React 壳）、`scripts/build-currency-plugin.mjs`
- Modify: `plugins/com.frond.currency/plugin.json`（v2.0.0 + api react + clipboard.write）、`plugins.json`、`package.json`（script `build:currency`）
- Test: `plugins/com.frond.currency/lib.test.js`（纯函数部分：输入解析/缓存有效期/换向——React 视图外可测的逻辑抽 `lib.js`，UMD 同款）

**Interfaces:**

```js
// plugins/com.frond.currency/lib.js：FrondCurrencyLib（main.tsx import 相对路径 './lib.js'？——
//   不行：lib.js 是 UMD，esbuild 可 bundle 它。约定：lib.js 保留给 vitest 直测的纯函数，
//   main.tsx `import { parseQuery, isCacheFresh } from '../lib.js'` 由 esbuild 打进 bundle，
//   UMD 头让 vitest 也能直接 import（两端同一份实现）。
// parseQuery(q, {baseCurrency, targetCurrency}) → { amount: number, from: string, to: string } | null
//   '100 usd cny' / '100USD→CNY' / '100'（无币种用偏好默认，大小写不敏感，金额支持小数）
// isCacheFresh(cache, nowMs) → boolean  // ts 在 24h 内
// topCurrencies: ['CNY','USD','EUR','JPY','GBP','HKD','KRW','AUD','CAD','SGD']（内置常用清单，Top10 换算列表的行序）
```

React 视图（`src/main.tsx`）行为契约：
- `convert` 命令：getContext 拿 args.q（命令 arguments 声明一个 text 参数 `q`，placeholder「金额 货币对，如 100 usd cny」）→ parseQuery → 读缓存/取汇率（`fetch('https://open.er-api.com/v6/latest/' + from)`）→ `render(<List>)`：
  - 首条目：`100 USD = 7xx.xx CNY`（title=结果、subtitle=汇率 1 USD = x CNY + tag `{ text: '缓存 HH:mm', tone: 'default' }` 或 `{ text: '实时', tone: 'success' }`）；actions=复制结果（showHud）、换向（重渲染 from/to 互换）、收藏该货币对（db `pairs`）、换币种（`nav.push(<CurrencyPicker>)`）、自定义金额（`nav.push(<AmountForm>)`）
  - Top10 组（section='常用货币'）：topCurrencies 各货币的换算条目（排除 from/to 本身）
  - 收藏组（section='收藏'，db pairs 有则渲染，动作=取消收藏）
  - 网络失败且有缓存 → 缓存数据 + tag `{ text: '离线 · ' + 距上次更新小时数 + 'h 前', tone: 'warn' }`；无缓存 → 错误条目（subtitle=原因 + 「重试」动作）
- `CurrencyPicker` 页：List 全货币（rates keys ~160 条，searchText 过滤——SDK List 若无搜索回调则 arguments/键入过滤不可用，**用 List items + 首字母 section 分组**，点击条目回调设置目标币并 `pop()`）
- `AmountForm` 页：Form（text 字段 amount，submitLabel「换算」）→ onSubmit 写回状态 pop 回列表按新金额重算
- 复制动作：`copyToClipboard(text)` + `showHud('已复制')`（SDK 导出）
- onEnter 无 args.q：直接渲染收藏对 + Top10（缓存优先，无缓存后台取）

- [ ] **Step 1: 写 `plugins/com.frond.currency/lib.test.js`**（测试全文）

```js
import { parseQuery, isCacheFresh, topCurrencies } from './lib.js'

describe('currency lib（React 视图外的纯函数契约）', () => {
  it('parseQuery 三种输入形态', () => {
    expect(parseQuery('100 usd cny', { baseCurrency: 'CNY', targetCurrency: 'USD' }))
      .toEqual({ amount: 100, from: 'USD', to: 'CNY' })
    expect(parseQuery('100', { baseCurrency: 'CNY', targetCurrency: 'USD' }))
      .toEqual({ amount: 100, from: 'CNY', to: 'USD' })
    expect(parseQuery('12.5 EUR→JPY', {})).toEqual({ amount: 12.5, from: 'EUR', to: 'JPY' })
    expect(parseQuery('abc', {})).toBeNull()
  })
  it('isCacheFresh 24h 边界', () => {
    const now = Date.now()
    expect(isCacheFresh({ ts: now - 23 * 3600e3 }, now)).toBe(true)
    expect(isCacheFresh({ ts: now - 25 * 3600e3 }, now)).toBe(false)
    expect(isCacheFresh(null, now)).toBe(false)
  })
  it('topCurrencies 恰 10 项且含 CNY/USD', () => {
    expect(topCurrencies).toHaveLength(10)
    expect(topCurrencies).toContain('CNY')
  })
})
```

- [ ] **Step 2: RED** —— `pnpm vitest run plugins/com.frond.currency/lib.test.js`（lib.js 不存在 → FAIL）
- [ ] **Step 3: 实现 lib.js（UMD，纯函数）→ GREEN**
- [ ] **Step 4: 写 `src/main.tsx`（行为契约如上；JSX automatic，参照 example-react/src/main.tsx 的 start/render/List 用法）+ `index.html` React 壳（照 example-react/index.html 的结构：root 容器 + `<script src="dist/main.js"></script>`）+ `scripts/build-currency-plugin.mjs`（照 example-react/build.mjs，`absWorkingDir: join(ROOT, 'example-react')`、entryPoint 指向 currency 的 src/main.tsx、outfile 指向 currency 的 dist/main.js、`nodePaths: [join(ROOT, 'example-react', 'node_modules')]`）+ package.json script `build:currency`。跑 `pnpm build:currency` 确认 dist 产出且 log 显示 SDK 模块已打包。**
- [ ] **Step 5: plugin.json 改造**（version 2.0.0、`"api": "react"`、commands[0] 加 `arguments: [{ name: 'q', type: 'text', placeholder: '金额 货币对，如 100 usd cny（可空）' }]`、permissions 补 clipboard.write）；plugins.json 同步 2.0.0。
- [ ] **Step 6: 验证**：`pnpm vitest run plugins/com.frond.currency` → 绿；`pnpm test`（审计绿）；`pnpm typecheck`（currency src 有 tsconfig 覆盖？plugins/** 不在 tsconfig.web/node 内——用 example-react 的 tsconfig 模式：不单配，esbuild 转译不查型；`pnpm typecheck` 保持 0 即可）+ `npx eslint plugins/com.frond.currency/src plugins/com.frond.currency/lib.js` → 0 error。
- [ ] **Step 7: Commit** —— `feat(plugins): currency v2.0.0 React 标杆——SDK List/push 货币选择/Form 金额/db 缓存 24h`

### Task 2: e2e——新字段渲染 + currency 冒烟

**Files:**
- Create: `e2e/builtin-plugins-render.spec.mjs`
- Modify: 无（独立 spec；不并入 smoke 名单，运行方式 `npx playwright test e2e/builtin-plugins-render.spec.mjs`）

**Interfaces:** 沿用计划 1 plugin-hud.spec.mjs 骨架（FROND_E2E='1'、installFromFolder、probeCounts）；断言面：
- colorpicker：installFromFolder(`plugins/com.frond.colorpicker`) → openPlugin → 主窗口不接管（data 模式）→ 胶囊副输入框输入 `#336699` → 断言胶囊 DOM：`.plist-item` ≥5 条、`.plist-icon [style*="336699"]` 或 `.plist-icon i/style 含 336699` 至少 1 条（tintColor 透传）、`.plist-header` 存在（分组渲染）
- qrcode：installFromFolder(`plugins/com.frond.qrcode`) → 输入 `https://frond.app` → 断言 `img.plist-thumb` 存在且 `src^="data:image/png;base64,"`
- currency：installFromFolder(`plugins/com.frond.currency`)（React dist 已入库无需构建）→ openPlugin('com.frond.currency') → 断言**任一**：`.plist-item` 存在（列表/错误/缓存态渲染完成）——用 `await expect.poll(...)` 包住（网络态不定）

- [ ] **Step 1: 写 spec**（三个 test 块，骨架照 plugin-hud.spec.mjs；onboarding 跳过 + installFromFolder 绝对路径 join(ROOT, 'plugins', 'com.frond.colorpicker') 等）
- [ ] **Step 2: 跑** `pnpm build && npx playwright test e2e/builtin-plugins-render.spec.mjs` → 3 passed（colorpicker/qrcode 的输入方式：data 模式插件接管胶囊搜索框为 subinput，`capsule.locator('input').fill('#336699')` 后等 onSubInputChange 生效；若 fill 不触发 input 事件则用 `pressSequentially`）
- [ ] **Step 3: Commit** —— `test(e2e): 内置插件新字段渲染断言——tintColor 颜色块/dataUrl 缩略图/分组头 + currency React 冒烟`

### Task 3: example-plugin 升级（新协议字段演示）

**Files:**
- Modify: `example-plugin/index.html`、`example-plugin/plugin.json`（version 0.2.0）、`example-plugin/launcher-api.d.ts`（补 showHud/新 icon 形状类型）

**Interfaces:** 新增两条演示命令（保留现有四条不动）：
- `fancy`（view）：renderList 一次性演示 section（'颜色块' 组：三条 tintColor 条目；'徽章' 组：tag tone 四态条目）+ dataUrl 条目（1x1 PNG 内置 base64 常量）+ detail markdown
- `hud`（action）：showHud('example-plugin HUD 演示') 后 close
- launcher-api.d.ts 补：`showHud(title: string): Promise<boolean>`；ListItem.icon union 类型注释更新

- [ ] **Step 1: 改 manifest + index.html（新命令代码照新字段形状写全）+ d.ts 同步**
- [ ] **Step 2: 验证**：`pnpm test`（plugin-api-parity 覆盖 example-plugin 调用面 → 绿）；`npx eslint example-plugin` 若被 ignore 则跳过（eslint.config ignores 含 example-plugin/**——确认跳过合规）
- [ ] **Step 3: Commit** —— `feat(example-plugin): 演示新协议字段——section/tintColor/dataUrl/tag/showHud（v0.2.0）`

### Task 4: PLUGIN_DEV.md 新能力章节

**Files:**
- Modify: `PLUGIN_DEV.md`（在 API 参考表后新增一节）

**Interfaces:** 章节名「2026-10 协议扩展（条目视觉 / 分组 / HUD）」，内容要点（每条给代码片段）：
1. `icon` 三形态（string / `{value, tintColor}` / `{value, dataUrl}`）+ dataUrl 65536 上限与 png 前缀约束
2. `section` 分组语义（相邻同名聚合、渲染层 trim 归一）
3. `accessories` tag 形状（tone 四态语义）
4. `showHud`（无需权限、1.5s、与 notify 的选择指引）
5. **复制动作公约**：callback `'copy:<index>'` + `lastResults` 缓存（payload 2000 字符清洗上限，禁内联长文本）+ `showHud('已复制')`
6. **lib.js 测试基建**：UMD 模板、`plugins/<id>/lib.test.js` vitest 自动收录、UMD 头代码块
7. React 插件构建：指向 example-react/build.mjs 与 currency 的 `scripts/build-currency-plugin.mjs` 为参照

- [ ] **Step 1: 写章节（代码片段从已落地实现摘录，保持与实现一致）**
- [ ] **Step 2: Commit** —— `docs(PLUGIN_DEV): 2026-10 协议扩展章节——icon视觉/分组/徽章/HUD/复制公约/lib.js测试基建`

### Task 5: 全量回归收口

**Files:** 无新改动（纯验证；回归先修后随任务提交）

- [ ] **Step 1**: `pnpm typecheck && pnpm lint && pnpm lint:css && pnpm test` 全绿
- [ ] **Step 2**: `pnpm build && npx playwright test e2e/launch-smoke.spec.mjs e2e/settings-theme.spec.mjs e2e/pomodoro.spec.mjs e2e/plugin-hud.spec.mjs e2e/builtin-plugins-render.spec.mjs e2e/react-view.spec.mjs` 全绿
- [ ] **Step 3**: 输出手工冒烟清单到最终报告（20 插件主链路抽查：每类 2 个 + currency 网络态 + quickfolders 置顶/子目录）
- [ ] **Step 4**: `git status` 干净；ledger 收口

## Self-Review 结论

1. **Spec 覆盖**：5.5 currency（Task 1）、5.7 example-plugin（Task 3）、第 8 节收尾文档/e2e（Task 2/4）、第 10 节测试策略（Task 5）——全覆盖。
2. **占位符**：lib 测试全文给出；main.tsx 以行为契约清单给定（SDK 组件用法参照 example-react 现有范例，属「有源可照」）；构建脚本以 example-react/build.mjs 为蓝本 + 关键差异（nodePaths/entry/outfile）写明。
3. **类型一致**：copy 动作沿用计划 2 公约（`copy:<index>` + showHud）；db key `rates`/`pairs` 唯一；`topCurrencies` 与 currency 偏好 options 一致（10 币种）。
4. **Review Focus**：新风险面=「e2e 依赖外网」（Global Constraints 已声明断言降级策略）、「node_modules 进插件目录致安装膨胀」（Task 1 构建方案显式规避）、「React 壳 index.html 引错 dist 路径」（契约名约束 + build log 校验）。

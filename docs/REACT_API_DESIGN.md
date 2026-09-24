# Frond · React 级扩展 API 设计（#11，2026-09-19）

> 对应 `RAYCAST_GAP_ANALYSIS_V4.md` §2.11 的核心缺口：插件只有声明式数据协议（v1
> renderList），没有组件级 UI API。参考 `references/vicinae/src/typescript/`（react-reconciler
> 序列化 + 函数 props 回调 id 注册表 + 宿主 model-parser 原生渲染）。
>
> **状态（2026-09-24 校正）：已实施，非设计稿。** 本文此前长期标着「设计稿，待确认后
> 实施」，而 SDK 早已落地并在用（M1 / M2 / M3 均已完成，`example-react` 是活样例）。
> 下文保留设计意图，但**以代码为准**；实现细节与本稿不符之处已在对应段落标注。
>
> ⚠ **改这个 SDK 前必读**：`react-reconciler` 是**按位置传参**调用宿主配置的，
> 且它的小版本会改调用签名 —— 2026-09-22 就因 `commitUpdate` 沿用旧版形参顺序
> 出过一次真事故（fiber 被写进 `HostNode.props` → 序列化爆栈 → **此后所有视图提交
> 静默消失**，而单测 / typecheck / 构建全绿）。现在 `packages/frond-plugin-sdk/package.json`
> 把版本**钉成精确值**，并有 `__tests__/hostconfig-contract.test.ts` 在运行时量出
> reconciler 实际传了几个实参、每一位是什么。**升级前先跑它**。

## 1. 目标与非目标

**目标**
- 插件作者用 React 组件写 UI：`<List>` / `<List.Item>` / `<Detail>` / `<Form>` / `<ActionPanel>`，
  API 形态对标 `@raycast/api` 子集——会 Raycast 就会写 Frond 插件
- **宿主原生渲染**（Vicinae 同款哲学）：React 树序列化为 JSON 协议，胶囊用 Frond 自己的
  Vue 组件渲染——插件零 CSS、零 DOM，Raycast 质感由宿主统一保证，插件 DOM 永不进宿主
- 回调闭环：`onAction` / `onChange` 等函数 props 经回调 id 注册表回流插件

**非目标（明确不做，Proxy 抛「not supported」，Vicinae 同款策略）**
- MenuBarExtra / WindowManagement / AI / Toast HUD / OAuth 全家桶
- 插件自绘 DOM（Option B，见 §7 备选）——放弃「宿主统一质感 + 最小攻击面」
- 直接运行未改动的 Raycast 商店扩展（M3 评估 api-compat 包装层的覆盖度后再定）

## 2. 架构（数据流）

```
插件 BrowserView（React + frond-plugin-sdk）
  react-reconciler（SDK 内置，supportsMutation）
    → 组件树序列化 {$t: "list-item", props: {...}, children: [...]}
    → 函数 props 替换为回调 id（SDK 端 Map<id, fn>，组件卸载时清理）
  → launcherApi.renderView({views, version})        （既有 plugapi 通道，结构化克隆）
主进程 setDeclaredList 旁路 → 转发胶囊窗
胶囊渲染端「视图模型解析器」（对应 Vicinae model-parser）
    → JSON 树映射为 Frond Vue 组件（PluginListPage / Detail 面板 / FormPage / ActionPanel）
用户交互（回车 / 点击 / 表单提交）
    → plugapi:callback(id, args)                       （宿主只转发 id，不解析语义）
  → SDK 回调注册表分发 → 插件 setState → 下一轮 reconcile → 增量提交
```

关键点：**宿主不解析 React 语义，只解析一个版本化的 JSON 视图 schema**——协议面
（schema）稳定，React 侧实现（reconciler）可以独立演进。

## 3. 协议（v2，向后兼容 v1）

- `plugin.json` 增加 `"api": "react"`（缺省 `"data"` = 既有 renderList 模式，互不影响）
- 视图树叶子节点直接复用 v1 形状（`list-item` 的字段 ≈ PluginListItem），宿主解析器
  把树映射进**现有 PluginListPage 渲染管线**——v2 是 v1 的组件化超集，不是重写
- 视图种类 v1：`list`（含 section 分组）/ `detail`（markdown|text）/ `form`（字段协议
  复用 #3 FormField）/ `action-panel`
- 提交合并：reconcile 高频变化（输入态）在 SDK 侧合并后再提交，避免 IPC 风暴。
  **实现与本稿不同**：用的是 `queueMicrotask` 而**不是 rAF** —— 隐藏页面（声明模式
  插件视图）的 rAF / setTimeout 会被 Chromium 后台节流冻结，回调后的视图提交将
  无限延迟。React commit 本身已按批次收敛，微任务直发即最及时且不被节流
  （见 `src/reconciler.ts` 的 `scheduleSubmit`）

## 4. SDK 形态（frond-plugin-sdk）

- 依赖：`react`（peer，范围 `>=18`）+ `react-reconciler`（**peer + dev 两处都钉精确
  版本 `0.34.0`，不带 `^`/`~`**）——只在插件侧，宿主零 React。
  钉死的原因见文首的升级守卫说明：宿主配置按位置传参，签名漂移是**静默**故障。
  升版流程 = 改 `package.json` 两处 + 改 `hostconfig-contract.test.ts` 里的
  `PINNED_RECONCILER_VERSION` + 跑它确认实参个数与位置没变
- 组件：List / List.Item / List.Section / Detail / Form.* / ActionPanel / Action
- Hooks v1：`useNavigation()`（push/pop 视图栈，插件内自管）、`useLocalStorage()`（走
  既有 plugapi:db* 通道）
- 环境门控：`Environment.canAccess` 形态预留（对应敏感权限声明制）
- 不支持的 API：递归 Proxy，调用即抛带文档链接的错误

## 5. 里程碑

- **M1（本轮）**：SDK（reconciler + List/Detail/ActionPanel + useNavigation + 回调注册表）
  + 胶囊解析渲染器 + `api: "react"` 门控 + `example-react` 插件（搜索 GitHub 仓库演示
  List + Detail + 回调）+ e2e（渲染 → 交互回调 → 状态更新闭环）
- **M2**：Form 组件全家桶（复用 pluginarg/FormPage）+ useLocalStorage + Grid
- **M3（已完成 2026-09-19）**：`packages/frond-raycast-api`（`@frond/raycast-api`）兼容别名层——
  消化 List.items/List.Item.actions/accessories 对象数组/Form 字段命名/Form.Submit/
  Action.Copy·Open·Close 等形状差异。跑未改动商店扩展仍是非目标；
  插件侧 API 清单见 `docs/PLUGIN_DEVELOPMENT.md` §2
- **P-2.3 / P-2.5 逐项消掉的 notSupported**（每接一格都同时删掉那条降级，防「文档说支持、代码仍降级」）：
  `Toast`·`LocalStorage`·`Cache`（P-2.3）→ `navigation.popToRoot`（P-2.6）→
  `Alert.show`·`alert`（宿主原生模态框）、`open(url)`（协议白名单 + `net` 权限）、
  `getPreferenceValues`（一次读全声明过的偏好）（P-2.5）。
  **只剩 `getSelectedText` 未接**：要 macOS 辅助功能下的 AX API，宿主还没有这一层；
  「模拟 ⌘C 再读剪贴板」这条捷径在 Frond 里**不能用**——本应用自己记录剪贴板历史，
  模拟一次复制就往用户的历史里塞了一条真数据。
  两个必须记着的形状差别：`getPreferenceValues` 在 Frond 是 **async**（Raycast 同步），
  漏 `await` 会读到 undefined；`Alert.enableInput` 没有对应物（原生框无输入框），传了会明确 warn。

## 6. 测试与验收

- SDK 单测（`packages/frond-plugin-sdk/__tests__/`，测的是 `dist/`，由
  `vitest.global-setup.ts` 每次从 src 重建 —— 杜绝「改了源码却测着旧字节码」）：
  - `sdk.test.ts`：序列化行为（Section 拍平不重复、嵌套函数 props 清洗、环状 props
    切断、回调 id 失效可诊断、useNavigation 引用稳定、List 加载/空态、Detail actions）
  - `hostconfig-contract.test.ts`：**react-reconciler 调用约定契约**（版本钉死 +
    运行时量实参个数与位置 + 宿主配置形参顺序）
  - `platform.test.ts`：平台能力门控
- 宿主解析器单测：JSON 树 → 视图模型（含非法节点 fail-closed 剔除）
- e2e：example-react 插件 → 胶囊打开 → List 渲染 → 回车触发回调 → 详情切换
  （`e2e/react-view.spec.mjs`）

## 7. 备选方案对比（已否决 Option B）

**Option B：插件在 BrowserView 内自渲染 React DOM**——无需协议，但：(1) 质感与胶囊
割裂（每个插件一套 UI 风格）；(2) 插件 DOM 直接运行在宿主进程窗口，攻击面↑；(3) 与
「声明式、宿主渲染」的既有 M3.1 决策相悖。Vicinae/ueli 生态均走宿主渲染路线。

## 8. 需拍板事项（**均已有结论**，2026-09-24 回填）

1. **SDK 分发形态** → **仓库 workspace 包**（`packages/frond-plugin-sdk`，
   `pnpm-workspace.yaml` 收录；插件侧经 dist 引用）。发布 npm 仍待办。
2. **v1 组件面** → **同期就含 Form**：`List` / `List.Item` / `List.Section` /
   `Detail` / `Form.*` / `ActionPanel` / `Action` 均已实现（见 §4）。
3. **API 命名** → **两条都做**：自有命名 `frond-plugin-sdk` + `@frond/raycast-api`
   兼容别名层（M3 已完成）。

> 本节此前列的三条「需拍板」其实早已由实现回答，长期没回填 —— 属于本仓库
> 「文档自称事实源、实际已漂」的典型。回填后本节保留作决策留痕，不再表示待办。

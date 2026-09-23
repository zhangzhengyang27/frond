# Leaf · 主题与文案语调（THEME & VOICE）

> **本文件 2026-09-23 从代码重生成。** 原件与 `PLUGIN_QA_CHECKLIST.md` 一起随 2026-09-22 桌面误删事故丢失，各备份池无副本，所以这里的内容全部来自当下盘面上的代码与活文档，不引用任何记忆中的"原来写过的话"。
> `docs/README.md:24` 对本文的期望是「主题与文案语调」。**语调（第 5 节）那一半没有事故前成文依据**，写法与主题那一半不同，见 §5.0。

## 本文的事实来源

| 分区 | 真理源 | 本文从它取什么 | 本文**不**取什么 |
| --- | --- | --- | --- |
| token 该是什么值 | [`DESIGN_TOKENS.md`](./DESIGN_TOKENS.md)（自述「唯一的视觉事实源」`:3`） | 只引用它的结论与纪律 | **不抄它的任何色值表**（§1 起全部走实现线） |
| 明暗三态 | `src/renderer/src/composables/useTheme.ts` | 生效方式、广播、切换动画 | — |
| 用户自带主题 | `src/renderer/src/composables/useUserTheme.ts` + `src/main/modules/userThemes.ts` + `src/shared/themeFile.ts` + `src/shared/themeSchema.ts` | 加载 → 校验派生 → 注入 → 摘除 全链 | — |
| 主题相关 IPC | `src/shared/ipc-contract.ts:149-150,176-184,188-206` + `src/main/ipc/preferences.ts` + `src/preload/index.ts:232-241,247-253` | 通道名与契约形状 | — |
| 胶囊窗怎么跟着换 | `src/renderer/src/launcher-entry.ts:15-24` + `themeFile.ts:275-294` + `src/renderer/src/launcher/LauncherApp.vue:1721-1755` | 跨渲染进程的联动口径 | — |
| 与主题正交的观感档 | `src/shared/capsuleGlass.ts` / `src/shared/density.ts` | 覆盖与**摘除**的实现口径（§3.2 的那条教训在这里） | — |
| 主题行为契约 | `e2e/user-theme.spec.mjs` / `e2e/settings-theme.spec.mjs` / `e2e/capsule-glass.spec.mjs` / `e2e/density.spec.mjs` | 已跑通的验证链条 | 不代它们声明"跑过" |
| 拍板史 | `docs/DECISIONS.md`（Decision-010 `:141-149`、Decision-012 `:185-200`）+ `docs/POSITIONING.md:39` | 强调色/几何不联动的原因 | — |
| 文案语调 | 见 §5.0（**没有成文规范**，只有三条边角依据 + 界面样本） | 归纳倾向 | 不写成规章 |

**一句话分工**：`DESIGN_TOKENS.md` 管「一个 token 该是什么」；本文管「一个主题怎么被装进来、怎么落到 DOM、怎么摘干净、怎么证明它真的生效」。

---

## 0. 先分清三条轴（互不等价，容易混）

| 轴 | 取值 | 载体 | 持久化 | 生效方式 | 默认为何 |
| --- | --- | --- | --- | --- | --- |
| **A 明暗** | `light` / `dark` / `auto` | `html.dark` 类 + `html[data-theme]`（`useTheme.ts:50-67`） | `preferences` 表 `theme` 键，缺省回落 `'auto'`（`PreferencesDataStore.ts:85-102`、`ipc-contract.ts:1543-1544`） | 换类/属性 → `tokens.css` 的 `:root` / `html.dark` / `:root.dark,html.dark` 三块各自命中（`tokens.css:25,326,358-359`） | v4 产品决策：跟随系统（`useTheme.ts:26`） |
| **B 主题集** | `''`（内置 tokens.css）或某个用户主题 id | 一段 `<style id="leaf-user-theme-vars">`（`useUserTheme.ts:15,29-36`） | `preferences` 表 `theme:activeUser` 键（`PreferencesDataStore.ts:54,105-120`） | 在 `tokens.css` **之上**叠一层覆盖；选内置即把节点整个摘掉 | 默认不注入，观感与未上此功能时一致 |
| **C 观感档** | 密度 `comfortable/compact`、玻璃 `opaque/soft/clear`、紧凑模式 布尔 | 根元素上的 `--leaf-*` CSS 变量（`density.ts:39-43`、`capsuleGlass.ts:64-68`） | 三条独立 preference（`ipc-contract.ts:170-182`） | `setProperty` / `removeProperty` 落到 `documentElement`，消费端 `var(--leaf-x, token 兜底)` | 全默认 = 一个像素都不变 |

A 与 B 是**正交**的：一套用户主题自带 `appearance`，激活时设置页会顺手把 A 切过去，否则「深色主题配在亮底上会花」（`SettingsView.vue:177-178`，注释原话）。C 与主题无关，但它和 B 用同一套「往根上写变量」的机制，所以 §3.2 那条摘除教训对它同样成立。

---

## 1. 怎么用一个主题（生效链，逐步可点）

### 1.1 读盘：目录、体积上限、坏文件不拖垮列表

| 环节 | 落点 |
| --- | --- |
| 主题目录 = `userData/themes/` | `src/main/modules/userThemes.ts:32-40`（`themesDir()` / `ensureThemesDir()`） |
| 只吃 `.json`，按文件名排序遍历 | `userThemes.ts:83` |
| 单份体积上限 256KB，超了归入 `rejected` | `userThemes.ts:20,86-89` |
| 逐份解析，非法文件**不**抛穿列表 | `userThemes.ts:90-103`（错误原文进 `rejected`，UI 指名报出） |
| id 重复只留先出现的 | `userThemes.ts:95-98` |
| 装进来的文件名由 **id** 派生，来源文件名不参与拼路径 | `userThemes.ts:60-67`（`safeThemeFileName`）、`:120-133`（先校验后写、重新序列化） |

### 1.2 校验与派生：fail-closed + 白名单 + 派生基座

| 规则 | 落点 |
| --- | --- |
| 任何字段非法 → 整份拒绝并给出字段级原因（不允许"部分生效"） | `src/shared/themeFile.ts:37-39,197-238` |
| 颜色值只走白名单正则（`#hex3/4/6/8`、`rgb(a)()`、`hsl(a)()`、纯字母名），`;` `}` `<` `url(` 进不来 | `themeFile.ts:29-30,42-52` |
| hex 长度**不能**写成 `{3,8}`（会把 CSS 不认的 5 位放进来） | `themeFile.ts:26-30` 注释与正则 |
| 语义子表是封闭集：未知键忽略，不放大成注入面 | `themeFile.ts:55-70`（`:64`） |
| 未显式给的语义键由 `core` 三元组派生；深浅按 `core.bg` 亮度，不信 `appearance` 字符串 | `themeFile.ts:139-172`（`:146` 非 hex/rgb 时不派生） |
| 不可派生项（`text-danger` / `text-success` 等）继承同 `appearance` 的内置基座 | `themeFile.ts:188-191,226` + `themeSchema.ts:157`（`BUILTIN_THEMES`） |
| `text-brand` 按 WCAG 4.5:1 把 accent 往 fg 方向拉 | `themeFile.ts:174-186` |
| 中文主题名的 id 兜底必须**确定**（id 会被持久化成"当前激活主题"） | `themeFile.ts:240-258` |

### 1.3 IPC 面（四条 + 两条广播）

| 通道 | 契约 | 主进程 | preload |
| --- | --- | --- | --- |
| `preferences:getTheme` / `setTheme` | `src/shared/ipc-contract.ts:149-150` | `src/main/ipc/preferences.ts:22-29`（setTheme 后向**所有窗口**推 `theme:changed`） | `src/preload/index.ts:247-248`、广播订阅 `:250-253` |
| `userTheme:list` | `ipc-contract.ts:189-197`（返 `active/themes/rejected/dir`） | `preferences.ts:34-42` | `preload/index.ts:233` |
| `userTheme:setActive` | `ipc-contract.ts:198-201` | `preferences.ts:44-54`（`''` = 回内置；非空 id 必须真实存在，否则 `主题不存在：…`；随后广播 `userTheme:changed`） | `preload/index.ts:234` |
| `userTheme:install` | `ipc-contract.ts:202-205`（含 `canceled`） | `preferences.ts:56-69`（系统选择框 → `installThemeFile`） | `preload/index.ts:235` |
| `userTheme:openDir` | `ipc-contract.ts:206` | `preferences.ts:71-76` | `preload/index.ts:236` |
| 广播 `theme:changed` / `userTheme:changed` | 单向推送，不入 `typedHandle` 契约面（与 `density:changed` 同形，`ipc-contract.ts:176-178`） | `preferences.ts:27,51` | `preload/index.ts:239-240,252` |

### 1.4 渲染端注入：一段 `<style>`，不是逐条 `setProperty`

`useUserTheme.applyThemeVars()`（`src/renderer/src/composables/useUserTheme.ts:20-37`）做四件事：

1. 变量名与值在 **IPC 边界再校验一次**——"这些字符串最终进的是 DOM 里的 CSS"（`:16-17,27`）。
2. 选择器写全三档：`:root,:root.dark,html.dark`。只写 `:root` 会被 `tokens.css` 的深色块（特异性 0,2,0）压过，**主题在深色下静默失效**——这是代码注释里点名的坑（`:31-35`）。
3. 节点始终后插入 `<head>`，靠"同特异性后来者胜"压过基线（`:36`）。
4. 变量表来自 `themeToCssVars()`：语义子表 22 键 + `--launcher-*` 12 键；`core` 三项**不输出**（`tokens.css` 里没有 `--bg/--fg/--accent` 消费者）（`src/shared/themeFile.ts:296-312`）。

### 1.5 摘除：切回内置 = 删掉那个节点

`applyThemeVars(null)` → `document.getElementById('leaf-user-theme-vars')?.remove()`（`useUserTheme.ts:21-24`）；`applyActive()` 在找不到目标主题时传的就是 `null`（`:44-47`）。这条被 e2e 直接钉成断言：`e2e/user-theme.spec.mjs:117-125`（点「内置（tokens.css）」后既要比变量值回到 `#…`，也要 `getElementById(...) === null`）。

### 1.6 多窗口一致：靠广播，不靠各窗自读

主进程改完就向 `BrowserWindow.getAllWindows()` 推（`preferences.ts:26-28,50-52`）；渲染端各自订阅：明暗 `useTheme.ts:82-94`（B4 修复，只在本地落后时应用以免自身回声），主题集 `useUserTheme.ts:87-97`。两处订阅都带 `try/catch`，理由写明是"preload 未更新时忽略"。

### 1.7 激活路径上的一个副作用：明暗一起切

`SettingsView.vue:174-178` — 选到带 `appearance` 的主题时，若当前明暗不符就 `setTheme(target.appearance)`。反过来说：**只调 B 不调 A 是这条链的正常行为**（例如直接改 `userTheme:setActive`，明暗不会自己动）。

### 1.8 胶囊窗怎么跟着换主题（另一条独立渲染进程）

胶囊没有路由、没有 pinia，靠独立入口自己把主题拉齐：

| 步 | 落点 | 关键点 |
| --- | --- | --- |
| 挂载前先跑主题 | `src/renderer/src/launcher-entry.ts:15-24`（`await useTheme().initTheme()` 后才 `createApp().mount()`） | 所以胶囊**不闪**；主窗与既有 `dark` 类生效时机一致，不比现状更差（`useTheme.ts:106-109` 注释） |
| 明暗落到 html | `useTheme.ts:50-67` | 与主窗共享同一份持久化值 |
| 用户主题注入 | `useTheme.ts:109` → `useUserTheme.initUserTheme()` → `applyThemeVars` | 胶囊这个渲染进程自己再校验、再注入一遍 |
| 胶囊专属键的联动 | `themeFile.ts:275-294`（`launcherThemeVars()`，12 键，只覆盖表面与文本） | 深色档必须**保留 `--launcher-bg` 的 alpha（0.74）**，否则主题一开毛玻璃就变成死色块（`:270-272`，实测值 `rgba(20,16,24,0.74)` 由 `e2e/user-theme.spec.mjs:182-187` 钉住） |
| 要么整套要么不发 | `themeFile.ts:276-278`（`core` 落不进 hex/rgb 数值形态时返回空表） | 宁可整套保持 `tokens.css` |
| 不联动 | 强调色系与几何/阴影/模糊（`themeFile.ts:263-268`，理由在 `docs/DECISIONS.md:189-200` Decision-012；强调色独立拍板见 `DECISIONS.md:141-149` Decision-010） | `pomo-*` / `shot-*` 模块自治（`DESIGN_TOKENS.md:146-149`） |
| 观感档同路 | `launcher/LauncherApp.vue:1721-1755`（`applyGlass/applyDensity` + `onDensityChanged/onCapsuleGlassChanged` 订阅 + `visibilitychange` 补读） | 改档必须**广播**，只回发起方会让另一侧继续按旧值渲染（`preferences.ts:106-107` 注释） |
| 窗口创建期底色 | 主窗 `src/main/modules/windows.ts:12-23`（`resolveWindowBackground()` 解析三态并对齐 `--surface-0`）；胶囊窗是透明窗 + 系统 vibrancy（`src/main/launcher/window.ts:69,77,81`） | 主窗防首帧跳色；胶囊的通透感来自底色 alpha + 系统材质，**不是** CSS `backdrop-filter`（`capsuleGlass.ts:25-28`） |

---

## 2. 怎么加一个主题

### 2.1 路线 A：不改代码（用户主题文件）

1. 设置页 →「主题文件」→「打开主题目录」（`SettingsView.vue:831-839` → `userTheme:openDir`），或「导入主题文件…」（`:822-830` → 选择框 → 校验通过才落盘）。
2. 写一个 JSON，最小合法形态只有 `name` + `appearance` + `core`（`themeFile.ts:203-219`）：

```json
{
  "name": "Plum Night",
  "appearance": "dark",
  "core": { "bg": "#141018", "fg": "#f4eefb", "accent": "#b48ef5" }
}
```

可选：`id`（缺省由 `name` slug 化）与四张语义子表 `surface` / `border` / `text` / `glass` 逐键覆盖（`themeFile.ts:221-236`，键名必须落在 `themeSchema.ts:31-67` 的白名单里）。
3. 列表**每次读盘**（`userThemes.ts:70-106` 走 `readdirSync`），所以改完文件重开设置页即可重新解析（`DESIGN_TOKENS.md:130-131`）；渲染端要主动重拉时走 `useUserTheme.refresh()`（`useUserTheme.ts:73-79`）。
4. 在设置页点选它即生效；报错看同一块区域的「N 份未通过校验：文件（原因）」（`SettingsView.vue:847-850`）。

### 2.2 路线 B：加一档**内置**主题（要动代码，四步缺一不可）

| 步 | 改哪里 | 为什么 |
| --- | --- | --- |
| 1 | `src/renderer/src/styles/tokens.css` 加/改值（`:root` 从 `:25`、`html.dark` 启动器块 `:326`、深色语义块 `:358`） | 运行时视觉仍由静态 CSS 承载（无 FOUC），schema 不注入样式（`DESIGN_TOKENS.md:123`、`themeSchema.ts:6-9`） |
| 2 | `src/shared/themeSchema.ts` 补结构 + `BUILTIN_THEMES`（`:81,119,157`） | 它是 tokens.css 语义层的**结构化提取**，改 CSS 必须同步它（`:7-8`） |
| 3 | 跑不变量测试 | `src/shared/__tests__/themeSchema.test.ts:12-17`（亮/暗键结构一致 + 值与 tokens.css 1:1）与 `src/shared/__tests__/themeFile.test.ts`（派生与注入键集合）——手改 CSS 漏改 schema 会红 |
| 4 | 若要给胶囊也联动，改 `themeFile.ts:280-293` 的键集合，并同步 `themeFile.test.ts` 里"12 个键逐一点名 + 每键在 tokens.css 真存在"的断言 | `DESIGN_TOKENS.md:161-163`：判据是**键集合**，不发没人读的变量 |

新增"另一套完整内置主题"目前**没有**独立开关：内置主题在界面上的表达就是「内置（tokens.css）」这一项（`useUserTheme.ts:68-71` 造选择器条目时只塞这一条内置项 + 用户主题）。要把内置档做成可选项，需要扩 `options` 的来源（这是设计缺口，不是 bug）。

### 2.3 路线 C：加一个新语义变量

先过 `DESIGN_TOKENS.md` 的纪律（`:103-109` 强制规则、`:19-20` 对比度基线），再回到本文 §2.2 的 1-3 步。只加 CSS 不加 schema → 主题不覆盖它；只加 schema 不加 CSS → `themeSchema.test` 红。

### 2.4 三条路线的代价

| 路线 | 谁受益 | 风险 | 撤销方式 |
| --- | --- | --- | --- |
| A | 单个用户 | 值白名单外的形态整份被拒（可能"我写了没出现"） | 选回内置 / 删文件 |
| B | 所有用户 | 改默认观感，需过 token 纪律 + 不变量测试 | 回退提交 |
| C | 组件作者 | 漂移风险最高（CSS/schema/派生/键集合测试四处） | 回退提交 |

---

## 3. 怎么验证主题生效

### 3.1 三段可跑契约（本文只登记"链路上有什么"，不代它们声明结果）

| 契约 | 用例位置 | 断言的东西 |
| --- | --- | --- |
| 主题文件被列出 → 点选后 CSS 变量生效 → 切回内置把覆盖摘除 | `e2e/user-theme.spec.mjs:93-126` | `--surface-0/--text-primary` 等于 `core` 值（`:109-110`）、文件里没写的**派生**键也落地（`:112-114`）、切回内置后值回退**且** `<style>` 节点为 `null`（`:117-125`） |
| 用户主题进胶囊窗（另一条渲染进程） | `e2e/user-theme.spec.mjs:135-192` | `.launcher` 底色 = `rgba(20,16,24,0.74)`（alpha 结构保住了，`:182-184`）、输入框文本色 = `rgba(244,238,251,0.96)`（`:185-187`）、切回内置与基线**逐字段相等**（`:189-191`） |
| 设置页真的跟明暗变（不是"换主题没换全"） | `e2e/settings-theme.spec.mjs:66-103`；`:105-122` 另查有没有残留写死色类 | 同一元素两主题下计算样式确实变了；深色下卡片不得是 `rgb(255,255,255)` |
| 玻璃档默认与改动前一致、切档生效、切回回到原值 | `e2e/capsule-glass.spec.mjs:121-160`、通透 < 半透明 `:162-187` | 只量 alpha，不吃颜色字符串写法（`:66-79` 说明 Chromium 把 `color-mix()` 算成 `color(srgb …)`） |

三条与主题相关的 e2e 共同的读法要点：**切换有 320ms 过渡**（`useTheme.ts:41-48`），切完立刻读 `getComputedStyle` 会拿到插值中的中间色——所以要 poll 到"不再变"（`e2e/user-theme.spec.mjs:154-175`，注释里记着实测抓到的 `rgba(224,223,224,0.957)`）。自己写验证脚本时同理。

### 3.2 那条 `removeProperty` 教训：代码里**是**这么写的，但不在用户主题那条路上

盘面事实（逐条读码核过）：

| 说法 | 实情 | 出处 |
| --- | --- | --- |
| 「CSS 变量用 `setProperty(name, '')` 是显式设成非法值，必须 `removeProperty`」 | **已按这条写着**，写在胶囊玻璃档：`null`（这一档不覆盖）→ `removeProperty`，否则 `setProperty` | `src/shared/capsuleGlass.ts:84-89` |
| 注释给出的理由 | "「不覆盖」和「设成空」差一个世界"；`setProperty(name,'')` 留下的是 guaranteed-invalid 的空自定义属性，消费端 `var(--leaf-capsule-blur)` **没写兜底值时**整条声明失效 | `capsuleGlass.ts:84-87`；有兜底的消费端如 `LauncherApp.vue:1958` `var(--leaf-capsule-bg, var(--launcher-bg))`、`:2160` `var(--leaf-row-pad-y, 8px)` |
| 仓库自己的**实测**结论（比上面那句更弱） | 单测注释写的是：实测 `setProperty(k, '')` 在 Chromium 里**等价于删除属性**，"写空串"今天不会坏事；钉住 `removeProperty` 是为了表达显式的"不覆盖"，不依赖那条容易读错的规范细节 | `src/shared/__tests__/capsuleGlass.test.ts:15-16`，桩与断言 `:29,54` |
| 用户主题那条路 | **不用** `removeProperty`：整段覆盖是一个 `<style>` 节点，摘除就是删节点（`applyThemeVars(null)` → `existing?.remove()`） | `src/renderer/src/composables/useUserTheme.ts:21-24`，e2e 侧断言 `user-theme.spec.mjs:123-125` |
| 一处不对称（读码可见，非 bug 判定） | 密度只有 `setProperty`，**没有** `removeProperty` 分支，因为两档都发满三个键、没有"不覆盖"语义（`DENSITY` 两档各 3 键） | `src/shared/density.ts:26-29,45-54` 对比 `capsuleGlass.ts:43-45`（`opaque` 三个键全 `null`） |

> **对上游转述的核对结论**：事故前后流传的说法是"带 fallback 的 `var()` 不会用 fallback，所以必须 `removeProperty`"。代码与测试里**都没有这句话**，盘面上的版本是"没写兜底值时整条声明失效"（`capsuleGlass.ts:85-87`）+ "实测等价于删除，但仍要写 `removeProperty`"（`capsuleGlass.test.ts:15-16`）。本文按盘面写，**这条差异待原作者/维护者复核后统一**。

### 3.3 症状 → 先看哪里

| 症状 | 第一落点 | 备注 |
| --- | --- | --- |
| 主题在设置页里没出现 | `userThemes.ts:83-103`（`.json` 后缀 / 体积 / id 重复）+ 设置页的 `rejected` 文案（`SettingsView.vue:847-850`） | `list` 每次读盘，不需要重启 |
| 浅色下生效、深色下没变 | 注入选择器是否含 `:root.dark,html.dark` | `useUserTheme.ts:31-35` |
| 胶囊不变色，主窗变 | ①`core` 是不是 hsl/颜色名（那就整套不发，`themeFile.ts:276-278`）②`launcherThemeVars` 键集合 ③胶囊入口有没有跑 `initTheme`（`launcher-entry.ts:19`） | 三条都会给出"主窗变、胶囊不变" |
| 改主题后另一扇窗没跟着变 | 广播有没有发（`preferences.ts:26-28,50-52`）、订阅是否在（`useTheme.ts:83-89` / `useUserTheme.ts:90-93`） | 两处订阅都 `try/catch`，preload 老会静默不订阅 |
| 首帧闪一下 | 主窗看 `resolveWindowBackground()`（`windows.ts:12-23`）；胶囊看是否 mount 前 await | 切换中间色另见 §3.1 的 320ms 过渡 |
| "切回内置还残留一点主题色" | 覆盖节点是否真被删（`useUserTheme.ts:21-24` + `user-theme.spec.mjs:123-125`）；再查是不是某个 `--leaf-*` 被写成了空串 | 后者是 §3.2 那格 |
| 打开主题目录/导入没反应 | `preferences.ts:56-69,71-76`（选择框取消 → `{ok:false,canceled:true}`，不是错误） | 取消与失败在返回形状上就不同 |

### 3.4 现成闸口（改主题相关代码前后应看的）

| 类型 | 文件 | 钉住什么 |
| --- | --- | --- |
| 单测 | `src/shared/__tests__/themeFile.test.ts` | fail-closed 逐字段、core 派生、注入白名单、`--launcher-*` 键集合（文件头 `:9-12`） |
| 单测 | `src/shared/__tests__/themeSchema.test.ts:12-17` | 亮/暗键结构一致 + 值与 `tokens.css` 1:1 |
| 单测 | `src/renderer/src/composables/__tests__/useUserTheme.test.ts:14-40` | 注入器复用同一节点、非法名/值被挡、`applyThemeVars(null)` 摘除 |
| 单测 | `src/shared/__tests__/capsuleGlass.test.ts:15-16,54` | 默认档"三个变量全部 `removeProperty`，一个都不 set" |
| 主进程侧 | `userThemes.ts` 的 `listThemesIn` / `installThemeFileInto`（`:70,120`，dir 参数化的纯函数层，不依赖 electron 便于喂临时目录，见 `:11`） | 读盘与落盘规则 |
| e2e | 本文 §3.1 表左列四个文件 | 跨进程链路 |

---

## 4. 边界（**已拍板的不做**，别当 bug 报）

| 不做 | 出处 |
| --- | --- |
| 主题不改强调色（`--brand-500` 与 `--launcher-accent*` 都不随 `core.accent` 覆写） | `themeFile.ts:296-303`、`DECISIONS.md:141-149`（Decision-010 的 Raycast 红拍板）、`DESIGN_TOKENS.md:146-149` |
| 主题不改几何/阴影/模糊 | `themeFile.ts:265-268`、`DECISIONS.md:196-198` |
| `pomo-*` / `shot-*` 不联动（模块自治） | `themeFile.ts:301-303`、`DESIGN_TOKENS.md:146-147`；`shot-*` 是**恒定深色**面板（`DESIGN_TOKENS.md:88`） |
| 只吃 JSON，不支持 TOML | `DESIGN_TOKENS.md:149` |
| 不做多语言（i18n 是 Decision-011 里唯一维持"不做"的项，UI 继续仅中文） | `POSITIONING.md:34`、`DECISIONS.md:165`（另见 `:69`） |
| 玻璃档只覆盖胶囊框那一层，内页仍是实色 → 看到的是"透的框 + 不透的内容" | `capsuleGlass.ts:15-24`（整段是刻意的覆盖范围声明，真做整窗玻璃需另拍） |

---

## 5. 文案语调（VOICE）

### 5.0 先说依据：**本节缺少事故前成文依据**

盘面检索结果：`docs/POSITIONING.md`、`docs/DECISIONS.md`、`docs/IA_V2.md`、`docs/SHORTCUTS.md` 四份里**没有**成文的文案语调规范（全仓 `docs/` + 根目录 md 检索「语调 / 文案规范 / 措辞 / 语气 / 全角 / 标点」只命中 `docs/README.md:24` 这一行索引自身）。也**没有**集中的文案表：`package.json` 的 63 个依赖里没有 `vue-i18n`/i18n 框架（`DECISIONS.md:69` 那句"vue-i18n 框架要接好"目前**未落地**），`src/` 下无 locale/strings/copy 文件，文案散写在组件与 composable 的字面量里。

能算"成文"的只有这三条边角，它们都是**术语/范围**约束，不是语调：

| 成文依据 | 内容 |
| --- | --- |
| `docs/IA_V2.md:69-72` | 「启动器」= launcher；**禁用**「快速搜索 / fastSearch」作为产品词，旧路径留 redirect |
| `docs/POSITIONING.md:34` | 多语言不做，UI 仅中文（2026-09-20 复核，唯一维持项） |
| `docs/UI_ALIGNMENT_CHECKLIST.md:89,156` | 底栏主按钮基准是"当前选中项主动作，**动宾结构**"；对标 Raycast 时只对齐信息结构（分区命名、动宾按钮文案模式），中文文案保持 |

**所以：以下 §5.1 是从现存界面文案归纳的倾向，不是规范。** 每条都给了样本行号，也给了**反例**——凡是想找"一条没有任何例外"的语调规则的地方，盘面目前给不出。谁要把其中某条升级成规范，请写进 `DECISIONS.md` 再回到本节引用，不要靠本文的措辞当权威。

### 5.1 归纳（样本 + 反例）

| # | 倾向（归纳，非规范） | 正例（`文件:行号`） | 反例 / 边界 |
| --- | --- | --- | --- |
| 1 | 空态 = "没有 X" + 下一步做什么，主语是内容不是用户 | `launcher/pages/ClipboardPage.vue:161`「还没有历史——复制任意内容后这里就会出现」；`launcher/pages/NotesPage.vue:76`「暂无笔记，点击上方新建」；`launcher/pages/BrowserTabsPage.vue:7-8`「没有打开的浏览器标签」+「在 Chrome 或 Safari 中打开一些标签页后重试」 | 也存在纯陈述不带动作的：`launcher/pages/CalendarPage.vue:50`「当天暂无提醒」、`views/screenRecorder/components/MarkersPanel.vue:98`「暂无标记」 |
| 2 | 权限/失败类文案说**事实 + 路径 + 键名**，不评价用户 | `launcher/pages/SchedulePage.vue:5`「日历访问被拒绝：系统设置 → 隐私与安全性 → 日历，允许本应用后重试」、`:10`「日历尚未授权：回车或点击下方按钮发起授权」；`views/launcher/index.vue:984`「打开授权设置，把 Leaf 加入辅助功能列表后重试」 | — |
| 3 | 「请重试」式甩锅话**不成立为禁令**：`后重试` 是主流写法，光秃的「请重试」也有 | 上面 `:5` 与 `BrowserTabsPage.vue:8` 都是 `…后重试` | **反例**：`views/screenRecorder/pages/RecordPage.vue:516,524`「无法创建合成流，请重试」「合成流无效，请重试」；`launcher/pages/McpCallPage.vue:24` 直接有一颗「重试」按钮 |
| 4 | 中文全角标点、拉丁词与中文之间留半角空格、成对引用用 `「」`、省略号用 `…` | `ClipboardPage.vue:258`「图片暂无识别文本（OCR 未完成或无文字）」；`useSourceSelection.ts:213`「摄像头无法启动，可能被其他应用占用。请关闭其他使用摄像头的应用后重试」；`launcher/pages/SnippetsPage.vue:7`「没有匹配「${query}」的片段」；`BrowserTabsPage.vue:3`「正在读取浏览器标签…」、`SchedulePage.vue:7`「加载日程中…」 | 例外不少：`launcher/pages/AIChatPage.vue:47`「暂无预设，在设置中添加模型预设」（无空格需求）、个别页仍写 `...`（未逐页统计，**未证实**是否系统性） |
| 5 | 按钮/动作条目用**动词开头**（与 `UI_ALIGNMENT_CHECKLIST.md:89` 的动宾基准同向） | `views/SettingsView.vue:822`「导入主题文件…」、`:839`「打开主题目录」；`SchedulePage.vue:18`「发起日历授权」；插件侧同样：`plugins/com.leaf.quickfolders/index.html:57-59`「打开 / 复制路径 / 移除」 | 底栏主按钮历史上是固定「↵ 执行」（`UI_ALIGNMENT_CHECKLIST.md:90-91` 把它记为待改项），"动词随选中项变"这条**当时未落地** |
| 6 | 错误提示分两层：短标题（多为「X失败」）+ 原因进 `description` | `composables/useToast.ts:6-12`（用法示例就是 `toast.error('导出失败', { description: '磁盘已满' })`）；`views/launcher/index.vue:576,621,702,742`（导入/安装/更新/注册四类失败） | 也有只给标题不给原因的：`views/launcher/index.vue:562`「读取插件列表失败」、`:832`「偏好保存失败」 |
| 7 | 状态陈述用完成态短语，不用感叹号、不用"哦/啦" | `views/launcher/index.vue:830`「偏好已保存」；`example-plugin/index.html:183`「作者名已改为 …」；`launcher/pages/SettingsPage.vue:60,67`「已开启 / 已关闭 / 当前平台不支持」；胶囊 `hints` 用「选择 / 切换 / 调节 / 返回」两字动词（`SettingsPage.vue:32-36`，页脚同义写作「↵ 切换 · ←→ 调节 · esc 返回」`:16`） | `views/screenRecorder/components/ClipEditor.vue:378`「还没有片段，先添加一个吧。」带句末语气词，与"极简专业"调性（`POSITIONING.md:11-17`）不完全一致 |

### 5.2 关于"语调另有出处吗"

没有第二处真理源，但有三处**事实上的口径载体**，改文案前值得先看：

1. `composables/useToast.ts:6-12` — toast 的形状约定（`title` / `description` / `duration` / `action`），是全仓错误提示最集中的地方（`views/launcher/index.vue` 一处就 15+ 条）。
2. `components/ui/UEmpty.vue:11-14` — 空态有共享组件与**缺省标题「空空如也」**，但它只是兜底，各页都自己传 `title`（`:3-5` 的约定是插槽：`#icon` + `#action`）。
3. 插件清单里的动作 label — 插件作者写的文案会被宿主原样渲染（清洗只截断不改写，`plugin-protocol.ts:293`），所以"内置插件的文案"实际住在 `plugins/*/plugin.json` 与 `plugins/*/index.html` 里，而不是渲染层组件里。

### 5.3 本节**未证实**清单（不编）

| 未证实项 | 说明 |
| --- | --- |
| 事故前 `THEME_AND_VOICE.md` 的语调章节写过什么 | 无副本可查（`docs/README.md:24` 只留一行索引标题）。**本节整节的"倾向"都可能与原件措辞不同** |
| 是否有过成文的空态/错误句式规范 | 盘面无痕；不能据此断定"从来没有"，只能说"现在没有" |
| 中英混排/全角标点是"规则"还是"多数人的写法" | 只做了抽样（本文 §5.1 第 4 行的样本），未做全仓统计 |
| 「不使用『请重试』」这类说法的任何版本 | 已有直接反例（`RecordPage.vue:516,524`），可判定**未成立过** |
| 术语表（除「启动器」外还有哪些产品词被定过名） | `IA_V2.md:69-72` 只有那一条；未见更全的表 |
| `DECISIONS.md` 里 Decision-012 出现两次（`:185` 与 `:213`，内容相同） | 疑为 2026-09-22 事故后的回填重复。本文引用 `:185` 那一份，**未判定**该留哪一份 |

---

## 6. 重生成核对账

| 本文结论 | 依据形式 | 状态 |
| --- | --- | --- |
| §0-§2 全部机制与行号 | 逐文件读码（`useTheme` / `useUserTheme` / `themeFile` / `themeSchema` / `userThemes` / `preferences` / `ipc-contract` / `preload` / `launcher-entry` / `LauncherApp` / `capsuleGlass` / `density` / `windows` / `launcher/window` / `SettingsView` / 胶囊 `SettingsPage`） | 已证实（读码） |
| §3.1 四段契约"断言了什么" | 读 e2e 脚本 | 已证实（读码）；**本文未跑过任何一轮 e2e**（重生成时按要求不得构建/跑测） |
| §3.2 `removeProperty` 教训的落点 | `capsuleGlass.ts:84-89` + `capsuleGlass.test.ts:15-16` + `useUserTheme.ts:21-24` | 已证实；与常见转述的**措辞差**已就地标出 |
| §3.3 症状表的"第一落点" | 读码指向 | 已证实（指向可查）；每条症状是否真会在实机上出现 = 未逐一复现 |
| §5.1 七条"倾向" | 界面字面量抽样 | **归纳，不是规范**；每条附反例或边界 |
| §5.0「缺成文依据」 | 全仓 docs + 依赖 + 文件检索 | 已证实（检索为负结果） |
| §5.3 六项 | — | 未证实，已明写 |

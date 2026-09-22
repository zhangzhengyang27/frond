# Leaf · Design Tokens

> **唯一的视觉事实源**。所有组件、页面、模块都从这里取值，不允许在组件中写死主题颜色。
> 实现：`src/renderer/src/styles/tokens.css`；消费：`tailwind.config.js`（var 映射）+ 组件内 `var(--*)`。

---

## 0. v4 设计原则（2026-08 重设计 · macOS Native）

| 原则         | 描述                                                                 |
| ------------ | -------------------------------------------------------------------- |
| **原生质感** | 对齐 Apple HIG：SF 系统字体栈、hairline 描边、大而柔的阴影、blur+saturate 毛玻璃材质 |
| **科技蓝**   | Brand = macOS System Blue（浅 `#007AFF` / 深 `#0A84FF`），全站单一品牌色相 |
| **克制色**   | 主色 1 个，语义色 4 个（success/warning/danger/info = HIG System Colors）；旧 Sunset Orange CTA 退役，`--accent-*` 收敛为 brand 别名 |
| **冷调中性** | 中性灰带轻微蓝灰偏移（macOS 窗口材质感），亮暗两套都是第一主题        |
| **三层架构** | primitive（brand/gray/语义原色）→ semantic（surface/line/fg/glass）→ module namespace（pomo-\* / shot-\* / legacy） |
| **零破坏**   | v1/v2/v3 变量名全部保留，值层整体换血                                 |

**对比度基线（WCAG）**：正文/次级文本 ≥ 4.5:1（AA）；muted 仅限提示性内容 ≥ 3:1；
按钮文字对品牌底按 UI 组件 3:1 标准（与 HIG 同款取舍）。

---

## 1. Brand 色（Tech Blue）

浅色以 `#007AFF`（HIG systemBlue light）为锚，深色以 `#0A84FF`（HIG dark）为锚。

| Token         | 亮色       | 暗色       | 用途                       |
| ------------- | ---------- | ---------- | -------------------------- |
| `--brand-50`  | `#F0F6FF`  | `#14202E`  | 高亮背景 / tint 底色       |
| `--brand-100` | `#DCEBFF`  | `#182739`  | 次级背景                   |
| `--brand-200` | `#B4D6FF`  | `#1E3250`  | 边框（弱）                 |
| `--brand-300` | `#85BDFA`  | `#6FB2FF`  | active / 渐变终点          |
| `--brand-400` | `#4CA3F7`  | `#459DFF`  | hover 主色                 |
| `--brand-500` | `#007AFF`  | `#0A84FF`  | **Brand Default** 主按钮/强调 |
| `--brand-600` | `#0064D2`  | `#3D9BFF`  | 主按钮 hover（深色端向提亮，HIG 行为） |
| `--brand-700` | `#0053AE`  | `#63AEFF`  | active                     |
| `--brand-900` | `#002E5F`  | `#082238`  | 深色文字 / Logo            |
| `--brand-glow`| `rgba(0,122,255,.3)` | `rgba(10,132,255,.4)` | 焦点/辉光氛围 |
| `--text-brand`| `#0064D2`（白底 5.6:1 AA）| `#6FB2FF`（深底 8:1 AA） | 品牌文本/链接 |

## 2. 中性色（冷调蓝灰）

| Token       | 亮色       | 暗色       | | Token       | 亮色       | 暗色       |
| ----------- | ---------- | ---------- |-| ----------- | ---------- | ---------- |
| `--gray-50` | `#F7F8FA`  | `#1E2127`  | | `--gray-500`| `#7D8590`  | `#6A7383`  |
| `--gray-100`| `#EFF1F4`  | `#242830`  | | `--gray-600`| `#626B78`  | `#909AA9`  |
| `--gray-200`| `#E3E6EB`  | `#2D323C`  | | `--gray-700`| `#4A525E`  | `#B2BAC6`  |
| `--gray-300`| `#D2D6DD`  | `#3B414E`  | | `--gray-800`| `#343A44`  | `#D5DAE1`  |
| `--gray-400`| `#A9B0BA`  | `#505867`  | | `--gray-900`| `#21262E`  | `#EAEFF3`  |
| | | | | `--gray-950`| `#14181E`  | `#111419`  |

> 暗色端 `--gray-*` 反转：50 最深、900 最浅（沿用 v1 约定，组件无需感知）。

## 3. 语义层（Surface / Line / FG / Glass）

| 语义        | 亮色 | 暗色 | 用途 |
| ----------- | ---- | ---- | ---- |
| `--surface-0` | `#F5F5F7` | `#191A1E` | 应用画布（= 主进程窗口启动底色） |
| `--surface-1` | `#FFFFFF` | `#222329` | 面板 / 卡片 |
| `--surface-2` | `#FFFFFF` | `#292B32` | 浮起卡片 |
| `--surface-3` | `#FFFFFF` | `#30333B` | 模态 / Popover |
| `--surface-hover/active` | 黑 4.5% / 8.5% | 白 6% / 10% | 悬停 / 按压态 |
| `--surface-inverse` | `#1D1D1F` | `#F5F5F7` | 反色面（深色按钮 / HUD 徽标） |
| `--border-subtle/default/strong` | 黑 6% / 10% / 16% | 白 7% / 11% / 18% | hairline 描边（划界主力） |
| `--text-primary` | `#1D1D1F`（15.8:1）| `#F5F5F7`（15.9:1） | 标题/正文 |
| `--text-secondary` | `#515154`（7.9:1）| `#A6ABB5`（7.5:1） | 次级 |
| `--text-tertiary` | `#6E6E73`（5.1:1）| `#8A909C` | 辅助 |
| `--text-muted` | `#86868B`（3.6:1）| `#666C78` | 仅提示性内容 |
| `--text-danger/success` | `#D70015` / `#248A3D` | `#FF6961` / `#30D158` | 语义文本（Apple accessible 变体） |
| `--color-success/warning/danger/info` | HIG light（`#34C759/#FF9500/#FF3B30/#007AFF`） | HIG dark（`#30D158/#FF9F0A/#FF453A/#0A84FF`） | 徽标/填充/图表 |
| `--glass-bg / -bg-strong` | 白 68% / 82% | `rgba(26,27,31,.72)` / `.85` | 毛玻璃材质（侧栏/顶栏/浮层） |
| `--glass-filter` | `blur(20px) saturate(1.8)` | `blur(24px) saturate(1.8)` | vibrancy 观感；用 `.glass-material` 类消费 |
| `--overlay-bg` | 黑 28% | 黑 52% | 模态遮罩 |

## 4. 形状与动效

- **字体**：`-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', …`（SF 优先，原生根基）；mono `'SF Mono', ui-monospace, …`
- **圆角**：`--radius-sm 5px`（按钮/输入）、`md 9px`（卡片）、`lg 14px`（模态/Popover）、`xl 20px`（Hero）
- **阴影**：macOS 式大模糊低透明度；`xs/sm/md/lg` + `glow`（品牌辉光）+ `ring-focus`（3px 品牌焦点环）/ `ring-danger`
- **动效**：`instant 40ms / fast 80ms / normal 160ms / slow 280ms / spring 360ms cubic-bezier(0.16,1,0.3,1)`

## 5. 模块命名空间

| 命名空间 | 范围 | 约定 |
| -------- | ---- | ---- |
| `--pomo-*` | 番茄钟 | Material-3 风格局部体系；work 模式已并入品牌蓝家族，short/long 保持青/紫区分 |
| `--shot-*` | 截图覆盖层 | **恒定深色**（悬浮在任意截图内容之上，同 macOS 截图 UI），不随主题切换 |
| `--bg-* / --primary-* / --gradient-primary` | 录屏（legacy） | 已按主题定义；`--gradient-primary` = 品牌蓝主操作渐变，承载 `text-white` 主按钮 |

**保留字面量的唯一合法场景**：画布绘制（`ctx.fillStyle`）、导出到图片的内容（macOS 红绿灯、
CodeScreenshot 渐变背景、标注调色板、语法高亮主题）、纯数据色（项目色、标记色）、
恒定深色面板上的白系透明度（`rgba(255,255,255,.1)` hover 等）。

## 6. 主题机制（三态 · 跟随系统为默认）

- `light / dark / auto`，持久化在主进程 `PreferencesDataStore`（默认 **auto** = 跟随系统）
- 生效方式：`html.dark` 类 + `data-theme`；Tailwind `darkMode: 'class'`
- 切换动画：`useTheme` 在切换瞬间给 `html` 加 `.theme-anim`（240ms 全局色彩过渡，320ms 后移除；尊重 `prefers-reduced-motion`），初始化时不动画
- 多窗口一致：主进程广播 `onThemeChanged`；窗口启动底色 `resolveWindowBackground()` 解析三态并与 `--surface-0` 对齐（防首帧跳色/黑闪）
- 语义色全部走 var → **禁止新增 `dark:` 前缀的硬编码色对**，配对亮暗值写在 tokens.css

## 7. 强制规则

1. 新代码颜色一律用 token（Tailwind 语义类 `surface-*/line-*/fg-*/brand-*` 或 `var(--*)`）
2. 禁止在组件中写死主题颜色（stylelint `color-no-hex` 会警告；内容色按第 5 节豁免）
3. 文本对比度必须达标（见基线）；`--text-muted` 不用于正文
4. 主按钮 = `bg-brand-500` + `text-white`，hover = `brand-600`；禁止再引入第二品牌色相

## 8. 历史

- v1：Indigo `#4F46E5` + Sunset Orange，zinc 灰
- v2：Raycast/Linear 风（深色优先、描边划界、玻璃拟态）
- v2.5/v3：浅色画布压暗 + 多层柔影（对「线条感」的修补）
- **v4（当前）**：macOS Native 全面重设计 —— 科技蓝、冷调中性、SF 字体栈、hairline + 柔影双轨、blur+saturate 材质、跟随系统为默认主题


## 主题 Schema（#12，2026-09-19）

对标 Vicinae 主题文件（`extra/themes/*.toml`）的 core/accent/语义子表结构，Phase 1 已落地 `src/shared/themeSchema.ts`：

- **ThemeDefinition**：`core`（bg/fg/accent 三元组）+ 四张语义子表（surface / border / text / glass），值 1:1 提取自 tokens.css 语义层（由 `themeSchema.test.ts` 不变量测试守护同步，手改 CSS 漏改 schema 会红）
- **运行时视觉仍由 tokens.css 承载**（静态 CSS 无 FOUC）；schema 是数据层，不注入样式
- **模块命名空间（pomo-\* / shot-\* / launcher-\*）不在 schema**：模块私有令牌；launcher 强调色是独立拍板（Raycast 红，Decision-010），不随 core.accent 派生

### 用户主题文件（Phase 2，已落地 2026-09-19）

演进路径 1-3 已实现，第 4 步按拍板维持模块自治。

- **放哪**：`userData/themes/*.json`（设置页 →「主题文件」→「打开主题目录」可直接跳过去），
  一个文件一套主题，可放多份；改完文件重开设置页即重新解析
- **格式**：`{ name, appearance: 'light'|'dark', core: { bg, fg, accent } }`，
  可选 `id` 与四张语义子表（`surface` / `border` / `text` / `glass`）逐键覆盖
- **派生**：未显式给出的语义键由 core 三元组算出（文本层级 = fg 向 bg 收敛三档；
  描边/悬浮 = fg 叠加透明度；`text-brand` 按 WCAG 对比度把 accent 往 fg 方向拉）；
  `text-danger` / `text-success` 这类不可派生项继承同 appearance 的内置主题。
  `core` 写成非 hex/rgb 形态（hsl、颜色名）时**不做派生**，只吃显式覆盖 + 内置基座
- **生效方式**：注入一段 `:root,:root.dark,html.dark{…}` 覆盖样式（特异性必须与
  tokens.css 的深色块同档，只写 `:root` 会在深色下被压过而静默失效）；
  选「内置」即摘除该节点，回到 tokens.css 现状。默认不注入，视觉与升级前完全一致
- **FOUC**：胶囊窗在 mount 前 await（不闪）；主窗与既有 dark 类生效时机一致，
  不比现状更差
- **fail-closed**：任何字段非法整份拒绝并在设置页指名报出（`core.bg: 不是允许的 CSS
  颜色形态`）；颜色值走白名单正则，`;` `}` `<` `url(` 一律进不来（渲染端在 IPC 边界
  再校验一次）。文件名由 id 派生，导入来源路径的名字不参与拼路径
- **不做什么**：`pomo-*` / `shot-*` 不随主题联动（模块自治）；launcher 只联动**表面与文本**
  那一组（12 个键，见下条与 Decision-012），强调色的两处消费者
  （`--brand-500` 与 `--launcher-accent*`）都保持 Decision-010 的拍板，不由 `core.accent` 覆写；
  TOML 未支持（只吃 JSON，避免为配置文件引一个解析依赖）

### 胶囊联动（Phase 2.1，已落地 2026-09-20 · Decision-012）

`src/shared/themeFile.ts` 的 `launcherThemeVars()` 由 `core.bg` / `core.fg` 派生 12 个
`--launcher-*` 键（底色 / 悬浮层 / 弹层 / 描边 / hairline / 四级文本 / 选中底 / hover / input 底），
在 `themeToCssVars()` 里与语义子表合并后一并注入——注入器与胶囊入口都不用改。

- **深浅看亮度不看 `appearance` 字符串**：与 `deriveFromCore` 同口径；深色档必须保留底色 alpha
  （0.74），否则主题一开就把 Raycast 式毛玻璃变成死色块
- **只发一整套或干脆不发**：`core` 是 hsl / 颜色名等无法数值化的形态时返回空表，
  胶囊整套继续走 tokens.css——宁可不动，也不要半个面板换了色
- **不联动**：强调色系与几何/阴影/模糊（理由逐条写在 Decision-012）
- **判据是键集合**：`themeFile.test.ts` 把 12 个键逐一点名，并断言每个键在 tokens.css 里真存在
  （不发没人读的变量）以及没有任何 accent/几何键混进来

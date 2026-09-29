# 重塑现状审计报告（2026-09-29）

> 阶段 1 交付物。基线：main @ cb5abf7。全程只读审计（git 工作区零改动），三路独立深审 + TW4 spike + 挂账口径合并。
> 配套文档：《REDESIGN_ROADMAP_2026-09-29》（阶段 2 路线图与决策记录）。

## 0. 审计口径

- 规模：71,495 行 TS + 32,791 行 Vue；428 条 typed IPC 通道；133 个测试文件（约 1,076 用例）；31 个 e2e spec（CI 仅跑 3 条冒烟）。
- 方法：产品视角（45 项，P-产品-NN）/ 代码视角（11 项，C-代码-NN）/ 设计视角（12 项，D-设计-NN），另有 Tailwind 4 兼容 spike 与挂账合并核查。
- 编号规则：本文档沿用三视角编号；行动项并入 `docs/BUGS.md`（B 编号唯一挂账源）。

## 1. 总评

**这不是一座要推倒的 demo，而是一座纪律异常好、但皮相和承诺拖了后腿的建筑。**

- 产品：胶囊交互链路、插件信任链（sha256→权限差分→回车默认拒绝）、parity 机制层已超 demo 水准。真正的问题是三处「承诺违约」——onboarding 教错第一手势、同步/备份后端在而用户摸不到、设置双中心劈开配置面。
- 代码：类型收紧弹量小（any≈0），真债在 6 个零测试千行巨型文件、6 个真实循环依赖、以及「31 个 e2e 里零覆盖的界面恰好是重塑动线上的界面」。
- 设计：token v4 数据层、ARIA 骨架、四态意识好于皮相；但几何/动效 token 名存实亡（圆角 ≥15 种、过渡时长 20 种、space token 零消费），且存在双品牌色相（全局蓝 + 胶囊 Raycast 红）。

## 2. 四项决策（D1–D4）的量化验证

| 决策 | 验证结果 | 结论 |
|---|---|---|
| D1 Tailwind 4 | spike 全绿：electron-vite 4 peer 含 Vite 7；`@theme` var() 别名链成功（tokens.css 可继续当唯一事实源）；暗色 variant/玻璃/任意值类/透明度修饰全过；与旧转储共存无冲突。转储定界：544 个转储类与模板实际使用交集 SettingsView 96%、Editor 100%——快照基本可再生 | 可执行 |
| D2 一步到位 | `noUncheckedIndexedAccess` 全仓去重 ≈349（产品代码 ~110，六成在测试）；`exactOptionalPropertyTypes` 87；388 warning 中 285 条 prettier 可自动清零；`as any` 全仓 1 处 | 弹量小一个量级 |
| D3 品牌重塑 | 硬冲突：tokens v4 自述「替代 v2 Raycast/Linear 方向」，胶囊 accent 又是 Raycast 红（Decision-010）——双品牌色相违反自家 §7 规则 4 | 须先拍板单 accent |
| D4 地基先行 | 结构债定界：样式管线（L）+ 类型地基（S-M）+ 挂账合并（S）+ 巨型文件拆解（L 贯穿） | 路线图成立 |

## 3. P0 问题（6 项）

| 编号 | 描述 | 视角 | 建议方向 | 工作量 |
|---|---|---|---|---|
| D-设计-01 | Tailwind 管线丢失：main.css 为 4,576 行编译转储，转储后新增类静默失效（0×0 控件事故已发生过） | 设计 | 恢复 TW4 生成管线，废 gap 补丁文件 | L |
| D-设计-01b | 双品牌色相：全局 systemBlue vs 胶囊 Raycast 红 #ff6363；类名残留 FrondRaycastHome/RaycastSettings | 设计 | 单 accent 拍板，launcher-accent 收敛为 brand 派生 | M |
| P-产品-08/36 | 同步/备份用户不可达：dataSync（行级合并 35 单测）与 cloudBackup（WebDAV 加密）双后端在、渲染层零调用；POSITIONING 宣称「已落地」 | 产品 | 迁移中心补同步分区；先修 B38 两件防 bug 放大 | M |
| P-产品-13/14 | 生态发现面为零：市场开箱仅 21 内置件，第三方需手填 https JSON URL | 产品 | 官方索引仓库 + 市场默认源 + 提交渠道；邀 3–5 种子作者 | M |
| P-产品-25 | Onboarding 教错快捷键：第 5 步把 ⌘⇧P（番茄钟启停）教成命令面板；第一入口 Alt+Space 全程未出现 | 产品 | 重写第 5 步：Alt+Space 第一课，⌘K 第二，删 ⌘⇧P | S |

## 4. P1 清单（18 项，按主题）

| 主题 | 编号与要点 | 工作量 |
|---|---|---|
| 生态与 parity | P-产品-03 SDK 兼容层 6 处 notSupported 需契约页+测试钉住；16 计算器 NL/实时汇率下沉；17 片段导入器（Espanso/TextExpander）；15 getSelectedText（可排后） | M×3 / L |
| 承诺与旅程 | 26/27 引导文案指向不存在的库存与收藏区；30 Hub 假搜索+4 处 setTimeout 竞态；24/39 B38 两件（墓碑不过网、push 半失败）——同步 UI 前置；09 双日历并存；41/42 时间三页/Notes 三入口 IA 归位 | S~M |
| 真机验证轮 | 04 录屏剪辑端到端；11 菜单栏搜索；20 21 内置插件批量目检——合并为一场真机轮 | M |
| 工程 | C-代码-05 六个千行文件零直接测试（SettingsView 1799 / preload 1116 / runtime 902 等）；06 e2e 零覆盖界面恰在重塑动线；09 巨型文件棘轮（14 个 >800 行）；03 IPC 错误信封（渲染端拿裸 rejection）；评审 P1-3 渲染件 UI 断言 | L 贯穿 |
| 设计 | D-设计-02 骨架屏缺失（USkeleton 零消费）；03 几何/动效 token 收编+stylelint 白名单；04 封闭字阶；07 玻璃三参数阶梯；05 reduced-motion CSS 全缺；06 模态滚动锁定/焦点陷阱 | M~L |

## 5. 关键量化数据

**D2 弹量**：NUIA node 270 / web(vue-tsc) 218，去重并集 ≈349（node 侧 160 条在 __tests__）；EOPT 87；warn→error 388 条/150 文件（prettier 285、no-unused-vars 71、explicit-return 27）；any 族：`: any` 0 / `as any` 1 / `<any>` 6 / `@ts-ignore` 2；`: unknown` 276 处（unknown-first 已是风格）。

**CSS 定界**：转储类名并集 544（main.css 507 + gap 66）；模板命中 SettingsView 96% / Editor 100% / LauncherApp 0%（自持 scoped）；硬编码 hex 474（快照内 332 + 组件层 132，重灾区 FloatingNote 21 / CodeScreenshot 16 / FocusShield 11）；`var(--` 1,803 处；tokens.css 392 变量。

**设计失守面**：圆角 ≥15 种 vs token 5 档；过渡时长 20 种（0.1s~3.2s，s/ms 混用）vs token 5 档；字号 9–22px 无 token；`var(--space-*)` 消费 0 处、radius 2 处、shadow 1 处、motion 4 处；阴影三轨并行；kbd 键帽 ≥3 套方言。

**四态覆盖**：错误态约 6 成、加载态约 5 成（多为纯文本转圈）、骨架屏 0（USkeleton 建了没人用）；洼地 = FormPage/SettingsPage(胶囊)/FocusPage/SystemInfoPage。

**可访问性**：focus-visible 仅 9 文件（胶囊全族无环）；滚动锁定全仓 0 实现；焦点陷阱无；reduced-motion 仅 JS 1 处（全部 CSS 动画不响应）；胶囊 combobox ARIA 是标杆（role/expanded/activedescendant 全套）。

**测试缺口**：133 测试文件 = main 90 / shared 23 / renderer 20 / preload 0；.vue 伴生测试 3/100（逻辑已抽 composable 并测，属可接受形态）；31 e2e 中零覆盖界面：notes 视图、MigrationCenterView、AboutView、mini-timer、floating-note、screenRecorder 完整 UI、reminders。

**架构耦合**：分层干净（renderer→main 直连 import = 0；跨层 52 处几乎全是 import type，被 sharedLayering 棘轮钉住）；madge 53 环 = 33 良性（migrations 注册表）+ ~14 type-only + **6 个真实环**；>800 行文件 14 个（最大 LauncherApp.vue 2152）。

**安全面（健康，勿破坏）**：8 处窗口创建零危险配置（全 sandbox:true 或安全默认）；navigationGuard 全局兜底 + 主窗/插件视图双层更严 handler；B40 凭证脱敏与 MCP 差分确认在码；进程级 unhandledRejection/uncaughtException 兜底在 LogService.ts:159。

## 6. 挂账合并结果

- **P 编号体系（外部评审 13 条）**：11 条已修复或被 09-24 校订证伪（已逐条到代码核实）。开着的 2 条：P1-3 渲染件 UI 断言 → **B44**；P1-7 恢复工具链死链 → **B45**（待核）。此后 P 体系退役。
- **B 编号体系**：开账 7 件——B25（已决策修法①，见路线图 D6）、B29（维持暂不做）、B38 残留 2、B41 残留 2、B43 附带 P2 + B43 本体待用户体感确认。

## 7. 未竟事项

1. **真机目检**：dev 起成功、screencapture 抓到全屏基线（/tmp/frond-main-1/2.png 等 6 份，Retina），但本会话图像工具链无法回显像素。B39 五大风险部位清单见设计审计 §4（任务抽屉时间线、统计面板双列折叠、Markdown 双底色裂缝、胶囊六内联页行高节奏、Onboarding 任意值类）。
2. strictTypeChecked 全量弹量未测（需改 eslint 配置）——批 2 首个动作。
3. 端口 5173 有先于审计的监听进程，非本链启动，未触碰。

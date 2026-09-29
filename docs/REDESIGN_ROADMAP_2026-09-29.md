# 重塑路线图（2026-09-29）

> 阶段 2 交付物，配套《REDESIGN_AUDIT_2026-09-29》。总原则：地基先行，双轨交替，每批独立验收、保 CI 恒绿、可随时中断。总量约 4–5 周（单人节奏）。

## 决策记录

| # | 决策 | 内容 |
|---|---|---|
| D1 | 样式地基 | 直接上 Tailwind 4（CSS-first），`@theme` var() 别名桥接 tokens.css——tokens.css 保持唯一视觉事实源；4,576 行转储分批迁移退役 |
| D2 | 工程收紧 | 一步到位：strictTypeChecked + noUncheckedIndexedAccess + exactOptionalPropertyTypes 开满，存量一次性清账进 CI |
| D3 | 视觉方向 | 品牌重塑：对标 Raycast/Linear 暗色玻璃质感；token v4 三层架构保留，数值重定（v5） |
| D4 | 推进顺序 | 地基先行（TW4 管线 + 类型地基 + 挂账合并）→ UI/代码双轨交替 |
| D5 | **单 accent** | **蓝（systemBlue 全站唯一 accent，胶囊 Raycast 红 #ff6363 退役）**——与 macOS Native + 暗色玻璃基座协调，不与 Raycast 撞脸（2026-09-29 用户批准执行时按推荐项生效，可逆） |
| D6 | **B25 修法** | **修法①**：域名解析全落 198.18/15 时给独立可诊断 reason（「检测到 fake-ip 代理环境」），不改放行面、不动信任模型；落地批次：批 4 |

## 批次

| 批 | 名称 | 目标 | 预估 | 前置 |
|---|---|---|---|---|
| 0 | 存档与备份 | R1 备份 + 文档落库 + 挂账单源 | S | 无 |
| 1 | 样式管线（D1） | TW4 生成管线落地，转储退役 | L | 0 |
| 2 | 类型地基（D2） | 三开关开满 0 error | M | 0 |
| 3 | 品牌 v5（D3+D5） | 单 accent + 玻璃阶梯 + 字阶/几何 token | L | 1 |
| 4 | 承诺修复 | 产品 P0/P1 快件 + B25①落地 | M | 3 |
| 5 | 同步/备份 UI | B38 前置修复 + 迁移中心同步分区 | M | 可与 4 并行 |
| 6 | 生态发现面 | 官方索引 + 市场默认源 + 作者 0→1 | M–L | 3 |
| 7 | 工程结构 | 巨型文件/循环依赖/错误信封/补 e2e | L（穿插 4–6） | 2 |
| 8 | 总验收 | 真机验证轮 + 全界面目检 + 台账清零 | M | 全部 |

### 批 0 · 存档与备份
git bundle 备份（已完成：~/Desktop/frond-backup-2026-09-29.bundle）；本路线图与审计报告落 docs/；P1-3/P1-7 以 B44/B45 并入 BUGS.md，P 体系退役。验收：BUGS.md 成为唯一挂账源。

### 批 1 · 样式管线
tailwind.config 重建（CSS-first）+ `@theme` var() 桥 + `@custom-variant dark`（`:root.dark` 口径）；过渡期只引 theme+utilities 层、**不启 preflight**（dump 先行防全局重置扰动）；转储 544 类按模块拆 4–5 子批迁移，迁一个删一段；gap 补丁文件归位；迁移完成前 ghostClasses 门禁做产物 diff 验收，之后退役。
验收：产物类覆盖 diff=0；全量 e2e 冒烟绿；真机目检 B39 五大风险部位。

### 批 2 · 类型地基
先测 strictTypeChecked 全量弹量 → NUIA ≈349（产品代码 ~110 优先）+ EOPT 87 + 非 prettier warn 103 分批清账（测试文件与产品代码分开）→ 三开关进 CI。
验收：0 error、CI 全绿、测试数不降。

### 批 3 · 品牌 v5
D5 落地（launcher-accent 收敛为 brand 派生，红退役）；tokens 升 v5：暗档压深一档（~#141417 级）、玻璃三参数阶梯（bg alpha × blur × 1px 高光，三档）、封闭字阶 7 档、geometry/motion 强制档 + stylelint 白名单；清理 FrondRaycastHome/RaycastSettings 血统类名；组件层 132 处 hex 全部 tokens 化。
验收：stylelint 色相唯一强制通过；对比度含暗色面板 muted（现 2.97:1）全过 AA；三窗代表界面真机目检。

### 批 4 · 承诺修复
onboarding 重写（Alt+Space 第一课、模块数动态取 MODULES.length、收藏承诺落地二选一）；Hub 假搜索改真按钮 + 4 处 setTimeout 竞态消除；权限面板上移出「高级」；snippets 摘 PENDING 牌；本地月历并入提醒页；胶囊设置页改名「快速开关」；B25①（D6）落地。
验收：每件附 e2e 或目检证据。

### 批 5 · 同步/备份 UI
前置修 B38 两件（墓碑不过网、push 半失败态 exportedAt 语义）→ 迁移中心「轻量同步」分区（V5 P-5 原设计落点）+ cloudBackup 接线。
验收：真机双实例同步/恢复走通；半失败态用例绿。

### 批 6 · 生态发现面
官方插件索引仓库 + 市场页默认填入 + 分类/搜索/截图位 + 提交渠道；SDK 兼容契约页（6 处 notSupported 钉测试）；邀 3–5 名种子作者真机走 0→1。
验收：一名外部作者从文档到上架全程走通。

### 批 7 · 工程结构（与批 4–6 交替）
SettingsView(1799)→LauncherApp(2152)→preload/runtime 拆解（拆一个从棘轮删一行）；6 个真实循环依赖拆解；typedIpc 统一错误信封（保留 rejection 兼容）+ 统一 logger 门面；零 e2e 界面（notes/迁移中心/mini-timer/floating-note）先补网再动刀；渲染件 UI 断言（B44）。
验收：棘轮清单只减不增；循环依赖 0 真实环；错误信封默认开。

### 批 8 · 总验收
真机验证轮三合一（录屏端到端 + 菜单栏搜索 + 21 内置插件批量目检）；全界面四态目检；台账清零核对；`release:preflight --strict` 真打包一次。

## 风险与对策

| 风险 | 对策 |
|---|---|
| dump 迁移漏类（B17 幽灵类事故重演） | ghostClasses 门禁转产物 diff 验收 + 全量冒烟；漏类即红 |
| TW4 preflight 全局重置扰动存量 | 过渡期不引 preflight 层，待迁移完成才启用 |
| 品牌改动面大（两主题 × 三窗） | 先 token 后组件两段落，每子批真机目检 |
| 单人节奏中断 | 每批独立可停，批间 CI 恒绿即安全点 |

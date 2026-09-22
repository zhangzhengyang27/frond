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
   〔🟡 **2026-09-21 第一批：注册表做完了，「插件 push 视图」这一半按原样留着没做**（原因写在下面，不是偷懒）。
   - 位置先纠一句：那条硬链不在 `useLauncherPages.ts`，在 `LauncherApp.vue` 的模板里（当时 24 节）。
     现在是一张表 `launcher/composables/launcherPageViews.ts`：`Record<LauncherViewId, def>`，
     def = 组件 + `props(ctx)` + `on(ctx)` + `ready(ctx)` + `key(ctx)`，模板里只剩一个
     `<component :is>`。**换掉硬链的真正理由是类型**：以前 `FirstPartyPage` 加一个 id 而模板漏一节，
     表现是「那一行能按、按下去一片空白」，编译与单测都不报错；现在少一条 def 就是编译错误
     （`LAUNCHER_PAGE_VIEWS` 覆盖全部 id 的那条用例是运行时的第二道闸）。
   - 顺手把一处**偶然顺序**改成了规则：插件那两节以前夹在第 7、8 位，于是「排在它前面的 7 页」
     能盖住插件视图、后面的全被盖。现在是「栈上有页 → 栈顶；栈空且插件开着 → 插件视图」，
     并且 `onPluginChanged` 在插件打开那一刻把页栈清掉（主窗 ⌘K 直接叫主进程开插件那条路不经过
     `runEntry`，以前根本不清栈）。
   - 两条行为保真的坑，都是「统一成一条 `<component>`」才暴露的：
     ① `FilesPage` 原本**没挂** `ref="pageRef"`，所以拿不到按键；统一挂上后按键路由会去调
     `undefined(e)` 抛 TypeError——调用点改成 `pageRef.value?.handleKey?.(e)`；
     ② 同名组件（FormPage 有 6 条）在 `:is` 下会被 Vue **复用实例**，`qlarg → pluginarg` 这种
     切换会留着上一页的输入值。注册表给每条一个 `key`（默认就是页面 id），换页必重挂载。
   - **同一批还修了两条命令表的老毛病**（做这条时被 e2e 逼出来的）：
     `launcher:command-table-changed` 以前只发给胶囊窗，主窗的 ⌘K 面板一直拿着过期的表；

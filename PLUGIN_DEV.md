# Leaf 插件开发指南

Leaf 启动器支持第三方插件，基于 Web 技术（HTML + JS），通过 `window.launcherApi` 与宿主交互。

## 快速开始

### 1. 创建插件目录

在 `plugins/` 下创建以插件 ID 命名的目录：

```
plugins/com.your.plugin/
├── plugin.json    # 插件清单
└── index.html     # 入口页面
```

### 2. 编写 plugin.json

```json
{
  "id": "com.example.hello",
  "name": "示例插件",
  "version": "1.0.0",
  "description": "插件描述",
  "main": "index.html",
  "commands": [
    { "code": "hello", "title": "示例命令", "description": "命令描述" },
    { "code": "clean", "title": "清理剪贴板", "mode": "action" }
  ],
  "preferences": [
    { "name": "greeting", "label": "问候语", "type": "text", "default": "Hello" }
  ]
}
```

命令形态 `mode`（对标 Raycast，缺省 `view`）：

- `view`：打开插件界面（一直以来的行为）
- `action`：**无界面执行**——宿主仍创建沙箱视图跑你的 JS，但不挂到胶囊窗，用户看到的还是原来的搜索结果。插件在 `getPluginContext()` 里按 `cmd` 分支决定要不要渲染；做出视图（`renderList` / `renderView` / `setSubInput` / `setExpandHeight`）时宿主会自动升级为可见，所以「声明了 action 就永远看不到界面」并不成立。跑完请自己 `closePlugin()`；不自关的由宿主 20s 兜底回收。

命令参数 `arguments`（对标 Raycast `arguments`，最多 3 个，超出由宿主截断）：

```json
{ "code": "test", "title": "正则测试",
  "arguments": [
    { "name": "pattern", "label": "正则表达式", "type": "text", "required": true },
    { "name": "text", "label": "测试文本", "type": "text", "placeholder": "留空则取剪贴板" },
    { "name": "flags", "label": "标志位", "type": "dropdown",
      "data": [ { "title": "g（全局）", "value": "g" }, { "title": "gi", "value": "gi" } ] }
  ] }
```

- 类型只有 `text` / `password` / `dropdown`；`dropdown` 界面上展示 `title`、提交给插件的是 `value`
- **≤2 格且都是文本/密码 → 在搜索框里内联填**（P-1.6b：命令名变一颗 chip，←/→ 换格，↵ 执行）；
  第 3 格起或含 `dropdown` 才弹参数表单页（`FormPage`）。`required` 且留空会被拒绝执行
- **查询里可以直接把第一个参数打出来**：`正则测试 \d+` 这样「标题 + 空格 + 尾巴」的查询会命中该命令
  （只有声明了 `arguments` 的命令吃这条前缀规则，所以命令「Git」不会被「Github xxx」抢走），
  尾巴自动预填进第一格
- 插件侧在 `onEnter(data)` 的 `data.args` 里收参数（`getContext()` 同样能读到）
- 现成示例：`plugins/com.leaf.regex`（三参数含 dropdown → 表单页）、
  `example-react` 的 `argsum`（两格文本 → 内联槽），用例在 `e2e/plugin-args.spec.mjs` /
  `e2e/plugin-arg-slots.spec.mjs`

偏好声明 `preferences`（宿主是 **fail-closed** 读的，写错的表现是「设置里少了这一项」而不是报错）：

- 类型只有 `text` / `select` / `checkbox`；**省略 `type` = 文本框**，写了不认识的类型整条剔除
  （不降级——把 `password` 当文本框就是把口令摆在设置页里）
- `name` / `default` / `select` 的候选**超长是整条剔除，不截断**（名字被剪短之后，
  存储键与插件 `getPreference('…')` 用的键就不是同一个了）；`label` 是显示用的，超长截断
- 上限 20 项、select 上限 20 个候选；`select` 不给候选 = 整条剔除
- 读写都只认**声明过的键**：`preferences.get('没声明的键')` 回 `ok:false`，`set` 同理

### 3. 编写 index.html

插件页面不需要 UI，通过 `launcherApi.renderList()` 提交数据，宿主用原生组件渲染列表。

```javascript
const api = window.launcherApi

api.onEnter((data) => {
  api.renderList([
    {
      title: '第一条',
      subtitle: '描述',
      icon: 'star-line',
      actions: [
        { label: '打开', type: 'open', payload: 'https://example.com' },
        { label: '复制', type: 'copy', payload: '文本' }
      ]
    }
  ])
})

api.onSubInputChange((data) => {
  // 用户在副输入框输入时过滤列表
})

api.onAction((payload) => {
  // type=callback 的动作回到这里
})
```

## API 参考

### 声明式列表

| 方法 | 说明 |
|---|---|
| `renderList(items)` | 提交列表数据，宿主原生渲染 |
| `clearList()` | 清空列表 |

列表条目字段：
- `title`（必填）：主标题
- `subtitle`：副标题
- `icon`：remixicon 名称（不含 `ri-` 前缀）
- `accessories`：右侧配件文本（最多 3 个）
- `detail`：详情面板内容
- `detailFormat`：`'text'` 或 `'markdown'`
- `actions`：动作数组（首个为回车默认动作，**最多 10 个**，超出由宿主截断）

动作类型：
- `copy`：复制 `payload` 到剪贴板
- `open`：系统打开 `payload`（URL / 文件路径）
- `callback`：回到 `onAction` 回调

### 生命周期

| 钩子 | 触发时机 |
|---|---|
| `onEnter` | 命令被选中进入 |
| `onReady` | 页面加载完成 |
| `onLeave` | 离开插件 |
| `onShow` / `onHide` | 胶囊窗显示/隐藏 |
| `onSubInputChange` | 副输入框内容变化 |
| `onAction` | callback 动作被触发 |

### 受控能力

| 方法 | 说明 |
|---|---|
| `notify(body)` | 发送系统通知 |
| `copyText(text)` | 复制文本（需权限 `clipboard.write`） |
| `readText()` | 读取剪贴板文本（需权限 `clipboard.read`） |
| `openPath(path)` | 打开文件/路径（需权限 `fs.open`） |
| `open(url)` | 交给系统浏览器（需权限 `net`；协议只收 `http/https/mailto`，`file:`/自定义 scheme/`data:` 一律拒） |
| `alert({ title, message, actions })` | 宿主原生模态框，回被按下的动作 id；**取消/Esc 回 `null`**（没声明 cancel 样式动作时宿主自己补一颗「取消」，Esc 绝不等于执行第一个动作）。同一插件同时只一条框，挤不进去的直接回 `null` |
| `fetch(url)` | 联网请求（需权限 `net`；绕 CORS，2MB/15s 上限） |
| `schedule.add({ cron, cmd, label?, arguments? })` | 排一条**本插件的**定时任务（需权限 `schedule`；详见下面「定时任务」） |
| `schedule.list()` | 本插件已登记的任务（看不到别人的） |
| `schedule.remove(id)` | 撤一条（只能撤自己登记的） |
| `setSubInput(placeholder)` | 设置副输入框占位符 |
| `setExpandHeight(height)` | 设置展开高度 |
| `detach()` | 分离为独立窗口 |
| `close()` | 关闭插件 |

### 定时任务（插件生命周期外执行）

插件页是 BrowserView，关掉就被销毁 —— 所以「插件关掉之后还想定期做点事」只能由宿主排程。
`schedule` 这一组就是把 **设置 → 定时任务** 那台引擎开一个受限的入口给插件，四条规则都在宿主侧强制：

| 规则 | 为什么 |
|---|---|
| 必须声明权限 `schedule` | 它的副作用是「第三方代码会在没人看它的时候跑」，用户该在导入确认框里单独看到这一项 |
| 只能排本插件 **`mode: 'action'`** 的命令 | 视图命令会在凌晨自己弹出界面；`add` 会按插件清单核这个 |
| 每个插件最多 3 条 | 总上限 20 条是留给用户的，不能被一个插件占满 |
| 最快每 15 分钟一次（一天 ≤ 96 次） | 比这更密是轮询，代价与「自动化」的价值不成比例 |

三条要说清的实话：

- **看得见**：排上的任务出现在「设置 → 高级 → 定时任务」里，带「来自插件 X」标记，用户能关能删；
  卸载插件时它登记的任务一并清掉（留着就是一条条「到点失败、原因写着插件未安装」的悬空任务）。
- **cron 是本机本地时间**，标准 5 字段（分 时 日 月 周），不支持秒与别名。
- **成败只看得到「投递到了插件」**：Action 命令没有回调通道，插件里跑成什么样宿主不知道。
  所以设置页对这类任务写的是「已交给插件」，不是「执行成功」。

React SDK 侧同名导出：`scheduleCommand(input)` / `listScheduledCommands()` / `cancelScheduledCommand(id)`。

### 数据存储

| 方法 | 说明 |
|---|---|
| `db.put(id, data)` | 存储 KV（插件命名空间隔离） |
| `db.get(id)` | 读取 KV |
| `db.remove(id)` | 删除 KV |
| `db.list()` | 列出所有 KV |
| `preferences.get(name)` | 读取偏好（plugin.json 声明的键；未声明的键回 `ok:false`，与 set 同一道闸） |
| `preferences.set(name, value)` | 设置偏好 |
| `preferences.all()` | 一次取回**声明过的**全部偏好（没设过的落 manifest 默认值） |

### 网络

```javascript
const resp = await api.fetch('https://api.example.com/data', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer xxx' }
})
// resp.ok, resp.status, resp.body, resp.contentType
```

网络请求由主进程代理，绕过 CORS，超时 15s，响应体上限 2MB。

## 搜索双通道（#5）

插件可以向启动器根搜索贡献条目——**关闭插件后依然可搜**：

1. `plugin.json` 顶层声明 `"searchable": true`（显式开通，未声明则提交被拒绝）。
2. 插件运行时（onReady / onEnter 均可）提交条目集，覆盖式持久化到主进程：

```js
await launcherApi.submitSearchItems([
  {
    title: 'Rust 入门笔记',
    subtitle: 'Trae Work KB',
    icon: 'book-2-line',
    keywords: ['rust', 'trae'],
    badge: '笔记',
    action: { type: 'open', payload: 'https://example.com/rust' } // 或 copy / callback
  }
])
```

行为要点：

- 每次提交覆盖旧条目集（上限 300 条），宿主清洗非法项（title 必填、动作必须有类型和非空 payload）
- 关闭插件后条目仍出现在根搜索；每次打开插件重新提交即完成刷新
- 动作语义与声明式列表一致：`copy` 复制 payload 后收起胶囊；`open` 打开 payload
  （http(s) 走浏览器，否则按路径打开）；`callback` 打开插件继续交互
- 停用 / 卸载插件后其条目自动从根搜索消失

## React 视图 API（#11 M2）

`plugin.json` 声明 `"api": "react"` 后，插件可以用 **React 组件**写 UI——视图以 JSON
提交宿主，**胶囊用原生组件渲染**（插件零 CSS、零 DOM，Raycast 质感由宿主保证）。
SDK：`packages/leaf-plugin-sdk`（workspace 包，插件以 `file:../packages/leaf-plugin-sdk` 引用）。

```tsx
import { start, List, ActionPanel, Action, Detail, Form, useNavigation } from 'leaf-plugin-sdk'

function App() {
  const nav = useNavigation()
  return (
    <List>
      <List.Item title="leaf/launcher" subtitle="主仓库" detailFormat="markdown"
        detail="# README">
        <ActionPanel>
          <Action title="查看详情" onAction={() => nav.push(<Detail markdown="# 详情" />)} />
          <Action title="复制名称" type="copy" payload="leaf/launcher" />
        </ActionPanel>
      </List.Item>
    </List>
  )
}

start(<App />)
```

要点：

- **入口**：`start(element)`（含 useNavigation 支持）；`render(element)` 为裸渲染
- **组件**：`List` / `List.Item` / `List.Section`（v1 拍平渲染）/ `Detail`（markdown|text）/
  `ActionPanel` + `Action`（type 缺省 callback，`onAction` 经回调 id 回传）/
  `Form` + `Form.TextField|TextArea|Select|Checkbox|DateField|PasswordField`
- **Form**（#11 M2）：`<Form onSubmit={(values) => ...} submitLabel="发送">`，字段以
  `id` 为提交键；提交值经 Callback 钩子回传 `onSubmit`，插件可 `nav.push(Detail)` 展示结果
- **useNavigation**：`push(element)` 进入新视图 / `pop()` 返回（根视图 pop = 关闭插件）
- **回调生命周期**：每次提交后宿主只保留当轮引用的回调 id（组件卸载即失效）
- 宿主暂无对应能力的 Raycast API（`getSelectedText` / `MenuBarExtra` / `WindowManagement` /
  `ShowHUD` / `JSB` 等）**首次调用时 `console.warn` 一次并安全降级**
  （返回空值/空对象，不抛错、不假实现）；完全未导出的（如 `MenuBarExtra`）在构建期即不可引用。
  已接通的对照表见下面「@raycast/api 兼容层」

### 表单示例

```tsx
<Form submitLabel="发送反馈" onSubmit={(values) => nav.push(<Detail markdown={\`已收到：${values.content}\`} />)}>
  <Form.Select id="kind" label="类型" options={['建议', '缺陷']} initial="建议" />
  <Form.TextField id="content" label="内容" placeholder="想说的话" />
</Form>
```

字段类型：text / textarea / select（需 options）/ checkbox（initial 为 boolean）/
date / password。宿主 fail-closed 清洗：字段 id 去重、select 无选项降级 text、封顶 20 字段。

### @raycast/api 兼容层（#11 M3）

`packages/leaf-raycast-api`（包名 `@leaf/raycast-api`）把 Raycast 的组件形态适配到
leaf-plugin-sdk。**定位**：让会写 Raycast 的人用熟悉的 JSX 形状写 Leaf 插件；
「跑未改动的 Raycast 商店扩展」不是目标（那是 REACT_API_DESIGN §1 的明确非目标）。

不冒用 `@raycast` 这个 npm scope，插件侧一行 alias 指过来：

```js
// esbuild
build({ alias: { '@raycast/api': '@leaf/raycast-api' }, /* … */ })
```

本层已消化的形状差异：

| Raycast 写法 | Leaf 实际 |
| --- | --- |
| `<List items={[…]} />` | children |
| `<List.Item actions={<ActionPanel>…</ActionPanel>} />`（actions 是 prop，可不套面板） | children 里的 `<ActionPanel>` |
| `accessories={[{ title, value }]}` | `string[]`（取 value） |
| `Form.TextField name/title/defaultValue` | `id` / `label` / `initial` |
| `Form.Dropdown` + `Form.Dropdown.Item` | `Form.Select options=[]` |
| `Form.Submit title` | 宿主提交按钮文案（`submitLabel`） |
| `Action.Copy text` / `Action.Open target` | `type='copy'/'open'` + `payload` |
| `Action.Close` | 根视图 pop（= 关闭插件，与 Raycast 关闭扩展等效） |

**宿主已有、SDK 已接通的能力**（P-2.3 / P-2.5 / P-2.6）：`Toast.show`（→ 系统通知）、
`Alert`（→ 宿主原生模态框；回被按下的动作 id，Esc/取消回 `null`，没声明 cancel 样式时宿主
自己补一颗「取消」，同一插件同时只一条框）、`getPreferenceValues()`（→ `plugapi:listPreferences`
一次取回声明过的全部偏好，**是 async 的**：Raycast 那边同步，这里跨进程必须 await）、
`open(url)`（→ 系统浏览器，需 `net` 权限 + `http/https/mailto` 协议白名单；`Local.openPath`
仍是那条本地路径的）、
`LocalStorage.getItem/setItem/removeItem` 与 `Cache.getCacheItem/setCacheItem/removeCacheItem`
（→ 插件命名空间 KV，`ls:` / `cache:` 前缀分开，Cache 支持 ttl 秒、过期读到即删）、
`navigation.popToRoot()`（已在根视图时等同 `pop`，即通知宿主关闭插件）、
`List` 的 `isLoading`（→ `loading`）与 `emptyView`（→ `emptyMessage` 一句文案：
列表为空且加载中时宿主显示「加载中…」，否则显示插件给的文案）、
`Detail.actions`（→ 宿主把 detail 降级成「占位条目 + 正文」，动作挂在该条目上，
胶囊右侧照旧显示正文、动作行与 `runPluginAction` 原样复用）。
`Action.Copy` / `Action.Open` 的标签 `name` 与 `title` 两个都收（Raycast 文档里两种都出现过）。
Leaf 原生 SDK 侧同名导出：`showToast` / `copyToClipboard` / `getClipboardText` /
`getPluginContext` / `closePlugin` / LocalStorage 与 Cache 的六个函数。

**仍然没有的能力不假装有**：首次调用时 `console.warn` 一次并安全降级——
`getSelectedText` / `Action.SubmitForm` / `ShowHUD` / `HideHUD` / `JSB` /
`List.searchBarPlaceholder`（胶囊占位文案由宿主控制）。
入口需自己调 `render(<App />)`（Raycast 由宿主调 `main()`）。

## 内置示例

- `example-plugin/`：完整演示声明式列表、偏好、网络、通知
- `example-react/`：React 视图 API 演示（List / Detail / ActionPanel / Form / 导航）
- `plugins/com.leaf.quickfolders/`：常用目录快速访问

## 调试

1. 插件管理页点「运行」打开插件（胶囊中进入插件交互）
2. 点「调试」打开该插件视图的独立 DevTools（`console.log` / 断点 / DOM 检查均可）
3. 插件未打开时点「调试」会自动先运行首个命令再挂调试器

## 安装插件

将插件目录放入 `plugins/` 下，重启 Leaf 或在插件管理页刷新即可。

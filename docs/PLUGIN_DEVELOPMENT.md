# Leaf 启动器 · 插件开发指南（协议全集）

面向第三方插件开发者。事实来源（本文件与代码不一致时以代码为准）：

- 类型声明：`example-plugin/launcher-api.d.ts`（与 `src/shared/plugin-protocol.ts` 保持同步）
- 宿主实现：`src/main/launcher/runtime.ts`（API 校验/执行）、`src/preload/plugin.ts`（受控桥）
- 安装/清单：`src/main/launcher/pluginStore.ts`；市场：`src/main/launcher/market.ts`；
  开发热重载：`src/main/launcher/devPlugins.ts`

零起步教程（目录结构 / plugin.json 字段表 / 快速上手）见
[`example-plugin/README.md`](../example-plugin/README.md)，本文不重复字段表，只补协议细节。

---

## 1. 运行模型

- 插件 = 包含 `plugin.json` 的本地目录，安装在 `userData/launcher-plugins/<pluginId>/`。
- 运行时是一个 **BrowserView**：`contextIsolation` 开、`nodeIntegration` 关、`sandbox` 开、
  `webSecurity` 开。插件页面拿不到任何 Electron/Node 能力，
  只能通过专用 preload 暴露的 `window.launcherApi`（受控 IPC 白名单 `plugapi:*`）做事。
- 页面地址：普通插件为 `plugin://<pluginId>/<main>`（自定义协议，只读挂载安装目录）；
  声明了 `devServer` 的插件直接加载该 http(s) 地址。
- 视图导航被锁定：只允许插件自身源（`plugin://<pluginId>/`）与 `devServer` 前缀，
  `window.open` 一律拒绝，越界导航被拦截并记日志。
- 身份模型：每个 API 通道按 `event.sender`（webContents id）解析插件身份，
  不依赖"当前激活"状态——`detach` 成独立窗口后依然可用。

两种形态（可共存）：

- **声明式**：`renderList(items)` 提交数据，宿主原生渲染，插件视图缩为 0 高纯数据源；
- **HTML 自绘**：不提交声明式列表，插件页自行渲染，可调高度 / 分离窗口。

---

## 2. API 全集（`window.launcherApi`）

除生命周期钩子外全部返回 `Promise`。完整类型见 `example-plugin/launcher-api.d.ts`。

### 2.1 上下文

| API | 签名 | 说明 |
| --- | --- | --- |
| `getContext` | `() => Promise<PluginContext \| null>` | `{ pluginId, name, cmd }`；`cmd` 为触发本次打开的命令 code（无则 null） |

### 2.2 声明式 List（推荐）

| API | 签名 | 说明 |
| --- | --- | --- |
| `renderList` | `(items: PluginListItem[]) => Promise<boolean>` | 提交整份列表（覆盖式）；宿主校验通过后原生渲染。非法输入**整体拒绝**（返回 `{ ok: false, error }`，胶囊继续显示旧列表/传统模式） |
| `clearList` | `() => Promise<boolean>` | 清空声明式列表，回退传统 UI 模式（插件视图与窗口尺寸恢复） |

条目（`PluginListItem`）与校验规则（超出部分截断或整体拒绝，见 runtime `setDeclaredList`）：

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `title` | string | 必填（缺失则整体拒绝）；≤200 字符 |
| `actions` | array | 必填（缺失则整体拒绝）；≤6 项；每项 `{ label?, type, payload? }` |
| `subtitle` | string | ≤300 字符 |
| `icon` | string | remixicon 名（不含 `ri-` 前缀），缺省 `plug-2` |
| `keywords` | string[] | 搜索过滤由插件自管，宿主用于高亮兜底 |
| `accessories` | string[] | 右侧配件文本，≤3 项 |
| `detail` | string | 选中显示的详情面板内容，≤5000 字符 |
| `detailFormat` | `'text' \| 'markdown'` | 缺省 `'text'`（白名单外按 text 处理）；markdown 走 marked + sanitize 渲染 |
| `actions[].type` | `'copy' \| 'open' \| 'callback'` | 白名单外按 `callback` 处理 |
| `actions[].payload` | string | ≤2000 字符；copy=复制，open=系统打开（URL/路径），callback=回 `onAction` |

整份列表上限 **300** 条（`PLUGIN_MAX_VIEW_ITEMS`）。提交成功后：

- 数据流：`plugapi:renderList` → 主进程（挂在视图上下文）→ `launcher:plugin-changed`
  （整份状态快照，列表与 React 表单视图互斥）→ 胶囊原生渲染；
- 动作流：胶囊回车/⌘数字 → `launcher:plugin-run-action` → copy/open 宿主本地执行，
  callback 回插件 `onAction({ item, action, itemIndex, actionIndex })`。

### 2.3 数据：db（插件命名空间 KV）

存储在本地 SQLite `launcher_docs` 表，按 `pluginId` 隔离命名空间，插件只能触达自己的数据。

| API | 签名 | 说明 |
| --- | --- | --- |
| `db.put` | `(id: string, data: unknown) => Promise<unknown>` | 覆盖写；`id` 必填 |
| `db.get` | `(id: string) => Promise<unknown>` | 不存在返回 null |
| `db.remove` | `(id: string) => Promise<unknown>` | 删除 |
| `db.list` | `() => Promise<unknown[]>` | 本插件全部文档（按更新时间倒序） |

### 2.4 偏好（preferences）

值存主进程 kv（命名空间 `prefs.<pluginId>`），**只允许读写 `plugin.json` `preferences` 声明过的键**；
管理页会按声明自动渲染设置表单。

| API | 签名 | 说明 |
| --- | --- | --- |
| `preferences.get` | `(name) => Promise<{ ok, value?, error? }>` | 未设置时返回清单声明的 `default` 兜底 |
| `preferences.set` | `(name, value) => Promise<{ ok, error? }>` | 未声明的键报 `preference not declared` |

### 2.5 网络：fetch（主进程代理）

| API | 签名 |
| --- | --- |
| `fetch` | `(url: string, init?: { method?, headers?, body? }) => Promise<{ ok, status?, body?, contentType?, error? }>` |

行为与限制见 §3.1。绕 CORS（请求由主进程发出），响应以文本返回，不支持流式/二进制。**需要 `net` 权限。**

### 2.6 受控能力

| API | 签名 | 说明 |
| --- | --- | --- |
| `notify` | `(body: string) => Promise<boolean>` | 系统通知，标题为插件名 |
| `copyText` | `(text: string) => Promise<boolean>` | 写剪贴板（需 `clipboard.write` 权限） |
| `readText` | `() => Promise<string>` | 读剪贴板（需 `clipboard.read` 权限） |
| `openPath` | `(path: string) => Promise<boolean>` | 系统默认程序打开（需 `fs.open` 权限）；经安全守卫（§3.2），拒绝返回 false |
| `setSubInput` | `(placeholder: string) => Promise<boolean>` | 把胶囊搜索框设为插件副输入框；输入变化经 `onSubInputChange` 回插件；分离模式不可用 |
| `setExpandHeight` | `(height: number) => Promise<boolean>` | 调整插件区高度，主进程夹取 120–580；分离模式不可用 |
| `detach` | `() => Promise<boolean>` | 分离为独立窗口（单一分离窗，已有分离窗时失败）；分离后 Enter 会带 `detached: true` 重发 |
| `close` | `() => Promise<boolean>` | 关闭插件视图，回到搜索列表 |

### 2.6.1 敏感权限声明制

`copyText` / `readText` / `openPath` / `fetch` 属于敏感 API，需在 `plugin.json` 中声明
`permissions` 后才可用；**未声明时调用按该 API 的失败形状静默拒绝**（`fetch` 返回
`{ ok: false, error }`，其余返回 `''` / `false`）。

```json
{
  "permissions": ["clipboard.read", "net"]
}
```

| 权限 | 解锁的 API | 导入确认框展示 |
| --- | --- | --- |
| `clipboard.read` | `readText` | 读取剪贴板 |
| `clipboard.write` | `copyText` | 写入剪贴板 |
| `fs.open` | `openPath` | 打开本地文件 |
| `net` | `fetch` | 访问网络 |

规则：
- 声明以外的值在读取时剔除（拼错权限名 = 没声明）
- 基础 API（UI / 生命周期钩子 / db / preferences / notify）无需声明
- 用户导入插件时，确认框会列出声明的敏感权限
- 内置官方插件已按实际使用声明权限

### 2.7 生命周期钩子

全部返回取消订阅函数；同一钩子可多次订阅；回调异常被捕获不影响宿主。

| 钩子 | payload | 触发时机 |
| --- | --- | --- |
| `onEnter` | `{ cmd: string \| null }`（detach 后含 `detached: true`） | 插件被打开（dom-ready 后）；重载后也会重发 |
| `onReady` | `null` | 首次挂载完成（紧随 Enter） |
| `onLeave` | `null` | 关闭 / 分离迁移前 |
| `onShow` / `onHide` | `null` | 胶囊窗显示 / 隐藏 |
| `onSubInputChange` | `{ text: string }` | 副输入框内容变化（配合 `setSubInput`） |
| `onAction` | `{ item, action, itemIndex, actionIndex }` | 用户执行了 `type: 'callback'` 动作 |

---

## 3. 安全约束（红线）

### 3.1 网络代理（`fetch`）

- 仅 http(s)；**本地/内网/链路本地地址一律拒绝**：`localhost`、`127/8`、`10/8`、`0/8`、
  `192.168/16`、`169.254/16`、`172.16–31`、CGNAT `100.64–127`、IPv6 `::1` / `fe80::/10` / `fc00::/7`、
  IPv4-mapped IPv6 等；
- 主机名会做 **DNS 解析后逐一校验**（解析结果任一地址落内网即拒绝，解析失败按拒绝处理）——
  防 DNS rebinding；**不自动跟随重定向**（防外网 302 → 内网绕过）；
- 响应体 **2MB 上限**（字节级流式截断），**15s 超时**。

### 3.2 openPath 守卫

`openPath` 语义是「打开本应用产出的内容」：必须是**存在的绝对路径**（文件或目录），
并拒绝可直接执行的类型（`.sh` `.bash` `.zsh` `.command` `.scpt` `.scptd` `.workflow`
`.terminal` `.exe` `.bat` `.cmd` `.ps1` `.vbs` `.msi` `.app` `.jar`）。
启动应用不在内容通道承担，走宿主自身的 launch-application 白名单。

### 3.3 声明式列表与 markdown detail

- 列表字段按白名单校验、长度截断（见 §2.2），未声明的字段不透传；
- `detailFormat: 'markdown'` 的渲染路径：`marked` → `sanitize-html`（标签白名单，允许 `img`/`del`）
  → `v-html`。事件属性/脚本不在白名单；链接强制 `target="_blank" rel="noopener"`。

### 3.4 进程与导航

- `contextIsolation` / `sandbox` 开，`nodeIntegration` 关；插件只能走 `plugapi:*` 白名单通道；
- 插件源被锁定（§1）；dev server 插件仅放行清单声明的那个 origin 前缀；
- 偏好与 db 严格按插件命名空间隔离，跨插件不可见。

---

## 4. 开发模式（热重载，对标 Raycast develop）

管理页「开发者」区块 → 「添加开发目录」（目录选择复用既有 `launcher:selectPluginFolder` 通道）。

行为：

- 注册即 `importFromFolder` **覆盖安装**（staging→原子交换），并记录配置到
  launcher_docs kv `sys.devplugins`：`[{ pluginId, sourceDir, autoReload }]`；
- watcher：`fs.watch(sourceDir, { recursive: true })`（macOS/Windows 支持），**300ms 防抖**；
  触发 → 覆盖重装 → `reloadPluginView` 就地重载该插件视图（重新 loadURL 入口 + 重置声明列表
  握手 + 重发 Enter/Ready）；
- `autoReload` 关闭会停掉 watcher 释放句柄；「重载」按钮不依赖该开关手动触发；
- 「移除」= 解除开发跟踪（停 watcher + 删 kv 记录），**不卸载插件本体**；
  卸载走「已安装插件」区的「卸载」（`launcher:removePlugin`）；
- 重装失败（manifest 写坏等）不破坏已安装版本（staging 交换保证），
  失败经系统通知 + `launcher:devPlugins:changed` 推送（管理页 toast）反馈；
- 应用退出（`will-quit`）统一关闭全部 watcher。

主进程通道清单（`src/main/launcher/ipc.ts`）：

| 通道 | 参数 | 返回 |
| --- | --- | --- |
| `launcher:devPlugins:list` | – | `DevPluginInfo[]`（含 name/version/installed/sourceExists/manifestValid） |
| `launcher:devPlugins:add` | `dirPath` | `{ ok, error?, plugin? }`；校验目录存在且含合法 plugin.json |
| `launcher:devPlugins:remove` | `pluginId` | `{ ok, error? }`；只解除跟踪，不卸载 |
| `launcher:devPlugins:setAutoReload` | `pluginId, autoReload` | `{ ok, error? }`；关 = 停 watcher |
| `launcher:devPlugins:reload` | `pluginId` | `{ ok, error?, plugin? }`；手动重载单插件 |
| `launcher:devPlugins:changed`（推送） | `{ kind: 'added'\|'removed'\|'reloaded'\|'error', pluginId, name?, error? }` | watcher 自动重装结果广播 |

**preload 绑定清单**（已在 `src/preload/index.ts` 的 `window.api.launcher` 上实现，
管理页对开发者区块做存在性守卫、缺失时降级不报错）：

```ts
devPluginsList: () => Promise<DevPluginRow[]>
devPluginsAdd: (dir: string) => Promise<{ ok: boolean; error?: string; plugin?: { id: string; name: string; version?: string } }>
devPluginsRemove: (pluginId: string) => Promise<{ ok: boolean; error?: string }>
devPluginsSetAutoReload: (pluginId: string, autoReload: boolean) => Promise<{ ok: boolean; error?: string }>
devPluginsReload: (pluginId: string) => Promise<{ ok: boolean; error?: string; plugin?: { id: string; name: string; version?: string } }>
marketUpdate: (entryId: string) => Promise<{ success: boolean; error?: string; plugin?: { id: string; name?: string; version?: string } }>
onDevPluginsChanged: (cb: (p: { kind: 'added'|'removed'|'reloaded'|'error'; pluginId: string; name?: string; error?: string }) => void) => () => void
```

`src/preload/index.ts` 与 `src/preload/index.d.ts` 各补同形绑定即可（风格照抄相邻的
`marketInstall` / `onPluginChanged`）。

---

## 5. 市场发布流程

索引 = 仓库根 `plugins.json`（打包后经 electron-builder extraResources 落在 resources/）。
静态、本地优先：不联网也能浏览安装。

条目字段：`id`（合法反向域名）、`name`、`version`（可选，强烈建议）、`description`、`author`、
`download`、`sha256`（可选）。`download` 三种来源：

1. **本地目录**：相对索引文件解析，且必须位于索引目录子树内（`../` 逃逸与索引目录本身都会被剔除；
   安装时再做一次 realpath 包含校验，防符号链接逃逸）；
2. **本地 zip**：相对索引文件的 `.zip` 路径，解压后在根目录或一层子目录定位 `plugin.json`；
3. **https zip 直链**：20MB 上限 / 30s 超时，禁止本地与内网地址，不跟随重定向，走 DNS 钉住的连接层。

字段是**静默剔除**而不是报错的：`id`/`name`/`download` 不合法、本地路径逃出索引目录、
声明了 `sha256` 却不是 64 位十六进制——这一条条目直接从市场里消失，界面上不会说明原因
（`pluginManifestAudit.test.ts` 里有一条「索引过一遍真解析器不丢条目」的审计就是拦这个的）。

### sha256 校验和

- `sha256` 是**包体**（zip / 直链下载到的字节流）的摘要，不是目录里文件的摘要，所以本地目录形态给不出；
- 声明了就必须命中：zip 在**解压之前**校验，不通过即中止安装并提示
  「sha256 校验不通过：包体与索引声明不一致」；
- 市场列表按真话标注：有 `sha256` 显示「sha256 校验」，没有显示「未校验」。没有证书与签名设施
  （见 `DECISIONS.md` 的签名/公证一期），所以「已校验」永远只指字节完整性，不代表作者身份可信。

### 远程索引（用户自配）

除打包索引外，用户可以在「启动器 → 插件市场」里填一个 **https** JSON 地址并拉取：

- 拉到的内容缓存到 `userData/market-remote.json`，断网时继续显示上次结果；**拉取失败不清空**已有列表；
- 远程索引里的条目 `download` 只接受 https URL（不接受本地路径，也不接受明文 http）；
- **打包索引胜出**：远程条目 `id` 与打包条目同名时被丢弃，市场头部如实报「N 条与打包索引同名已忽略」。
  这条是刻意的——否则任何一份远程索引都能把官方插件换成自己的包。

安装复用 `pluginStore.importFromFolder`：manifest 校验（id 合法、name 必填、devServer 仅 http(s)）
+ staging 原子交换，**覆盖式安装**（重装/降级覆盖都不破坏现有安装）。

### version 语义

- 插件清单 `plugin.json` 的 `version` 是版本事实来源；市场条目 `version` 是「索引宣布的最新版」；
- **语义比较**（`parseSemver`/`compareSemver`，容忍前导 `v` 与 prerelease 后缀）：只有市场版本
  **确实比已装版本新**才标 `updatable: true`。索引落后于本机（例如清单已升 `1.0.1` 而索引还写 `1.0.0`）
  时不再常年显示「可更新」，降级也不会被当成更新推给用户；
- 任一侧缺 version → `updatable: false`（不可判定）；两侧都解析不出 semver 时才退回
  「字符串不等即视为可更新」，宁多不漏（例如 `nightly` 这类自定义版本号）；
- 发新版：改插件目录里 `plugin.json` 的 version → 同步改 `plugins.json` 的 version → 提交索引
  （两者不一致会被 `pluginManifestAudit.test.ts` 拦住）。

### 版本更新机制

- 通道：`launcher:market:update`（`entryId`）→ 与安装同一条 `installFromMarket` 覆盖式链路
  （目录/zip/url 来源解析 → 校验 → staging 交换），返回 `{ success, plugin, error? }`，
  `plugin.version` 即更新后的新版本；
- 更新成功后若该插件视图存活会**就地重载**（同开发模式 reload），未打开则下次打开生效；
- 示例：仓库内 `example-plugin/` 与 `plugins.json` 条目 version 均为 `0.1.0`；
  想演示更新流，把 `plugins.json` 的 version 改成 `0.2.0`，市场区即出现
  「可更新 0.1.0 → 0.2.0」。

---

## 6. 修订记录

- 2026-09：新增开发模式热重载（`devPlugins.ts`）、市场版本更新通道（`launcher:market:update`）、
  `MarketItem.installedVersion/updatable`；本文件为第一版协议全集。

# Examples · 标杆第三方插件

三个可以**直接运行**的第三方插件示范，覆盖第三方开发者最常见的三类形态。
它们**不随应用分发**（不在 `plugins/`、不自动安装）——克隆/下载本仓库后，
用开发模式导入或经 CLI 发布安装：

| 插件 | 形态 | 演示点 |
| --- | --- | --- |
| [`com.third.hn`](./com.third.hn) | 网络 + 列表 | 真实公网 API（HN 官方 API，无需 Key）、宿主代理 fetch、open/copy 动作、子输入过滤 |
| [`com.third.myip`](./com.third.myip) | 最小单命令 | 一条命令一次请求就能成为插件；宿主代办的 copy 动作；坏响应兜底 |
| [`com.third.weather`](./com.third.weather) | 偏好设置 + 网络 | preferences 声明与读写、坐标校验、分 section 列表、callback 动作 + HUD |

每个插件都是标准四件套：`plugin.json`（清单：命令/偏好/权限声明）+
`lib.js`（纯逻辑，UMD 双导出）+ `lib.test.js`（vitest 直接跑）+
`index.html`（宿主 API 接线）。

## 试用

**开发模式（改完即热重载）**：启动 Frond → 插件中心/设置 → 开发插件 → 导入
`examples/com.third.weather` 等目录。

**走完整发布链**（与真实第三方发布同一条路）：

```bash
pnpm plugin pack examples/com.third.weather
pnpm plugin publish examples/com.third.weather \
  --index ./my-index.json \
  --download https://你的托管/com.third.weather.zip
```

> 注意：`com.third.*` 命名空间仅是示范性第三方 id；宿主只保留 `sys.*`。

## 宿主 API 速查

- `api.fetch(url)` → `{ ok, status, body, contentType }`——**唯一**网络通道，
  经宿主代理（SSRF 防护 / 30s 超时 / 2MB 上限），需声明 `net` 权限
- `api.renderList(rows)` / `api.setSubInput(placeholder)` / `api.onSubInputChange`
- 动作三型：`{ label, type: 'copy' | 'open' | 'callback', payload }`
  （copy/open 由宿主代办；callback 回 `api.onAction({ item, action })`）
- `api.preferences.all()/get/set`（需在 plugin.json 声明 preferences）
- `api.showHud(text)` / `api.notify(text)`
- 未声明的敏感 API 在运行时被**拒绝**（声明制权限，清单里的 `permissions` 是能力清单也是给用户的知情清单）

完整协议见 [PLUGIN_DEV.md](../PLUGIN_DEV.md)。

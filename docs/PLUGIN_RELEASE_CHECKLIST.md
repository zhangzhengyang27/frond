# 插件发布清单（第三方作者视角）

> 目标读者：想把插件发布给 Frond 用户用的插件作者。协议与 API 全集见
> [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md)，本文只回答一个问题：
> **从「我写好了」到「用户装上了」要做什么。**

Frond 市场没有中心化商店与审核（`DECISIONS.md` 签名一期），发布 =
**你托管两个文件，用户填一个地址**。全程不需要我们的参与。

## 前置：本地验证过了吗

- [ ] 插件能被加载（启动器 → 插件 → 开发者工具；或 devServer 热重载调试）
- [ ] `plugin.json` 的 `id` 全网唯一（建议反向域名，如 `com.yourname.tool`；
      校验规则：词字符首尾、不含 `..`、不能以 `sys.` 开头）
- [ ] 声明的每个权限（clipboard/fs/net/schedule）都是**真的需要**——安装时会逐项问用户
- [ ] [PLUGIN_QA_CHECKLIST.md](./PLUGIN_QA_CHECKLIST.md) 过一遍

## 打包（一条命令）

```bash
node scripts/make-plugin-release.mjs <你的插件目录> --download https://你的托管/插件.zip
```

产物在 `<插件目录>-release/`：

| 文件 | 用途 |
| --- | --- |
| `<id>-v<版本>.zip` | 插件包本体（zip 根 = `plugin.json` 所在层） |
| `index-entry.json` | 市场索引条目（含包体 sha256） |

脚本已经替你做了：zip 根定位、sha256（市场校验口径 = 解压前的 zip 字节流）、
与市场**同源**的索引规则校验（不合法会给原因——主进程侧是静默剔除，作者侧必须能看到原因）。

## 托管（两个 https 地址）

1. **zip 直链**：任意静态 https 托管（GitHub Releases 资产、对象存储、自己的服务器均可）。
   约束：≤ 20MB / 下载 30s 超时 / 只收 https（明文 http 与内网地址会被拒）。
2. **索引 JSON**：一个数组，把你插件的 `index-entry.json` 条目放进去即可：

   ```json
   [
     {
       "id": "com.yourname.tool",
       "name": "你的插件",
       "version": "1.0.0",
       "description": "一句话",
       "author": "你的名字",
       "download": "https://your.host/com.yourname.tool-v1.0.0.zip",
       "sha256": "打包脚本已算好"
     }
   ]
   ```

   把这个 JSON 的 https 地址发给用户。

## 用户侧（你要写给用户的安装说明）

启动器 → 插件市场 → 底部「远程索引」→ 粘贴索引地址 → 拉取 → 安装。
安装时会看到：权限清单（按 manifest 声明逐项问）、sha256 徽章（有 `sha256` 字段显示
「sha256 校验」，否则显示「未校验」——**建议永远带上 sha256**）。

## 升级新版

1. 改插件 `plugin.json` 的 `version`；
2. 重新跑打包脚本（zip 名自动带新版本号，sha256 自动重算）；
3. 更新你的索引 JSON 里的 `version` / `download` / `sha256`；
4. 用户侧：市场列表按语义化版本比对，只有**确实更新**才标「可更新」；
   更新会重新走一遍权限确认（新增权限时）。

## 常见坑（都是真会发生的）

- **条目在市场里消失不报错**：主进程对不合法条目是静默剔除（id 不合法、sha256 不是
  64 位十六进制、明文 http……）。打包脚本会在本地提前用同源规则拦住并给原因——
  信任脚本的红字，别等产品里「找不到」。
- **官方插件撞名**：远程索引条目 `id` 与打包索引同名时**直接丢弃**（防替换攻击）。
  你的 id 必须全网唯一。
- **索引落后于包**：`plugin.json` 升了版本而索引没同步，用户端不会显示「可更新」——
  两处要一起改。
- **devServer 别打进发布包**：那是本地开发字段，市场安装会忽略它。

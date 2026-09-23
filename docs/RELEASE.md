# Frond · 发布清单（Release Checklist）

发布链路：`.github/workflows/release.yml`（tag `v*` 触发，三平台构建 + GitHub Release 上传）。
CI 门禁：`.github/workflows/ci.yml`（lint / typecheck / 三平台单测 / e2e smoke）。

> **一句话现状（2026-09-20）**：构建与产物链路是通的，**签名/公证这一格等 Apple 开发者账号**
> （决策 D2 见 `docs/DECISIONS.md`）——现阶段就是发未签名产物。
> 这条线现在不用靠记性守：`pnpm run release:preflight` 会把「哪一格还没到位」直接判出来。

## 发布前自检（P-3.6）

```bash
pnpm run release:preflight              # 只报告，永远 exit 0（本地随手看）
pnpm run release:preflight -- --strict  # 有 blocking 项则 exit 1（release.yml 的构建 job 已接）
pnpm run release:preflight -- --target-only  # 只印生效的发布目标
```

判定本体是 `scripts/lib/releasePreflight.mjs`（纯函数 + `scripts/__tests__/releasePreflight.test.ts` 11 条），
两档**不能混**：

| 档 | 项 | 为什么 |
| --- | --- | --- |
| blocking | `electron-builder.yml` 的 publish 还是占位 `frond-app/frond-desktop` | 自动更新会去查一个不存在的仓库，而 `electron-builder` 本身是绿的 |
| blocking | `package.json` 版本不是 `x.y.z` / 与触发 tag 不一致 | 更新通道按版本号比大小，方向猜错就是永久卡在旧版 |
| blocking | 没有 `GH_TOKEN` / `GITHUB_TOKEN` | 产物只能躺在 CI 缓存里 |
| warning | 未签名（无 `CSC_LINK`） | 现阶段刻意如此（D2），但必须写进发布说明 |
| warning | 已签名但未公证 | 差 `APPLE_ID` / `APPLE_TEAM_ID` / `APPLE_APP_SPECIFIC_PASSWORD` |

未签名产物在用户侧的真实表现：首次打开报「已损坏 / 无法验证开发者」，要右键 → 打开；
Gatekeeper 更严的版本连右键都不给。**未签名期间不要把自动更新当主推荐路径。**

## 一次性配置（首次发布前）

1. **建远端仓库**
   ```bash
   gh repo create frond-desktop --public --source=. --push   # 或私有 --private
   ```
   开源定位见 `docs/POSITIONING.md`；仓库建好后删除本节并更新下一步。

2. **替换 publish 占位**（当前 `frond-app/frond-desktop` 是占位，不存在的组织）
   - `electron-builder.yml` → `publish.owner / publish.repo`
   - `dev-app-update.yml` → 同步替换（本地 `electron-vite` 预览态的更新源走这个文件）
   - `src/main/services/AutoUpdateService.ts` 头注释同步
   - 改完跑一次 `pnpm run release:preflight`，那条占位 blocking 应当自动消失

3. **配置签名 secrets**（macOS 签名公证；不做则 mac 产物未签名，用户需右键打开）
   | Secret | 说明 |
   | --- | --- |
   | `APPLE_ID` | Apple ID 邮箱 |
   | `APPLE_APP_SPECIFIC_PASSWORD` | appleid.apple.com → App-Specific Passwords |
   | `APPLE_TEAM_ID` | 10 位 Team ID |
   | `MAC_CSC_LINK` | Developer ID Application 证书 .p12（base64） |
   | `MAC_CSC_KEY_PASSWORD` | .p12 导出密码 |

   本地生成 .p12：
   ```bash
   security export -t cert -k "keychain login" -f pkcs12 -P "$PASS" \
     -o cert.p12 "Developer ID Application: Your Name (TEAMID)"
   base64 -i cert.p12 | pbcopy
   ```
   证书细节见 `docs/SIGNING_MAC.md`。**这五项到位即补齐「只差证书」那一格**：
   workflow 已经把这几个名字透传给 electron-builder（见 `release.yml` 的 builder step），
   签名 + 公证一起生效，preflight 的两条 warning 自动消失——不用改代码。

## 每次发布流程

```bash
# 1. 确认 CI 全绿（main 分支）
# 2. 本地先看一眼自检（此时应只剩「未签名」这条 warning）
pnpm run release:preflight
# 3. 升版本
pnpm version patch   # 或 minor / major；会改 package.json 并打 tag
# 4. 推送（tag 触发 release.yml）
git push && git push --tags
```

约束：
- **tag 必须与 package.json 版本一致**——release.yml 有守卫步骤 + preflight 双道，不一致直接失败。
- 首个版本 `v0.1.0`；1.0.0 留给正式发布。
- builder 用 `--publish=never`：产物由 publish job 统一上传，避免 electron-builder 与本 workflow 双份上传。
- 构建 job 会生成 `out/make/.../SHA256SUMS` 并随 Release 一起发出（未签名阶段唯一的完整性凭据）。

## 发布后核对

- GitHub Release 页面出现产物（当前只发 mac：dmg / zip / latest-mac.yml / SHA256SUMS）
- 校验和对得上：`shasum -a 256 -c SHA256SUMS`（在下载到的同目录下跑）
- 已装版本内「设置 → 更新」能检测到新版本（electron-updater 拉 Releases latest.yml）——
  **这条只有配上签名+公证后才算真通过**，未签名产物即使检测到也装不上干净的更新
- e2e 冒烟在本机跑一遍安装包（首启 Onboarding → 胶囊唤起 → 截图/录屏各一次）
  - 注意首启现在多了「系统权限」那一步（P-3.5），引导页共 5 屏

## 已知注意事项

- Linux snap 目标需要 runner 有 snapcraft；如失败可先从 matrix 去掉 snap。
- 非 mac 平台只跑 CI 单测矩阵、不出真机验证过的安装包（决策 D5：无 Windows 真机）；
  `release.yml` 的 matrix 里 win/linux 项已注释，恢复时记得未签名 Windows 产物同样有来源告警。
- e2e 在 CI 需 xvfb（ci.yml 已配置）；本地直接 `pnpm build && pnpm test:e2e:smoke`。
- 插件市场的完整性是另一条线：索引条目可声明 `sha256`，安装时在解压前校验、声明了就必须命中
  （见 `docs/PLUGIN_DEVELOPMENT.md`「sha256 校验和」）。两边口径一致：**声明了就当真，没声明就明说。**

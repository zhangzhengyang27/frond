# Leaf · macOS 签名与公证（SIGNING_MAC）

> **重生说明**：本文件原件与 `docs/ROUTING.md` 同在 2026-09-22 桌面删除事故中丢失，各备份池无副本
> （`HANDOFF.md:695-697`），2026-09-23 从代码重生成。目录表对本文的期望是「macOS 签名公证细节」
> （`docs/README.md:26`），`docs/RELEASE.md:61` 把证书细节指给本文。
>
> **本文的事实来源**（逐行读过）：`electron-builder.yml` · `.github/workflows/release.yml` ·
> `docs/RELEASE.md` · `scripts/lib/releasePreflight.mjs` · `scripts/release-preflight.mjs` ·
> `package.json` · `pnpm-lock.yaml` · `.gitignore` · `src/renderer/*.html`（CSP）·
> 以及 `build/entitlements.mac.plist`——**该文件在仓库中不存在**（见 §5.1）。
>
> **状态口径（重要）**：本项目**当前没有 Apple 开发者证书**。本文写成「证书一到，按这几步补完」的
> 操作文档，**不是**已完成流程的记录。判据沿用 `RELEASE.md:6-7`（「只差证书」那一格）与
> `RELEASE.md:61-63`（五项到位即补齐），**不另立口径**。
>
> **标记约定**（每条结论后必带）：
> 【码】仓库代码/配置可证实（给 `文件:行号`）｜【本机】2026-09-23 本机实测（只跑只读命令，
> **未执行任何 `codesign` / `notarytool` / 构建**）｜【未跑】需要证书或联网，本机一次都没跑过，
> **不得当作已验证**。

---

## 1. 现在到底在哪一格

| 环节 | 现状 | 证据 | 标记 |
| --- | --- | --- | --- |
| 构建产物链路 | 通：`electron-vite build` → `electron-builder --mac --publish=never` | `release.yml:71-72`、`release.yml:91`（`--publish=never` 的理由在 `:92-93`） | 【码】 |
| 产物目录 | 统一到 `out/make` | `electron-builder.yml:5-7`（注释明写「与 release.yml 的 artifact 路径保持一致」）；CI glob `release.yml:32-37` | 【码】 |
| `out/make` 实体 | 本机**不存在** | 本轮禁跑构建，`ls out/make` → `No such file or directory` | 【本机】 |
| 代码签名 | **未做**（无 `CSC_LINK`） | `releasePreflight.mjs:63,65-68` 判「未签名」为 warning；`electron-builder.yml:72-75` 只写了证书怎么给，没给 | 【码】+【未跑】 |
| 公证 | **未做**（缺三个 APPLE_* ） | `releasePreflight.mjs:64,69-70`；`electron-builder.yml:62-69` 把 `notarize: true` 打开了，但注释 `:64-67` 点明需要注入 env | 【码】+【未跑】 |
| entitlements 文件 | **缺失**（`build/` 整个目录都不在） | `electron-builder.yml:55` 指着 `build/entitlements.mac.plist`；`ls build` 与 `find . -name 'entitlements*'` 均无命中 | 【本机】 |
| 分发 | GitHub Release，只上传 `.dmg` / `.zip` | `release.yml:141-152`（`files` 在 `:148-150`） | 【码】 |
| 自动更新目标 | 仍是占位 `leaf-app/leaf-desktop` | `electron-builder.yml:93-97`；`releasePreflight.mjs:15-16,51-55` 判 blocking | 【码】 |

**本机实跑一次自检（只读，不改任何产物）**：`node scripts/release-preflight.mjs` →
「发布目标：leaf-app/leaf-desktop 版本：0.1.0」+ 两条 blocking（占位目标、无 `GH_TOKEN`）+
一条 warning「未签名（没配 CSC_LINK）」，exit 0。 【本机】

> 这条读数是本文的基准状态：**签名/公证确实只是缺凭据，但「只差证书」这句话有 5 处口径对不上，见 §8。**

---

## 2. 五项 secrets（照 `RELEASE.md:47-53` 原样，不另立口径）

| # | GitHub Secret 名 | 说明（`RELEASE.md` 原文口径） | 在 CI 里映射到哪个 env | 证据 |
| --- | --- | --- | --- | --- |
| 1 | `APPLE_ID` | Apple ID 邮箱 | `APPLE_ID` | `release.yml:83` |
| 2 | `APPLE_APP_SPECIFIC_PASSWORD` | appleid.apple.com → App-Specific Passwords | `APPLE_APP_SPECIFIC_PASSWORD` | `release.yml:84` |
| 3 | `APPLE_TEAM_ID` | 10 位 Team ID | `APPLE_TEAM_ID` | `release.yml:85` |
| 4 | `MAC_CSC_LINK` | Developer ID Application 证书 .p12（base64） | **`CSC_LINK`** | `release.yml:89` |
| 5 | `MAC_CSC_KEY_PASSWORD` | .p12 导出密码 | **`CSC_KEY_PASSWORD`** | `release.yml:90` |

三条易错点：

1. **secret 名 ≠ env 名**：mac 的证书两项在仓库里叫 `MAC_CSC_LINK` / `MAC_CSC_KEY_PASSWORD`，
   经 `release.yml:89-90` 改名喂给 electron-builder 认的 `CSC_LINK` / `CSC_KEY_PASSWORD`。
   配 secret 时写反 = 静默未签名（`releasePreflight.mjs:63` 只看 `CSC_LINK`）。 【码】
2. 判定用的是 `CSC_LINK` + `APPLE_ID` + `APPLE_TEAM_ID` + `APPLE_APP_SPECIFIC_PASSWORD`
   四个 env 名字（`releasePreflight.mjs:32,63-64,80`），**不看** GitHub secret 名。 【码】
3. 本地跑签名**不走这五项**：不给 `CSC_LINK` 时 electron-builder 自己去系统 keychain 找
   `"Developer ID Application: Your Name (TEAMID)"`（`electron-builder.yml:72-75`，本地调试公证可用
   `notarytool --store-in-keychain-profile` 持久化，注释 `:68`）。 【码】

---

## 3. 证书本体：要哪一种、怎么导出

| 项 | 结论 | 证据 / 标记 |
| --- | --- | --- |
| 类型 | **Developer ID Application**（不是 App Store 的 `3rd Party Mac Developer Application`，也不是 `Developer ID Installer`） | `RELEASE.md:52`（「Developer ID Application 证书 .p12」）与 `:58`、`release.yml:88` 的 `security export` 命令里的证书名都是这一支；`electron-builder.yml:75` 同 【码】 |
| 与 `hardenedRuntime` 的关系 | 配置里 `hardenedRuntime: true` 已开（`electron-builder.yml:70`），而公证要求签名 + hardened runtime | 该行本身【码】；「公证要求 hardened runtime」属 Apple 通用约束，**本仓库内没有文档写过** → 未证实 |
| 账号年费 / 需要什么会员 | 未证实 | 仓内无记录（`RELEASE.md:46-53` 只列凭据，不谈账号） |
| 导出 .p12 + base64 | `security export -t cert -k "keychain login" -f pkcs12 -P "$PASS" -o cert.p12 "Developer ID Application: Your Name (TEAMID)"` 然后 `base64 -i cert.p12 \| pbcopy` | 命令抄自 `RELEASE.md:55-60`；**本机没有该证书，一次没跑过** 【未跑】 |

---

## 4. 证书到位后的一次性补齐清单（按顺序做，别跳）

| 步 | 动作 | 现在为什么卡 / 依据 | 标记 |
| --- | --- | --- | --- |
| 0 | 先跑 `node scripts/release-preflight.mjs` 记基准读数 | 文档写的 `pnpm run release:preflight` 目前**跑不起来**（§8-1） | 【本机】 |
| 1 | 建 `build/entitlements.mac.plist`，内容按 §5.3 清单 | `electron-builder.yml:55` 指着它而文件不存在；`directories.buildResources: build`（`:4`）意味着整个 build 资源目录都缺（图标同理，见 §8 附注） | 【未跑】（electron-builder 对缺失路径是报错还是回落内置默认，本机未验——未证实） |
| 2 | 配 §2 的五项 secrets；确认 workflow 无需改动 | `RELEASE.md:62-63` 与 `release.yml:78-93` 的 env 块已把五个名字透传完 | 【码】 |
| 3 | 本地签名构建：`CSC_LINK=… CSC_KEY_PASSWORD=… pnpm build:mac` | 脚本链 `package.json:32` = `pnpm run build && electron-builder --mac`；`build` 内含 `typecheck`（`:22`） | 【未跑】 |
| 4 | 公证：走 §6 手工链（**先手工跑通**，再依赖 CI 自动） | `electron-builder.yml:69` `notarize: true` 让 CI 在构建内自动提交 | 【未跑】 |
| 5 | 验签与钉票校验：§7 | `gatekeeperAssess: false`（`:71`）→ 构建不会自己评估 | 【未跑】 |
| 6 | 打 tag 走 CI 出签名产物 | `RELEASE.md:65-79`（tag 与 `package.json` 版本必须一致，守卫在 `release.yml:51-58`） | 【未跑】 |
| 7 | 与签名无关但同属「能发」：把 publish 占位换成真仓库，并同步 `dev-app-update.yml` 与 `AutoUpdateService.ts` 头注释 | `RELEASE.md:40-44`；占位在 `electron-builder.yml:93-97` | 【码】 |

---

## 5. 配置逐项解释

### 5.1 `electron-builder.yml` 里与签名直接相关的五处

| 键 | 值 | 行 | 为什么这么设（有码的写码，没码的标未证实） | 本机状态 |
| --- | --- | --- | --- | --- |
| `mac.hardenedRuntime` | `true` | `:70` | 公证的前置开关（Apple 通用约束，仓内无文档 → 未证实为何开） | 【码】值 / 【未跑】效果 |
| `mac.notarize` | `true` | `:69` | 让 electron-builder 构建后自动提交公证。注释 `:63` 说走 `electron-notarize`，**实际依赖是 `@electron/notarize@2.5.0`**（`pnpm-lock.yaml:431`、作为 electron-builder 依赖 `:5425`）——注释口径旧了 | 【码】 |
| `mac.entitlementsInherit` | `build/entitlements.mac.plist` | `:55` | 「inherit」给的是 Helper 应用（每个 BrowserWindow 的渲染/helper 进程），沙箱窗要靠它才拿得到能力。本项目确实有 `sandbox: true` 的窗口（`miniWindow.ts:47`、`floatingNote.ts:129`、`launcher/window.ts:85`），主窗是 `sandbox: false`（`windows.ts:61`）→ inherit 这份不是可选项 | **文件缺失** 【本机】 |
| `mac.gatekeeperAssess` | `false` | `:71` | 值为码可证；「为什么关」仓内无注释（推测是构建机上 `spctl` 评估不可信）→ **未证实** | 【码】 |
| `mac.identity` / `forceCodeSigning` | **未配** | 全文无该键 | 依注释 `:72-75` 走 keychain 自动查找。**后果未证实**：没有 `Developer ID Application` 身份时是静默出未签名产物还是报错，本机没有证书无法判 | 【未跑】 |

### 5.2 `mac.extendInfo` 四条用途串 + 一个开关（`:56-61`）

这些串不是签名凭据，但它们进的是 `.app` 的 `Info.plist`，**改一次就要重签一次**，故与本文同条链路。

| 键 | 行 | 谁在用它（代码证据） | 不开会怎样 |
| --- | --- | --- | --- |
| `NSCameraUsageDescription` | `:57` | 录制的摄像头叠加层：`getUserMedia(constraints)` 取视频流（`useStreamManager.ts:282`、`:318`、`:338`） | TCC 首次弹权限时无文案；未实测（未证实） |
| `NSMicrophoneUsageDescription` | `:58` | 录制麦克风轨（`useStreamManager.ts:97`；`:30-31` 注释解释「系统音频 + 关麦克风」组合也必须打开 `getUserMedia`） | 同上；未实测 |
| `NSDocumentsFolderUsageDescription` | `:59` | **未证实**：全仓 `grep getPath('documents')` 无命中【本机】。合理解释是给「用户经打开/保存对话框选到文稿」的 TCC 文案，但代码里没有直接读者 | — |
| `NSDownloadsFolderUsageDescription` | `:60` | 录像落 Downloads：`app.getPath('downloads')`（`screenRecorder.ts:200`） | 同上；未实测 |
| `NSCameraUseContinuityCameraDeviceType: true` | `:61` | **未证实**：仓内无注释、无对应消费代码 | — |

### 5.3 `build/entitlements.mac.plist` 该写什么（文件缺失，下面是从代码推出来的候选清单，**全部【未跑】**）

| 候选 entitlement | 为什么要开（代码依据） | 把握 |
| --- | --- | --- |
| `com.apple.security.cs.allow-jit` / `allow-unsigned-executable-memory` | Electron + V8 的常规要求 | 通用约束，本仓库无记录 → 未证实 |
| `com.apple.security.cs.disable-library-validation` | hardened runtime 的库校验会挡住**从 asar 外单独加载的原生模块**：`better-sqlite3`（注释 `electron-builder.yml:29-30` 明写「.node 不能从 asar 内加载」）、`uiohook-napi`（全局键盘钩子，`:28`）、`@ffmpeg-installer`（自带的 ffmpeg 可执行文件，`:27`）；三者全在 `asarUnpack`（`:25-32`） | 高，但**没跑过就不算**：electron-builder 是否已替 unpacked 二进制逐个签名，未证实 |
| `com.apple.security.network.client` | OCR 的 worker 与语言包要从公网拉（`cdn.jsdelivr.net` / `unpkg.com` / `tessdata.projectnaptha.com`）。这条现在发生在**主进程**：`src/main/services/ScreenshotIndexService.ts:218` 与 `src/main/services/ClipboardHistoryService.ts:531` 的 `createWorker('chi_sim+eng')`（tesseract.js 缺省即从上述 CDN 取）。原引用 `screenshot.html:6-13` 的 CSP 随树内截图编辑器一起删了（2026-09-23，HANDOFF §11） | 中 |
| `com.apple.security.files.user-selected.read-write` + `downloads.read-write` | 与 §5.2 的 Downloads/Documents 两条用途串配套；保存对话框与录像落盘 | 中 |
| `com.apple.security.device.camera` + `audio-input` | §5.2 前两条的沙箱侧对应物 | 中（仅当相关窗口在 App Sandbox 内才需要，本项目未开 `com.apple.security.app-sandbox`，见下） |
| （刻意**不**开）`com.apple.security.app-sandbox` | 全文没出现该键；开了上述文件/网络项都得重排 | 结论：本项目走「hardened runtime + 非沙箱」这一支，与 Mac App Store 分发互斥——**未证实**是否刻意为之 |

---

## 6. 公证命令链（`notarytool` 现代写法）——**本节整段【未跑】**

证书到手后**先本地手工跑通这四步**，再让 CI 自动做。以下路径里的 `Leaf-<ver>` 形态来自
`electron-builder.yml:2`（`productName: Leaf`）与 `:77`（dmg `artifactName: ${name}-${version}.${ext}`），
`.app` 落点按 `output: out/make`（`:7`）推为 `out/make/mac/Leaf.app`——**具体子目录未跑过，属推断**。

```bash
# 0) 前置：产物已由 §4 步骤 3 签好（未签名的包公证会被直接拒）
ls out/make/*.dmg out/make/mac/Leaf.app

# 1) 一次性存凭据（只给本地调试用；CI 走环境变量，不建 profile）
xcrun notarytool store-credentials leaf-notarize \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD"

# 2) 提交并等终态（--wait 轮询到 Accepted / Invalid，省掉手写循环）
xcrun notarytool submit "out/make/Leaf-0.1.0.dmg" \
  --keychain-profile leaf-notarize --wait

# 3) 被拒时取逐文件日志（zip 与 .app 也可提交，通常三份都要分别过）
xcrun notarytool log <request-id> --keychain-profile leaf-notarize

# 4) 钉票据：staple 对 .dmg 与 .app 都做一次，离线首启才不依赖网络取票
xcrun stapler staple "out/make/Leaf-0.1.0.dmg"
xcrun stapler staple "out/make/mac/Leaf.app"
```

CI 形态**不需要**上面这四步：`notarize: true`（`electron-builder.yml:69`）+ `release.yml:83-85`
三个 env 齐了即在构建 job 内由 `@electron/notarize` 完成（`RELEASE.md:62-63` 同口径）。 【码】

**没跑过所以别当已验证的点**：
① `@electron/notarize@2.5.0` 到底给 `notarytool` 传了哪些参数（是否 `--wait`、是否 macOptions 分叉）；
② `asarUnpack` 出来的 ffmpeg / `.node` / 以及 `extraResources` 里 `plugins/` 的文件（`electron-builder.yml:33-46`）
会不会被判 `The binary is not signed` / unsupported files；
③ `.app` 与 `.dmg` 是否都要单独 submit；④ App Store 时间戳 vs 公证时间戳的差异是否影响 CI 缓存复用。
以上四项：未证实。

---

## 7. 验签与 Gatekeeper 判定（**整段【未跑】**）

```bash
codesign --verify --deep --strict --verbose=2 out/make/mac/Leaf.app
codesign -dvv --entitlements - out/make/mac/Leaf.app | sed -n '1,60p'   # 看 §5.3 那些项是否真进了 plist
spctl -a -t open --context context:primary-signature -vv out/make/Leaf-0.1.0.dmg
xcrun stapler validate out/make/Leaf-0.1.0.dmg
```

| 说明 | 依据 |
| --- | --- |
| 这四项是「证书到位后判断有没有**真**签上/钉上」的判据；本仓库当前**没有**任何自动执行它们的代码 | 全 `.github/` 无 `codesign` / `notarytool` / `stapler` 命中【本机】；`release.yml` 的 step 列表在 `:39-104` |
| 构建期不做 Gatekeeper 评估是配置显式选的 | `electron-builder.yml:71` `gatekeeperAssess: false` 【码】 |
| 未签名在用户侧的真实表现：首次打开报「已损坏 / 无法验证开发者」，要右键 → 打开；更严的 Gatekeeper 版本连右键都不给 | `RELEASE.md:29-30`（现象记录）【码】；本机无签名产物可比对 → 现象本身【未跑】 |
| 「已签名但未公证」这一档的判据 | `releasePreflight.mjs:69-70`（只在 `CSC_LINK` 有、APPLE_* 缺时冒这条 warning）【码】 |

---

## 8. 「只差证书」这句话的边界（先记账，别等证书到手才发现）

`RELEASE.md:61-63` 承诺：五项到位即补齐那一格、「不用改代码」、preflight 两条 warning 自动消失。
按代码核下来，有 **5 处口径对不上**。都不是签名本身的问题，但都在同一条链路上：

| # | 文档说法 | 代码事实 | 影响 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `RELEASE.md:13-15` 三条 `pnpm run release:preflight …` | `package.json` 的 scripts 块（`:9-35`）**没有** `release:preflight` 这一项【本机 grep 无命中】；脚本本体在（`scripts/release-preflight.mjs`），其自带用法注释也是 `node scripts/release-preflight.mjs`（`:5-8`） | 自检按文档命令跑不起来；本文 §1 用的是 node 形式 | 从未接上 or 事故丢失：未证实 |
| 2 | `RELEASE.md:14`「`release.yml` 的构建 job 已接 `--strict`」 | `release.yml` 的 step 列表（`:39-104`）里**没有** preflight step【码】 | 「不用靠记性守」这道闸目前不存在——占位目标这条 blocking 拦不住发版 | 同上 |
| 3 | `RELEASE.md:81`「构建 job 会生成 `out/make/.../SHA256SUMS` 并随 Release 一起发出」 | 全仓 `.github/` + `scripts/` + `package.json` grep `SHA256SUMS` **无命中**【本机】；`release.yml:95-96` 只 `ls -la out/make` | 「未签名阶段唯一的完整性凭据」目前没有 | 同上 |
| 4 | `RELEASE.md:85` 发布物含 `latest-mac.yml` | 上传的 `files` 只列 `dist/**/*.dmg` 与 `dist/**/*.zip`（`release.yml:148-150`），且 `fail_on_unmatched_files: true`（`:147`） | electron-updater 拿不到 yml ⇒ 自动更新链断（publish 目标本身也还是占位，`electron-builder.yml:93-97`）→ `RELEASE.md:87-89` 那句「只有配上签名+公证才算真通过」目前连前置都不满足 | 【码】 |
| 5 | `RELEASE.md:6-7,26` 把现状归为「决策 D2 见 `docs/DECISIONS.md`」 | `DECISIONS.md` 只有 `Decision-001…012`（`:5,13,27,37,47,62,73,105,128,141,152,185`），**无 D2 签名条目**【本机 grep】；`ROADMAP.md:29` 的「D2 · 插件生态」是另一回事。真正把这条决策写下来的地方是 `releasePreflight.mjs:11-12,67` 的注释 | 决策出处指错；本文按 `releasePreflight.mjs` 注释为事实来源 | 【码】 |

**结论**：证书只补齐 §1 的「签名 / 公证」两格；上 5 条要么顺手补，要么把 `RELEASE.md` 的说法改成与代码一致。
（本文只记账，不改 `RELEASE.md`，也不改代码。）

**附注（同类，与签名共享 `buildResources: build`）**：`directories.buildResources: build`（`electron-builder.yml:4`）
指向的目录不存在，且 mac 段没有 `icon:` 键【本机 `ls build` 无命中】——签名后的 `.app` 用哪套图标未证实。

---

## 9. 与签名同一条链路的打包红线（只列影响签名面的项）

| 项 | 配置 | 行 | 和签名/公证的关系 | 标记 |
| --- | --- | --- | --- | --- |
| `asarUnpack` | `resources/**`、`@ffmpeg-installer`、`uiohook-napi`、`better-sqlite3`、`bindings`、`file-uri-to-path` | `:25-32` | unpacked 出来的可执行文件与 `.node` **必须在签名覆盖范围内**，否则 hardened runtime 下加载即失败。为什么这六个要 unpack：注释 `:29-30`（`.node` 不能从 asar 内加载） | 【码】配置 / 【未跑】签名后果 |
| `extraResources` | `plugins.json → resources/plugins.json`；`plugins/ → resources/plugins/`（6 种扩展名白名单 filter） | `:33-46` | 落在 `Contents/Resources` 下的文件同样参与整体 bundle 签名；**市场包另有一套 sha256 校验**（`RELEASE.md:98-99`），两条线别混 | 【码】 |
| `files` 排除 | `docs/e2e/scripts/.github` 等目录、根 `plugins/**` 与 `plugins.json`、`*.traineddata`、`draft_*` | `:15-24` | 排除项缩小签名面；`draft_*`「绝不能随安装包分发」（注释 `:20`）。traineddata 由运行时下载（`.gitignore:17-18`） | 【码】 |
| `output` | `out/make` | `:7` | 与 CI glob `out/make/**/*.dmg` / `.zip`（`release.yml:32-37`）绑死；改了忘同步，`if-no-files-found: error`（`:104`）会让 job 直接红 | 【码】 |
| artifact 名 | dmg `${name}-${version}.${ext}`、nsis 同名形态 | `:49-50`、`:76-77` | §6/§7 命令里的文件名以此为准 | 【码】 |
| `npmRebuild: false` | `:87` | 不让 electron-builder 重编译原生模块，靠 `pnpm rebuild:native` 先编（`release.yml:63-66` → `package.json:28`） | 被签名的 `.node` 因此是 **pnpm 的产物**，非 builder 产物：换机器/换缓存时签名对象可能变 | 【码】+【未跑】 |
| `electronDownload.mirror` | `https://npmmirror.com/mirrors/electron/` | `:98-99` | CI 的 electron 二进制走第三方镜像（全文 99 行，无 checksum / verify 类键）。与签名无关但同属分发可信度，顺手记 | 【码】+【未跑】 |
| matrix 只有 mac | `release.yml:29-37`（win/linux 项被注释掉，原因见 `:25-28` 与 `RELEASE.md:95-96`） | — | 现阶段公证只有一条链路要管 | 【码】 |

---

## 10. 未证实清单（合并，便于证书到手后逐条消）

1. **`build/entitlements.mac.plist` 缺失时 electron-builder 的实际行为**（报错 / 回落内置默认）——未证实。
2. §5.1 `mac.identity` 未配且 keychain 无匹配身份时的行为（静默未签名 or 失败）——未证实。
3. §5.1 `gatekeeperAssess: false` 与 §5.2 `NSCameraUseContinuityCameraDeviceType`、
   `NSDocumentsFolderUsageDescription` 的**设立动机**——仓内无依据，未证实。
4. §5.3 全部 entitlement 候选：一条都没在本机验证过是否需要（未跑构建、未跑 `codesign -d --entitlements`）。
5. §6 四项（notarytool 参数、unpacked 二进制是否被拒、`.app`/`.dmg` 是否分别 submit、时间戳差异影响）——未证实。
6. §7 四条校验命令的实际输出——未跑。
7. Apple 开发者账号的类型/年费要求——仓内无记录，未证实。
8. §8 表头 5 条：「从未接上」还是「2026-09-22 事故连带丢失」——无法从当前树判定，未证实。

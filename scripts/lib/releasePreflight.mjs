/**
 * 发布链路自检（P-3.6）· 纯判定部分
 *
 * 为什么存在：仓库还没有真的发布目标（`electron-builder.yml` 的 publish 是占位
 * `frond-app/frond-desktop`），也没有 Apple 开发者账号。这两件事在产品里表现为
 * 「自动更新永远查不到东西」和「下载下来 macOS 报已损坏」，而构建本身是**绿的**——
 * 绿色不代表能发。所以把判定写成显式的一档：
 *   blocking = 不能发（占位目标 / 版本不合法 / 没有上传用的 token）
 *   warnings = 能发，但必须对用户说清楚（未签名 / 已签名未公证）
 * 签名这一档按 D2（无账号）刻意不算 blocking：现阶段就是发未签名产物，
 * 等账号到位把 CSC_LINK 配上，warnings 自己会少一条。
 */

/** 还没换成真仓库之前，构建可以跑、发布不能过的占位目标 */
export const PLACEHOLDER_PUBLISH = { owner: 'frond-app', repo: 'frond-desktop' }

export function isPlaceholderTarget(owner, repo) {
  return owner === PLACEHOLDER_PUBLISH.owner && repo === PLACEHOLDER_PUBLISH.repo
}

/** 版本号必须是 x.y.z（可带 prerelease），且 tag 要能对得上 */
export function parseReleaseVersion(version) {
  if (typeof version !== 'string') return null
  const m = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(version.trim())
  return m ? m[1] : null
}

/**
 * @param input.owner / input.repo electron-builder.yml 里生效的 publish 目标
 * @param input.version package.json 的版本
 * @param input.tag 触发发布的 tag（没有就跳过 tag 一致性检查）
 * @param input.env 构建环境（看 CSC_LINK / APPLE_ID / APPLE_TEAM_ID / GH_TOKEN / GITHUB_TOKEN）
 * @param input.platform 目标平台（非 mac 没有签名/公证这一档）
 */
export function evaluateReleaseReadiness(input) {
  const { owner, repo, version, tag, env = {}, platform = 'mac' } = input
  const blocking = []
  const warnings = []

  const semver = parseReleaseVersion(version)
  if (!semver) blocking.push(`package.json version「${version}」不是 x.y.z 形态`)
  if (tag) {
    const tagVersion = parseReleaseVersion(tag)
    if (!tagVersion) blocking.push(`tag「${tag}」不是 vX.Y.Z 形态`)
    else if (semver && tagVersion !== semver)
      blocking.push(`tag v${tagVersion} 与 package.json 的 ${semver} 不一致`)
  }

  if (!owner || !repo) {
    blocking.push('electron-builder.yml 的 publish 缺 owner/repo')
  } else if (isPlaceholderTarget(owner, repo)) {
    blocking.push(
      `发布目标仍是占位 ${PLACEHOLDER_PUBLISH.owner}/${PLACEHOLDER_PUBLISH.repo}——` +
        '自动更新会去查一个不存在的仓库。改成真仓库后再发'
    )
  }

  if (!env.GH_TOKEN && !env.GITHUB_TOKEN) {
    blocking.push('没有 GH_TOKEN / GITHUB_TOKEN，产物传不上 Release')
  }

  if (platform === 'mac') {
    const signed = !!env.CSC_LINK
    const notaryReady = !!env.APPLE_ID && !!env.APPLE_TEAM_ID && !!env.APPLE_APP_SPECIFIC_PASSWORD
    if (!signed) {
      warnings.push(
        '未签名（没配 CSC_LINK）：用户首次打开要右键 → 打开，且自动更新的信任链不完整（D2 现状）'
      )
    } else if (!notaryReady) {
      warnings.push('已签名但未公证（缺 APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD）')
    }
  }

  return {
    ok: blocking.length === 0,
    blocking,
    warnings,
    version: semver,
    target: owner && repo ? `${owner}/${repo}` : null,
    signed: platform === 'mac' ? !!env.CSC_LINK : null
  }
}

/**
 * 从 electron-builder.yml 里取生效的 publish 目标。
 * 只认我们自己这份配置的形态：`publish:` 块下的扁平 `key: value`（缩进两格），
 * 遇到下一个顶格 key 结束。没有引 yaml 依赖，就为一个四行块装个解析器不值当。
 */
export function readPublishTarget(ymlText) {
  const lines = String(ymlText).split(/\r?\n/)
  let inPublish = false
  const out = {}
  for (const raw of lines) {
    if (/^publish:\s*$/.test(raw)) {
      inPublish = true
      continue
    }
    if (!inPublish) continue
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue
    if (/^\S/.test(raw)) break // 顶格 = publish 块结束
    const m = /^ {2}(\w+):\s*(.*)$/.exec(raw)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return { provider: out.provider ?? null, owner: out.owner ?? null, repo: out.repo ?? null }
}

/**
 * 发布资产自检（P1-6）
 *
 * 为什么需要：`electron-builder.yml` 里的 `build/...` 路径是**字符串引用**，
 * 文件不存在时 electron-builder 要么直接报错、要么悄悄退回默认图标 —— 而
 * `pnpm typecheck && pnpm build` 在这种状态下**照样是绿的**。实测事故形态：
 * `mac.entitlementsInherit: build/entitlements.mac.plist` 指向一个不存在的
 * `build/` 目录（HANDOFF 说「只差证书」，其实还差 entitlements 四件套 + 图标）。
 *
 * 判据刻意**从 yml 反解**而不是硬编码清单：以后往 yml 里加一个 `build/xxx`
 * 引用，自检自动跟着要求它存在，不会漏。
 */

/** 从 yml 文本里取出所有 `build/...` 形态的资产引用（去重、保序） */
export function readReferencedBuildAssets(ymlText) {
  const out = []
  for (const m of String(ymlText).matchAll(/(?:^|[\s:'"])(build\/[A-Za-z0-9._/-]+)/g)) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

/**
 * 除 yml 引用的资产外，还必须有根 LICENSE。
 * electron-builder 会把它打进安装包；仓库无 LICENSE 时 README 的链接指向空，
 * 而且 MIT 的「保留版权声明」要求随分发物一起给出。
 */
export const REQUIRED_ROOT_ASSETS = ['LICENSE']

/**
 * @param exists (relPath) => boolean —— 注入以便单测，不碰真实文件系统
 * @param referenced yml 里引用的 build/* 路径
 */
export function checkReleaseAssets(exists, referenced = []) {
  const required = [...REQUIRED_ROOT_ASSETS, ...referenced]
  const missing = required.filter((rel) => !exists(rel))
  return { required, missing }
}


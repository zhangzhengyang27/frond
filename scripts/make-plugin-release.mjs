#!/usr/bin/env node
/**
 * Frond · 插件发布打包器（第三方作者 0→1 的最后一公里）
 *
 * 用法：
 *   node scripts/make-plugin-release.mjs <plugin-dir> [--download https://host/x.zip] [--out <dir>]
 *
 * 做四件事：
 *   1. 读 <plugin-dir>/plugin.json 并按市场规则校验（id/name/version）；
 *   2. 把插件目录打成 zip（zip 根 = plugin.json 所在层，市场解压后能定位清单）；
 *   3. 计算 zip 的 sha256（市场「sha256 校验」徽章的来源；不声明则显示「未校验」）；
 *   4. 生成市场索引条目 JSON（与 market.ts 静默剔除规则同源，这里给原因不给惊喜）。
 *
 * 产物：<out>/<id>-v<version>.zip + index-entry.json。--download 填最终托管地址；
 * 不填则条目里是 https://TODO.replace.me/... 占位——发布前必须换成真地址。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { buildIndexEntry } from './lib/makePluginRelease.mjs'

const args = process.argv.slice(2)
const pluginDir = resolve(args.find((a) => !a.startsWith('--')) ?? '')
const downloadIdx = args.indexOf('--download')
const downloadUrl = downloadIdx >= 0 ? args[downloadIdx + 1] : 'https://TODO.replace.me/your-plugin.zip'
const outIdx = args.indexOf('--out')
const outDir = resolve(outIdx >= 0 ? args[outIdx + 1] : `${pluginDir}-release`)

function die(msg) {
  console.error(`make-plugin-release: ${msg}`)
  process.exit(1)
}

if (!pluginDir || !existsSync(pluginDir)) die(`插件目录不存在：${pluginDir}`)
const manifestPath = join(pluginDir, 'plugin.json')
if (!existsSync(manifestPath)) die(`找不到 ${manifestPath}（zip 根必须是 plugin.json 所在层）`)

let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (e) {
  die(`plugin.json 解析失败：${e.message}`)
}

// ── 1. 市场规则校验（静默剔除规则在这里提前给原因）──
const issues = []
if (manifest.devServer) {
  issues.push('plugin.json 带 devServer：市场安装会忽略它，发布包不需要（仅本地开发用）')
}
if (manifest.id !== manifest.id?.trim() || manifest.name !== manifest.name?.trim()) {
  issues.push('id/name 有首尾空白：与校验规则不符')
}

// ── 2. 打 zip（macOS 自带 zip；zip 根 = plugin.json 所在层）──
mkdirSync(outDir, { recursive: true })
const version = manifest.version ? `-v${manifest.version}` : ''
const zipName = `${manifest.id}${version}.zip`
const zipPath = join(outDir, zipName)
try {
  execFileSync('zip', ['-rq', zipPath, '.', '-x', 'release/*', '-x', '*.DS_Store'], {
    cwd: pluginDir,
    stdio: 'pipe'
  })
} catch (e) {
  die(`zip 失败（需要 macOS 自带 zip）：${e.message}`)
}

// ── 3. sha256（包体摘要，与市场校验同口径：解压前的 zip 字节流）──
const sha256 = createHash('sha256').update(readFileSync(zipPath)).digest('hex')

// ── 4. 索引条目（download 默认占位，发布前必须替换成真托管地址）──
const built = buildIndexEntry({
  id: manifest.id,
  name: manifest.name,
  version: manifest.version,
  description: manifest.description,
  author: manifest.author,
  download: downloadUrl.replace(/<zipname>/g, zipName),
  sha256
})
if (built.error) die(`索引条目被市场规则拒绝：${built.error}`)

const entryPath = join(outDir, 'index-entry.json')
writeFileSync(entryPath, `${JSON.stringify(built.entry, null, 2)}\n`)

const mb = (statSync(zipPath).size / 1024 / 1024).toFixed(1)
console.log(`✅ 打包完成 → ${outDir}`)
console.log(`   ${zipName} (${mb} MB，市场上限 20MB / 下载超时 30s)`)
console.log(`   index-entry.json：`)
console.log(JSON.stringify(built.entry, null, 2))
for (const w of issues) console.log(`⚠️  ${w}`)
if (!downloadUrl.includes('TODO')) {
  console.log('发布：把 zip 与 index-entry.json 里的 download 地址对上后托管到 https，')
  console.log('再把含该条目的索引 JSON 地址发给用户（启动器 → 插件市场 → 远程索引）。')
} else {
  console.log('⚠️  download 还是占位地址：重新运行时用 --download https://你的托管/x.zip')
}

#!/usr/bin/env node
/**
 * frond-plugin · 第三方插件开发者 CLI（P-3 3.3 核心回路）
 *
 *   frond-plugin init <name> [--dir <dir>] [--author <you>] [--id <com.you.name>]
 *   frond-plugin pack  <dir> [--out <dir>] [--download <https://.../x.zip>]
 *   frond-plugin publish <dir> --index <index.json> --download <https://.../x.zip> [--keep-zip <dir>]
 *   frond-plugin open  <what>          # scripts → 打开本机脚本命令目录（便利指令）
 *
 * pack 复用 scripts/make-plugin-release.mjs 的同源校验与条目构造；
 * publish 把条目 upsert 进自建索引 JSON（远程索引形态，宿主已可消费）。
 * 零依赖：zip 用系统 zip（mac/linux）或 PowerShell（win）。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  buildIndexEntry,
  normalizeInit,
  normalizePublish,
  renderScaffold,
  upsertEntry
} from './lib.mjs'

function die(msg) {
  console.error(`frond-plugin: ${msg}`)
  process.exit(1)
}

function argOf(args, flag) {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

function zipDir(pluginDir, zipPath) {
  if (process.platform === 'win32') {
    // PowerShell 压缩要求目标目录存在；zip 根 = plugin.json 所在层
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Compress-Archive -Path '${pluginDir}\\*' -DestinationPath '${zipPath}' -Force`
      ],
      { stdio: 'pipe' }
    )
    return
  }
  execFileSync('zip', ['-rq', zipPath, '.', '-x', 'release/*', '-x', '*.DS_Store'], {
    cwd: pluginDir,
    stdio: 'pipe'
  })
}

const [, , cmd, ...rest] = process.argv

if (cmd === 'init') {
  const positional = rest.find((a) => !a.startsWith('--'))
  const parsed = normalizeInit({
    name: positional ?? argOf(rest, '--name'),
    dir: argOf(rest, '--dir'),
    author: argOf(rest, '--author'),
    id: argOf(rest, '--id')
  })
  if (parsed.error) die(parsed.error)
  const target = resolve(parsed.dir)
  if (existsSync(target)) die(`目录已存在：${target}`)
  const { manifest, html, readme } = renderScaffold(parsed)
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(join(target, 'index.html'), html)
  writeFileSync(join(target, 'README.md'), readme)
  console.log(`✅ 脚手架完成 → ${target}`)
  console.log('下一步：')
  console.log(`  1. 启动 Frond → 插件中心/设置 → 开发插件 → 导入目录 ${target}（保存文件自动热重载）`)
  console.log('  2. 改 index.html / plugin.json（命令、偏好、权限声明见 PLUGIN_DEV.md）')
  console.log(`  3. 发布：frond-plugin publish ${parsed.dir} --index ./my-index.json --download https://你的托管/${parsed.id}.zip`)
  process.exit(0)
}

if (cmd === 'pack') {
  const pluginDir = resolve(rest.find((a) => !a.startsWith('--')) ?? '')
  if (!pluginDir || !existsSync(pluginDir)) die(`插件目录不存在：${pluginDir}`)
  const outDir = resolve(argOf(rest, '--out') ?? `${pluginDir}-release`)
  const manifest = JSON.parse(readFileSync(join(pluginDir, 'plugin.json'), 'utf8'))
  mkdirSync(outDir, { recursive: true })
  const version = manifest.version ? `-v${manifest.version}` : ''
  const zipPath = join(outDir, `${manifest.id}${version}.zip`)
  zipDir(pluginDir, zipPath)
  const sha256 = createHash('sha256').update(readFileSync(zipPath)).digest('hex')
  const built = buildIndexEntry({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    download: (argOf(rest, '--download') ?? 'https://TODO.replace.me/<zipname>').replace(
      /<zipname>/g,
      `${manifest.id}${version}.zip`
    ),
    sha256
  })
  if (built.error) die(built.error)
  writeFileSync(join(outDir, 'index-entry.json'), `${JSON.stringify(built.entry, null, 2)}\n`)
  console.log(`✅ 打包完成 → ${zipPath}（${(statSync(zipPath).size / 1024 / 1024).toFixed(1)} MB）`)
  console.log(`   sha256: ${sha256}`)
  console.log(`   索引条目 → ${join(outDir, 'index-entry.json')}`)
  process.exit(0)
}

if (cmd === 'publish') {
  const pluginDir = resolve(rest.find((a) => !a.startsWith('--')) ?? '')
  if (!pluginDir || !existsSync(pluginDir)) die(`插件目录不存在：${pluginDir}`)
  const manifestPath = join(pluginDir, 'plugin.json')
  if (!existsSync(manifestPath)) die(`找不到 ${manifestPath}`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const pub = normalizePublish({ download: argOf(rest, '--download') })
  if (pub.error) die(pub.error)

  // 打 zip 到临时目录 → sha256 → 条目
  const tmp = `${pluginDir}-publish-tmp-${process.pid}`
  mkdirSync(tmp, { recursive: true })
  const version = manifest.version ? `-v${manifest.version}` : ''
  const zipPath = join(tmp, `${manifest.id}${version}.zip`)
  zipDir(pluginDir, zipPath)
  const sha256 = createHash('sha256').update(readFileSync(zipPath)).digest('hex')
  const built = buildIndexEntry({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    download: pub.download,
    sha256
  })
  if (built.error) {
    rmSync(tmp, { recursive: true, force: true })
    die(built.error)
  }

  // 产物落位：zip 拷到 keep-zip（缺省 pluginDir-release/），条目 upsert 进索引
  const keep = resolve(argOf(rest, '--keep-zip') ?? `${pluginDir}-release`)
  mkdirSync(keep, { recursive: true })
  const finalZip = join(keep, `${manifest.id}${version}.zip`)
  writeFileSync(finalZip, readFileSync(zipPath))
  rmSync(tmp, { recursive: true, force: true })

  const indexPath = resolve(argOf(rest, '--index') ?? die('--index 缺失：自建索引 JSON 路径'))
  const before = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : ''
  const after = upsertEntry(before, built.entry)
  // 原子替换：先写临时文件再 rename，中途崩溃不留截断索引
  const tmpIndex = `${indexPath}.tmp-${process.pid}`
  writeFileSync(tmpIndex, after)
  renameSync(tmpIndex, indexPath)

  console.log(`✅ 已发布到索引 → ${indexPath}`)
  console.log(`   zip（托管这个）→ ${finalZip}`)
  console.log(`   download    → ${pub.download}`)
  console.log('   把 zip 传到 download 地址、索引 JSON 传到 https，用户在「插件市场 → 远程索引」填地址即可安装。')
  process.exit(0)
}

console.log(`frond-plugin · Frond 插件开发者 CLI

用法：
  frond-plugin init <name> [--dir <dir>] [--author <you>] [--id <com.you.name>]
  frond-plugin pack  <dir> [--out <dir>] [--download <https://.../x.zip>]
  frond-plugin publish <dir> --index <index.json> --download <https://.../x.zip> [--keep-zip <dir>]

0→1 全流程见包内 README.md（English）。`)
process.exit(cmd ? 1 : 0)

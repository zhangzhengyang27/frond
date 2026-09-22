#!/usr/bin/env node
/**
 * 发布前自检（P-3.6）· CLI
 *
 * 用法：
 *   node scripts/release-preflight.mjs            # 只报告，永远 exit 0（本地随手看）
 *   node scripts/release-preflight.mjs --strict   # 有 blocking 就 exit 1（CI 发布前跑）
 *   ... --target-only                             # 只印生效的发布目标（脚本用）
 *
 * 存在的意义：`pnpm build:mac` 在**发布目标还是占位、产物没签名**的时候同样是绿的，
 * 而这两种状态下发出去的东西要么更新不到、要么被 macOS 判「已损坏」。
 * 判定本体在 scripts/lib/releasePreflight.mjs（纯函数 + 单测），这里只做输入装配。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateReleaseReadiness, readPublishTarget } from './lib/releasePreflight.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict')
const targetOnly = process.argv.includes('--target-only')

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
const target = readPublishTarget(readFileSync(join(ROOT, 'electron-builder.yml'), 'utf-8'))

if (targetOnly) {
  console.log(target.owner && target.repo ? `${target.owner}/${target.repo}` : '')
  process.exit(0)
}

const result = evaluateReleaseReadiness({
  owner: target.owner,
  repo: target.repo,
  version: pkg.version,
  tag: process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME.startsWith('v')
    ? process.env.GITHUB_REF_NAME
    : '',
  env: process.env,
  platform: process.platform === 'darwin' ? 'mac' : process.platform
})

console.log(`发布目标：${result.target ?? '（未配置）'}　版本：${result.version ?? pkg.version}`)
for (const line of result.blocking) console.log(`✗ ${line}`)
for (const line of result.warnings) console.log(`! ${line}`)
if (result.ok && result.warnings.length === 0) console.log('✓ 发布链路就绪（目标已配置、已签名并公证）')
else if (result.ok) console.log('✓ 可以发布（上面 ! 的几项要在发布说明里讲清楚）')

if (strict && !result.ok) {
  console.error(`\n${result.blocking.length} 项阻塞，发布不予放行`)
  process.exit(1)
}

/**
 * Frond · HEIC/HEIF → PNG（2026-09-23 重建件：原件全盘无副本）
 *
 * `frond-file://` 协议遇到 iPhone 拍的原图要把 HEIC 转成浏览器认的格式。
 * 走 macOS 自带的 `sips`（`ipc/applications.ts` 的 icns→png 同一手法），不引新依赖。
 * 结果按「路径 + 修改时间」缓存到临时目录：同一张图重复加载只转一次，图被换掉则自然失效。
 */
import { execFile } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { extname, join } from 'path'
import { promisify } from 'util'

const run = promisify(execFile)

const HEIC_EXTENSIONS = new Set(['.heic', '.heif', '.hif'])

export function isHeicPath(filePath: string): boolean {
  return HEIC_EXTENSIONS.has(extname(filePath).toLowerCase())
}

function cachePathFor(filePath: string): string {
  const { mtimeMs, size } = statSync(filePath)
  const key = createHash('sha1').update(`${filePath}:${mtimeMs}:${size}`).digest('hex')
  return join(tmpdir(), `frond-heic-${key}.png`)
}

/** 转成 PNG 并返回其绝对路径；源文件不存在或 sips 失败都抛出，由调用方决定回什么状态码 */
export async function convertHeicToPng(filePath: string): Promise<string> {
  if (!existsSync(filePath)) throw new Error(`源文件不存在：${filePath}`)
  const out = cachePathFor(filePath)
  if (existsSync(out)) return out
  await run('sips', ['-s', 'format', 'png', filePath, '--out', out], { timeout: 15000 })
  if (!existsSync(out)) throw new Error(`sips 未产出文件：${out}`)
  return out
}

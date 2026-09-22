/**
 * Leaf · openPath 安全校验
 *
 * shell.openPath 会以系统默认程序打开目标：对被攻陷的渲染进程而言，
 * 任意路径 openPath ≈ 启动任意脚本/可执行文件。openPath 通道的语义是
 * 「打开本应用产出的内容（图片/视频/文档/目录）」，因此：
 * - 必须是存在的绝对路径，且为文件或目录
 * - 拒绝可直接执行的脚本/安装包类型（内容通道不承担启动职责；
 *   启动应用走 launch-application，其有独立的扩展名白名单）
 */
import { isAbsolute, extname } from 'path'
import { existsSync, statSync } from 'fs'

/** 打开即执行的文件类型（openPath 内容通道不放行；.app 由 launch-application 白名单管） */
const EXECUTABLE_EXTENSIONS = new Set([
  '.sh',
  '.bash',
  '.zsh',
  '.command',
  '.scpt',
  '.scptd',
  '.workflow',
  '.terminal',
  '.exe',
  '.bat',
  '.cmd',
  '.ps1',
  '.vbs',
  '.msi',
  '.app',
  '.jar',
  // 可执行的是「目录形态」的 bundle（.app 是目录，isFile 检查拦不住——审查 I-8）
  '.bundle',
  '.xpc',
  '.framework',
  '.kext',
  '.appex',
  '.plugin'
])

/** 通过校验返回原路径；否则返回 null（调用方拒绝操作并记日志） */
export function safeOpenablePath(p: unknown): string | null {
  if (typeof p !== 'string' || p.length === 0) return null
  if (!isAbsolute(p)) return null
  if (!existsSync(p)) return null
  // 扩展名黑名单对文件与目录都生效：.app/.bundle 等是目录形态的
  // 可执行 bundle，曾被 isFile 短路放行（审查 I-8）
  if (EXECUTABLE_EXTENSIONS.has(extname(p).toLowerCase())) return null
  let stat
  try {
    stat = statSync(p)
  } catch {
    return null
  }
  if (!stat.isFile() && !stat.isDirectory()) return null
  return p
}

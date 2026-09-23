/**
 * Frond · 录制保存路径签发登记
 *
 * 录制文件的目标路径由主进程签发（默认下载目录 / 保存对话框），渲染端只是回传。
 * 写盘类 IPC（beginWrite / saveFile）必须只接受主进程签发过的路径，否则被攻陷的
 * 渲染进程可用任意 filePath 截断、覆盖、删除任意文件。
 *
 * 不用目录白名单：用户在对话框里可以选任意目录，白名单会把合法流程挡掉。
 * 签发路径用完（endWrite / saveFile 完成 / abortWrite）即撤销；保留有限条目
 * 防止无限增长。
 */
import { resolve, extname } from 'path'

const MAX_GRANTS = 32
const granted: string[] = []

function normalize(filePath: string): string {
  return resolve(filePath)
}

/** 主进程签发路径时登记；同时登记渲染端可能补正出的 .webm 变体 */
export function grantRecordingSavePath(filePath: string): void {
  const candidates = new Set<string>([normalize(filePath)])
  if (!filePath.toLowerCase().endsWith('.webm')) {
    candidates.add(normalize(`${filePath}.webm`))
  }
  for (const p of candidates) {
    const idx = granted.indexOf(p)
    if (idx >= 0) granted.splice(idx, 1)
    granted.push(p)
  }
  while (granted.length > MAX_GRANTS) granted.shift()
}

/**
 * 校验渲染端回传的路径是否是签发过的；通过则返回规范化绝对路径，否则 null。
 * 额外要求扩展名在允许集合内（默认 .webm = MediaRecorder 唯一产出的容器），
 * 进一步缩小可写面。导出类通道（mp4/webm/gif 输出）传自定义白名单。
 */
export function resolveGrantedRecordingPath(
  filePath: unknown,
  allowedExtensions: string[] = ['.webm']
): string | null {
  if (typeof filePath !== 'string' || filePath.length === 0) return null
  const p = normalize(filePath)
  if (!allowedExtensions.includes(extname(p).toLowerCase())) return null
  return granted.includes(p) ? p : null
}

/** 写盘会话结束后撤销授权 */
export function revokeRecordingSavePath(filePath: string): void {
  const p = normalize(filePath)
  const idx = granted.indexOf(p)
  if (idx >= 0) granted.splice(idx, 1)
}

/** 仅测试用：清空登记 */
export function __resetRecordingSavePathGrants(): void {
  granted.length = 0
}

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** AppleScript 字符串字面量转义：用户输入不许当代码拼进脚本（无 shell，但脚本层仍可注入） */
function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Frond · macOS 原生输入框（osascript `display dialog ... default answer`）
 *
 * 片段占位符展开时向用户取值。取消 → osascript 非零退出 → 返回 null，调用方据此放弃整次展开。
 * 不设 timeout：display dialog 本就阻塞到用户作答，超时等于替用户取消。
 * 非 macOS 上 osascript 不存在，execFile 失败同样落到 null（Windows 等价物本期不做）。
 */
export async function showInputBox(opts: {
  title: string
  message: string
  default?: string
}): Promise<string | null> {
  const script =
    `display dialog ${quote(opts.message)} default answer ${quote(opts.default ?? '')} ` +
    `with title ${quote(opts.title)} buttons {"取消", "确定"} default button "确定"`
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script])
    // 输出格式：button returned:确定, text returned:用户输入\n
    const match = stdout.match(/text returned:(.*)/)
    if (match) {
      // 只去掉末尾换行，保留用户输入的首尾空格
      return match[1].replace(/\n$/, '')
    }
    return ''
  } catch {
    // 用户取消时 osascript 返回非零退出码（error -128）
    return null
  }
}

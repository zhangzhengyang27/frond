/**
 * Frond · 系统信息服务（阶段3.3a）
 *
 * 获取 CPU、内存、磁盘、系统版本等信息，供启动器「系统信息」命令展示。
 * macOS 下通过 sysctl / vm_stat / df 等命令获取。
 */
import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'
import { ipcMain } from 'electron'

const execAsync = promisify(exec)

export interface SystemInfo {
  /** 系统版本（macOS 14.5） */
  osVersion: string
  /** 芯片型号（Apple M3 Pro / Intel Core i7） */
  chip: string
  /** CPU 核心数 */
  cpuCores: number
  /** CPU 使用率（%） */
  cpuUsage: number
  /** 总内存（GB） */
  memoryTotal: number
  /** 已用内存（GB） */
  memoryUsed: number
  /** 内存使用率（%） */
  memoryUsage: number
  /** 磁盘总容量（GB） */
  diskTotal: number
  /** 磁盘已用（GB） */
  diskUsed: number
  /** 磁盘使用率（%） */
  diskUsage: number
  /** 开机时间（小时） */
  uptimeHours: number
  /** 主机名 */
  hostname: string
}

/** 获取 macOS 系统版本 */
async function getMacOSVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync('sw_vers -productVersion')
    return `macOS ${stdout.trim()}`
  } catch {
    return `macOS ${os.release()}`
  }
}

/** 获取芯片型号 */
async function getChip(): Promise<string> {
  try {
    const { stdout } = await execAsync('sysctl -n machdep.cpu.brand_string')
    return stdout.trim()
  } catch {
    try {
      const { stdout } = await execAsync('sysctl -n hw.model')
      return stdout.trim()
    } catch {
      return os.arch()
    }
  }
}

/** 获取 CPU 使用率（%）
 *  macOS top -l 1 返回的是自启动以来的平均值，需要 -l 2 取第二次采样才是实时值。
 *  用 -n 0 不显示进程，-s 0 无延迟，加快速度。
 */
async function getCpuUsage(): Promise<number> {
  try {
    // -l 2: 两次采样，取第二次；-n 0: 不显示进程；-s 0: 采样间隔 0 秒
    const { stdout } = await execAsync('top -l 2 -n 0 -s 0 | grep "CPU usage" | tail -1')
    const match = stdout.match(/(\d+\.\d+)% user,\s*(\d+\.\d+)% sys/)
    if (match) {
      const user = parseFloat(match[1])
      const sys = parseFloat(match[2])
      return Math.round((user + sys) * 10) / 10
    }
  } catch {
    /* fallback 到 os.cpus() */
  }
  // fallback：os.cpus() 返回累计值，只能给出自启动以来的平均使用率
  const cpus = os.cpus()
  const idle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0)
  const total = cpus.reduce(
    (sum, cpu) =>
      sum + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq,
    0
  )
  return Math.round((1 - idle / total) * 1000) / 10
}

/** 获取内存信息（GB） */
async function getMemoryInfo(): Promise<{ total: number; used: number; usage: number }> {
  const total = os.totalmem() / 1024 ** 3
  const free = os.freemem() / 1024 ** 3
  const used = total - free
  const usage = Math.round((used / total) * 1000) / 10
  return { total: Math.round(total * 10) / 10, used: Math.round(used * 10) / 10, usage }
}

/** 获取磁盘信息（GB，主分区） */
async function getDiskInfo(): Promise<{ total: number; used: number; usage: number }> {
  try {
    const { stdout } = await execAsync('df -h / | tail -1')
    const parts = stdout.trim().split(/\s+/)
    // Filesystem Size Used Avail Capacity Mounted
    const totalStr = parts[1] // e.g. "460Gi"
    const usedStr = parts[2] // e.g. "230Gi"
    const usageStr = parts[4] // e.g. "50%"
    const parseSize = (s: string): number => {
      const num = parseFloat(s)
      if (s.includes('Ti')) return num * 1024
      if (s.includes('Gi')) return num
      if (s.includes('Mi')) return num / 1024
      return num
    }
    return {
      total: Math.round(parseSize(totalStr) * 10) / 10,
      used: Math.round(parseSize(usedStr) * 10) / 10,
      usage: parseInt(usageStr) || 0
    }
  } catch {
    return { total: 0, used: 0, usage: 0 }
  }
}

/** 获取完整系统信息 */
export async function getSystemInfo(): Promise<SystemInfo> {
  const [osVersion, chip, cpuUsage, memory, disk] = await Promise.all([
    getMacOSVersion(),
    getChip(),
    getCpuUsage(),
    getMemoryInfo(),
    getDiskInfo()
  ])

  return {
    osVersion,
    chip,
    cpuCores: os.cpus().length,
    cpuUsage,
    memoryTotal: memory.total,
    memoryUsed: memory.used,
    memoryUsage: memory.usage,
    diskTotal: disk.total,
    diskUsed: disk.used,
    diskUsage: disk.usage,
    uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
    hostname: os.hostname()
  }
}

/** 注册系统信息 IPC */
export function registerSystemInfoIpc(): void {
  ipcMain.handle('system:hardware', async () => {
    return getSystemInfo()
  })
}

/**
 * Frond · Espanso 片段导入（P-3 文本扩展三件套之三）
 *
 * Espanso（espanso.org）的 match 文件是 YAML：
 *   matches:
 *     - trigger: ":sig"
 *       replace: "{{date}}/{{name}}"
 *       vars:
 *         - name: date
 *           type: date
 *           params: { format: "%Y-%m-%d" }
 *
 * 映射规则（v1，诚实边界）：
 * - trigger → Frond 触发词原样保留；replace → 片段内容（YAML 块标量多行照收）
 * - date 型 var（strftime format）→ {date:Frond 格式}（常用 token 映射，未知 token 原样保留并警告）
 * - clipboard 型 var → {clipboard}
 * - 其余 var（form/shell/script 等在 Frond 无对应物）→ 保留 {{name}}，即 Frond
 *   的用户输入动态参数（展开时弹表单），并警告降级
 * - 无 trigger / replace 非字符串 → 跳过该条并警告
 *
 * 本文件被 ipc-contract 以类型引用带进 web tsconfig 程序（SnippetTransferService 同款），
 * 因此只允许纯 JS 依赖（yaml）与纯逻辑，不得 import electron / node 模块 / 仓库实现。
 */
import { parse as parseYaml } from 'yaml'
import type { ExportedSnippet } from './SnippetTransferService'

export interface EspansoImportItem {
  name: string
  trigger: string
  content: string
}

export interface EspansoParseOutcome {
  items: EspansoImportItem[]
  warnings: string[]
}

/** strftime → dayjs 风格 token（expansionTemplate.formatDate 的口径）常用映射 */
const STRFTIME_MAP: Record<string, string> = {
  '%Y': 'YYYY',
  '%y': 'YY',
  '%m': 'MM',
  '%d': 'DD',
  '%e': 'D',
  '%H': 'HH',
  '%I': 'hh',
  '%M': 'mm',
  '%S': 'ss',
  '%p': 'A',
  '%P': 'a'
}

/** 未知 strftime token（%B 月份名/%A 星期名等）原样保留并标 lossy，由调用方警告 */
export function strftimeToFrondFormat(fmt: string): { format: string; lossy: boolean } {
  let lossy = false
  const format = fmt.replace(/%[A-Za-z%]/g, (t) => {
    const mapped = STRFTIME_MAP[t]
    if (mapped) return mapped
    if (t === '%%') return '%'
    lossy = true
    return t
  })
  return { format, lossy }
}

/** {{var}} 引用替换：查 varMap，查不到的保留原样（即 Frond 的手动输入参数） */
function applyVars(replace: string, varMap: Map<string, string>): string {
  return replace.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, name: string) => {
    return varMap.get(name) ?? full
  })
}

interface EspansoVar {
  name?: unknown
  type?: unknown
  params?: { format?: unknown } & Record<string, unknown>
}

export function parseEspansoYaml(raw: string): EspansoParseOutcome {
  const warnings: string[] = []
  const parsed = parseYaml(raw) as unknown
  const list =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { matches?: unknown }).matches)
        ? ((parsed as { matches: unknown[] }).matches)
        : null
  if (!list) throw new Error('不是合法的 Espanso match 文件（缺少 matches 列表）')

  const items: EspansoImportItem[] = []
  list.forEach((entry, index) => {
    const label = `第 ${index + 1} 条`
    if (!entry || typeof entry !== 'object') {
      warnings.push(`${label}：不是对象，已跳过`)
      return
    }
    const e = entry as { trigger?: unknown; replace?: unknown; vars?: unknown }
    const trigger = typeof e.trigger === 'string' ? e.trigger.trim() : ''
    if (!trigger) {
      warnings.push(`${label}：缺少 trigger，已跳过`)
      return
    }
    const replace =
      typeof e.replace === 'string'
        ? e.replace
        : e.replace === undefined || e.replace === null
          ? ''
          : String(e.replace)
    if (!replace) {
      warnings.push(`${label}（${trigger}）：replace 为空，已跳过`)
      return
    }

    const varMap = new Map<string, string>()
    if (Array.isArray(e.vars)) {
      for (const rawVar of e.vars) {
        if (!rawVar || typeof rawVar !== 'object') continue
        const v = rawVar as EspansoVar
        const name = typeof v.name === 'string' ? v.name : ''
        if (!name) continue
        if (v.type === 'date') {
          const fmt = typeof v.params?.format === 'string' ? v.params.format : ''
          if (!fmt) {
            varMap.set(name, '{date}')
            continue
          }
          const { format, lossy } = strftimeToFrondFormat(fmt)
          varMap.set(name, `{date:${format}}`)
          if (lossy) {
            warnings.push(
              `${label}（${trigger}）：var "${name}" 含无法映射的 strftime token，已原样保留`
            )
          }
        } else if (v.type === 'clipboard') {
          varMap.set(name, '{clipboard}')
        } else {
          warnings.push(
            `${label}（${trigger}）：var "${name}" 类型 "${String(v.type ?? '未知')}" 无对应能力，已降级为手动输入参数`
          )
        }
      }
    }

    items.push({ name: trigger, trigger, content: applyVars(replace, varMap) })
  })
  return { items, warnings }
}

/** 解析结果 → Frond 片段（ExportedSnippet 形状，与 JSON 导入同一落库路径） */
export function espansoItemsToSnippets(items: EspansoImportItem[], now: number): ExportedSnippet[] {
  return items.map((item) => ({
    id: randomId(),
    name: item.name,
    contents: [
      { id: randomId(), label: '文本', value: item.content, language: 'plaintext' }
    ],
    trigger: item.trigger,
    folderId: null,
    tagIds: [],
    isDeleted: false,
    isFavorites: false,
    createdAt: now,
    updatedAt: now
  }))
}

function randomId(): string {
  return globalThis.crypto.randomUUID()
}

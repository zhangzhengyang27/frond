/**
 * Leaf · 文件索引骨架词（#9，对标 Vicinae skeletonizeToken）
 *
 * CJK 字符 → 拼音首字母（pinyin-pro，词典较大故动态 import 一次并缓存），
 * latin/数字保留小写，其余丢弃。让中文文件名可用拼音首字母前缀搜索：
 * 「项目计划.md」→ xmjhmd，输入 xmjh* 命中。
 */

type PinyinFn = (text: string, opts?: Record<string, unknown>) => string[]

let pinyinPromise: Promise<PinyinFn> | null = null

async function loadPinyin(): Promise<PinyinFn> {
  if (!pinyinPromise) {
    pinyinPromise = import('pinyin-pro').then((m) => {
      const pinyin = m.pinyin
      return (text: string, opts?: Record<string, unknown>) =>
        pinyin(text, {
          pattern: 'first',
          toneType: 'none',
          type: 'array',
          ...(opts ?? {})
        }) as string[]
    })
  }
  return pinyinPromise
}

/** 生成骨架词：拼音首字母 + 小写 latin/数字，非字母数字丢弃 */
export async function skeletonize(name: string): Promise<string> {
  if (!name) return ''
  const pinyin = await loadPinyin()
  const parts = pinyin(name)
  let out = ''
  for (const part of parts) {
    for (const ch of part.toLowerCase()) {
      if (/[a-z0-9]/.test(ch)) out += ch
    }
  }
  return out
}

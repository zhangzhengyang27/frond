/**
 * Frond · 词典服务（阶段3.3d）
 *
 * 支持两种查询方式：
 * 1. macOS 自带词典（dict:// URL scheme）
 * 2. 免费在线词典 API（dictionaryapi.dev，无需 key）
 */
import { shell } from 'electron'
import https from 'https'
import { typedHandle } from '../ipc/typedIpc'

export interface DictionaryDefinition {
  word: string
  phonetic?: string
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{
      definition: string
      example?: string
    }>
  }>
}

/** 用 macOS 词典应用打开单词 */
export function openInDictionary(word: string): void {
  void shell.openExternal(`dict://${encodeURIComponent(word)}`)
}

/** 用 dictionaryapi.dev 查询单词释义（带超时） */
export function queryDictionary(word: string): Promise<DictionaryDefinition[]> {
  return new Promise((resolve, reject) => {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    const req = https.get(url, (res) => {
      // 非 200 状态码直接返回空
      if (res.statusCode !== 200) {
        res.resume() // 消耗响应体
        resolve([])
        return
      }
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (Array.isArray(parsed)) {
            resolve(parsed as DictionaryDefinition[])
          } else {
            resolve([])
          }
        } catch (err) {
          reject(err)
        }
      })
    })
    // 8 秒超时
    req.setTimeout(8000, () => {
      req.destroy()
      resolve([])
    })
    req.on('error', () => resolve([]))
  })
}

/** 注册词典 IPC */
export function registerDictionaryIpc(): void {
  typedHandle('dictionary:open', (_e, req) => {
    openInDictionary(req.word)
    return true
  })

  typedHandle('dictionary:query', async (_e, req) => {
    try {
      return await queryDictionary(req.word)
    } catch {
      return []
    }
  })
}

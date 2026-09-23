/**
 * 截图 OCR 服务（tesseract.js 单例封装）
 * 2026-09-23 重建：原件未留存，按调用方（OcrResult.vue）的契约重建。
 *
 * worker 与语言包（数十 MB）创建/加载耗数秒，故整进程复用同一个 worker；
 * 只在识别失败时销毁，下一次调用重新拉起。
 */
import { createWorker, type Worker, type LoggerMessage } from 'tesseract.js'

export interface OcrOptions {
  /** 语言包，如 'chi_sim+eng' */
  lang?: string
  /** 进度 0~1 */
  onProgress?: (progress: number) => void
}

export interface OcrResultData {
  text: string
  /** 0~100 */
  confidence: number
}

const DEFAULT_LANG = 'chi_sim+eng'

let workerPromise: Promise<Worker> | null = null
let activeLang = DEFAULT_LANG
/** logger 只能在 createWorker 时注册一次，之后靠这个指针把进度转给当前调用方 */
let activeOnProgress: ((progress: number) => void) | undefined

async function acquireWorker(lang: string): Promise<Worker> {
  if (!workerPromise) {
    activeLang = lang
    workerPromise = createWorker(lang, undefined, {
      logger: (m: LoggerMessage) => {
        if (m.status === 'recognizing text') activeOnProgress?.(m.progress)
      }
    })
    // 创建失败不能留着：否则后续每次 OCR 都拿到同一个 rejected promise
    workerPromise.catch(() => {
      workerPromise = null
    })
  } else if (activeLang !== lang) {
    const worker = await workerPromise
    await worker.reinitialize(lang)
    activeLang = lang
  }
  return workerPromise
}

async function discardWorker(): Promise<void> {
  const pending = workerPromise
  workerPromise = null
  if (!pending) return
  try {
    ;(await pending).terminate()
  } catch {
    /* 销毁失败不额外处理：已经不会再被引用 */
  }
}

export const ocrService = {
  async recognize(imageSrc: string, options: OcrOptions = {}): Promise<OcrResultData> {
    activeOnProgress = options.onProgress
    try {
      const worker = await acquireWorker(options.lang ?? DEFAULT_LANG)
      // blocks/hocr/tsv 全关：调用方只要纯文本，少一份结构化输出少一次回传
      const { data } = await worker.recognize(imageSrc, {}, { blocks: false, text: true })
      return { text: data.text?.trim() ?? '', confidence: data.confidence ?? 0 }
    } catch (error) {
      await discardWorker()
      throw error
    } finally {
      activeOnProgress = undefined
    }
  }
}

/** 素材类型工具（主进程/渲染端共用，无 DOM/Node 依赖） */

export type AssetKind = 'image' | 'video' | 'audio' | 'font' | 'file' | 'bookmark'

export const FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'ttc']

export const VIDEO_EXTENSIONS = [
  'mp4',
  'mov',
  'webm',
  'm4v',
  'mkv',
  'avi',
  'wmv',
  'flv',
  'mpeg',
  'mpg'
]

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus', 'wma']

export const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'svg',
  'heic',
  'heif',
  'avif',
  'psd',
  'ai',
  'tif',
  'tiff',
  'pdf'
]

export const FIVE_KINDS: AssetKind[] = ['image', 'video', 'audio', 'font', 'file']

/** 六期：+书签（URL 收集）。书签不经 kindOfExt（无文件扩展名语义），仅由显式 API 创建 */
export const ALL_KINDS: AssetKind[] = [...FIVE_KINDS, 'bookmark']

export function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : ''
}

/** 按扩展名归类素材类型；未知扩展 → 'file'（兜底卡片） */
export function kindOfExt(fileNameOrExt: string): AssetKind {
  const ext = extensionOf(fileNameOrExt.includes('.') ? fileNameOrExt : `.${fileNameOrExt}`)
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio'
  if (FONT_EXTENSIONS.includes(ext)) return 'font'
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  return 'file'
}

export function isFontFile(fileName: string): boolean {
  return kindOfExt(fileName) === 'font'
}

export const KIND_LABELS: Record<AssetKind, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  font: '字体',
  file: '文件',
  bookmark: '书签'
}

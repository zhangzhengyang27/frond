/**
 * Frond · sanitize-html 项目内类型声明（B55 散点根源修复之一）
 *
 * sanitize-html 无 bundled types 且 @types/sanitize-html 未安装——此前包装模块
 * 用 @ts-ignore 掩盖，导致 8 个消费文件（DetailPanel/PluginListPage/
 * MarkdownPreview/MarkdownPresentation 等）连带 "type could not be resolved"。
 * 只声明本仓实际用到的面。若日后安装 @types/sanitize-html，删除本文件即可。
 */
declare module 'sanitize-html' {
  export interface SanitizeHtmlOptions {
    allowedTags?: string[] | false
    allowedAttributes?: Record<string, string[]>
    allowedSchemes?: string[]
    allowedIframeHostnames?: string[]
    transformTags?: Record<
      string,
      (tagName: string, attribs: Record<string, string>) => Record<string, string>
    >
    selfClosing?: string[]
    disallowedTagsMode?: 'discard' | 'recursiveEscape'
  }

  const sanitizeHtml: {
    (dirty: string, options?: SanitizeHtmlOptions): string
    /** 与主函数同名的静态成员（wrapper 消费：defaults.allowedTags 等） */
    defaults: {
      allowedTags: string[]
      allowedAttributes: Record<string, string[]>
      allowedSchemes: string[]
    }
    simpleTransform(
      tagName: string,
      attribs?: Record<string, string>,
      merge?: boolean
    ): (tagName: string, attribs: Record<string, string>) => Record<string, string>
  }

  export default sanitizeHtml
}

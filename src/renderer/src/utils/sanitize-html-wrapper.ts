// sanitize-html 包装模块：vite CJS→ESM 互操作下默认导出可能挂在 .default 上
// （类型来自 src/renderer/src/types/sanitize-html.d.ts，B55：不再 @ts-ignore）
import sanitizeHtmlModule from 'sanitize-html'

const mod = sanitizeHtmlModule as unknown as { default?: typeof sanitizeHtmlModule }
const sanitizeHtml = mod.default ?? sanitizeHtmlModule

export default sanitizeHtml
export { sanitizeHtml }

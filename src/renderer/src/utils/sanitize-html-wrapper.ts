// sanitize-html 包装模块，让 Vite 处理 CommonJS 转换
// Vite 会自动将 CommonJS 模块转换为 ES 模块
// @ts-ignore - sanitize-html 是 CommonJS 模块，无类型声明，Vite 会自动处理
import sanitizeHtmlModule from 'sanitize-html'

// 处理可能的默认导出（CJS→ESM 互操作下可能挂在 .default 上）
const mod = sanitizeHtmlModule as { default?: unknown }
const sanitizeHtml = mod.default || sanitizeHtmlModule

export default sanitizeHtml
export { sanitizeHtml }

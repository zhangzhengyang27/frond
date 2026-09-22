/**
 * example-react 的构建脚本：src/main.tsx → dist/main.js
 *
 * 产物必须是自包含单文件：插件页跑在 plugin:// 源的 sandbox BrowserView 里，
 * 那里没有裸模块解析（node_modules 只是被整目录拷进安装目录的副产品，页面不认），
 * 所以 leaf-plugin-sdk 与 react/react-reconciler 一律打进 bundle，不留 import。
 * format 选 iife 是同一原因的另一半——页面用经典 <script> 引它，不依赖协议的 module 语义。
 *
 * 输出名 dist/main.js 是契约：index.html 按这个路径引，e2e 导入插件目录即用它，
 * 改名等于静默测不到（导入不报错、页面空白）。
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { statSync } from 'node:fs'

// npm --prefix 下的 cwd 不保证是本包目录，路径一律相对本文件解析
const HERE = dirname(fileURLToPath(import.meta.url))

const result = await build({
  absWorkingDir: HERE,
  entryPoints: [join(HERE, 'src/main.tsx')],
  outfile: join(HERE, 'dist/main.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  // main.tsx 不写 `import React`，JSX 走 react/jsx-runtime 自动入口
  jsx: 'automatic',
  // react 与 react-reconciler 的 CJS 入口按 process.env.NODE_ENV 选 dev/prod 产物，
  // 插件视图里没有 process：不替换就是 ReferenceError（白屏且只在控制台说话）
  define: { 'process.env.NODE_ENV': '"production"' },
  // 只为报告「SDK 到底进没进 bundle」——留成裸 import 时构建同样退出 0，得看得见
  metafile: true,
  logLevel: 'info'
})

if (result.metafile) {
  const bytes = statSync(join(HERE, 'dist/main.js')).size
  const sdk = Object.keys(result.metafile.inputs).filter((p) => p.includes('leaf-plugin-sdk'))
  console.log(`[example-react] dist/main.js ${(bytes / 1024).toFixed(1)} KB`)
  console.log(`[example-react] 已打包 SDK 模块 ${sdk.length} 个：\n  ${sdk.join('\n  ')}`)
}

/**
 * currency React 插件的构建脚本：plugins/com.frond.currency/src/main.tsx → dist/main.js
 *
 * 与 example-react/build.mjs 同一套约束：自包含单文件 iife bundle（sandbox BrowserView
 * 没有裸模块解析），NODE_ENV 替换（react CJS 按 process.env.NODE_ENV 选产物）。
 * 差异：currency 不是 workspace 包，依赖解析经 nodePaths 锚到 example-react/node_modules
 * （react / frond-plugin-sdk / esbuild 都在那）——绝不能在插件目录里装 node_modules，
 * importFromFolder 是整目录拷贝，会把依赖一起拷进安装目录。
 *
 * 输出名 dist/main.js 是契约：index.html 按这个路径引，改名等于静默白屏。
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { statSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const PLUGIN = join(ROOT, 'plugins', 'com.frond.currency')
const DEPS = join(ROOT, 'example-react', 'node_modules')

// esbuild 不在根依赖里（只有 example-react 声明了它）：显式从 example-react 解析
const require = createRequire(join(ROOT, 'example-react', 'package.json'))
const { build } = require('esbuild')

const result = await build({
  absWorkingDir: ROOT,
  entryPoints: [join(PLUGIN, 'src/main.tsx')],
  outfile: join(PLUGIN, 'dist/main.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [DEPS],
  // ⚠ 实证（2026-10-05）：esbuild 会把「顶层 async IIFE」入口整段判为可摇（视副作用为
  // 可丢弃），产物只剩 SDK+react 运行时壳（510KB 恒定、无入口字符串、页面静默白屏）。
  // example-react 之所以幸存是因为其 IIFE 内有 getPreferenceValues 等被 define 保留的调用
  // 形态差异；本插件必须显式关闭 tree-shaking。
  treeShaking: false,
  metafile: true,
  logLevel: 'info'
})

if (result.metafile) {
  const bytes = statSync(join(PLUGIN, 'dist/main.js')).size
  const sdk = Object.keys(result.metafile.inputs).filter((p) => p.includes('frond-plugin-sdk'))
  console.log(`[currency] dist/main.js ${(bytes / 1024).toFixed(1)} KB`)
  console.log(`[currency] 已打包 SDK 模块 ${sdk.length} 个`)
}

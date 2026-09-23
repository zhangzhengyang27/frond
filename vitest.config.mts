import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  resolve: {
    // 与 electron.vite.config.ts 保持一致（否则主进程测试解析不了 @shared 等别名）
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared'),
      // 渲染端别名也要能解析：胶囊那张页面注册表（launcherPageViews）会 import 全部 SFC，
      // 页面里用的是 @components/* 这类写法。与 electron.vite.config.ts 的 renderer 段保持一致。
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@components': resolve(__dirname, 'src/renderer/src/components'),
      '@composables': resolve(__dirname, 'src/renderer/src/composables'),
      '@utils': resolve(__dirname, 'src/renderer/src/utils'),
      '@views': resolve(__dirname, 'src/renderer/src/views'),
      '@api': resolve(__dirname, 'src/renderer/src/api'),
      '@router': resolve(__dirname, 'src/renderer/src/router'),
      '@constants': resolve(__dirname, 'src/renderer/src/constants')
    }
  },
  // 六期：渲染层 .vue 组件测试（AssetThumb 等）需要 vue 插件；环境由文件内
  // `// @vitest-environment happy-dom` 注释按文件启用，不影响主进程 node 测试
  plugins: [vue()],
  test: {
    // 全新 clone 无 SDK dist 也要能跑单测（见该文件注释）
    globalSetup: ['./vitest.global-setup.ts'],
    // references/**：外部参考仓库（ueli/vicinae，见 .gitignore）自带测试，不属本仓库测试面
    // scripts/ 只排可执行脚本本身（.mjs），测试文件仍要收：release-preflight 的判定是纯函数，
    // 判错的代价是「不能发的版本被发出去」
    exclude: ['e2e/**', 'scripts/**/*.{js,mjs,cjs}', '**/node_modules/**', 'references/**'],
    // 全量跑时 112 个测试文件并行抢 CPU，默认 5s 用例超时会把「纯静态扫描」型用例
    // 打成 STACK_TRACE_ERROR 假红（vitest 的超时占位错误）：ipcContract 全量 106.7s
    // vs solo 14.4s，renderer-api-parity 全量 10.6s vs solo 2.4s，而两者 solo 都是绿的
    // —— 是负载问题，不是契约不符。提到 30s 兜住负载。
    // 那两个文件另有文件级 120s（见各自 describe 的 options），因为它们要遍历整个 src 子树。
    testTimeout: 30_000
  }
})

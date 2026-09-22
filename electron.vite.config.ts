import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        include: [
          'electron',
          '@electron-toolkit/utils',
          '@electron-toolkit/preload',
          'better-sqlite3',
          'onnxruntime-node'
        ],
        // ESM-only 包打进 bundle：externalize 后 CJS require 拿到的是 namespace，无法 new / 直接调用
        exclude: ['p-queue', 'sharp-phash']
      })
    ],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve('src/preload')
      }
    },
    build: {
      rollupOptions: {
        // 双入口：index = 应用窗口通用桥；plugin = 启动器插件受控 API 桥
        input: {
          index: resolve('src/preload/index.ts'),
          plugin: resolve('src/preload/plugin.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@components': resolve('src/renderer/src/components'),
        '@composables': resolve('src/renderer/src/composables'),
        '@utils': resolve('src/renderer/src/utils'),
        '@views': resolve('src/renderer/src/views'),
        '@api': resolve('src/renderer/src/api'),
        '@constants': resolve('src/renderer/src/constants'),
        '@router': resolve('src/renderer/src/router'),
        '@preload': resolve('src/preload'),
        '@shared': resolve('src/shared'),
        // 为浏览器环境提供 Node.js 模块的空实现
        path: resolve('src/renderer/src/utils/path-polyfill.ts'),
        fs: resolve('src/renderer/src/utils/fs-polyfill.ts'),
        url: resolve('src/renderer/src/utils/url-polyfill.ts'),
        'source-map-js': resolve('src/renderer/src/utils/node-polyfills.ts')
      }
    },
    plugins: [vue()],
    define: {
      'process.env': {},
      process: {}
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      },
      include: ['sanitize-html']
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
        include: [/sanitize-html/, /node_modules/]
      },
      rollupOptions: {
        // 多页入口：index = 主应用；launcher = 启动器胶囊窗；
        // shield = 专注护盾遮罩（轻入口，命中屏蔽应用时即时创建）
        input: {
          index: resolve('src/renderer/index.html'),
          launcher: resolve('src/renderer/launcher.html'),
          shield: resolve('src/renderer/shield.html')
        }
      }
    }
  }
})

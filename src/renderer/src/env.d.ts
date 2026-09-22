/// <reference types="vite/client" />

/**
 * 主进程用 electron-vite 的 `?asset` 后缀导入资源文件（resources/icon.png）。
 * typecheck:web 会顺带编译被类型引用链拉进来的 src/main 模块，而 web 程序只带
 * vite/client（声明 *.png，不含 *.png?asset）→ 这些导入报 TS2307。
 * node 程序由 electron-vite/node 提供该声明，故这条只补 web 侧，不与之重复。
 */
declare module '*?asset' {
  const assetPath: string
  export default assetPath
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

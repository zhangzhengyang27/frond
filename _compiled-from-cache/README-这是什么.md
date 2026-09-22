# _compiled-from-cache —— 139 个编译后模块

从 dev-server 的 Chromium 缓存抽取(leaf-library / leaf-desktop / Electron 三个 app 数据目录)。**不是原始源码**：`.ts` 只被剥了类型、语句原样；`.vue` 的 `<script setup>` 完整、模板已成 `_createVNode` 调用。按 URL 去重取最晚一份，`?t=` 即原文件 mtime。主进程 `src/main/**` 不经 HTTP，基本不在此。
清单：`~/Desktop/_缓存编译产物清单-2026-09-22.json`

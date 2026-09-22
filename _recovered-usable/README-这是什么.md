# _recovered-usable —— 从 dev-server 缓存机械还原的 .ts 模块

做法：取编译响应 → 删 Vite HMR 前言 → 把 `/@fs/.../.vite/deps/<pkg>.js?v=` 改回裸包名、`/@fs<项目>/src/...` 改回 `/src/...`。
必须知道的限制：
- **类型标注已被 esbuild 全部剥除**，所以内容是去掉类型的 JS（能被 TS 编译，但不是原文件，`interface`/泛型断言没了）。
- `chunk-*` 这类被 Vite 合并的共享依赖块无法反推包名，保留为 `"__CHUNK__/xxx"` 占位，需要手工改。
- 已过 `node --check` 语法校验，未做运行/类型验证；回填 `src/` 前请先看一遍。
统计：{'语法通过': 186, '源文件已在,跳过': 9}

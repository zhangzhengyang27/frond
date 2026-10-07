# 性能基线

> 数字来源：`e2e/perf-baseline.spec.mjs`（冷启动 / 胶囊唤起 / 内存）与
> `e2e/perf-results.spec.mjs`（根搜索键入代价）。两者都是**端到端实测**：
> 启动真实构建产物（`out/main/index.js`），不用 mock。
>
> 复现：
>
> ```bash
> pnpm exec electron-vite build
> pnpm exec playwright test e2e/perf-baseline.spec.mjs
> FROND_PERF_LABEL=your-label pnpm exec playwright test e2e/perf-results.spec.mjs
> ```
>
> 结果分别写在 `test-results/perf-baseline.json` 与
> `test-results/perf-results-<label>.json`。
> ⚠️ Playwright 每次运行开头会清空 `test-results/`——两个 spec 要的 JSON
> 别指望在同一次连续运行里都存活，跑完一个先拷走再跑下一个。

## 2026-10-07 基线（首个存档口径）

环境：Apple Silicon（M 系列）真机 · macOS 25.5 · Electron 38 · 全新 e2e userData（无真实用户数据、跳过内置插件播种差异按各自 spec 约定）。

> 运行间方差可观：同一构建多次实测冷启动 461–674ms、内存合计 729–841 MiB（后台任务与磁盘缓存的噪声）。
> 引用数字时带上「约」与口径；要盯的硬红线只有 perf-baseline 里的**热唤起 < 200ms** 断言。

### 冷启动 / 胶囊唤起 / 内存（perf-baseline）

| 指标 | 数值 | 说明 |
| --- | --- | --- |
| 冷启动 | **674 ms** | `electron.launch` → 主窗口 DOM 就绪，信息性（含进程拉起），无预算断言 |
| 胶囊首唤起 | **38.9 ms** | 含胶囊窗懒创建 |
| 胶囊热唤起 | **3.8 ms** | 用户日常路径，**e2e 硬断言 < 200 ms**（`perf-baseline.spec.mjs:95`） |
| 内存（合计） | **≈ 729 MiB / 7 进程** | `app.getAppMetrics()` workingSet 求和，见下明细 |

内存明细（workingSetSize，KB）：

| 类型 | 进程数 | 合计 |
| --- | --- | --- |
| Browser（主进程） | 1 | 187,072 |
| GPU | 1 | 96,816 |
| Utility（含文件索引 worker） | 2 | 108,096 |
| Tab（渲染进程：主窗 + 胶囊等） | 3 | 354,480 |

> **与 Raycast 对照口径（2026-09 自建基准：350–450 MB）**：那是单应用常驻观感口径；
> 上表是 Electron 全进程 workingSet 合计，含 GPU/Utility 与两个本就隐藏的窗口渲染进程，
> 两者**不可直接相比**。引用时务必带口径说明，别拿 729 去跟 400 打架。

### 键入响应（perf-results，10 探测词）

| 指标 | 数值 | 说明 |
| --- | --- | --- |
| firstMutationMs | **154–161 ms**（全部探测词） | 键入 → 首次 DOM 变化，**含 150 ms 防抖**——同步打分+首绘约 4–11 ms |
| settleMs（小结果集 ≤38 行且命中少） | 187–274 ms | 'safari' / 'note' / 'clip' / 'er' 等 |
| settleMs（35 行大结果集） | **611–748 ms** | 'a' / 'e' / 'i' / 's'（churn 457–589 ms）——异步补充源（文件/剪贴板）到达的代价 |
| stalled | 全部 false | 观察窗内列表都落定，无「永不落定」病灶 |

结论：单键同步开销在个位数毫秒量级；大结果集的 settle 时长主要付给异步补充源，
防抖两端同价，不随行数放大。后续优化若要动 `useUnifiedSearch.ts` 的行数常量，
按 `perf-results.spec.mjs` 文件头的 A/B 方法先量后改。

## CI 归档

`.github/workflows/perf.yml`（手动触发）在 macos runner 上跑两个 spec 并把
JSON 上传为 workflow artifact；mac runner 数字噪声大于真机，仅作趋势参考，
**权威口径以本文件存档的真机数字为准**。

# Leaf · 文件自建索引设计（#9，2026-09-18）

> 对应 `RAYCAST_GAP_ANALYSIS_V4.md` §2.7 的 P0 缺口：文件搜索受制于 Spotlight（mdfind）
> 与 Windows PowerShell 递归。参考 `references/vicinae/src/file-indexer/`（独立进程 + inotify
> + sqlite FTS5 + skeleton 骨架词 + gitignore 式排除），适配 Leaf 的 Electron + better-sqlite3 栈。
> **状态：设计稿，待确认后实施。**

## 1. 目标与非目标

**目标**
- 文件名搜索不再依赖 Spotlight：自建索引即时（<50ms 量级）、可控（自管排除规则）、跨状态稳定（Spotlight 被禁用/重建时 Leaf 不受影响）
- Windows 获得与 macOS 同级的文件搜索体验（现状是 PowerShell 裸递归，无索引）
- 增量更新：文件系统事件驱动，非轮询全扫

**非目标（本轮明确不做）**
- 替代系统 Spotlight 的全部能力（元数据搜索 / 按类型过滤等）
- 网络盘 / 外置卷的持续索引（断连卷保留策略后置）
- 应用索引（应用扫描已有 ApplicationCommandProvider 承担）

## 2. 架构决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 存储位置 | **独立 sqlite 文件** `userData/file-index.db` | Vicinae 同款决策：索引体积大、可随时 drop 重建，不进主库迁移序列（030+ 不受影响），不撑大用户数据备份 |
| 运行位置 | **main 进程内模块**（非独立进程） | Vicinae 独立进程是 C++ 特有需要；Leaf 里独立进程收益低（better-sqlite3 同步写用分片 + yield 控制阻塞），少一套进程管理 |
| 扫描调度 | 初始全量**分片扫描**（每片 N 条 yield 事件循环）+ **FSEvents 增量** | 对应 Vicinae 的 filesystem-walker / incremental-scanner / io-pacer 三件套 |
| FS 事件源 | macOS `fsevents` npm 包（chokidar 同款底层，原生 FSEvents）| Windows 后续用 `@parcel/watcher` 或 ReadDirectoryChangesW 封装（M3） |
| 数据表 | FTS5 虚拟表 + 目录水位表 | 见 §3 |

## 3. Schema（file-index.db）

```sql
-- 文件条目（FTS5 外部内容表：主数据在 files，FTS 只存可搜索列）
CREATE TABLE files (
  rowid_ptr TEXT PRIMARY KEY,   -- 绝对路径
  parent    TEXT NOT NULL,      -- 父目录（FilesPage 目录浏览用）
  name      TEXT NOT NULL,      -- 文件名（含扩展名）
  ext       TEXT,               -- 小写扩展名（类型过滤）
  size      INTEGER,
  mtime     INTEGER,
  is_dir    INTEGER NOT NULL DEFAULT 0
);
CREATE VIRTUAL TABLE files_fts USING fts5(
  name, skeleton, path, content='files', content_rowid='rowid'
);
-- skeleton 列：CJK 骨架词（对标 Vicinae skeletonizeToken）——拼音首字母可搜中文文件名
CREATE TABLE dirs (           -- 目录水位：增量扫描跳过未变目录
  path TEXT PRIMARY KEY,
  mtime_epoch INTEGER NOT NULL
);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);  -- schema 版本 / 上次全量时间 / 索引范围配置
```

## 4. 索引范围与排除治理

- **范围（scopes）**：用户在管理页配置目录列表，持久化到 meta 表；默认值待拍板（见 §8）
- **内置排除**（不可关）：`node_modules` / `.git` / `Library` / 缓存与构建产物目录（对齐 Vicinae excludedPaths + Raycast 默认排除 node_modules）
- **`.leafignore`**：目录内放此文件即整目录跳过（Raycast `.rayignore` 对应物；gitignore 全语法解析后置 M2，v1 只支持「文件存在 → 跳目录」）
- **隐藏文件开关**（默认忽略 dot 开头，管理页可开）
- **磁盘保护**：单文件条目上限（如 50 万）+ 索引体积上限（如 512MB），触顶停止并提示

## 5. 集成点

- `src/main/modules/fileSearch.ts`：新增 `source: 'index' | 'mdfind' | 'powershell'` 分层——查询先走自建索引，未就绪 / 查询无果时**回退** mdfind（macOS）。IPC 形状不变（`fileSearch.query`），渲染端零改动即可受益
- FilesPage / 根搜索聚合：不动（沿用现有 file 行渲染与 open/reveal 动作）
- 管理页「文件索引」区：范围目录管理（增删）、索引状态（条目数 / 上次全量 / 体积）、「重建索引」按钮
- 索引事件：初始全量完成 / 增量异常 → 主进程通知（非打断式）

## 6. 性能预算与验收

| 指标 | 预算 |
| --- | --- |
| 索引查询延迟 | < 50ms（1 万条目内，FTS5 命中） |
| 初始全量（10 万文件） | < 90s，期间主进程单次阻塞 < 16ms（分片 yield） |
| 增量延迟 | FSEvents 事件 → 可搜 ≤ 2s（合并节流 500ms） |
| 索引体积 | 10 万文件 ≤ 100MB（FTS5 双列） |
| 验收 | e2e：建临时目录播种 → 搜索命中 → 改名 → 增量可搜 → 排除目录不可见；单测覆盖排除规则 / 骨架词 / 水位跳过 |

## 7. 里程碑

- **M1（本轮）**：schema + 扫描器 + FSEvents 增量 + 排除治理 + fileSearch 集成（macOS，name 模式）+ 管理页区
- **M2**：content 模式（FTS 加 content 列，macOS 替代 mdfind content）+ .leafignore 全语法 + Windows（@parcel/watcher）
- **M3**：断连卷策略 / spellfix1 容错 / 索引体积统计可视化

## 8. 需拍板事项

1. **平台范围**：M1 只做 macOS（Windows 留 M2），还是双平台同期？
2. **默认索引范围**：保守（默认空，用户显式加目录）vs 激进（默认 home 全量 + 排除，Vicinae/Raycast 式）
3. **v1 内容搜索**：M1 只做文件名（推荐，content 留 M2），还是同期上？

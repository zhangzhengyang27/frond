# Leaf · 数据迁移机制（schema 迁移 + data migration）

> **本文是 2026-09-23 从代码重生成的。** 2026-09-22 的误删事故把 `MIGRATIONS.md` 与 `DB_SCHEMA.md` 连同各备份池里的副本一起带走了（记账见 `HANDOFF.md:693-697`）。
> 每一条结论都带 `文件:行号`，行号是这次逐文件读出来的；查不到依据的写「未证实」并说明为什么值得查。
> 表结构、前缀规则、FTS 与同步的结构要求不在本文，见同批重生成的 [`DB_SCHEMA.md`](./DB_SCHEMA.md)（`001_init.ts:7` 也指着它）。

**本文的事实来源**

| 来源 | 用来确认什么 |
| --- | --- |
| `src/main/db/database.ts` | 迁移执行器：`meta` 版本推进、事务、降级告警、打开前备份与校验 |
| `src/main/db/migrations/index.ts` + `001_init.ts` … `030_sync_state.ts`（30 个文件全读） | 注册表约定、每个迁移做了什么、幂等写法样本 |
| `src/main/db/__tests__/migrations.test.ts`、`__tests__/testDb.ts` | 现有护栏（幂等重跑、表不在了）与测试侧执行器 |
| `src/main/db/dataMigrations.ts`、`dataMigrationsRecording.ts`、`dataMigrationsPomodoro.ts`、`legacyArchive.ts` | 数据迁移 v1/v2/v3/v4 + legacy JSON 归档/还原 |
| `src/main/index.ts:302-323` | 两条线在启动流程里的实际顺序与容错 |
| `src/main/db/dbBackup.ts`、`src/main/ipc/migration.ts` | 备份/导入/恢复出厂与「迁移中心」入口 |
| `src/main/services/LogService.ts` | 迁移期日志能不能落库（答案：不能，静默吞） |
| `src/main/launcher/dataSync.ts` | 同步快照与 `leaf_meta` 的归类缺口（结构要求见 DB_SCHEMA §6） |
| 实机只读核对：`~/Library/Application Support/leaf-desktop/leaf.db`（`sqlite3 -readonly`，2026-09-23） | `MAX(meta.version)=30`、`meta` 30 行、`leaf_meta` 只有 4 条标志位（§5-1 的现场证据） |

---

## 0. 两条线先看对照

| | **schema 迁移** | **data migration（数据迁移）** |
| --- | --- | --- |
| 干什么 | 建表 / 加列 / 建索引与 FTS / 删表 | 把旧 electron-store JSON 与 JSON 旁文件的**存量数据**搬进 SQLite |
| 单位 | 版本号 1…30，一版一个文件 | v1 / v2 / legacy 归档 / 5 个 electron-store 子步 / v3 / v4 |
| 记账 | `meta(version, applied_at)`（一行一版） | `leaf_meta(key, value, updated_at)`（一条一个标志位，值 `'done'`） |
| 幂等靠 | 「`version <= current` 就跳过」+ 语句自身 `IF NOT EXISTS` / `PRAGMA table_info` 守卫 | 标志位；跑成功才落，失败不落、下次启动重试 |
| 原子性 | 每个版本一个事务（`m.up` + 写 `meta` 同事务） | v1/v2 无跨步事务（逐域 try/catch）；v4 的 `UPDATE` 与标志位同事务；v3 逐条独立 |
| 回滚 | **没有** `down()`，只有备份/还原 | 靠 `legacy-backup/` 归档可还原（还原后会形成重跑循环，见 §2.5） |
| 代码 | `src/main/db/database.ts:140-174`；`src/main/db/migrations/*` | `src/main/db/dataMigrations*.ts`、`legacyArchive.ts` |
| 触发点 | 第一次取 `database.handle` 时（懒打开即跑） | `app.whenReady()` 里显式按序调用（`src/main/index.ts:302-323`） |

---

## 1. schema 迁移

### 1.1 执行器：版本号怎么推进

```
ensureOpen() → new Database(userData/leaf.db) → 4 个 PRAGMA → runMigrations()
runMigrations():
  CREATE TABLE IF NOT EXISTS meta(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)
  current = SELECT MAX(version) FROM meta          -- 空表 → null → 0
  current > 代码里最后一个 version → 只 console.warn（降级告警）
  for m of migrations: if (m.version <= current) continue
                       db.transaction(() => { m.up(db); INSERT INTO meta })(…)
```

| 事实 | 依据 |
| --- | --- |
| 库文件与 PRAGMA（WAL / foreign_keys=ON / synchronous=NORMAL / temp_store=MEMORY） | `src/main/db/database.ts:46`、`:61-64` |
| 版本记在 **`meta` 表**，不是 `PRAGMA user_version`（全仓无一处 `user_version`） | `src/main/db/database.ts:144-150`；检索 `user_version` 在 `src`/`scripts`/`e2e` 零命中 |
| 「已应用版本」= `MAX(version)`，因此**一行一版**，重复执行同版本不会产生第二行（跳过了就不会再插） | `database.ts:149-150`、`:163` |
| 每个迁移包在一个事务里：`m.up(db)` 与写 `meta` 同事务 → 半迁移状态不会出现 | `database.ts:164-171` |
| 跑完后内存里 `current` 前推（同一批未跑完前不重读库） | `database.ts:172` |
| 调试入口 `database.currentVersion()` 读同一个 `MAX(version)` | `database.ts:188-192` |
| 实机核对：dev 库 `meta` 恰 30 行、`MAX(version)=30` | 2026-09-23 只读查询 |

**降级（新库跑在旧代码上）不阻止、不回退，只告警**：`current > maxKnown` 时打一条「schema vN 来自更高版本的应用…继续运行有数据风险」（`database.ts:152-160`）。这里的 `maxKnown` 取的是数组**末元素**的 version（`database.ts:154`），所以「严格递增」这件事一旦破，这条防线也一起失效。

### 1.2 迁移失败会怎样（没有兜底）

| 环节 | 行为 | 依据 |
| --- | --- | --- |
| 单个迁移抛错 | 该版本事务回滚，错误**原样抛到 `ensureOpen()` 外**（文件头明写「任何 prepare/exec 失败必须抛错，不静默吞错」） | `database.ts:11`、`:164-171` |
| 启动路径 | `installDatabase()` 是 `app.whenReady()` 回调里**唯一没被 try/catch 包住**的数据库调用；它抛错 → 该回调 reject，后面的数据迁移、IPC 注册、窗口都不再执行 | `src/main/index.ts:302` 对比 `:304-323`（三个数据迁移各自 try/catch） |
| 迁移期的错误日志 | 写不进 `log_entries`：`LogService.write()` 里 `database.handle` 取不到或表还没建就静默 catch（此时只剩 console 与内存 ring buffer） | `src/main/services/LogService.ts:116-124`（`:123-124` 的空 catch + 注释） |
| 失败前有没有兜底备份 | **只在库 > 50 MB 时**才备份（`leaf.db.bak.<ts>`，留 3 份），备份前先 `wal_checkpoint(TRUNCATE)`、备份后 `quick_check` 不过就丢弃该备份 | `database.ts:21-22`、`:70-104` |

### 1.3 迁移文件怎么写才安全（现状归纳，规则本身没有守卫）

| # | 规则 | 现状依据 |
| --- | --- | --- |
| 1 | **只能向后追加，`version` 严格递增，不改已发布版本**；新文件要同时在末尾加 import 和 push | `migrations/index.ts:4-8`、`:18`、`:50`。**没有任何测试或执行器校验这条**（`migrations.test.ts` 只断言幂等与表不存在：`:33-51`） |
| 2 | 建表/建索引/建触发器一律 `IF NOT EXISTS`；`up()` 必须幂等 | 注释 `index.ts:7`；样板 `001_init.ts:5`、`:18` 起整段；幂等测试 `migrations.test.ts:47-51` |
| 3 | `ALTER TABLE ADD COLUMN` 没有 `IF NOT EXISTS` → 先 `PRAGMA table_info` 查列 | `002:23-29`、`003:37-51`、`008:36-47`、`016:15-24`、`020:14-17`、`022:16-23`、`025:16-20`、`026:17-21` |
| 4 | **不能给已有列补 CHECK**（SQLite 做不到，008 明确放弃，改由 Repository 写入路径保证） | `008:48-49`；新建表才写列内 CHECK：`008:59-60` |
| 5 | 改唯一约束 = 先 `DROP INDEX IF EXISTS` 再建 partial unique（软删列不参与旧值冲突） | `002:32-36`；同型 `003:31-34` |
| 6 | 删表用 `DROP TABLE IF EXISTS`，包在事务里；**索引随表消失，不需要单独 DROP**（028 却显式删了两个索引，属多做无害） | `013:18-32`、`018:23-39`、`027:8-19`（注释写明）、`028:21-23` |
| 7 | 给**已有数据**的表补 FTS 镜像时，建完触发器必须 `('rebuild')` 一次；005 就是在补 001 漏掉的这一步 | `005:3-13`、`:23-45`；正例（新表同事务内先建表后建镜像，无需 rebuild）`023:42-56`、`024:35-48` |
| 8 | 迁移内做数据搬运要自守幂等：能按内容判重的按内容判（`014:70` 用 UUID 正则短路已迁移行），判不了的靠标志位（见 §2.3 的 markers 例子） | `014:54-80`；`dataMigrations.ts:478-481` |
| 9 | 迁移可以 `import { v4 as uuidv4 } from 'uuid'` 造 id，但**不要 import electron**（001-030 里零处 import electron，执行器在 `app.isReady()` 之后跑，但 `:memory:` 测试路径没有 electron） | `009:25`、`014:2`；测试用 `__tests__/testDb.ts:14-31` |
| 10 | 结构变更后同步更新 `docs/DB_SCHEMA.md` 的表清单与同步归类（新表不归类会被 `syncExclusionAudit()` 报出来 —— 但它只在单测里跑） | `DB_SCHEMA.md` §6-§7；`src/main/launcher/__tests__/dataSync.test.ts:234-239` |

### 1.4 回滚：没有 down，只有备份与换库

| 手段 | 做什么 | 依据 |
| --- | --- | --- |
| `Migration` 接口 | **只有 `version` / `name` / `up`**，没有 `down` | `migrations/index.ts:12-16` |
| 自动备份 | 打开前按大小阈值复制 `leaf.db.bak.<ts>`（≥50 MB 才做，留 3 份，坏备份丢弃） | `database.ts:70-104`、`:121-138` |
| 导出当前库 | 先 `database.close()` 让 WAL 落盘再复制 | `src/main/db/dbBackup.ts:56-80` |
| 导入外部库 | `validateSqliteFile()` 魔数 + `quick_check` → 二次确认 → `applyDbFile()`：关连接、把现库另存 `leaf.db.pre-import.<ts>`、删 `-wal`/`-shm`、覆盖、100 ms 后 relaunch | `dbBackup.ts:25-50`、`:86-140`、`:149-173` |
| 恢复出厂 | 删 `leaf.db` + `-wal` + `-shm` 并重启；下次启动建空库，数据迁移会被再次判定（v1/v2 标志位随库一起消失） | `dbBackup.ts:179-211`（`:177` 注释） |
| 手动救旧备份 | 上面三种之外，`leaf.db.bak.*` / `*.pre-import.*` 只能手工换文件名 | `database.ts:78`、`dbBackup.ts:154` |

### 1.5 版本史（001 → 030）

| 版本 | `name` | 做了什么（净效果） |
| --- | --- | --- |
| 1 | `initial_schema` | 12 个分节：22 张实体表 + 索引 + `meta` + `snip_snippets_fts` 虚表（**没建触发器**） | `001_init.ts:18-359`（`meta:22`、`rec_recordings:90`、`ss_screenshots:136`、`pom_tasks:168`、`snip_snippets:208`、`tag_tags:236`、`folder_folders:254`、`pref_preferences:298`、`snip_snippets_fts:225`、`log_entries:348`） |
| 2 | `tag_tags_softdelete_partial_unique` | 补 `tag_tags.deleted_at`，`UNIQUE(name)` 换成 partial unique | `002:25-36` |
| 3 | `lib_files_table_and_wall_files_meta` | 建 `lib_files`、扩 `wall_files` 5 列 | `003:22-51` |
| 4 | `snippet_contents_subtable_and_folder_meta` | 建 `snip_snippet_contents`（FK 级联 `:30`）、`folder_folders` 加 3 列 | `004:22-55` |
| 5 | `snippet_fts_sync_triggers` | 补 001 漏的三个触发器 + 一次 `rebuild` | `005:23-45` |
| 6 | `online_music_module_schema` | 建 `om_*` 七张表 | `006:27-127` |
| 7 | `usage_module_schema` | 建 `usage_records` / `usage_favorites` | `007:23-37` |
| 8 | `recording_segments_and_status` | `rec_recordings` 加 6 列（放弃 CHECK）、建 `rec_segments`、加 partial 复合索引 | `008:42-76` |
| 9 | `pomodoro_v2` | 建 `pom_projects`、`pom_tasks.project_id`、并**插一个「默认」项目 + 回填孤儿任务** | `009:32-97` |
| 10 | `pomodoro_multi_project` | `pom_pomodoros.project_id`（不回填，查询侧 COALESCE 兜底） | `010:36-45`、`:18-20` |
| 11 | `pomodoro_task_title` | 加 `task_title`，并按「短且无换行、不以 `#`/`//`/`<!--` 开头」的启发式把 `note` 搬过去 | `011:31-63` |
| 12 | `remove_default_project` | 撤销 009 造的「默认」项目：任务 `project_id` 置 NULL + 软删该项目 | `012:16-30` |
| 13 | `remove_music_schema` | 删 `music_*` 3 张 + `om_*` 7 张 | `013:18-32` |
| 14 | `assets_v1` | `photo_photos` 加 4 列、建 `photo_smart_albums`、把 `photo_tags.tag_id` 从裸字符串 remap 成 `tag_tags.id` 并刷 `usage_count` | `014:23-98` |
| 15 | `photo_embeddings` | 建 `photo_embeddings`（CLIP 向量 BLOB） | `015:15-24` |
| 16 | `asset_kinds` | `kind`/`duration_ms`/`folder_id` + 按扩展名回填 kind + 建 `photo_folders` | `016:15-63` |
| 17 | `bookmarks_geo` | `photo_photos.source_url` + 建 `geo_cache` | `017:17-29` |
| 18 | `remove_photos_and_wallpaper` | 删 `photo_*` 7 张、`wall_*` 2 张、`lib_files`；**保留 `tag_tags`** | `018:25-38`、`:15` |
| 19 | `launcher_docs` | 建插件文档表 + `plugin_id` 索引 | `019:15-21` |
| 20 | `snippet_trigger` | `snip_snippets.trigger`（文本扩展关键词） | `020:14-17` |
| 21 | `usage_use_count` | `usage_records.use_count`（排序自学习从「最近」升级「频次×新近」） | `021:14-17` |
| 22 | `snippet_content_type` | `snip_snippet_contents.content_type` text/rich | `022:16-23` |
| 23 | `notes` | 建 `note_folders`、`notes`、4 个索引、`notes_fts` + 3 触发器 | `023:16-57` |
| 24 | `reminders` | 建 `reminders`、5 个索引、`reminders_fts` + 3 触发器 | `024:15-49` |
| 25 | `reminders_notified_at` | `reminders.notified_at`（重启后不重复通知） | `025:16-20` |
| 26 | `rec_marker_color` | `rec_markers.color`（可空，不回填历史行） | `026:17-21` |
| 27 | `drop_rec_clips` | 删 `rec_clips`（剪辑改直转码，表已无读写方） | `027:8-19` |
| 28 | `remove_screenshot` | 删 `ss_screenshots` 及其 2 个索引；`tag_tags`/`image://`/`usage_records`/tesseract 保留 | `028:21-23`、`:8-9` |
| 29 | `create_shot_index` | 建 `shot_index`（新前缀 `shot_`，索引磁盘上真实截图 + OCR 状态） | `029:5-28` |
| 30 | `sync_state` | 建 `sync_state`（三方合并的本机基线 + 墓碑，刻意不同步） | `030:24-30`、`:4-14` |

> 版本史里能读出这条线的整体脾气：**加列远多于改列**、**下线即 DROP**（013/018/027/028），且 009 造的默认项目被 012 撤销 —— 迁移不可改写，只能再补一条撤销迁移。

---

## 2. data migration（数据迁移）

### 2.1 启动顺序与总容错

```
app.whenReady() →
  installDatabase()                 -- schema 迁移在这里；不包 try（src/main/index.ts:302）
  try runDataMigrations()           -- v1 + v2 + legacy 归档 + 5 个 electron-store 子步（:305，catch 于 :307）
  try runRecordingHistoryMigration()-- v3（:311，catch 于 :316）
  try runPomodoroDurationMsMigration() -- v4（:320，catch 于 :322）
```

| 事实 | 依据 |
| --- | --- |
| v4 必须排在 v2 之后（v2 的 legacy 导入仍写「秒」，靠 v4 统一 ×1000） | `dataMigrationsPomodoro.ts:16-17`；调用顺序 `src/main/index.ts:305`→`:320` |
| v3 是「此前从未接线、属死代码」才被补进启动流程 | `src/main/index.ts:309`（注释原文） |
| 三个数据迁移整体抛错只 `console.error`，不阻断启动 | `src/main/index.ts:306-308`、`:315-317`、`:321-323` |
| v3 部分失败额外 `log.warn(…, 下次启动重试)` | `src/main/index.ts:312-314` |
| 日志 scope 就是启动日志里看到的那几个：`dataMigration` / `dataMigration.v3` / `dataMigration.v4` / `legacyArchive` | `dataMigrations.ts:115`、`:172-175`、`:304-310`；`dataMigrationsRecording.ts:87`、`:177-180`；`dataMigrationsPomodoro.ts:48`、`:65`；`legacyArchive.ts:68`、`:96` |

### 2.2 各步做什么

| 步骤 | 搬什么（源 → 目标） | 幂等判据 | 失败会怎样 | 依据 |
| --- | --- | --- | --- | --- |
| **前置** | 自建 `leaf_meta(key,value,updated_at)` | 每步都 `CREATE TABLE IF NOT EXISTS` | — | `dataMigrations.ts:98-104` |
| **v1** | `userData/Preferences.json` → `pref_preferences`（只 `theme`/`editor` 两键）；`userData/Tag Data.json` → `tag_tags` | `leaf_meta.data_migration_v1 = 'done'`（兼容旧标志位；**v1 与 v2 都 done 才整段早退**） | 逐域 try/catch，错误进 `result.errors` + `log.error`；**有错就不落 v1 标志位**，下次启动重跑 | `:106-117`、`:122-176`（早退 `:114-117`、判据 `:166`） |
| **v2** | `pomodoro-data.json` → `pom_tasks`/`pom_pomodoros` + `pomodoro_settings`（pref）；`Snippet Data.json` → `snip_*`；`Folder Data.json` → `folder_folders` | `leaf_meta.data_migration_v2 = 'done'`；导入本身也是 `ON CONFLICT(id) DO UPDATE`（重跑幂等） | 同上：本段有错则不落 v2 标志位 | `:183-264`、`:266-279`；repo 幂等 `TagRepository.ts:205`、`SnippetRepository.ts:449-458`、`PomodoroRepository.ts:594-596`/`:618-620`、`FolderRepository.ts:280-283` |
| **legacy 归档** | `userData` 根下 10 个 legacy JSON → `userData/legacy-backup/<ISO ts>/`（**rename 而非删除**，不去重、留时间线） | 目录内无这些文件即 skip；每次执行新建一个时间戳目录 | 单文件失败不阻断（逐文件 try/catch + errors 汇总）；**只要本次有任何错就整段不执行**，免得把 v1 还没导入的文件搬走 | `:281-302`（判据 `:284`）；`legacyArchive.ts:21-32`（文件清单）、`:66-70`（无文件即 skip）、`:86-102`（逐文件） |
| **归档目录记账** | 最新归档绝对路径 → `leaf_meta.legacy_archive_dir`（设置页展示用） | 覆盖写 | 只 `log.warn` | `:288-301` |
| **electron-store 子步 ×5** | 别名 `config.json.aliases` → pref `aliases`；`config.json` 的 `ai.config`/`ai.sessions` → pref 同名；`clips.json` → pref `clips`；`recording-settings.json.settings` → pref `recording.settings`；`markers.json` → `rec_markers` | 各自标志位 `data_migration_{aliases,ai,clips,recording_settings,markers}`；且**现值优先**（pref 已有该键就只落标志位不覆盖） | 整体 try/catch，失败 `log.warn` 且不落标志位（下次重试）；markers 是 `INSERT OR IGNORE` + 单事务 | 调用点 `:312-317`；标志位表与读助手 `:369-400`；aliases `:322-367`、ai `:402-427`、clips `:429-449`、recording.settings `:451-473`、markers `:475-524` |
| **v3** | `userData/recording-history.json` → `rec_recordings`：字段映射 `filePath/fileName/fileSize/thumbnail/createdAt`，`duration` 秒→`duration_ms` 毫秒，旧 id 写进 `description` 前缀 `legacy:`（可溯源），`status` 一律 `completed`、fps 一律 30 | 标志位 `data_migration_v3`；**逐行按 `file_name` 未删除行去重**（旧 id 不是 UUID，不能当判据）；文件不存在 / 空数组也落 done（避免每次启动再查） | 单条失败不阻断、计入 errors（下次整体重跑，靠 file_name 判重补剩余）；`database.handle` 拿不到或 `getPath` 失败直接返回并带 error | `dataMigrationsRecording.ts:8-20`、`:83-89`、`:94-103`、`:105-133`、`:138-149`、`:151-169` |
| **v4** | `pom_pomodoros.duration_ms` 存量秒值 ×1000（修「25 分钟番茄统计为 0」的 ÷60_000 口径 bug） | 标志位 `data_migration_v4_pomodoro_ms`；**`UPDATE` 与标志位在同一事务里**，防「已放大但未标记 → 重跑双重放大」 | 事务抛错整体回滚（下次干净重跑）；外层 `try` 在启动流程里，抛错只 console.error | `dataMigrationsPomodoro.ts:3-18`、`:38-42`、`:44-50`、`:53-63`；`src/main/index.ts:318-323` |

### 2.3 幂等与中断恢复的三条判据（照抄会出事，先理解形状）

| 判据类型 | 用在哪 | 为什么 |
| --- | --- | --- |
| **表里没有可判「是不是旧数据」的字段 → 只能记账** | markers → `rec_markers`（`dataMigrations.ts:480-481` 的注释） | 新行与旧行形状相同，二次执行会重复插入，故 `INSERT OR IGNORE` + 标志位双保险 |
| **内容自带可判重键 → 按内容判重** | v3 按 `file_name`（`dataMigrationsRecording.ts:138-147`）；014 按 UUID 正则短路已 remap 的行（`014:70`） | 允许「中断后重跑」真的把剩下的搬完，而不是被标志位挡回零 |
| **同事务改数 + 落标记** | v4（`dataMigrationsPomodoro.ts:53-62`） | 破坏性放大类改动**绝不能**「改完再单独记一笔」 |

**「有错不落标志位」是 v1/v2 的硬规矩**，并且连带决定归档时机：v1 失败 + v2 成功时若照样归档，`Preferences.json`/`Tag Data.json` 会被搬走、v1 重跑时 `existsSync` 短路、零错误被标 done → 数据静默永久缺失（`:281-284` 把这条写成了注释）。同理 `TagRepository.importMany` 逐条 try 跳过重名，避免「一条重名让 v1 永不 done、每次启动重跑报错、legacy JSON 永不归档」（`TagRepository.ts:200-215`）。

### 2.4 userData / resources 各放什么

| 位置 | 内容 | 依据 |
| --- | --- | --- |
| `userData/leaf.db`(+`-wal`/`-shm`) | 唯一被迁移链管辖的库 | `database.ts:20`、`:46` |
| `userData/file-index.db` | 文件索引，**独立库、独立 `meta`、不在迁移链里** | `src/main/modules/fileIndex/db.ts:2`、`:70` |
| `userData/{Preferences,Tag Data,Snippet Data,Folder Data,pomodoro-data,Music Data,Online Music Data,Wallpaper Data,Local File Library,Photo Data}.json` | v1/v2 的导入源（含已下线模块，保留只为归档） | `legacyArchive.ts:21-32`；`dataMigrations.ts:128`、`:147`、`:189`、`:233`、`:250` |
| `userData/config.json` | electron-store 默认文件（`aliases` / `ai.*` 的来源；**只读不删**，因为别的键仍在用） | `:328-329`、`:347`、`:414` |
| `userData/recording-history.json` / `clips.json` / `recording-settings.json` / `markers.json` | v3 与各子步的来源 | `dataMigrationsRecording.ts:32`；`dataMigrations.ts:440`、`:463`、`:489` |
| `userData/legacy-backup/<ISO ts>/` | 归档目录（可还原/可删） | `legacyArchive.ts:34`、`:72-74` |
| `userData/sync-snapshots/<ms>.json` | 同步拉平前的本地快照，留 5 份（与数据迁移无关，但同属「恢复去路」） | `dataSync.ts:48-49`、`:400-413` |
| `userData/leaf.db.bak.<ms>`、`leaf.db.pre-import.<ms>` | 自动备份与换库前保险 | `database.ts:78`；`dbBackup.ts:154` |
| 打包 `process.resourcesPath` | 只读产物（内置插件、`plugins.json`）；**不放 schema、不放种子数据** | `src/main/launcher/builtinPlugins.ts:26`；`src/main/launcher/market.ts:88`；仓库 `resources/` 仅 `icon.png` |

### 2.5 用户能碰到的入口（迁移中心）

`registerMigrationIpcHandlers` 在 `whenReady` 里注册（`src/main/index.ts:359`），六个通道：`migration:listArchives` / `:deleteArchive` / `:restoreArchive` / `:exportDb` / `:importDb` / `:factoryReset`（`src/main/ipc/migration.ts:21-58`）。破坏性操作内部 dialog 二次确认（`:12-13`）；`deleteArchive`/`restoreArchive` 都先把路径锚死在 `userData/legacy-backup/` 直下、越界即拒（`legacyArchive.ts:170-177`）。

**还原 = 明知会循环**：把归档还原回 userData 后，下次启动 `runDataMigrations()` 会再导一遍并再次归档 —— 代码里就写明了这层「无效循环」与建议（`legacyArchive.ts:206-213`）。

---

## 3. 两条线之间的接缝（容易踩的地方）

| 接缝 | 事实 | 依据 |
| --- | --- | --- |
| `leaf_meta` 不在迁移链里 | 3 个文件、8 处各自 `CREATE TABLE IF NOT EXISTS leaf_meta`；`meta`（schema 版）才是迁移建的 | `dataMigrations.ts:98-104`、`:334-338`、`:410-412`、`:436-438`、`:459-461`、`:485-487`；`dataMigrationsRecording.ts:74-80`；`dataMigrationsPomodoro.ts:38-42` |
| 同步清单不认 `leaf_meta` | 既不在 `SYNC_TABLE_SPECS` 也不在 `SYNC_EXCLUDED_TABLES`；审计只在单测跑，且单测库是纯迁移产物（没有 `leaf_meta`），所以缺口测不出来 | `dataSync.ts:64-151`、`:154-168`；`__tests__/dataSync.test.ts:234-239`；`__tests__/testDb.ts:24-30` |
| 恢复出厂后 v1/v2 会重跑 | 标志位与库同生共死；`dbBackup` 注释即按此写 | `dbBackup.ts:176-177` |
| 表被 DROP 而写方还在 | 见 §5-2 | `028:23` vs `ScreenshotRepository.ts:184` |
| 迁移「写了但执行不到」 | 见 §5-1 | `dataMigrations.ts:114-117` vs `:312-317` |

---

## 4. 加一个迁移的最短动作（把 §1.3 落成步骤）

1. 新建 `src/main/db/migrations/0NN_x.ts`：`version = 当前最大 + 1`、幂等 `up()`（规则见 §1.3 第 2-8 条）。
2. `migrations/index.ts` 末尾追加 import + push（`:18` 的「必须在文件末尾追加」）。
3. 补断言：重跑全量迁移不抛错、目标表/列确在（照 `migrations.test.ts:41-51` 的形状写）。
4. 若动了表集合：更新 `DB_SCHEMA.md` §2/§3，并给新表做同步归类（§3 第 1、2 行）。
5. 若是**搬数据**而非改结构：走数据迁移那条线（新建/扩展 `dataMigrations*` 函数、`leaf_meta` 标志位、`index.ts:302-323` 里挂上、失败不落标志位）。
6. 自查一句：**这份改动在中断后重跑会不会双份/双重放大？** 会的话按 §2.3 第三行改形状。

---

## 5. 已知缺陷（读代码读出来的，未改任何代码）

| # | 事实 | 影响 | 依据 |
| --- | --- | --- | --- |
| 1 | **五个 electron-store 子迁移在已迁移过的机器上永远不执行**：`runDataMigrations()` 在 v1+v2 都 done 时于 `:114-117` 直接 `return`，而五个子步的调用点在 `:312-317`（return 之后） | 老用户升级后 `aliases` / `ai.*` / `clips` / `recording.settings` / `markers.json → rec_markers` 这五路 legacy 数据**静默不搬**。现场佐证：dev 库 `leaf_meta` 只有 `data_migration_{v1,v2,v3,v4_pomodoro_ms}` 四条，没有任何 `data_migration_{aliases,ai,clips,recording_settings,markers}`，而 `userData/config.json` 确实存在 | `dataMigrations.ts:106-117`、`:312-317`；2026-09-23 只读查询 `leaf_meta` |
| 2 | `ss_screenshots` 被 028 删了，`ScreenshotRepository` 仍在读写它。以前真被调用（树内截图覆盖层的 `ok` 分支动态 import 保存历史，错误被嵌套 catch 降成一行 console）；**2026-09-23 那个调用方随编辑器一起删除**，现在没人调它了 | 在删除之前每次截图保存历史都会 `no such table: ss_screenshots`；仓库层注释还写着「Schema: ss_screenshots (已在 001_init.ts 中定义)」，与迁移链相反 | `028:23`；`ScreenshotRepository.ts:6`、`:184`；`ipc/screenshotHistory.ts:33`、`:239`（该文件的 `registerScreenshotHistoryHandlers` 零调用方）；清理账见 HANDOFF §11 |
| 3 | 录屏设置的 legacy 导入落到 pref `recording.settings`，**生产读的是 `recording.default`** | 即使子步能跑（见 #1），搬进来的设置也没人读；只有单测断言 `recording.settings`（`:49`、`:117`），所以测试绿、功能空 | `dataMigrations.ts:465-466` vs `RecordingSettingsRepository.ts:4`、`:58`；全仓 `'recording.settings'` 仅出现在迁移与测试 |
| 4 | 同步清单里两处 `titleCol` 指到了不存在的列：`reminders` 用 `'text'`（表是 `title`）、`pom_tasks` 用 `'name'`（表是 `title`） | 冲突副本仍会插，但 `（冲突副本 · 设备 · 时间）` 那截写进一个非列键、回写时被按真实列过滤掉（`dataSync.ts:359-366`）→ 副本与赢家标题一模一样，用户分不清哪条是副本 | `dataSync.ts:98-102`；`024:15-17`；`001:168-170`；`syncMerge.ts:144-149` |
| 5 | 「version 严格递增 / 只能追加」没有守卫，而 `maxKnown` 取数组末元素 | 插错位置不会报错，却会让降级告警（`database.ts:155-160`）算错基线 | `migrations/index.ts:4-8`；`database.ts:154`；`migrations.test.ts` 全文无此项 |
| 6 | schema 迁移失败会击穿启动（唯一没包 try 的一步），而日志此刻落不了库 | 现场只剩 console/stderr；`log_entries` 里查不到那次失败 | `src/main/index.ts:302`；`database.ts:11`、`:164-171`；`LogService.ts:116-124` |
| 7 | v3 的判重键是 `file_name`（未删除行），而 v3 之后仍可重复执行；同时 v3 的 `status`/`fps` 一律写死 | 同名录制文件（或后来改名）判重不成立 → 有重复行风险；恢复的录制元数据被统一标成 `completed` | `dataMigrationsRecording.ts:138-149`、`:151-162` |
| 8 | `011_pomodoro_task_title` 用启发式猜「哪条 note 其实是标题」 | 猜错即把用户备注搬成标题，且**没有回退位**（只加列、无 flag，重跑因 `task_title IS NULL` 条件而不再改同一行） | `011:35-63` |

### 未证实（值得查，但代码里读不出依据）

| 事项 | 为什么值得查 |
| --- | --- |
| v1/v2 是否还有真实用户在触发（即还有多少 userData 带着 legacy JSON） | 决定 §5-1 是「历史洞」还是「正在发生的丢数据」；代码里没有埋点 |
| 生产环境的库是否出现过 ≥50 MB（自动备份阈值） | 若不达标，迁移前其实**没有**任何自动备份（`database.ts:21`、`:71-74`） |
| 013/018/028 删表前是否需要保留行数据 | 现在是无条件 DROP，历史库里被删的表已无法回查 |
| `migrations.test.ts:53` 那条 `it.todo` 原本断言什么 | 文件头自述本测试随 2026-09-22 事故丢过头尾（`:11-12`），018 的删表断言至今空缺 |
| `dataMigrations.ts:312-317` 五个子步是否**有意**放在早退之后 | 若是刻意的（例如只服务首轮升级），注释应写明；现在注释只解释「自包含、可独立调用」（`:333`），读不出现意 |
| `snip_folders` / `geo_cache` / `tag_tags.usage_count` 是否还有外部工具指望 | 三者今天在本仓都无读写方（`DB_SCHEMA.md` §8-2/3/4）；若有外部消费者，删它们就是破坏性变更 |

# Leaf · SQLite 表结构与前缀规则

> **本文是 2026-09-23 从代码重生成的。** 2026-09-22 的误删事故把 `DB_SCHEMA.md` 与 `MIGRATIONS.md` 的原件、以及各备份池里的副本一起带走了（这笔账记在 `HANDOFF.md:693-697`：「6 个被链接指向的文件在基线 `8446ff2` 就没有、各池也无副本」）。
> 所以：**下面每一条结论都指向代码行**，行号是这次逐文件读出来的；代码里查不到依据的一律写「未证实」并说明为什么值得查，不做补全式猜测。
> 另：`001_init` 的注释把「表前缀规则」指向本文 **§4**（`src/main/db/migrations/001_init.ts:7`），本次重生成保留了这个小节号，那处引用没有断。

**本文的事实来源**

| 来源 | 用来确认什么 |
| --- | --- |
| `src/main/db/migrations/001_init.ts` … `030_sync_state.ts`（30 个文件全读） | 每张表由谁建、谁改、谁删；索引与 FTS；主键/软删约定 |
| `src/main/db/migrations/index.ts` | 迁移注册表与「只追加」约定 |
| `src/main/db/database.ts` | 库文件位置、PRAGMA、迁移执行器、打开前备份 |
| `src/main/db/repo.ts`、`src/main/db/repos/*.ts`（17 个） | 每个域实际读写哪些表 → 前缀规则与实际消费者 |
| `src/main/launcher/dataSync.ts`、`src/main/launcher/syncMerge.ts`、`src/main/launcher/docStore.ts` | 哪些表进同步、`__rev` 从哪来、`launcher_docs` / `sync_state` 的读写方 |
| `src/main/db/dataMigrations*.ts`、`legacyArchive.ts`、`dbBackup.ts` | 数据迁移与备份/还原（详见 MIGRATIONS.md） |
| `src/main/services/LogService.ts`、`src/main/modules/fileIndex/db.ts` | `log_entries` 写方；第二个 sqlite 文件 `file-index.db` |
| 实机只读核对：`~/Library/Application Support/leaf-desktop/leaf.db`（dev userData，`sqlite3 -readonly`，2026-09-23） | `sqlite_master` 里真实存在的表/索引/触发器、`MAX(meta.version)=30`、`leaf_meta` 现有标志位 |

约定：正文里的路径都相对仓库根；`:NN` 是行号。表清单里所有「现存」= 迁移链跑完后的净结果，与实机 `sqlite_master` 一致。

---

## 0. 库与连接

| 项 | 值 / 行为 | 依据 |
| --- | --- | --- |
| 主库文件 | `userData/leaf.db`（dev 下 userData = `~/Library/Application Support/leaf-desktop`，包名 `leaf-desktop`） | `src/main/db/database.ts:20`、`:46`；`package.json:2` |
| 打开时机 | 懒打开：任何 `database.handle` 第一次被取时才开；开完立刻跑迁移；`app.isReady()` 之前取句柄直接抛错 | `src/main/db/database.ts:49-68`、`:29-32`；`src/main/index.ts:302` |
| PRAGMA | `journal_mode=WAL`、`foreign_keys=ON`、`synchronous=NORMAL`、`temp_store=MEMORY` | `src/main/db/database.ts:61-64` |
| 打开前备份 | 库 > 50 MB 时先 `wal_checkpoint(TRUNCATE)` 再复制成 `leaf.db.bak.<ts>`，`quick_check` 不过就丢弃该备份，最多留 3 份 | `src/main/db/database.ts:21-22`、`:70-104` |
| 第二个库文件 | 文件索引走**独立文件** `userData/file-index.db`，里面有自己的一张 `meta(key,value)` —— 与 `leaf.db` 的 `meta(version,applied_at)` 同名不同库，别混 | `src/main/modules/fileIndex/db.ts:2`、`:70`、`:265`、`:271` |
| `resources` 侧 | 打包后的 `process.resourcesPath` 只放只读产物（内置插件目录、`plugins.json`），**不含任何 schema 或种子数据**；仓库 `resources/` 目前只有 `icon.png` | `src/main/launcher/builtinPlugins.ts:26`；`src/main/launcher/market.ts:88` |

---

## 1. 列与行约定

| 约定 | 内容 | 依据 |
| --- | --- | --- |
| 主键 | 业务表一律 `id TEXT PRIMARY KEY`，值为 UUIDv4；例外见下表 | `src/main/db/migrations/001_init.ts:9-12` |
| 时间戳 | `created_at` / `updated_at` 为 INTEGER **unix ms**；时间戳列普遍配 DESC 索引服务「最近」查询 | `src/main/db/migrations/001_init.ts:11-13`、`:55`、`:109`、`:151`、`:223` |
| 软删除 | 主流方言是 `deleted_at INTEGER`（NULL = 活）；**笔记与提醒用 `is_deleted INTEGER 0/1`**（`notes:31`、`reminders:22`）—— 两种方言并存 | `src/main/db/migrations/001_init.ts:53`；`023_notes.ts:31`；`024_reminders.ts:22` |
| 仓库层默认过滤 | 「业务表默认过滤 `deleted_at IS NULL`」是 repo.ts 写的约定；公共软删/硬删 SQL 模板在 `repo.ts:48-53` | `src/main/db/repo.ts:6-9`、`:48-53` |
| 局部唯一索引 | 重名只约束未删除行：`idx_tag_tags_unique_name_active ON tag_tags(name) WHERE deleted_at IS NULL` | `src/main/db/migrations/002_tag_softdelete.ts:32-36`；同型：`003:32-34` |
| 外键 | 只有两张子表声明了 FK：`snip_snippet_contents.snippet_id`、`rec_segments.recording_id`，都是 `ON DELETE CASCADE` | `004_snippet_contents_and_folder_meta.ts:30`；`008_recording_segments_and_status.ts:61` |
| 无 CHECK 的枚举 | `rec_recordings.status` 想加 CHECK 但 SQLite 改不了已有列约束，008 明确放弃、改由 Repository 写入路径保证 | `008_recording_segments_and_status.ts:48-49` |
| 自增主键例外 | `log_entries.id`、`rec_segments.id` 用 `INTEGER PRIMARY KEY AUTOINCREMENT`；`om_*` 用外部平台返回的 `INTEGER PRIMARY KEY`（已随 013 删除） | `001_init.ts:349`；`008:54`；`006_online_music_schema.ts:29` |

---

## 2. 表清单（现存 25 张实体表 + 3 张 FTS5 虚表；实机 `sqlite_master` 另有 12 张 `x_fts_*` 影子表）

「谁写它」只列实际执行 INSERT/UPDATE/DELETE 的文件；纯读方不列。

### 2.1 片段（snippet）

| 表 | 用途 | 主键 | 谁写它 |
| --- | --- | --- | --- |
| `snip_snippets` | 代码片段主表（标题/语言/收藏/使用次数/`trigger` 文本扩展关键词） | `id` TEXT（`001:209`）；`trigger` 列由 `020:16` 加 | `src/main/db/repos/SnippetRepository.ts:279`（插）、`:336`/`:387`/`:402`（改）、`:394`/`:418`（硬删）、`:449`（迁移导入） |
| `snip_snippet_contents` | 片段的多内容块（`value` **密文**入库，`content_type` text/rich） | `id` TEXT + FK→`snip_snippets` 级联（`004:23-30`） | `SnippetRepository.ts:296`（密文写入 `:304`）、`:353`/`:465`（整块重写，先 `:351`/`:463` 删） |
| `snip_tags` | 片段 ↔ 全局标签的关联 | `(snippet_id, tag_id)` 复合（`001:200-205`） | `SnippetRepository.ts:312`、`:372`/`:470`（先 `:370`/`:468` 删） |
| `snip_snippets_fts` | FTS5 外部内容镜像（见 §5） | rowid 镜像（`001:225-231`） | 由 005 的三个触发器写，无人直接写（`005:23-45`） |
| `snip_folders` | 001 设计的片段文件夹树，**今天没有任何读写方**（片段树实际走 `folder_folders`） | `id` TEXT（`001:189-197`） | 无人写（全仓检索只有建表、注释与同步清单：`001:189`、`SnippetRepository.ts:6`、`dataSync.ts:85`）→ 见 §8-2 |

### 2.2 文件夹 / 标签（跨域共享）

| 表 | 用途 | 主键 | 谁写它 |
| --- | --- | --- | --- |
| `folder_folders` | 文件夹树（带磁盘 `path`、置顶、排序、`default_language`/`is_open`/`order_index` 由 004 加） | `id` TEXT（`001:254-265`） | `src/main/db/repos/FolderRepository.ts:144`/`:280`（插）、`:171`/`:223`/`:236`/`:250`/`:256`/`:263`（改）、`:201`（删，删前把子片段的 `snip_snippets.folder_id` 置空 `:195-197`）；上层 `src/main/stores/FolderDataStore.ts:15-53` |
| `tag_tags` | 全局标签字典（跨片段/笔记复用） | `id` TEXT + `name` 局部唯一（`001:236`、`002:32-36`） | `src/main/db/repos/TagRepository.ts:98`（插）、`:151`/`:170`（改）、`:187`（软删）、`:205`（迁移导入；重名条目逐条跳过，免得整批回滚把 v1 卡死 `:200-215`）；`014:64` 也曾在 remap 时插过（photo 域已下线） |

### 2.3 笔记 / 提醒

| 表 | 用途 | 主键 | 谁写它 |
| --- | --- | --- | --- |
| `notes` | 本地 Markdown 笔记（明文存储） | `id` TEXT（`023:25-34`） | `src/main/db/repos/NotesRepository.ts:164`（插）、`:186`/`:204`/`:213`/`:290`（改）、`:220`/`:226`（删）；上层 `src/main/ipc/notes.ts` |
| `note_folders` | 笔记文件夹 | `id` TEXT（`023:16-22`） | `NotesRepository.ts:272`（插）、`:281`（改）、`:291`（删） |
| `notes_fts` | FTS5 镜像（**只建不查**，见 §5） | rowid 镜像（`023:42-44`） | 023 的三个触发器（`023:47-56`） |
| `reminders` | 提醒事项（`due_at`/`remind_at`/`notified_at` 供定时通知去重） | `id` TEXT（`024:15-26`、`025:19`） | `src/main/db/repos/ReminderRepository.ts:169`（插）、`:193`/`:212`/`:224`/`:232`/`:253`/`:261`（改）、`:238`（删）；上层 `src/main/services/ReminderService.ts` |
| `reminders_fts` | FTS5 镜像（**唯一真正被查的 FTS 表**） | rowid 镜像（`024:35-37`） | 024 的三个触发器（`024:39-48`） |

### 2.4 番茄钟（pomodoro）

| 表 | 用途 | 主键 | 谁写它 |
| --- | --- | --- | --- |
| `pom_tasks` | 任务（`priority`/`estimate_ms`/`status`/软删，`project_id` 由 009 加） | `id` TEXT（`001:168-181`；`009:54-56`） | `src/main/db/repos/PomodoroRepository.ts:188`（插）、`:247`/`:280`（改）、`:594`（迁移导入） |
| `pom_pomodoros` | 番茄记录（`project_id` 010、`task_title` 011 快照列） | `id` TEXT（`001:157-165`） | `PomodoroRepository.ts:407`（插）、`:343`（改）、`:618`（迁移导入）；`011:56-62` 与 `dataMigrationsPomodoro.ts:55` 都批量改过它 |
| `pom_projects` | 项目（色值 + 排序 + 软删；009 建、012 把 009 造的「默认」项目软删掉） | `id` TEXT（`009:33-41`） | `src/main/db/repos/ProjectRepository.ts:85`（插）、`:120`/`:133`（改）；`009:66-69`、`012:30` |
| （无表） | 全局设置 / 项目级时长覆盖 / 每项目 timer 状态 → 全部落 `pref_preferences` | — | `PomodoroRepository.ts:69`（`pomodoro_settings`）、`ProjectSettingsRepository.ts:14`、`PomodoroTimerStateRepository.ts:17` |

### 2.5 录屏（recording）

| 表 | 用途 | 主键 | 谁写它 |
| --- | --- | --- | --- |
| `rec_recordings` | 录制记录（008 补 `has_system_audio`/`recovered_at`/`cursor_style`/`error_message`/`quality`） | `id` TEXT（`001:90-108`、`008:42-47`） | `src/main/db/repos/RecordingRepository.ts:209`（插）、`:274`/`:309`/`:324`/`:367`（改）、`:343`（硬删，先手动清子表 `:341-342`） |
| `rec_markers` | 时间标记（`color` 由 026 加） | `id` TEXT（`001:112-118`、`026:20`） | `src/main/db/repos/MarkerRepository.ts:60`（插）、`:89`/`:107`/`:113`（改）、`:95`/`:100`（删）；`dataMigrations.ts:493`（legacy markers 导入，秒→毫秒 `:503-508`） |
| `rec_segments` | 暂停分片（`state` 带列内 CHECK：`committed`/`discarded`） | `id` INTEGER 自增 + `UNIQUE(recording_id, seg_index)`（`008:53-63`） | `src/main/db/repos/RecordingSegmentRepository.ts:58`（插）、`:76`/`:130`（改）、`:141`（删） |

### 2.6 截图索引（shot）

| 表 | 用途 | 主键 | 谁写它 |
| --- | --- | --- | --- |
| `shot_index` | 对**磁盘上真实存在**的截图建 OCR 索引（不捕捉、不复制；`ocr_status` pending/done/failed） | `file_path` TEXT（绝对路径即主键，`029:18-26`） | `src/main/db/repos/ShotIndexRepository.ts:53`（upsert）、`:74`（prune 删除）、`:93`（OCR 回填）；驱动方 `src/main/services/ScreenshotIndexService.ts:170-171`、`:200`、`:209-211` |

### 2.7 偏好 / 使用统计 / 插件文档

| 表 | 用途 | 主键 | 谁写它 |
| --- | --- | --- | --- |
| `pref_preferences` | K-V 偏好（value 一律 JSON 字符串或标量字符串） | `key` TEXT（`001:298-302`） | `src/main/db/repos/PrefRepository.ts:43`（upsert）、`:52`（删）、`:59`（批量导入）；直连该表的还有 `dataSync.ts:277`、`RecordingSettingsRepository.ts:92`、`PomodoroRepository.ts:582` |
| `usage_records` | 最近使用 + 频次（`use_count` 由 021 加，`ON CONFLICT` 里 `+1`） | `module_id` TEXT（`007:23-28`、`021:16`） | `src/main/db/repos/UsageRepository.ts:40`（upsert）、`:69`（清空）；`module_id` 的取值域是 `src/shared/modules.ts:44` 的 `MODULES.id`（`UsageRepository.ts:13` 把它写作 `constants/modules.ts`，那份在渲染端 `src/renderer/src/constants/modules.ts`） |
| `usage_favorites` | 模块收藏（唯一进同步清单的 usage 表） | `module_id` TEXT（`007:32-37`） | `UsageRepository.ts:76`（加）、`:84`（取消） |
| `launcher_docs` | 插件文档 KV，`doc_id` 复合成 `<pluginId>:<docId>` 以隔离命名空间 | `doc_id` TEXT（`019:15-20`） | `src/main/launcher/docStore.ts:40`（upsert）、`:63`/`:91`/`:135`（删）、`:137`（导入） |

### 2.8 记账与系统

| 表 | 用途 | 主键 | 谁写它 |
| --- | --- | --- | --- |
| `meta` | **schema 版本表**：一行一个已应用版本（执行器与 001 都建它，`CREATE IF NOT EXISTS` 两处在） | `version` INTEGER（`database.ts:144-147`；`001:22-25`） | `src/main/db/database.ts:166-169`（迁移成功即写） |
| `leaf_meta` | **数据迁移标志位 + 归档目录记账**（`data_migration_v1/v2/v3/v4_pomodoro_ms`、`data_migration_{aliases,ai,clips,recording_settings,markers}`、`legacy_archive_dir`） | `key` TEXT（`dataMigrations.ts:98-104`） | `dataMigrations.ts:166-170`、`:269-273`、`:294-297`、`:359-362`、`:395-400`；`dataMigrationsRecording.ts:172-175`；`dataMigrationsPomodoro.ts:58-61`。**不在任何迁移文件里**（§8-5） |
| `log_entries` | 落地日志（与内存 ring buffer 互补，保留 5000 行） | `id` INTEGER 自增（`001:348-356`） | `src/main/services/LogService.ts:118-124`（插）+ `:128-134`（trim，常量 `:33`） |
| `sync_state` | 多设备三方合并的**本机基线 + 墓碑**（`deleted_at` 非空即墓碑），刻意不进 bundle | `(tbl, row_key)`（`030:24-30`） | `src/main/launcher/dataSync.ts:326-329`；读 `:315-323` |
| `geo_cache` | 017 为 Nominatim 反地理编码建的缓存表 | `key` TEXT（`017:23-28`） | **无读写方**（全仓只剩建表与排除清单 `dataSync.ts:137`）→ §8-3 |

---

## 3. 已下线的表（DROP 记录，别照着旧文档找表）

| 表 | 谁建的 | 谁删的 | 理由（原文） |
| --- | --- | --- | --- |
| `music_tracks` / `music_playlists` / `music_playlist_items` | `001:307`/`:327`/`:336` | `013_remove_music_schema.ts:20-22` | 音乐播放器下线 |
| `om_liked_*` ×5、`om_play_history`、`om_user_playlists` | `006:27-127` | `013:25-31` | 在线音乐下线 |
| `photo_photos` / `photo_albums` / `photo_album_items` / `photo_tags` / `photo_smart_albums` / `photo_embeddings` / `photo_folders` | `001:30`/`:60`/`:70`/`:79`、`014:39`、`015:15`、`016:52` | `018_remove_photos_and_wallpaper.ts:25-31` | 图片管理迁独立项目；`tag_tags` 明确保留（`018:15`） |
| `wall_collections` / `wall_files` | `001:272`/`:281` | `018:34-35` | 同上 |
| `lib_files` | `003:22-30` | `018:38` | 「音乐下线后已无消费方」（`018:13`） |
| `rec_clips` | `001:121` | `027_drop_rec_clips.ts:18` | 剪辑改直转码，「表在本仓已无任何读写方」（`027:8-9`） |
| `ss_screenshots`（连同 `idx_ss_screenshots_*`） | `001:136` | `028_remove_screenshot.ts:21-23` | 截图模块迁出 |

DROP 全部包在 `db.transaction(() => { … })()` 里、且一律 `IF EXISTS`（`013:18-32`、`018:23-39`、`027:17-19`、`028:20-24`）。

---

## 4. 前缀规则

**规则本身**：表名 = `<域前缀>_<实体>`，域前缀在 001_init 的分节注释里一次性定下来（`001:19-358` 的 `-- PHOTOS / RECORDINGS / SCREENSHOTS / POMODORO / SNIPPETS / TAGS / FOLDERS / WALLPAPERS / PREFERENCES / MUSIC / LOG` 分节）。索引名 = `idx_<表名>[_<列>]`，触发器名 = `<基表>_<ai|ad|au>`（`023:47-56`）。

| 前缀 | 域 | 现存表 | 首次引入 | 状态 |
| --- | --- | --- | --- | --- |
| `snip_` | 代码片段 | `snip_snippets`、`snip_snippet_contents`、`snip_tags`、`snip_folders`、`snip_snippets_fts` | `001:189-231`、`004:23` | 在用（`snip_folders` 空转） |
| `pom_` | 番茄钟 | `pom_tasks`、`pom_pomodoros`、`pom_projects` | `001:157-182`、`009:33` | 在用 |
| `rec_` | 录屏 | `rec_recordings`、`rec_markers`、`rec_segments` | `001:90-131`、`008:53` | 在用（`rec_clips` 已删） |
| `shot_` | 截图库 OCR 索引 | `shot_index` | `029:18` | 在用；029 特意说明它与已下线的 `ss_` 无关（`029:5-7`） |
| `note_` | 笔记 | `note_folders` | `023:16` | 在用（但主表没走前缀，见下方反例） |
| `tag_` | 全局标签 | `tag_tags` | `001:236` | 在用 |
| `folder_` | 文件夹 | `folder_folders` | `001:254` | 在用 |
| `pref_` | 偏好 | `pref_preferences` | `001:298` | 在用 |
| `usage_` | 使用统计/收藏 | `usage_records`、`usage_favorites` | `007:23-37` | 在用 |
| `launcher_` | 启动器 | `launcher_docs` | `019:15` | 在用 |
| `log_` | 日志 | `log_entries` | `001:348` | 在用 |
| `sync_` | 同步 | `sync_state` | `030:24` | 在用 |
| `ss_` `photo_` `wall_` `music_` `om_` `lib_` | 旧模块 | 已随各自表全删（§3） | `001`/`003`/`006` | 前缀视为**保留字，不再复用** |
| `geo_` | 017 的反地理编码缓存 | `geo_cache`（表在，无读写方 → §8-3） | `017:23` | 半下线 |

**现状里的反例（改代码前先知道）**：`notes`、`reminders` 两张业务主表不带前缀（`023:25`、`024:15`）；`geo_cache` 用了前缀却无归属域（`017:23`）。`tag_tags`/`folder_folders`/`pref_preferences` 属于「前缀=实体名」的重复式命名（`001:236`、`:254`、`:298`）。

**`pref_preferences` 的 key 命名（第二套「前缀」）**：现状至少三套方言并存 —— 裸名 `theme`/`editor`（`src/main/stores/PreferencesDataStore.ts:42-43`）、冒号命名空间 `onboarding:*`/`launcher:*`/`theme:activeUser`（同文件 `:44-54`）、点号命名空间 `mcp.servers`/`mcp.toolCache`（`src/main/services/mcp/store.ts:15`；`src/main/launcher/dataSync.ts:182-183`）；下划线域前缀另有 `pomodoro_settings`（`PomodoroRepository.ts:69`）、`recording.default`（`RecordingSettingsRepository.ts:58`）、`pomodoro_timer_state_{projectId}`（`PomodoroTimerStateRepository.ts:17`）、`pomodoro_project_settings_{projectId}`（`ProjectSettingsRepository.ts:14`）。**新 key 建议冒号或点号分段，别再往下划线方言里加**（这条是本仓库现状归纳，不是代码里的强制约束）。

---

## 5. FTS5 与索引

| 镜像 | 基表声明 | 虚表声明 | 触发器 | rebuild |
| --- | --- | --- | --- | --- |
| `snip_snippets_fts(title,content,description)` | `001:208-220` | `001:225-231`（`content='snip_snippets'`, `content_rowid='rowid'`） | `snip_snippets_fts_ai/_ad/_au` — `005:23-43` | 005 跑 `INSERT INTO … ('rebuild')` 一次把存量拉进镜像（`005:44-45`） |
| `notes_fts(title,content)` | `023:25-34` | `023:42-44` | `notes_ai/_ad/_au` — `023:47-56` | 不需要（同事务里表先建、触发器后建） |
| `reminders_fts(title,notes)` | `024:15-26` | `024:35-37` | `reminders_ai/_ad/_au` — `024:39-48` | 同上 |

- **005 的来历**就是「001 建了 external-content 镜像却没建触发器」这个事故级遗漏（`005:3-13`）。给已有数据的表加 FTS 时必须照 005 补一次 `rebuild`。
- **实机核对**：dev 库 `sqlite_master` 里确有 9 个 FTS 触发器（`snip_snippets_fts_ai/ad/au`、`notes_ai/ad/au`、`reminders_ai/ad/au`），以及 sqlite 自建的影子表 `x_fts_config/_data/_docsize/_idx`。这些影子表**是索引不是数据**：同步归类时用 `/_fts(_)$/` 一律滤掉（`src/main/launcher/dataSync.ts:162-164`）。
- **实际使用情况**（别以为建了 FTS 就在用）：
  - 只有提醒在用：`JOIN reminders_fts f ON f.rowid = r.rowid WHERE f MATCH @search ORDER BY rank`，参数是 `"${q}"*` 前缀短语（`src/main/db/repos/ReminderRepository.ts:124-130`），且异常时静默回退 LIKE（`:110`、`:131-135`）。
  - 片段搜索**不走 FTS**：`contents.value` 密文入库（`SnippetRepository.ts:304`），SQL/FTS 匹配不到密文，且 FTS 给不了子串包含语义 → 全量解密后 JS 过滤（`:246-258`）。`snip_snippets_fts` 在生产查询里没人用，只有单测在查（`src/main/db/__tests__/5_6b.snippet.test.ts:92`）。
  - 笔记同样不走 FTS，明文 LIKE 下推（`NotesRepository.ts:133-139`）。
- **`content` 列的双重身份**：`snip_snippets.content` 存第一个内容块的**明文**（`SnippetRepository.ts:286`），`snip_snippet_contents.value` 存**密文**（`:304`）—— 镜像索引的是前者。
- **索引惯例**：时间戳 `DESC`（`001:55-58`、`:109-110`、`:223`、`029:27`）；带软删的表用 partial index（`008:72-76`、`009:43-47`、`009:58-62`、`010:41-45`、`002:32-36`）；外键子表用 `(父 id, 序号)` 复合索引（`004:33-36`、`008:65-68`）。
- 文件索引另有其库：`userData/file-index.db` 的 `files` + `files_fts`（unicode61）+ `files_tri`（trigram 中缀兜底）+ `dirs` + 自己的 `meta`，触发器同型（`src/main/modules/fileIndex/db.ts:36-64`、`:70`、`:76`）。它**不在 `leaf.db` 里**，也就不受本文 §2 与迁移链管辖。

---

## 6. 与多设备同步的结构耦合（只讲与表结构有关的部分）

同步协议本身不在这份文档里。但**表结构决定一张表能不能被同步**，判据都是列：

| 结构要求 | 为什么 | 依据 |
| --- | --- | --- |
| 必须给出主键列组 `pk`（可以是复合，如 `snip_tags` 的 `(snippet_id, tag_id)`） | rowKey 与删除都按它拼 | `src/main/launcher/dataSync.ts:64-107`；`syncMerge.ts:29` |
| 必须能算出**行修订号**：本表有 `updated_at` → 否则 `created_at` → 否则声明 `parent{table,childCol,parentCol,revCol}` 借父行的时间戳 | bundle 里每行带 `__rev`（`SyncBundle.version: 2`），子表自己没有可用时间戳时只能问父行 | `dataSync.ts:56-61`、`:189`、`:220`、`:283-300` |
| 一张时间戳列都没有、又拿不到父行 → 修订号按 0 处理（宁可不覆盖用户的编辑） | `revOfRemoteRow` 的 fail-safe | `dataSync.ts:200-217` |
| 不同步就必须在 `SYNC_EXCLUDED_TABLES` 点名并写理由；`syncExclusionAudit()` 负责抓「既不在清单也不在排除表」的新表 | 归类漏判要能被报出来 | `dataSync.ts:116-118`、`:120-151`、`:154-168` |
| `meta` / `sync_state` 永不进 bundle | 一个是本机 schema 状态、一个是本机基线，同步过去等于两台设备共用「上次见过什么」 | `dataSync.ts:121-122`；`030_sync_state.ts:11-13` |

**当前这张表与 schema 的偏差**（只报，不改）：`syncExclusionAudit()` 只在单测里跑（`src/main/launcher/__tests__/dataSync.test.ts:234-239`），启动/同步路径都不跑；且实机 `leaf.db` 里的 `leaf_meta` 既不在同步清单也不在排除表（`dataSync.ts:64-151`）—— 单测之所以绿，是因为它的库是纯迁移产物、不含 `leaf_meta`（`src/main/db/__tests__/testDb.ts:24-30`）。

---

## 7. 加一张新表要走哪几步

| # | 动作 | 依据 |
| --- | --- | --- |
| 1 | 新建 `src/main/db/migrations/0NN_<短名>.ts`，`export const m0NN_x: Migration = { version: NN, name, up(db) }`；`version` 取当前最大 + 1 | 接口 `src/main/db/migrations/index.ts:12-16`；注册表现止于 `030_sync_state.ts:19-21` |
| 2 | **只在文件末尾追加** import 并 push 进数组，不改已发布版本 | `migrations/index.ts:4-8`、`:18`、`:50` |
| 3 | 建表用 `CREATE TABLE IF NOT EXISTS`；加列没有 `IF NOT EXISTS`，必须先 `PRAGMA table_info(...)` 查（008/009/020/022/025/026 都是这个形状） | `002:24-29`、`008:36-47`、`025:16-20` |
| 4 | 列约定：`id TEXT PRIMARY KEY` + `created_at`/`updated_at` unix ms + 软删列；带软删的索引加 `WHERE deleted_at IS NULL` | §1、`009:43-47` |
| 5 | 要 FTS 就必须**同时**建触发器，且基表已有数据时补一次 `('rebuild')`；只建虚表是 005 修过的那个坑 | `005:3-13`、`005:23-45`；正例 `023:42-56` |
| 6 | 写 repo 并挂进 `src/main/db/repos/index.ts`（现 17 个 repo 全从这里出口），repository 只取 `database.handle`、写路径用 prepared statement + 单条事务 | `src/main/db/repo.ts:4-8`；`src/main/db/repos/index.ts:1-82` |
| 7 | 同步归类：能同步就加 `SYNC_TABLE_SPECS`（要能给出 `pk` + 修订号来源），不能同步就加 `SYNC_EXCLUDED_TABLES` 并写理由 | §6；`dataSync.ts:64-107`、`:120-151` |
| 8 | 补一条「重跑全量迁移仍幂等」的断言（现有护栏就是这么写的），并同步更新本文与 `MIGRATIONS.md` 的版本表 | `src/main/db/__tests__/migrations.test.ts:47-51` |

> 注意：**「只追加、版本严格递增」目前只是注释里的约定**，没有任何测试或执行器检查（`migrations/index.ts:4-7`；全量检索 `migrations[` 只有 `src/main/db/database.ts:154` 一处按下标取末元素当「代码已知最大版本」—— 数组乱序会让那条降级告警失灵）。

---

## 8. 现状偏差（读代码读出来的，未修改任何代码）

| # | 事实 | 依据 |
| --- | --- | --- |
| 1 | `ScreenshotRepository` 仍在读写**已被 028 删掉**的 `ss_screenshots`，且截图完成事件真会走到它（错误被嵌套 try/catch 吞成一行 `console.error`） | `src/main/db/repos/ScreenshotRepository.ts:6`（「Schema: ss_screenshots (已在 001_init.ts 中定义)」）、`:184`；`src/main/ipc/screenshotHistory.ts:33`、`:239`；`src/main/services/ScreenshotService.ts:507-515`；`028_remove_screenshot.ts:23`。另：`registerScreenshotHistoryHandlers`（`ipc/screenshotHistory.ts:29`）全仓无调用方 |
| 2 | `snip_folders` 建了、还挂在同步清单上，但无读写方；片段树走 `folder_folders` | `001:189-198`；`dataSync.ts:85`；`FolderRepository.ts:195-201` |
| 3 | `geo_cache` 无任何读写方（017 为素材库建的 Nominatim 反地理编码缓存，`017:8`；photo 域已随 018 下线） | `017:8`、`:22-29`；`dataSync.ts:137`；全仓检索无其他命中 |
| 4 | `tag_tags.usage_count` 今天没人维护：唯一的 `bumpUsage()` 零调用方，014 的那次刷新只统计已删掉的 `photo_tags` | `TagRepository.ts:193-199`；`014:92-96`；`018:25` |
| 5 | `leaf_meta` 不在迁移链里，由 8 处 `CREATE TABLE IF NOT EXISTS` 各自自建；因此「v30 之前存在哪张表」这件事不看迁移文件也能漂移 | `dataMigrations.ts:98-104`、`:334-338`、`:410-412`、`:436-438`、`:459-461`、`:485-487`；`dataMigrationsRecording.ts:74-80`；`dataMigrationsPomodoro.ts:38-42` |
| 6 | 笔记/提醒用 `is_deleted` 布尔软删，其余业务表用 `deleted_at` 时间戳；同步与统计两侧都得到处特判 | `023:31`、`024:22` vs `001:53` 等 |
| 7 | 录制的 `status` 枚举只靠写入路径约束（SQLite 无法给已有列补 CHECK，008 明说放弃） | `008:48-49`；`RecordingRepository.ts:18`（「status 枚举（业务层保证；SQLite CHECK 未加，详见 008 注释）」）、`:32` |
| 8 | 旧注释会说 FTS「当前 schema 缺 trigger、写入时手动 upsert」，与 005/`:315` 的现状互相矛盾（该头注释是 005 之前的遗留） | `SnippetRepository.ts:9` vs `:315`、`:377` |

### 未证实（值得查，但没有依据不写结论）

| 事项 | 为什么值得查 |
| --- | --- |
| `ss_screenshots` 是「有意留表待迁移工具读」还是纯漏清 | 决定 §8-1 是删代码还是补表；`028:8-9` 说共用设施保留，但没提 `ScreenshotRepository` |
| `snip_snippets_fts` / `notes_fts` 是否曾计划成为搜索主路径 | 若是，「只建不查」是待接线；若否，两处镜像是常驻写放大（`001:225`、`023:42`） |
| 历史用户库里是否残留被 013/018/028 删掉的表的**行数据**（删表即丢，无法回查） | 影响「升级即丢数据」的风险说明与是否需要删前备份策略 |
| `resources/` 之外是否有安装包内置的 schema/种子数据 | `electron-builder.yml` 未逐条读；本次只证实 `process.resourcesPath` 的两个消费者 |
| `file-index.db` 的 `meta`/水位表治理方式 | 它不受迁移链管辖（`src/main/modules/fileIndex/db.ts:2`），机制与本文不同源 |

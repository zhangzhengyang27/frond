# 录制管线 Mediabunny 迁移设计（B57 根因①收官方案）

> 2026-10-04 · 状态：设计评审稿（未实施）
> 上游：`docs/BUGS.md` § 2026-10-04 录屏专项（B57-1~20）。本文消的是**根因①**：
> 「MediaRecorder 只产 webm → 转码/授权/恢复/契约链连锁病灶」。
> 其余三个根因（共享音轨所有权、双 finalize、监听挂错层）与管线无关，另行修复。

## 1. 背景与问题

现行录制链：`Canvas 合成 → MediaRecorder(webm) → 自研分片 IPC 写盘 → ffmpeg 转码 mp4/gif`。
MediaRecorder 是为「短clip + 内存 Blob」设计的黑盒，塞进「小时级 + 流式落盘 + 崩溃恢复」的
需求后，每一个缺口都要自研补丁，补丁本身成为 B57 的主要病灶：

| 病灶 | B57 | 与 webm-only 的关系 |
|---|---|---|
| 自研分片写盘丢尾竞态 + 跨会话缓冲污染 | B57-5 | MediaRecorder 无流式接口，只能自己攒 |
| 恢复扫描 `.partial.mp4` 与产物 `.webm` 脱节（恢复空转） | B57-1 | webm 无法打 recovery 标记，只能靠后缀约定 |
| ffmpeg 转码链（授权绕过、任意文件读取、四账不平） | B57-4/8 | webm 不是交付格式，必须转码 |
| `recording.delete` 忽略 deleteFile、addHistory 只认 .webm 等契约漂移 | B57-14 | 双格式双链路导致语义分叉 |
| 时长/大小元数据多源互踩 | B57-2/9 | 编码器不产元数据，只能多处自算 |

## 2. 目标与非目标

**目标**
1. 直出 **MP4**（H.264/AVC + Opus/AAC），消灭录制侧 ffmpeg 转码链
2. 流式落盘（内存 O(1)），写盘收尾由库内背压机制保证完整，不再自研攒批/猜等
3. fragmented MP4 + 应用层崩溃恢复（真实可用的 B57-1 重写基础）
4. 暂停/恢复语义保留（含 segments 表时长统计）
5. 画质不降级：硬件编码优先，码率/关键帧间隔可配

**非目标**
- 不动 UI 层（RecordPage/SourceSelector/MarkersPanel 等照旧）
- 不动区域浮层、倒计时、全局快捷键（B57-12 其余项另行修）
- 不迁移历史 webm 存量（照常可播，播放器本就支持）
- 剪辑/导出的 ffmpeg 链**暂保留**（输入从 webm 变 mp4 属参数微调；GIF 导出后置）

## 3. 可行性依据

- **Electron 38.8**（Chromium 140）：`VideoEncoder`/`AudioEncoder`/`AudioContext` 全量可用
  （WebCodecs 自 Chromium 94 GA，本项目远高于门槛）
- **Mediabunny**（`github.com/Vanilagy/mediabunny`）：mp4-muxer/webm-muxer 统一后继，
  零依赖纯 TS，活跃维护；同体量开源产品 **Screenity v4.6（2026 中）已用它全面替换
  MediaRecorder/webm 路线**，管线成熟度经过验证
- 硬件编码：Chromium `VideoEncoder` 在 macOS 走 VideoToolbox、Windows 走 D3D11，
  `hardwareAcceleration: 'prefer-hardware'` 即可；不可用时回退软编（VP9/AVC 软编均内置）

## 4. 目标架构

```
┌─ 渲染进程（复用现有 useStreamManager 合成层）─────────────────┐
│ 屏幕 desktopCapturer ─┐                                       │
│ 摄像头 getUserMedia ──┤→ 隐藏 <video> ×2 → Canvas 合成（画中画/  │
│ WebAudio 混音(mic+loopback) ─┘   区域裁剪/光圈，原样保留）      │
│                                   │                           │
│              ┌────────────────────┴───────────────────┐       │
│              │ Mediabunny Output {                    │       │
│              │   format: Mp4OutputFormat({            │       │
│              │     fastStart: 'fragmented' }),        │       │
│              │   target: StreamTarget(writable) }     │       │
│              │   video: CanvasSource   { codec:'avc' }│       │
│              │   audio: AudioBufferSource{codec:'opus'}│      │
│              │ }                                       │      │
└──────────────┼─────────────────────────────────────────┘─────┘
               │ StreamTarget(writable)：chunk = {data, position}
               ▼ 按偏移写（fMP4 为 append-only → 复用现有 IPC append 通道形态）
┌─ 主进程 ─────────────────────────────────────────────┐
│ WriteStream（fs.createWriteStream，保留现有授权/会话管理， │
│  beginWrite/appendChunk/endWrite 通道契约不变）          │
└──────────────────────────────────────────────────────┘
```

每帧 rAF/后台定时器里 `canvasSource.add(t, 1/fps)`（**必须 await**，背压传导到编码器）；
音频经 `AudioContext` 采到 `AudioBuffer` 后 `audioBufferSource.add(buffer)`。
收尾 `await output.finalize()`；取消 `await output.cancel()`（自动关流、释放编码器）。

## 5. 迁移范围映射

| 现有组件 | 处置 | 说明 |
|---|---|---|
| `useScreenRecorder` 的 MediaRecorder + 分片攒批 | **替换** | `useMediaRecorder` → `useRecordingPipeline`（新 composable）；攒批/在途链/draining 全删（库内背压接管） |
| `beginWrite/appendChunk/endWrite` IPC + 授权 | **保留** | 通道契约不变；`appendChunk` 语义从「攒批追加」变「按偏移写」，fMP4 下天然 append-only |
| `useStreamManager` 合成层 | **保留** | Canvas 合成/区域裁剪/光圈/后台降帧是本项目特有形态，无现成库 |
| WebAudio 混音（mic + loopback） | **保留** | 混音输出改接 `AudioBufferSource`；`AudioContext` 清理链照旧 |
| 时长/大小统计 | **替换** | 唯一真相 = 编码时间轴（`performance.now` 基准）+ `output.finalize` 回传；`recording.finalize` 渲染端自报通道**删除**（B57-2 双真相消亡） |
| segments 暂停计时 | **保留** | pause = 停 `add()` + 记 segments；resume = 恢复 add + 开新段 |
| `RecordingExportService` webm→mp4 转码 | **后续删除** | 源已是 mp4；剪辑拼接/转场仍用 ffmpeg（P3 再评估 Mediabunny Conversion API 替代） |
| `GifEncoderService` | **保留** | 输入参数从 webm 改 mp4，其余不动 |
| `RecoveryManager` | **P2 重写** | 见 §7 阶段三 |
| 历史表 / 播放器 / 剪辑器 UI | **保留** | mp4 在 `<video>`、`video://` 协议、ffmpeg 侧均直接支持 |

## 6. 关键设计决策

- **D1 编码在渲染端**：WebCodecs 是渲染进程 API；主进程只管写盘。合成 Canvas 本就在
  渲染端，避免逐帧跨进程搬运。
- **D2 fMP4（`fastStart: 'fragmented'`）而非普通 mp4**：普通 mp4 的 moov 在文件尾，
  崩溃即整文件报废；fMP4 每个 `moof+mdat` 自包含，崩溃后文件从头到「最后一个完整片段」
  均可播——这是 B57-1 恢复功能从「空转」变「真实可用」的前提。兼容性：Chrome/Safari/
  WPS/微信均支持 fMP4 播放。
- **D3 时间轴基准**：`performance.now()`（单调、不受系统改时钟影响——修掉现 Date.now()
  计时隐患）；音视频同源基准，片段时长 1/fps 固定，不随编码耗时漂移。
- **D4 恢复标记去后缀化**：崩溃恢复不再认 `.partial.mp4` 后缀，改认
  「DB 行 status='recording' 且 file_path 存在」的孤儿行 + 文件尾 moof 边界扫描
  （截断到最后完整片段，改 status='recovered'）。
- **D5 编码参数映射**：现有设置（encoder vp8/vp9/h264、bitrate、fps、audioBitrate）
  映射为 `codec: 'avc'|'vp9'` + `Quality({ bitrate })` + `keyFrameInterval: 2s`；
  VP8 档降级为 VP9（WebCodecs 无 VP8 编码器保证），mp4 容器下默认 AVC。
- **D6 双轨过渡**：P1 期新管线挂特性开关（设置项 `recording.engine: 'webcodecs' |
  'mediarecorder'`，默认关闭），灰度稳定一个版本后删旧链。

## 7. 分阶段实施

| 阶段 | 内容 | 验收 | 估量 |
|---|---|---|---|
| **P0 试点** | 独立分支跑通 `Canvas→WebCodecs→Mediabunny→fMP4` 最小闭环（全屏源、无音频），VLC/QuickTime 播放验证；测 CPU/内存对比 MediaRecorder | 10 分钟录制内存平稳、文件可播 | 1~2 天 ✅ **核心闭环已验证（见 §7.1）** |
| **P1 管线切换** | `useRecordingPipeline`（视频+音频+暂停恢复+设置映射）+ 特性开关；删除自研攒批/draining；B57-5 测试改钉新管线 | 全部录制模式（全屏/窗口/区域/画中画/双音频）+ 暂停恢复通过；单测覆盖时间轴与收尾 | 3~5 天 ✅ **代码落地+单测全绿（见 §7.2）；真机多模式回归待用户实测** |
| **P2 恢复重写** | 按 D4 重写 RecoveryManager（孤儿行 + moof 扫描 + 截断恢复），补 `recording.recover` 集成测试 | kill -9 后重启可恢复可播文件；B57-1 全链清账 | 2~3 天 ✅ **代码落地+15 集成钉全绿（见 §7.3）；kill -9 真机演练待用户实测** |
| **P3 清理** | 删 webm→mp4 转码路径与 `addHistory` webm 白名单、`ensureExtension` 授权绕过（B57-4 半）、契约收敛（B57-14）；评估 Conversion API 替代剪辑转码 | B57 相关挂账批量核销；全量门禁绿 | 2~3 天 ✅ **落地（见 §7.4）；转码链保留至旧引擎退役（双轨现实，修订见 §7.4）** |

### 7.1 P0 试点结果（2026-10-04，本机 macOS arm64 / Electron 38.8.6 / mediabunny 1.61.1）

harness：`scripts/mediabunny-pilot/`（独立于产品代码）。链路 = Canvas 1280×720@30fps 动画 →
WebCodecs avc（`prefer-hardware`，实测硬件编码可用）→ `Mp4OutputFormat({ fastStart: 'fragmented' })`
→ `StreamTarget` → IPC 按字节偏移 pwrite 落盘（模拟现有 beginWrite/appendChunk/endWrite 通道形态）。
编码循环逐帧 `await videoSource.add(t, 1/fps)`（背压传导）。

| 指标 | 10s 冒烟 | 60s 全程 |
|---|---|---|
| 帧数 | 300/300 | 1800/1800 |
| 墙钟 vs 目标 | 10.0s / 10s | 60.0s / 60s（**零漂移**） |
| ffmpeg 解码错误 | 0 | 0 |
| 时长（ffmpeg 读数） | 10.03s | 60.03s |
| fMP4 片段（moof） | 6 个（≈2s 间隔） | 31 个（≈2s 间隔） |
| moov 位置 | 文件头（offset 32） | 文件头（offset 32）→ **崩溃可恢复性成立** |
| 写盘延迟（IPC pwrite） | max 5.1ms | p50 3.7ms / max 4.6ms |
| 渲染端 JS 堆 | 6→9MB | 锯齿 6→17MB→GC 4.8MB→循环（**健康 GC 周期，非泄漏**） |
| 主进程 RSS 峰值 | 152MB | 164MB（Electron 主进程基线量级） |

实现要点与坑（P1 直接复用）：
- mediabunny ESM 入口静态 `import 'node:fs/promises'`，裸浏览器（import map 直挂）不可用——
  必须以 esbuild `--platform=browser --format=esm` 打包排除 node 分支（命令已存 harness）；
  产物 vendor.mjs 约 690KB（minified），P1 走 electron-vite 正常打包即可无此问题
- Electron 渲染层 WebCodecs avc `VideoEncoder.isConfigSupported` 直接通过，硬件加速可用
- `StreamTarget` 的 chunk 自带 `position`，主进程用 `fs.write(fd, buf, 0, len, position)`
  （pwrite）按偏移落盘即可，与现有 appendChunk 通道语义兼容
- `output.finalize()` 干净收尾；异常路径 `output.cancel()` 未触发（P1 补测）


### 7.2 P1 管线切换落地（2026-10-04）

**架构**（D6 特性开关双轨，默认关）：
- 新模块 `src/renderer/src/composables/useRecordingPipeline.ts`（418 行）：引擎核心。
  `createPipelineWriteBridge`（fMP4 追加写桥，position 守卫防乱序）+ 帧循环（暂停 =
  不出帧 + resume 补记 pausedTotalMs 回拨时钟，无补帧爆发）+ 区域裁剪/光圈绘制 +
  音频 `MediaStreamAudioTrackSource`（pause/resume 原生支持）。门面单例状态经
  `PipelineHost` 适配器注入（体量棘轮拆分件：useScreenRecorder.ts 原 1100 行 → 731）。
- `useScreenRecorder.ts`：门面保留（单例 refs/claim 闸/时长账本/旧 MediaRecorder 链），
  `engine==='webcodecs'` 时分支到管线。`RecorderOptions` 扩展
  engine/codec/fps/region/regionScale/getCursor，随模块转出口。
- 主进程：`RecordingSettings.engine`（默认 'mediarecorder'）；
  `getDefaultSavePath/selectSavePath` 增 `extension` 参数（mp4/webm 容器跟随引擎，
  grant 白名单同步覆盖 mp4 路径）；契约/preload 同步。
- 设置对话框：新增「录制引擎」单选（默认 MediaRecorder，webcodecs 标注实验性）。
- RecordPage：设置映射（encoder vp9→vp9、其余→avc——WebCodecs 无 vp8 保证）；
  纯屏幕源传 region+cursor（管线裁剪），合成流传 null（区域/画中画/光圈已在合成层）。

**单测**：`useScreenRecorder.pipeline.test.ts` 6 钉（mock mediabunny 锁接线契约）——
引擎选择/路径签发扩展名/fragmented 输出/逐帧 add 背压/暂停恢复（音频 pause+时间轴冻结）/
finalize→endWrite→finalize 收尾链/finalize 失败 abort 清场/写桥 position 守卫与字节统计/
engine 缺省走旧链路 mediabunny 零调用。旧链路 4 文件回归钉无损；全量 1342 测试绿。

**待办（P1 收尾）**：真机全模式回归（全屏/窗口/区域/画中画/双音频/暂停恢复/引擎开关
切换）；`output.cancel()` 异常路径真机验证；验证纯屏幕+区域录制在 webcodecs 引擎下
的裁剪正确性（此场景旧引擎本就存在「区域不生效录全屏」的疑点，B57 排查时未列入，
新引擎路径顺便修复，待实测确认后单独挂账核销）。

### 7.3 P2 恢复重写落地（2026-10-04）

**RecoveryManager 按 D4 重写**（`src/main/services/recording/RecoveryManager.ts`）：
- **scan 主源 = DB 孤儿行**：`status IN ('recording','paused')` 且 `file_path` 真实存在，
  旧引擎 webm / 新引擎 fMP4 通吃；`.partial.mp4` 目录扫描降为历史兜底（该后缀本就
  无人产出）。文件已被删/软删/completed 的行不列。
- **recover = 原地截断恢复**：`findMp4RecoveryPoint`（导出纯函数）按 box 边界顺序
  扫描（每 box 只读 8/16 字节头，GB 级文件 O(片段数) 次读），垃圾尾 `ftruncate` 到
  最后一个完整 mdat；**不 rename**（P0-1 静默覆盖消亡）、**先文件后 DB**（P0-2
  「文件消失」消亡——DB 写失败时行仍 recording，下次 scan 重试）。webm 不截断
  （无 ISO-BMFF 结构），probe ≥1s 门槛保留。
- **discard = 行级精确删除**：recordingId 优先、filePath 精确路径匹配，basename
  跨目录猜测废止（P0-4 误删消亡）；历史 .partial 兜底路径保留。
- 契约：`recording.recovery.recover/discard` req 增 `recordingId?`（加法式）；
  渲染层暂无恢复面板入口（通道就绪，UI 归入后续批次）。

**测试**：`RecoveryManager.recovery.test.ts` 15 钉——真实 sqlite（createTestDb）+
临时目录 + 手工 fMP4 夹具（ftyp+moov+(moof+mdat)³+垃圾尾）：moof 边界扫描四态
（完整/垃圾尾/webm/首个 mdat 即截断）、scan 三源（孤儿行/排除项/历史兜底）、
recover 五路（截断不改名/完整不截/webm/无行新建/probe 拒绝状态不变）、discard
三路（行级跨目录隔离/精确路径/未知 id）。

### 7.4 P3 落地（2026-10-04）

**B57-4 全链封死（安全）**：
- **B57-4b outputPath 绕过**：`recording.export.start` 的签发校验对象改为
  `ensureExtension(outputPath, format)` 之后的**实际写盘路径**（service 导出该纯函数
  供 handler 使用；svc.export 直接收最终路径）——「a.mp4 已签发 + format=gif → 实际写
  a.gif」的绕过封死。
- **B57-4a intro/outro/BGM 任意文件读取**：三个可选输入与 sourcePath 同口径——只认
  登记录像（findByFilePath）或主进程签发路径；当前无 UI 挂载，收紧零 UX 影响，
  未来 UI 须经文件对话框签发后再传入（handler 注释已注明）。

**B57-14 契约收敛**：
- `recording.delete` 兑现 `deleteFile`（先取行再删行，softDelete 后 findById 因
  deleted_at 过滤取不到；unlink 幂等，失败只告警不回滚行）
- `recording-history:addHistory` 白名单跟随引擎：webm/mp4/gif（webcodecs 直出 mp4、
  导出产物 mp4/gif 都能登记；签发校验语义不变）
- `screen-recorder:beginWrite` 契约删去从未返回的 `res.path`
- `recording.export.getInfo` 契约收敛到实际实现（删 width/height/error，无消费者）
- `recording.region.open*` 取消统一返回 `{ canceled: true }`（不再抛 Error('canceled')
  信封），契约补 `scaleFactor` 字段（handler 一直在返回、契约缺失）；RecordPage 适配
  联合类型并区分「取消」与「错误」
- `recording.export.start` 运行时数值校验：码率必须正数（负码率曾可拼出 `-5k` ffmpeg
  参数）、fps ∈ {30,60}、resolution ∈ {720,1080,1440,2160}

**转码链处置修订（对原 P3 计划的诚实修订）**：原计划「删 webm→mp4 转码路径」在双轨
现实下不成立——`RecordingExportService` 是两引擎共用的**导出功能**（剪辑拼接/转场/BGM/
GIF），不是单纯的格式转换 shim；旧引擎（默认）仍产 webm，其 mp4 导出仍依赖 ffmpeg。
转码链保留至「旧引擎退役」里程碑（webcodecs 灰度稳定后单独批次删除），删除时
`recording.engine` 开关与 mediarecorder 分支同批清理。

**Conversion API 评估（结论：剪辑转码暂不换）**：Mediabunny Conversion API 适合
客户端转码/裁剪（resize、trim、格式转换、samples 重封装），可承接「webm→mp4 转换」
与简单 trim；但剪辑导出的核心是 concat + xfade 转场 + amix 混音 + BGM 循环，
filter_graph 语义 Mediabunny 需逐段手工拼装且能力子集不等价。决策：ffmpeg 保留为
剪辑/导出后端；Conversion API 留作旧引擎退役后「单段裁剪预览」的优化项（省一次
进程启动与磁盘往返）。

**测试**：recordingExport.test.ts 增 5 钉（绕过封死/一致放行/输入白名单/码率/fps+
分辨率）、recordingDelete.test.ts 3 钉（deleteFile 删文件/缺省保留/幂等）、
recordingHistoryGuards.test.ts 增 1 钉（mp4/gif 放行）。全量 1366 测试 /
typecheck / lint 绿。

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 硬件编码器在部分机型不可用/输出异常 | `isConfigSupported` 预检 + 软编回退；试点阶段收集机型矩阵 |
| fMP4 在个别旧播放器不兼容 | 历史导出功能仍可产普通 mp4（转码链 P3 才删）；播放器为本应用内置 `<video>` |
| 音画同步漂移（原 MediaRecorder 老大难） | 同源时钟基准 + fMP4 按解码顺序写入；P0 试点专门验证 30/60 分钟长录的漂移 |
| Mediabunny 单一维护者风险 | 纯 TS 库可 vendor 锁定；接口收敛在 `useRecordingPipeline` 单点，替换成本低 |
| 渲染进程崩溃丢已编码未写盘片段 | fMP4 片段粒度（默认 2s 关键帧间隔）天然限损；主进程写盘通道独立存活 |

## 9. 与 B57 挂账的核销关系

P1 完成即核销：B57-5（写盘竞态整段删除）、B57-2 前半（时长唯一真相）。
P2 完成即核销：B57-1。P3 完成即核销：B57-4、B57-8、B57-14 的大部分。
不依赖本方案的挂账（B57-3/6/7/9/10/11/12/13/15~20）按 BUGS.md 原有节奏另行修复。

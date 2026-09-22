  )

  ipcMain.handle(
    'recording.settings.patch',
    wrap(
      (req: Partial<RecordingDefaultSettings>): RecordingDefaultSettings => {
        // 枚举/类型白名单：契约类型只是编译期约束，fps: 999 这类值会被存库
        // 并在导出时作为 ffmpeg 参数下发
        const safe: Partial<RecordingDefaultSettings> = {}
        if (req && typeof req === 'object') {
          const r = req as Record<string, unknown>
          if (r.fps === 30 || r.fps === 60) safe.fps = r.fps
          if (
            r.quality === 'low' ||
            r.quality === 'medium' ||
            r.quality === 'high' ||
            r.quality === 'source'
          ) {
            safe.quality = r.quality
          }
          if (r.cursor === 'halo' || r.cursor === 'highlight' || r.cursor === 'click-ring') {
            safe.cursor = r.cursor
          }
          if (typeof r.defaultSavePath === 'string' || r.defaultSavePath === null) {
            safe.defaultSavePath = r.defaultSavePath
          }
          if (typeof r.micDefault === 'string' || r.micDefault === null) safe.micDefault = r.micDefault
          if (typeof r.systemDefault === 'string' || r.systemDefault === null) {
            safe.systemDefault = r.systemDefault
          }
          if (typeof r.hasCamera === 'boolean') safe.hasCamera = r.hasCamera
          if (typeof r.hasMic === 'boolean') safe.hasMic = r.hasMic
          if (typeof r.hasSystemAudio === 'boolean') safe.hasSystemAudio = r.hasSystemAudio
          if (
            r.shortcuts &&
            typeof r.shortcuts === 'object' &&
            typeof (r.shortcuts as Record<string, unknown>).enabled === 'boolean'
          ) {
            const s = r.shortcuts as Record<string, unknown>
            safe.shortcuts = {
              enabled: s.enabled as boolean,
              start: typeof s.start === 'string' ? s.start : '',
              togglePause: typeof s.togglePause === 'string' ? s.togglePause : ''
            }
          }
        }
        return recordingSettingsRepository.patch(safe)
      }
    )
  )

  ipcMain.handle(
    'recording.settings.reset',
    wrap((): RecordingDefaultSettings => recordingSettingsRepository.reset())
  )

  // ── Recovery ───────────────────────────────────────────────
  ipcMain.handle(
    'recording.recovery.scan',
    wrap(() => {
      const r = getRecoveryManager().scan()
      return {
        orphans: r.orphans.map((o) => ({

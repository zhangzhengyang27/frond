
export function registerScreenRecorderIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // 获取可用的屏幕源
  ipcMain.handle('screen-recorder:getSources', async (_event, options: Electron.SourcesOptions) => {
    try {
      // thumbnailSize 由渲染端传入：钳制上限，防止恶意巨幅尺寸让每个源分配
      // 大位图 + toDataURL 拖垮主进程
      const MAX_THUMB = 512
      const rawThumb = options?.thumbnailSize
      const clamp = (n: unknown, fallback: number): number => {
        const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback
        return Math.max(1, Math.min(MAX_THUMB, v))
      }
      // 确保 options 有合理的默认值（避免重复指定同名属性）
      const defaultOptions: Electron.SourcesOptions = {
        thumbnailSize: {
          width: clamp(rawThumb?.width, 200),
          height: clamp(rawThumb?.height, 150)
        },
        ...options
      }
      defaultOptions.thumbnailSize = {
        width: clamp(rawThumb?.width, 200),
        height: clamp(rawThumb?.height, 150)
      }
      if (!defaultOptions.types || defaultOptions.types.length === 0) {
        defaultOptions.types = ['screen', 'window']
      }

      console.log('获取屏幕源，选项:', JSON.stringify(defaultOptions))

      const sources = await desktopCapturer.getSources(defaultOptions)

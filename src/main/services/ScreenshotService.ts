   */
  private listenIpc(): void {
    // 确定事件（复制到剪贴板）
    // 渲染端是沙箱 preload：IPC 传 Uint8Array（结构化克隆），这里统一转 Buffer
    ipcMain.on('SCREENSHOT:ok', async (_e, rawBuffer: Uint8Array, data: ScreenshotsData) => {
      const buffer = Buffer.from(rawBuffer)
      try {
        this.emit('ok', buffer, data)
        clipboard.writeImage(nativeImage.createFromBuffer(buffer))

        if (Notification.isSupported()) {
          new Notification({ title: '截图已复制', body: '截图已复制到剪贴板' }).show()
        }

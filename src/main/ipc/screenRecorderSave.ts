      }
    }
  )

  // 中止写盘会话：关闭流并删除半截文件，不写历史（写盘出错/启动失败时用）
  ipcMain.handle('screen-recorder:abortWrite', async (_event, filePath: string) => {
    const target = resolveGrantedRecordingPath(filePath)
    const session = target ? activeWriteSessions.get(target) : undefined
    if (!target || !session) return { ok: false }
    activeWriteSessions.delete(target)
    await endStream(session.ws).catch(() => undefined)
    try {
      if (existsSync(target)) unlinkSync(target)
    } catch {
      // 删除失败保留现场
    }
    revokeRecordingSavePath(target)
    return { ok: true }
  })

  ipcMain.handle(
    'screen-recorder:endWrite',
    async (_event, filePath: string, duration?: number, recordingId?: string) => {
      const target = resolveGrantedRecordingPath(filePath)
      const session = target ? activeWriteSessions.get(target) : undefined
      if (!target || !session) return { success: false, error: 'no active write session' }
      activeWriteSessions.delete(target)
      try {
        await endStream(session.ws)
        if (session.error) throw session.error
        return finalizeSavedFile(target, duration, recordingId)
      } catch (error) {
        console.error('[screenRecorderSave] endWrite failed:', error)
        // 与 abortWrite 对齐：失败时删除半截文件并撤销签发，
        // 否则磁盘残留半截录制、grant 仍在导致重试语义混乱
        try {
          if (existsSync(target)) unlinkSync(target)
        } catch {
          // 删除失败保留现场
        }
        revokeRecordingSavePath(target)
        return { success: false, error: (error as Error).message }
      }

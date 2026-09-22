  }
}

/**
 * 恢复出厂：删 leaf.db + WAL + SHM，重启应用。
 * 下次启动自动重建数据库（空 SQLite + dataMigrations() 跳过）。
 */
export async function factoryReset(getMainWindow: () => BrowserWindow | null): Promise<boolean> {
  const win = getMainWindow()
  const dbPath = database.path()

  const confirm = await dialog.showMessageBox(win ?? undefined!, {
    type: 'warning',
    title: '恢复出厂设置',
    message: '此操作将清空所有数据（标签 / 番茄钟 / 截图 / 录制 / 收藏）。',
    detail: '操作不可撤销。建议先「导出数据库」备份。\n\n确认继续？',
    buttons: ['确认清空', '取消'],
    defaultId: 1,
    cancelId: 1
  })
  if (confirm.response !== 0) return false

  try {
    database.close()
    const walPath = `${dbPath}-wal`
    const shmPath = `${dbPath}-shm`
    if (existsSync(walPath)) rmSync(walPath)
    if (existsSync(shmPath)) rmSync(shmPath)
    rmSync(dbPath)
    // 媒体文件一并清理：提示文案承诺「清空所有数据」，只删 DB 会把
    // 截图/录制/剪贴板图片残留成无记录的孤儿（存储占用用户无感知）
    const mediaDirs = [
      'screenshots',
      'recordings',
      'clipboard-history'
    ].map((name) => join(app.getPath('userData'), name))
    for (const dir of mediaDirs) {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    }
    log.warn('dbBackup', `factory reset, relaunching`)
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 100)
    return true
  } catch (e) {
    log.error('dbBackup', `factory reset failed: ${(e as Error).message}`, e)
    throw e
  }
}

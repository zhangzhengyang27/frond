  }> {
    try {
      const { stdout } = await execFileAsync(
        'osascript',
        ['-l', 'JavaScript', '-e', buildQueryScript(startSec, endSec, max)],
        { timeout: JXA_TIMEOUT_MS }
      )
      const parsed = JSON.parse(String(stdout || '{}')) as {
        status: number
        events: RawEvent[]
      }
      const auth = mapAuthStatus(parsed.status)
      if (auth !== 'authorized') {
        // notDetermined：顺手把授权弹窗拉起来（下次查询生效）
        if (parsed.status === 0) void this.requestAccess()
        return { auth, events: [] }
      }
      return { auth, events: parsed.events ?? [] }
    } catch (error) {
      // 超时/无辅助工具等：静默降级为无日程（不阻塞启动器）
      console.warn('[Calendar] 查询失败:', (error as Error).message)
      return { auth: 'notDetermined', events: [] }
    }
  }
}

export const calendarService = new CalendarService()

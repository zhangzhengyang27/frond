      expect(week.length).toBeGreaterThanOrEqual(2)
      expect(month.length).toBeGreaterThanOrEqual(2)
    })

    it('getStatistics 分类计数', () => {
      repo.addRecord({ type: 'work', duration: 1500, completedAt: 100 })
      repo.addRecord({ type: 'shortBreak', duration: 300, completedAt: 200 })
      const s = repo.getStatistics()
      expect(s.today.work).toBe(1)
      expect(s.today.shortBreak).toBe(1)
    })

    it('duration 毫秒语义：25 分钟番茄统计为 25 workMinutes（v4 单位契约）', () => {
      repo.addRecord({ type: 'work', duration: 25 * 60_000, completedAt: Date.now() })
      const trend = repo.getDailyTrend(1)
      expect(trend).toHaveLength(1)
      expect(trend[0].workMinutes).toBe(25)
      expect(trend[0].completedPomodoros).toBe(1)
    })
  })

  describe('settings (K-V via pref_preferences)', () => {
    it('getSettings 无值返回 DEFAULT_SETTINGS', () => {

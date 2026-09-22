  })

  it('导入失败时不标记 v2 done、不归档旧 JSON，修复后可重跑', () => {
    writeFileSync(join(env.tmpDir, 'pomodoro-data.json'), '{ broken ===', 'utf-8')
    env.writeJson('Folder Data.json', {
      folders: [
        {
          id: 'f-1',
          name: 'F',
          parentId: null,
          icon: null,
          defaultLanguage: 'text',
          isOpen: false,
          orderIndex: 0,
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })
    const r1 = runDataMigrations()
    expect(r1.errors.some((e) => e.startsWith('pomodoro:'))).toBe(true)
    expect(r1.foldersImported).toBe(1)
    // 失败段不得标记 done（否则该模块数据永久缺失）
    const doneRow = db
      .prepare('SELECT value FROM leaf_meta WHERE key = ?')
      .get('data_migration_v2') as { value: string } | undefined
    expect(doneRow?.value).toBeUndefined()
    // 旧 JSON 留在原地（未归档），供下次重试
    expect(existsSync(join(env.tmpDir, 'pomodoro-data.json'))).toBe(true)

    // 修复坏文件后重跑：v1 不重复执行，v2 导入成功并标记 done
    env.writeJson('pomodoro-data.json', {
      tasks: [{ id: 't-9', title: 'x', completed: false, createdAt: 1 }]
    })
    const r2 = runDataMigrations()
    expect(r2.errors).toEqual([])
    expect(r2.pomodoroTasksImported).toBe(1)
    const doneRow2 = db
      .prepare('SELECT value FROM leaf_meta WHERE key = ?')
      .get('data_migration_v2') as { value: string } | undefined
    expect(doneRow2?.value).toBe('done')
  })

  it('v1 失败 + v2 成功：v2 标记 done 但不归档（v1 重跑原料必须保留）', () => {
    // v1 原料损坏：Preferences.json 是坏 JSON
    writeFileSync(join(env.tmpDir, 'Preferences.json'), '{ broken ===', 'utf-8')
    // v2 原料完好
    env.writeJson('Folder Data.json', {
      folders: [
        {
          id: 'f-9',
          name: 'F9',
          parentId: null,
          icon: null,
          defaultLanguage: 'text',
          isOpen: false,
          orderIndex: 0,
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })
    const r1 = runDataMigrations()
    expect(r1.errors.some((e) => e.startsWith('prefs:'))).toBe(true)
    expect(r1.foldersImported).toBe(1)
    // v2 段成功 → v2 标记 done（下次只重跑 v1）
    const v2Row = db
      .prepare('SELECT value FROM leaf_meta WHERE key = ?')
      .get('data_migration_v2') as { value: string } | undefined
    expect(v2Row?.value).toBe('done')
    // v1 未标记
    const v1Row = db
      .prepare('SELECT value FROM leaf_meta WHERE key = ?')
      .get('data_migration_v1') as { value: string } | undefined
    expect(v1Row?.value).toBeUndefined()
    // 关键：v1 原料不得被归档搬走
    expect(existsSync(join(env.tmpDir, 'Preferences.json'))).toBe(true)

    // 修复后重跑：v1 导入成功，此时才允许归档
    env.writeJson('Preferences.json', { theme: 'dark' })
    const r2 = runDataMigrations()
    expect(r2.errors).toEqual([])
    expect(r2.prefsImported).toBe(1)
    expect(existsSync(join(env.tmpDir, 'Preferences.json'))).toBe(false)
  })
})

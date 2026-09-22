  })

  it('028 下线截图模块：ss_screenshots 表已删除', () => {
    runMigrations(db, migrations)
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
      name: string
    }>
    expect(rows.map((r) => r.name)).not.toContain('ss_screenshots')
    // 028 幂等：重复执行不抛错
    const m028 = migrations.find((m) => m.version === 28)!
    expect(() => m028.up(db)).not.toThrow()
  })

  it('018 下线图片管理/壁纸模块：photo_* / wall_* / lib_files 表已删除', () => {
    runMigrations(db, migrations)

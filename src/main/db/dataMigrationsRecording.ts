        status: 'completed',
        description: `legacy:${r.id}`,
        thumbnail_path: r.thumbnail ?? null,
        started_at: r.createdAt
      })
      result.recordingsImported += 1
    } catch (e) {
      const msg = (e as Error).message
      result.errors.push(`${r.id}: ${msg}`)
      log.error('dataMigration.v3', `import ${r.id} failed: ${msg}`, e)
    }
  }

  // 有错不标记 done（对齐 v1/v2 策略）：导入循环按 file_name 去重、重跑幂等，
  // 留待下次启动重试失败记录；全部成功才视为完成
  if (result.errors.length === 0) {
    db.prepare(
      `INSERT INTO leaf_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(DATA_MIGRATION_KEY, 'done', Date.now())
  }

  log.info(
    'dataMigration.v3',
    `done: imported=${result.recordingsImported}, skipped=${result.recordingsSkipped}, errors=${result.errors.length}`
  )

  return result

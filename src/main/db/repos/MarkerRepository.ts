  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  listByRecording(recordingId: string): MarkerRow[] {
    return this.db
      .prepare(
        `SELECT id, recording_id, time_ms, label, created_at
         FROM rec_markers
         WHERE recording_id = ?
         ORDER BY time_ms ASC`
      )
      .all(recordingId) as MarkerRow[]
  }

  get(id: string): MarkerRow {
    const row = this.db
      .prepare(
        `SELECT id, recording_id, time_ms, label, created_at
         FROM rec_markers WHERE id = ?`
      )
      .get(id) as MarkerRow | undefined
    return mustGet(row, 'marker', id)
  }

  add(input: {
    id: string
    recording_id: string
    time_ms: number
    label?: string | null
  }): MarkerRow {
    const ts = now()
    this.db
      .prepare(
        `INSERT INTO rec_markers (id, recording_id, time_ms, label, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(input.id, input.recording_id, input.time_ms, input.label ?? null, ts)
    return this.get(input.id)
  }

  remove(id: string): boolean {
    const r = this.db.prepare(`DELETE FROM rec_markers WHERE id = ?`).run(id)
    return r.changes > 0
  }

  removeAllForRecording(recordingId: string): number {
    const r = this.db.prepare(`DELETE FROM rec_markers WHERE recording_id = ?`).run(recordingId)
    return r.changes
  }

  rename(id: string, label: string): boolean {
    const r = this.db.prepare(`UPDATE rec_markers SET label = ? WHERE id = ?`).run(label, id)
    return r.changes > 0
  }

  getAll(): Record<string, PersistedTimerState> {
    // 一次取全表后本地过滤+解析：避免逐 key 再调 get() 重复查库的 N+1
    const all = prefRepository.all()
    const out: Record<string, PersistedTimerState> = {}
    for (const { key: k, value } of all) {
      if (!k.startsWith(KEY_PREFIX)) continue
      const projectId = k.slice(KEY_PREFIX.length)
      const parsed = this.parseState(value)
      if (parsed) out[projectId] = parsed
    }
    return out
  }
}

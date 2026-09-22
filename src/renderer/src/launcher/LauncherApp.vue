  // 声明式列表实时更新（插件提交新 items）
  unsubscribers.push(
    window.api.launcher.onPluginList((payload) => {
      if (pluginState.value.open && payload.pluginId === pluginState.value.pluginId) {
        declaredList.value = payload.items as PluginListItem[]
      }
    })
  )
  // #5 插件双通道：searchable 插件提交新条目集 → 刷新合并缓存（当前查询激活则重跑）
  unsubscribers.push(
    window.api.launcher.onPluginSearchIndexUpdated(() => {
      void loadPluginSearchItems()
      const q = query.value.trim()
      if (q) void runUnifiedSearch(q)
    })
  )

  void (async () => {
    try {
      // 阶段1.1：应用命令已迁移到 ApplicationCommandProvider

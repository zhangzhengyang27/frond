}

const hotkeyCommands = computed(() => {
  const specs = buildStaticCommands() as unknown as CommandEntryLike[]
  return specs
    .map((entry) => {
      const spec = specOfCommand(entry)
      const bound = spec
        ? Object.entries(hotkeyConfig.value.commands)
            .filter(([, s]) => JSON.stringify(s) === JSON.stringify(spec))
            .map(([accel]) => accel)
        : []
      return { entry, spec, bound: bound.length > 0 ? bound : null }
    })
    .filter((row) => row.spec !== null)
})

async function refreshHotkeys(): Promise<void> {
  try {
    hotkeyConfig.value = await window.api.launcher.hotkeysGetConfig()
  } catch {
    /* 保持默认 */
  }
  try {
    hotkeyConflicts.value = await window.api.launcher.hotkeysGetConflicts()
  } catch {
    /* 冲突清单读取失败按无冲突处理 */
  }
}

// ───── 两段式直达（主热键后按住修饰键 + 字母）─────
function chordLetterOf(entry: CommandEntryLike): string {
  const spec = specOfCommand(entry)

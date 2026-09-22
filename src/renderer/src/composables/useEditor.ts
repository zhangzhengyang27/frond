  }
)

export function useEditor(): {
  cursorPosition: { row: number; column: number }
  settings: EditorSettings
} {
  onMounted(() => {
    loadSettings()
  })

  return {
    cursorPosition,
    settings
  }
}

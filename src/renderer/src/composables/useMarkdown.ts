  scale.value = value.toString()
  setStoredScale(value)
}

export function useMarkdown(): {
  onZoom: (type: 'in' | 'out') => void
  scaleToShow: ComputedRef<string>
  scale: ShallowRef<string | undefined>
} {
  return {
    onZoom,
    scaleToShow,
    scale
  }
}

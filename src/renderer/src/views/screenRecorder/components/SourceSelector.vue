onMounted(async () => {
  const api = (
    window as unknown as {
      api?: { recording?: { region?: { listDisplays: () => Promise<DisplayInfo[]> } } }
    }
  ).api?.recording?.region
  if (api?.listDisplays) {
    try {
      displays.value = await api.listDisplays()
      // 默认选中主显示器
      const primary = displays.value.find((d) => d.isPrimary)
      if (primary) selectedDisplayId.value = primary.id
    } catch (e) {
      console.warn('[SourceSelector] listDisplays failed:', e)
    }
})

function selectDisplay(id: number): void {
  selectedDisplayId.value = id
  crossDisplay.value = false
  emit('select-region', id)
}

function toggleCrossDisplay(): void {
  crossDisplay.value = !crossDisplay.value
  if (crossDisplay.value) {
    selectedDisplayId.value = 'cross'
    emit('select-region', 'cross')
  }
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const switchSourceType = (type: 'screen' | 'camera'): void => {
  emit('switch-source-type', type)
}

const getSourceTypeLabel = (sourceId: string): string => {
  if (sourceId.includes('screen')) {
    return '屏幕'
  } else if (sourceId.includes('window')) {
    return '窗口'
  }
  return '未知'
}

const getThumbnailUrl = (thumbnail: string | undefined): string => {
  if (!thumbnail) {
    return ''
  }
  if (thumbnail.startsWith('data:')) {
    return thumbnail
  }
  return `data:image/png;base64,${thumbnail}`
}

const handleThumbnailError = (event: Event, _sourceId?: string): void => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

const handleThumbnailLoad = (event: Event, _sourceId?: string): void => {
  const img = event.target as HTMLImageElement
  img.style.display = 'block'
}
</script>

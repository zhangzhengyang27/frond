
const emit = defineEmits<{
  select: [window: WindowInfo]
  close: []
}>()

const loading = ref(true)
const windows = ref<WindowInfo[]>([])
const selectedId = ref<string | null>(null)

onMounted(async () => {
  try {
    const result = await window.api.screenshot.getWindowList()
    if (result.success) {
      windows.value = result.windows
    }
  } catch (error) {
    console.error('[WindowPicker] Failed to load windows:', error)
  } finally {
    loading.value = false
  }
})

const handleSelect = (win: WindowInfo): void => {
  selectedId.value = win.id
  emit('select', win)
}

const handleClose = (): void => {
  emit('close')
}
</script>

<style scoped>
.window-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--shot-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.window-picker-container {
  background: var(--shot-panel);
  border-radius: 12px;

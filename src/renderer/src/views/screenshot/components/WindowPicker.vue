~~~ 第 1 行未留存 ~~~
~~~ 第 2 行未留存 ~~~
~~~ 第 3 行未留存 ~~~
~~~ 第 4 行未留存 ~~~
~~~ 第 5 行未留存 ~~~
~~~ 第 6 行未留存 ~~~
~~~ 第 7 行未留存 ~~~
~~~ 第 8 行未留存 ~~~
~~~ 第 9 行未留存 ~~~
~~~ 第 10 行未留存 ~~~
~~~ 第 11 行未留存 ~~~
~~~ 第 12 行未留存 ~~~
~~~ 第 13 行未留存 ~~~
~~~ 第 14 行未留存 ~~~
~~~ 第 15 行未留存 ~~~
~~~ 第 16 行未留存 ~~~
~~~ 第 17 行未留存 ~~~
~~~ 第 18 行未留存 ~~~
~~~ 第 19 行未留存 ~~~
~~~ 第 20 行未留存 ~~~
~~~ 第 21 行未留存 ~~~
~~~ 第 22 行未留存 ~~~
~~~ 第 23 行未留存 ~~~
~~~ 第 24 行未留存 ~~~
~~~ 第 25 行未留存 ~~~
~~~ 第 26 行未留存 ~~~
~~~ 第 27 行未留存 ~~~
~~~ 第 28 行未留存 ~~~
~~~ 第 29 行未留存 ~~~
~~~ 第 30 行未留存 ~~~
~~~ 第 31 行未留存 ~~~
~~~ 第 32 行未留存 ~~~
~~~ 第 33 行未留存 ~~~
~~~ 第 34 行未留存 ~~~
~~~ 第 35 行未留存 ~~~
~~~ 第 36 行未留存 ~~~
~~~ 第 37 行未留存 ~~~
~~~ 第 38 行未留存 ~~~
~~~ 第 39 行未留存 ~~~
~~~ 第 40 行未留存 ~~~
~~~ 第 41 行未留存 ~~~
~~~ 第 42 行未留存 ~~~
~~~ 第 43 行未留存 ~~~
~~~ 第 44 行未留存 ~~~
~~~ 第 45 行未留存 ~~~
~~~ 第 46 行未留存 ~~~
~~~ 第 47 行未留存 ~~~
~~~ 第 48 行未留存 ~~~
~~~ 第 49 行未留存 ~~~
~~~ 第 50 行未留存 ~~~
~~~ 第 51 行未留存 ~~~
~~~ 第 52 行未留存 ~~~
~~~ 第 53 行未留存 ~~~
~~~ 第 54 行未留存 ~~~

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

const handleSelect = (win: WindowInfo) => {
  selectedId.value = win.id
  emit('select', win)
}

const handleClose = () => {
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

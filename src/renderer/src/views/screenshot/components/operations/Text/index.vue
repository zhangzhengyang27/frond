  x1: number
  x2: number
  y1: number
  y2: number
}

export interface TextareaBounds {
  x: number
  y: number
  maxWidth: number
  maxHeight: number
}

const sizes: Record<number, number> = {
  3: 18,
  6: 32,
  9: 46
}

const store = useStore()
const lang = computed(() => store.lang)
const [history, historyDispatcher] = useHistory()
const bounds = computed(() => getValue(store.bounds))
const [operation, operationDispatcher] = useOperation()
const [, cursorDispatcher] = useCursor()
const canvasContextRef = useCanvasContextRef()

const size = ref(3)
const color = ref('#ee5126')
const textRef = ref<import('../../../types').HistoryItemSource<TextData, TextEditData> | null>(null)
const textEditRef = ref<import('../../../types').HistoryItemEdit<TextEditData, TextData> | null>(
  null
)
const textareaBounds = ref<TextareaBounds | null>(null)
const text = ref<string>('')

const checked = computed(() => operation === 'Text')

const selectText = (): void => {
  operationDispatcher.set('Text')
  cursorDispatcher.set('default')
}

const handleSelectText = (): void => {
  if (checked.value) {
    return
  }
  selectText()
  historyDispatcher.clearSelect()
}

const handleSizeChange = (newSize: number): void => {
  if (textRef.value) {
    textRef.value.data.size = sizes[newSize]
  }
  size.value = newSize
}

const handleColorChange = (newColor: string): void => {
  if (textRef.value) {
    textRef.value.data.color = newColor
  }
  color.value = newColor
}

const handleTextareaChange = (value: string): void => {
  text.value = value
  if (checked.value && textRef.value) {
    textRef.value.data.text = value
  }
}

const handleTextareaBlur = (): void => {
  if (textRef.value && textRef.value.data.text) {
    historyDispatcher.push(textRef.value)
  }
  textRef.value = null
  text.value = ''
  textareaBounds.value = null
}

const onDrawSelect = (
  action: import('../../../types').HistoryItemSource<unknown, unknown>,
  e: MouseEvent
): void => {
  if (action.name !== 'Text') {
    return
  }

  selectText()

  textEditRef.value = {
    type: HistoryItemType.Edit,
    data: {
      x1: e.clientX,
      y1: e.clientY,
      x2: e.clientX,
      y2: e.clientY
    },
    source: action as import('../../../types').HistoryItemSource<TextData, TextEditData>
  }

  historyDispatcher.select(action)
}

const onMousedown = (e: MouseEvent): void => {
  if (!checked.value || !canvasContextRef.value || textRef.value || !bounds.value) {
    return
  }
  const { left, top } = canvasContextRef.value.canvas!.getBoundingClientRect()
  const fontFamily = window.getComputedStyle(canvasContextRef.value.canvas!).fontFamily
  const x = e.clientX - left
  const y = e.clientY - top

  textRef.value = {
    name: 'Text',
    type: HistoryItemType.Source,
    data: {
      size: sizes[size.value],
      color: color.value,
      fontFamily,
      x,
      y,
      text: ''
    },
    editHistory: [],
    draw,
    isHit
  }

  textareaBounds.value = {
    x: e.clientX,
    y: e.clientY,
    maxWidth: bounds.value.width - x,
    maxHeight: bounds.value.height - y
  }
}

const onMousemove = (e: MouseEvent): void => {
  if (!checked.value) {
    return
  }

  if (textEditRef.value) {
    textEditRef.value.data.x2 = e.clientX
    textEditRef.value.data.y2 = e.clientY
    if (history.top !== textEditRef.value) {
      textEditRef.value.source.editHistory.push(textEditRef.value)
      historyDispatcher.push(textEditRef.value)
    } else {
      historyDispatcher.set(history)
    }
  }
}

const onMouseup = (): void => {
  if (!checked.value) {
    return
  }

  textEditRef.value = null
}

useDrawSelect(onDrawSelect)
useCanvasMousedown(onMousedown)
useCanvasMousemove(onMousemove)
useCanvasMouseup(onMouseup)
</script>

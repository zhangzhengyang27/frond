const emit = defineEmits<{
  close: []
  result: [text: string]
}>()

const loading = ref(true)
const progress = ref(0)
const recognizedText = ref('')
const confidence = ref(0)
const error = ref('')
let isCanceled = false

onMounted(async () => {
  await performOcr()
})

onUnmounted(() => {
  // 标记取消：在飞的 recognize 会在下一个进度回调中止。
  // 不销毁 ocrService 单例——worker + 语言包（数十 MB）创建/加载耗数秒，
  // 每次关浮层即重建会让每次 OCR 都付出首次级延迟；worker 随应用退出回收
  isCanceled = true
})

const performOcr = async (): Promise<void> => {
  loading.value = true
  progress.value = 0
  error.value = ''
  isCanceled = false

  try {
    const { ocrService } = await import('../../../services/OcrService')

    const result = await ocrService.recognize(props.imageSrc, {
      lang: 'chi_sim+eng',
      onProgress: (p) => {
        if (isCanceled) {
          throw new Error('OCR cancelled')
        }
        progress.value = p
      }
    })

    if (isCanceled) return

    recognizedText.value = result.text
    confidence.value = Math.round(result.confidence)

    if (result.text) {
      emit('result', result.text)
    } else {
      error.value = '未检测到文字'
    }
  } catch (err) {
    if (isCanceled) {
      emit('close')
      return
    }
    console.error('[OcrResult] OCR failed:', err)
    error.value = '识别失败: ' + (err as Error).message
  } finally {
    loading.value = false
  }
}

const handleCancel = (): void => {
  isCanceled = true
  emit('close')
}

const handleCopy = async (): Promise<void> => {
  if (!recognizedText.value) return

  try {
    await navigator.clipboard.writeText(recognizedText.value)
    // 可以添加一个 toast 提示
  } catch (err) {
    console.error('[OcrResult] Copy failed:', err)
  }
}
</script>

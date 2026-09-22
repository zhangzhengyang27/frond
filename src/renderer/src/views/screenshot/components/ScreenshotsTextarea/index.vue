  maxWidth: number
  maxHeight: number
  size: number
  color: string
  value: string
}>()

const emit = defineEmits<{
  change: [value: string]
  blur: []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const width = ref(0)
const height = ref(0)

const handleChange = (e: Event): void => {
  const target = e.target as HTMLTextAreaElement
  emit('change', target.value)
}

const handleBlur = (): void => {
  emit('blur')
}

watch(
  () => [props.value, props.maxWidth, props.maxHeight],
  () => {
    if (!textareaRef.value) {
      return
    }
    const { width: w, height: h } = calculateNodeSize(
      textareaRef.value,
      props.value,
      props.maxWidth,
      props.maxHeight
    )
    width.value = w
    height.value = h
  },
  { immediate: true }
)

onMounted(() => {
  nextTick(() => {
    textareaRef.value?.focus()
  })
})
</script>

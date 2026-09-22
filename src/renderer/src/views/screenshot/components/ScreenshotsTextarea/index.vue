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

const handleChange = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  emit('change', target.value)
}

const handleBlur = () => {
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


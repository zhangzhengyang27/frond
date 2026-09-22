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
  }>(),
  {
    defaultSeconds: 3
  }
)

const emit = defineEmits<{
  start: [seconds: number]
  cancel: []
}>()

const options = [3, 5, 10]
const selected = ref(props.defaultSeconds)
const customSeconds = ref<number | null>(null)
const useCustom = ref(false)

const finalSeconds = computed(() => {
  if (useCustom.value && customSeconds.value && customSeconds.value > 0) {
    return Math.min(Math.max(Math.round(customSeconds.value), 1), 60)
  }
  return selected.value
})

const select = (sec: number) => {
  selected.value = sec
  useCustom.value = false
}

const start = () => {
  emit('start', finalSeconds.value)
}
</script><style scoped>
.delay-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--shot-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.delay-panel {
  background: var(--shot-panel);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shot-shadow);
  min-width: 280px;
}

.delay-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--shot-text);
  text-align: center;

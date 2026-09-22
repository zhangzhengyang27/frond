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

const select = (sec: number): void => {
  selected.value = sec
  useCustom.value = false
}

const start = (): void => {
  emit('start', finalSeconds.value)
}
</script>

<style scoped>
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

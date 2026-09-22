const newTaskTitle = ref('')

const handleAdd = (): void => {
  const title = newTaskTitle.value.trim()
  if (title) {
    emit('add-task', title)
    newTaskTitle.value = ''
    showAddInput.value = false
  }
}

const handleSelect = (taskId: string): void => {
  emit('select-task', props.currentTaskId === taskId ? null : taskId)
}

const handleDelete = (taskId: string): void => {
  emit('delete-task', taskId)
}

const handleComplete = (taskId: string): void => {
  emit('complete-task', taskId)
}
</script>

<style scoped>

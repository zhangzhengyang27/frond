/**

function onMouseUp(): void {
  stopDrawing()
}

// 触摸事件处理（移动设备支持）
function onTouchStart(event: TouchEvent): void {
  event.preventDefault()
  const touch = event.touches[0]
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  onMouseDown(mouseEvent)
}

function onTouchMove(event: TouchEvent): void {
  event.preventDefault()
  const touch = event.touches[0]
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  onMouseMove(mouseEvent)
}

function onTouchEnd(event: TouchEvent): void {
  event.preventDefault()
  onMouseUp()
}

onMounted(() => {
  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})

// 当激光笔关闭时清除笔画，开启时调整画布大小
watch(
  () => props.isActive,
  (newValue) => {
    if (!newValue) {
      clearStrokes()
      isDrawing.value = false
      currentStroke = null
    } else {
      nextTick(() => {
        resizeCanvas()
      })
    }
  }
)
</script>

<template>
  <canvas
    v-if="isActive"
    v-show="isActive"
    ref="canvasRef"
    class="laser-pointer-canvas"
    :style="{ height: `calc(100vh - ${props.offsetBottom}px)` }"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"

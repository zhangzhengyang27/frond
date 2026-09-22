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
})

const attrs = useAttrs()

// 将图标名称转换为 remixicon 类名
// 如果已经是 ri- 开头（完整类名），直接使用；否则添加 ri- 前缀和 -line/-fill 后缀
const iconClass = computed(() => {
  const iconName = props.icon

  // 如果已经是 ri- 开头的完整类名，直接使用
  if (iconName.startsWith('ri-')) {
    return iconName
  }

  // 否则添加 ri- 前缀和变体后缀
  return `ri-${iconName}-${props.variant}`
})

// 合并传入的 class 和图标类名
const mergedClass = computed(() => {
  const classes = [iconClass.value]
  if (attrs.class) {
    if (typeof attrs.class === 'string') {
      classes.push(attrs.class)
    } else if (Array.isArray(attrs.class)) {
      classes.push(...attrs.class)
    }
  }
  return classes.join(' ')
})

const iconStyle = computed(() => {
  const style: Record<string, string> = {
    fontSize: typeof props.size === 'number' ? `${props.size}px` : props.size,
    display: props.inline ? 'inline-block' : 'block'
  }

  // 只有当 color 不是 'currentColor' 时才设置内联颜色样式
  // 这样可以允许通过 class 属性（如 Tailwind 的 text-red-500）来设置颜色
  if (props.color !== 'currentColor') {
    style.color = props.color
  }

  if (props.rotate !== 0) {
    style.transform = `rotate(${props.rotate}deg)`
  }

  if (props.flip) {
    const flipMap = {
      horizontal: 'scaleX(-1)',
      vertical: 'scaleY(-1)',
      both: 'scale(-1)'
    }
    const flipTransform = flipMap[props.flip]
    if (style.transform) {
      style.transform += ` ${flipTransform}`
    } else {
      style.transform = flipTransform
    }
  }

  return style
})
</script>

<template>
  <i :class="mergedClass" :style="iconStyle" />
</template>


})

const attrs = useAttrs()

// 将图标名称转换为 remixicon 类名
// 如果已经是 ri- 开头（完整类名），直接使用；否则添加 ri- 前缀和 -line/-fill 后缀。
// 审查修复：调用方大量传入自带 '-line' 后缀的名字（如 'play-line'、'menu-line'、'link'），
// 直接拼接会产出不存在的双重后缀类（ri-play-line-line）导致图标静默空白——
// 统一先剥离尾缀再拼变体，存量与本批新增一并修复。
const iconClass = computed(() => {
  const iconName = props.icon

  // 如果已经是 ri- 开头的完整类名，直接使用
  if (iconName.startsWith('ri-')) {
    return iconName
  }

  const base = iconName.replace(/-(line|fill)$/, '')
  return `ri-${base}-${props.variant}`
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

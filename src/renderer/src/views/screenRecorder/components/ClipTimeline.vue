const duration = ref(0) // 使用 ref 存储时长，参考 PlaybackPanel.vue

// 计算视频源路径（video:// 协议流式 URL，主进程支持 Range 分片）
const videoSrc = computed(() => blobUrl.value || '')

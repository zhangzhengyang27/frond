    }

    // 如果有新路径，走 video:// 协议流式加载（主进程支持 Range 分片）：
    // 此前经 IPC 把整个文件读进内存再建 Blob，1GB+ 录制回放峰值内存数 GB
    if (newPath) {
      loading.value = true

      // 如果 videoInfo 中有时长信息，先使用它
      if (props.videoInfo?.duration && props.videoInfo.duration > 0) {
        duration.value = props.videoInfo.duration
        console.log('使用 videoInfo 中的时长:', duration.value)
      }

      // URL 直接指向本地文件，Chromium 按需分块拉取；加载失败由
      // <video> 的 error 事件兜底提示
      blobUrl.value = `video://${encodeURI(newPath)}`
      loading.value = false
    } else {
      loading.value = false
    }
  },
  { immediate: true }
)

// 监听 blob URL 变化，加载视频
watch(

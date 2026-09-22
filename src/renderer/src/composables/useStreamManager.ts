}

// 关闭摄像头
const closeCamera = (): void => {
  if (cameraStream.value) {
    // 视频轨 stop；音频轨只从流上摘除（removeTrack）——它可能来自共享的
    // 音频缓存（同一轨也挂在屏幕流/合成流上），直接 stop 会把正在用的麦克风静音
    cameraStream.value.getVideoTracks().forEach((track) => track.stop())
    cameraStream.value.getAudioTracks().forEach((track) => {
      if (cameraStream.value) cameraStream.value.removeTrack(track)
    })
    cameraStream.value = null
  }
  if (pipCameraRef.value) {
    pipCameraRef.value.srcObject = null
  }
  // 如果正在使用合成流，需要重新设置预览为屏幕流
  if (canvasStream.value && stream.value) {
    // 只 stop 合成流的视频轨；音频轨与屏幕流共享同一个 track 对象
    // （combineStreams 里 addTrack 的是 stream.value 的轨），直接 stop
    // 会把正在用的麦克风/系统音频静音——用 removeTrack 从合成流上摘除
    canvasStream.value.getVideoTracks().forEach((track) => track.stop())
    canvasStream.value.getAudioTracks().forEach((track) => {
      if (canvasStream.value) canvasStream.value.removeTrack(track)
    })
    canvasStream.value = null
    // 如果只有屏幕流，设置预览为屏幕流
    if (previewVideoRef.value) {
      previewVideoRef.value.srcObject = stream.value
      previewVideoRef.value.play()
    }
  }
}

// 清理资源

  type ComplexExportArgs = Parameters<typeof buildComplexExportArgs>[0]
  // 各输入默认：源 60s / 片头片尾各 5s，全部有音轨
  const mk = (over: Partial<ComplexExportArgs> = {}): ComplexExportArgs =>
    ({
      source: '/tmp/a.mp4',
      hasIntro: false,
      hasOutro: false,
      hasBgm: false,
      transition: 'cut',
      applyTransition: false,
      format: 'mp4',
      resolution: 1080,
      fps: 30,
      fadeSec: 0,
      outputPath: '/tmp/out.mp4',
      durations: { source: 60, intro: 5, outro: 5 },
      hasAudio: { source: true, intro: true, outro: true },
      ...over
    }) as ComplexExportArgs

  it('纯转码（无 intro/outro/bgm）走简单路径', () => {
    // main 端 export() 会根据 useComplex 走 buildComplex / buildSimple

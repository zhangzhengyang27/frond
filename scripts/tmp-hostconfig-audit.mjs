import fs from 'node:fs'
const path = 'node_modules/.pnpm/react-reconciler@0.34.0_react@19.3.0/node_modules/react-reconciler/cjs/react-reconciler.production.js'
const src = fs.readFileSync(path, 'utf8')
const names = [
  'commitTextUpdate', 'commitMount', 'prepareUpdate', 'appendChild', 'appendChildToContainer',
  'insertBefore', 'insertInContainerBefore', 'removeChild', 'removeChildFromContainer',
  'appendInitialChild', 'createInstance', 'createTextInstance', 'resetTextContent',
  'hideInstance', 'unhideInstance', 'commitUpdate', 'finalizeInitialChildren',
  'shouldSetTextContent', 'clearContainer', 'getPublicInstance', 'getInstanceFromNode',
  'maySuspendCommit', 'preloadInstance', 'startSuspendingCommit', 'waitForCommitToBeReady',
  'scheduleMicrotask', 'supportsMicrotasks'
]
for (const n of names) {
  const re = new RegExp('(^|[^A-Za-z0-9_$.])' + n + '\\s*\\(', 'g')
  const found = []
  let m
  while ((m = re.exec(src))) {
    const seg = src.slice(m.index + m[1].length, m.index + m[1].length + 200).replace(/\s*\n\s*/g, ' ')
    found.push(seg.slice(0, 160))
  }
  console.log(`### ${n} [${found.length}]`)
  for (const f of found.slice(0, 4)) console.log('    ' + f)
}

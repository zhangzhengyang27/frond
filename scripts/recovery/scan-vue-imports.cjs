const fs = require('fs')
const path = require('path')
const root = 'src/renderer/src'
const alias = {
  '@renderer/': root + '/',
  '@components/': root + '/components/',
  '@composables/': root + '/composables/',
  '@utils/': root + '/utils/',
  '@views/': root + '/views/',
  '@api/': root + '/api/',
  '@constants/': root + '/constants/',
  '@router/': root + '/router/',
  '@shared/': 'src/shared/',
  '@preload/': 'src/preload/'
}
function walk(d) {
  return fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
}
const files = walk(root).filter((f) => /\.(vue|ts)$/.test(f))
const missing = new Map()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/from\s+['"]([^'"]+\.vue)['"]/g)) {
    const spec = m[1]
    let p = null
    if (spec.startsWith('.')) p = path.normalize(path.join(path.dirname(f), spec))
    else for (const [a, b] of Object.entries(alias)) if (spec.startsWith(a)) { p = b + spec.slice(a.length); break }
    if (!p) continue
    if (!fs.existsSync(p)) {
      if (!missing.has(p)) missing.set(p, [])
      missing.get(p).push(f)
    }
  }
}
for (const [p, importers] of [...missing].sort()) {
  const rel = p.replace(root + '/', '')
  const cand = ['/tmp/cache-dump/src/' + rel, '/tmp/cache-dump/' + p]
  const hit = cand.find((c) => fs.existsSync(c))
  const lines = hit ? fs.readFileSync(hit, 'utf8').split('\n').length : 0
  console.log(
    (hit ? 'ORIG  ' : 'NONE  ') + p.padEnd(50) + ' <- ' + importers.length + ' importer(s)' + (hit ? '  ' + lines + ' lines' : '')
  )
}
console.log('total missing .vue:', missing.size)

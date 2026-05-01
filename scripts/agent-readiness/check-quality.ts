import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = new URL('../..', import.meta.url).pathname
const ignored = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.artifacts',
  '.omx',
  '.codex',
  '.worktrees',
])
const sourceExts = new Set(['.ts', '.tsx', '.js', '.jsx'])
const textExts = new Set([...sourceExts, '.json', '.md', '.yml', '.yaml', '.css', '.html'])
const maxSourceLines = 950
const maxSourceBytes = 180_000
const maxTextBytes = 500_000

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

function rel(path: string) {
  return relative(root, path)
}

function fail(message: string, detail: string) {
  failures.push(`${message}: ${detail}`)
}

const nPlusOneAllowlist = new Set(['api/db/generation-warmup.ts'])
const debtWordsPattern = new RegExp(
  '\\b(' + ['TO', 'DO'].join('') + '|' + ['FIX', 'ME'].join('') + ')\\b',
  'i',
)

const failures: string[] = []
const files = walk(root)
const sourceFiles = files.filter(
  (file) => sourceExts.has(extname(file)) && !rel(file).endsWith('.d.ts'),
)

for (const file of files) {
  const extension = extname(file)
  if (!textExts.has(extension)) continue
  const stats = statSync(file)
  const limit = sourceExts.has(extension) ? maxSourceBytes : maxTextBytes
  if (stats.size > limit)
    fail('large-file', `${rel(file)} is ${stats.size} bytes; limit is ${limit}`)
}

for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  if (lines.length > maxSourceLines)
    fail('large-source-file', `${rel(file)} has ${lines.length} lines; limit is ${maxSourceLines}`)

  lines.forEach((line, index) => {
    if (
      debtWordsPattern.test(line) &&
      !/(#[0-9]+|[A-Z]+-[0-9]+|(?:TO''DO|FIX''ME)\([^)]+\))/i.test(line)
    ) {
      fail(
        'untracked-tech-debt',
        `${rel(file)}:${index + 1} must link debt markers to an issue or owner`,
      )
    }
  })

  const queryCallPattern = /\b(lease\.run|connection\.run|db\.query|fetch)\s*\(/g
  const loopPattern =
    /\b(for|while)\s*\([^)]*\)\s*\{[\s\S]{0,900}?\b(lease\.run|connection\.run|db\.query)\s*\(/g
  if (loopPattern.test(text) && !nPlusOneAllowlist.has(rel(file))) {
    fail('n-plus-one-risk', `${rel(file)} appears to execute database work inside a loop`)
  }

  let queryCalls = 0
  while (queryCallPattern.exec(text)) queryCalls += 1
  if (queryCalls > 18)
    fail(
      'query-fanout-risk',
      `${rel(file)} has ${queryCalls} query/fetch call sites; split or justify`,
    )
}

const srcImportsApi = sourceFiles
  .filter((file) => rel(file).startsWith('src/') || rel(file).startsWith('app/'))
  .flatMap((file) => {
    const text = readFileSync(file, 'utf8')
    return /from ['"](\.\.\/api|api\/|@\/\.\.\/api)/.test(text) ? [rel(file)] : []
  })
if (srcImportsApi.length > 0)
  fail('module-boundary', `client files import API internals: ${srcImportsApi.join(', ')}`)

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const dependencyNames = Object.keys(packageJson.dependencies ?? {})
const searchableText = sourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
const dependencyAllowlist = new Set([
  'baseline-browser-mapping',
  'echarts-for-react',
  'js-cookie',
  'caniuse-lite',
  'sst',
  'tailwindcss-animate',
  'tw-animate-css',
  'uplot',
])
for (const dependency of dependencyNames) {
  if (dependencyAllowlist.has(dependency)) continue
  const importName = dependency.startsWith('@')
    ? dependency.split('/').slice(0, 2).join('/')
    : dependency
  if (!searchableText.includes(`'${importName}`) && !searchableText.includes(`"${importName}`)) {
    fail(
      'unused-dependency-candidate',
      `${dependency} is not imported by source files; add allowlist rationale or remove it`,
    )
  }
}

if (failures.length > 0) {
  console.error('Agent readiness quality checks failed:')
  for (const item of failures) console.error(`- ${item}`)
  process.exit(1)
}

console.log(`Agent readiness quality checks passed for ${sourceFiles.length} source files.`)

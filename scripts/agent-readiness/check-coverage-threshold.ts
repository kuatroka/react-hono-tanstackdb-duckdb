import { existsSync, readFileSync } from 'node:fs'

const lcovPath = '.artifacts/coverage/lcov.info'
const minimumLineCoverage = 10

if (!existsSync(lcovPath)) {
  console.error(`Coverage threshold failed: missing ${lcovPath}`)
  process.exit(1)
}

const lcov = readFileSync(lcovPath, 'utf8')
const found = [...lcov.matchAll(/^LF:(\d+)\nLH:(\d+)/gm)].reduce(
  (total, match) => ({
    lines: total.lines + Number(match[1]),
    hits: total.hits + Number(match[2]),
  }),
  { lines: 0, hits: 0 },
)

const coverage = found.lines === 0 ? 0 : (found.hits / found.lines) * 100
if (coverage < minimumLineCoverage) {
  console.error(
    `Coverage threshold failed: ${coverage.toFixed(2)}% lines < ${minimumLineCoverage}%`,
  )
  process.exit(1)
}

console.log(`Coverage threshold passed: ${coverage.toFixed(2)}% lines >= ${minimumLineCoverage}%`)

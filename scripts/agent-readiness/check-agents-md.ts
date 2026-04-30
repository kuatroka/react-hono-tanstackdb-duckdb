import { readFileSync } from 'node:fs'

const agents = readFileSync('AGENTS.md', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
}
const requiredCommands = ['lint', 'test', 'build', 'dev']
const missing = requiredCommands.filter((script) => !packageJson.scripts[script])

if (missing.length > 0) {
  console.error(
    `AGENTS.md validation failed: package.json is missing scripts: ${missing.join(', ')}`,
  )
  process.exit(1)
}

for (const command of ['bun run lint', 'bun run test', 'bun run build']) {
  const scriptName = command.replace('bun run ', '')
  if (!agents.includes(command) && !packageJson.scripts[scriptName]) {
    console.error(`AGENTS.md validation failed: ${command} is not documented or available`)
    process.exit(1)
  }
}

console.log(
  'AGENTS.md validation passed: core commands are present and runnable by package script name.',
)

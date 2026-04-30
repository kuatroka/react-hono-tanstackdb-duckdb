import { $ } from 'bun'

const base = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'HEAD~1'
const changed = await $`git diff --name-only ${base}...HEAD`
  .quiet()
  .text()
  .catch(() => '')
const files = changed.trim().split('\n').filter(Boolean)
const risky = files.filter(
  (file) => /^(api|infra|docker|\.github)\//.test(file) || /security|auth|secret/i.test(file),
)

const body = [
  '## Automated readiness review',
  '',
  `Changed files: ${files.length}`,
  risky.length > 0
    ? `Risk-sensitive files: ${risky.join(', ')}`
    : 'Risk-sensitive files: none detected',
  '',
  'Recommended reviewer checklist:',
  '- Confirm validators completed successfully.',
  '- Check API, auth, deploy, and data-path changes for rollback impact.',
  '- Verify new debt-marker comments link to an owner or issue.',
].join('\n')

console.log(body)

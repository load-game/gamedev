import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const audit = spawnSync('pnpm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
if (audit.error) throw audit.error
const report = JSON.parse(audit.stdout)
if (!report.advisories || !report.metadata) throw new Error('Dependency audit did not return a vulnerability report')

// The wallet SDK still requires Zod 3. A reviewed backport preserves that API.
// CI runs dependency-security.test.js before this gate. Keep the version-only
// advisory visible in ordinary pnpm audit output rather than suppressing it.
const patch = readFileSync(new URL('../patches/zod@3.25.76.patch', import.meta.url))
const reviewedPatch =
  createHash('sha256').update(patch).digest('hex') ===
  '35f795e500816bc9fa64e336026990be28609c4f1840c75ad3814702bac49b9a'
const decoderPatch = readFileSync(new URL('../patches/decode-uri-component@0.2.2.patch', import.meta.url))
if (
  createHash('sha256').update(decoderPatch).digest('hex') !==
  'cf16c27946d2ee5e5f33305f05f5ab5dd3f9b45b41bfca1e666c781f12cf82b6'
) {
  throw new Error('Legacy URI decoder patch changed; review its backport and regression tests')
}
const findings = Object.values(report.advisories)
const blocked = findings.filter(advisory => {
  if (!['high', 'critical'].includes(advisory.severity)) return false
  const legacyBackport =
    advisory.module_name === 'zod' &&
    advisory.url?.endsWith('/GHSA-mrhx-c7xc-m3w5') &&
    advisory.findings.every(finding => finding.version === '3.25.76') &&
    reviewedPatch
  return !legacyBackport
})
for (const advisory of blocked) console.error(`${advisory.severity}: ${advisory.module_name}: ${advisory.url}`)
if (blocked.length) process.exit(1)
console.log('No unmitigated high or critical dependency findings. Legacy Zod backport verified.')
console.log(JSON.stringify(report.metadata.vulnerabilities))

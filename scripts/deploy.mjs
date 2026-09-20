#!/usr/bin/env node
/**
 * Build and publish dist/ to the gh-pages branch.
 *
 * Deliberately not a GitHub Actions workflow: the local gh token has no
 * `workflow` scope, so the deploy runs from a developer machine instead.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args, cwd = repoRoot) {
  return execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

function capture(cmd, args, cwd = repoRoot) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim()
}

console.log('→ building')
run('npm', ['run', 'build'])

const remote = capture('git', ['remote', 'get-url', 'origin'])
const sourceSha = capture('git', ['rev-parse', '--short', 'HEAD'])

const work = mkdtempSync(join(tmpdir(), 'abc-quest-pages-'))
try {
  console.log(`→ staging gh-pages in ${work}`)
  run('git', ['init', '-q', '-b', 'gh-pages'], work)
  run('git', ['remote', 'add', 'origin', remote], work)

  cpSync(join(repoRoot, 'dist'), work, { recursive: true })
  // Jekyll on GitHub Pages would swallow files starting with an underscore.
  writeFileSync(join(work, '.nojekyll'), '')
  // Single-page app: unknown paths must fall back to index.html.
  cpSync(join(work, 'index.html'), join(work, '404.html'))

  run('git', ['add', '-A'], work)
  run('git', ['-c', 'user.name=abc-quest deploy', '-c', 'user.email=deploy@local',
    'commit', '-q', '-m', `deploy: ${sourceSha}`], work)
  console.log('→ pushing gh-pages')
  run('git', ['push', '-q', '--force', 'origin', 'gh-pages'], work)
  console.log('✓ deployed')
} finally {
  rmSync(work, { recursive: true, force: true })
}

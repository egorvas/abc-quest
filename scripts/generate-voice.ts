#!/usr/bin/env node
/**
 * Build every spoken line in the app into a static audio clip.
 *
 * The app used to call speechSynthesis at run time. On an iPad that produced a
 * different voice on every device, a letter name that was sometimes spelled out
 * instead of spoken, and no way at all to say an isolated /b/. Speech is now
 * generated once, here, and shipped as files.
 *
 *   npm run voice              # build what changed
 *   npm run voice -- --force   # rebuild everything
 *   npm run voice -- --check   # report only, write nothing
 *
 * What it does:
 *   1. makes sure a pinned Python environment exists (uv, no system Python)
 *   2. downloads the Kokoro model on first run
 *   3. synthesizes only the clips whose text or recipe changed
 *   4. trims, loudness-levels and encodes each clip to MP3 with ffmpeg-static
 *   5. writes public/voice/manifest.json, which the app fetches at boot
 *
 * Everything below is content-addressed: a clip's cache key is a hash of its
 * recipe plus the engine settings, so changing a sentence rebuilds one file and
 * changing the voice rebuilds all of them.
 */
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildInventory, type ClipSpec } from './voice/inventory.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const voiceDir = join(here, 'voice')
const cacheDir = join(repoRoot, '.voice-cache')
const rawDir = join(cacheDir, 'raw')
const modelDir = join(cacheDir, 'model')
const outDir = join(repoRoot, 'public', 'voice')

/** Bumping any of these invalidates the whole cache, which is the point. */
const ENGINE = Object.freeze({
  engine: 'kokoro-onnx',
  model: 'kokoro-v1.0',
  voice: 'af_heart',
  speed: 1.0,
  format: 'mp3',
  sampleRate: 24000,
  bitrate: '48k',
  loudness: 'I=-16:TP=-1.5:LRA=11',
  revision: 3,
})

const MODEL_FILES = Object.freeze([
  {
    name: 'kokoro-v1.0.onnx',
    url: 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx',
  },
  {
    name: 'voices-v1.0.bin',
    url: 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin',
  },
])

const args = new Set(process.argv.slice(2))
const force = args.has('--force')
const checkOnly = args.has('--check')

function run(cmd: string, argv: readonly string[], options: Record<string, unknown> = {}) {
  const result = spawnSync(cmd, argv as string[], { stdio: 'inherit', ...options } as never)
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${cmd} ${argv.join(' ')} exited with ${result.status}`)
  }
  return result
}

function capture(cmd: string, argv: readonly string[], options: Record<string, unknown> = {}): string {
  const result = spawnSync(cmd, argv as string[], { encoding: 'utf8', ...options } as never)
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '')
    throw new Error(`${cmd} ${argv.join(' ')} exited with ${result.status}`)
  }
  return result.stdout
}

/** Recipe hash. Two clips with the same key have identical audio. */
function clipKey(clip: ClipSpec): string {
  const recipe = JSON.stringify({ clip, engine: ENGINE })
  return createHash('sha256').update(recipe).digest('hex').slice(0, 16)
}

function ffmpegPath(): string {
  // ffmpeg-static ships a prebuilt binary; the box has no system ffmpeg.
  const mod = join(repoRoot, 'node_modules', 'ffmpeg-static', 'ffmpeg')
  if (!existsSync(mod)) {
    throw new Error('ffmpeg-static is missing - run `npm install` first')
  }
  return mod
}

/**
 * A pinned Python 3.12 environment, created with uv so nothing depends on the
 * system interpreter. uv is fetched on demand and lives inside the cache.
 */
function ensurePython(): string {
  const venv = join(cacheDir, 'venv')
  const python = join(venv, 'bin', 'python')
  const stamp = join(venv, '.requirements.sha')
  const requirements = readFileSync(join(voiceDir, 'requirements.txt'), 'utf8')
  const want = createHash('sha256').update(requirements).digest('hex')

  if (existsSync(python) && existsSync(stamp) && readFileSync(stamp, 'utf8') === want) {
    return python
  }

  let uv = 'uv'
  try {
    execFileSync(uv, ['--version'], { stdio: 'ignore' })
  } catch {
    throw new Error(
      'uv is required to build the voice.\n' +
      '  curl -LsSf https://astral.sh/uv/install.sh | sh\n' +
      'It is only needed to regenerate audio; `npm run build` does not need it.',
    )
  }

  console.log('→ creating the Python environment')
  run(uv, ['venv', '--python', '3.12', venv])
  run(uv, ['pip', 'install', '--python', python, '-r', join(voiceDir, 'requirements.txt')])
  writeFileSync(stamp, want)
  return python
}

function ensureModel() {
  mkdirSync(modelDir, { recursive: true })
  for (const file of MODEL_FILES) {
    const target = join(modelDir, file.name)
    if (existsSync(target) && statSync(target).size > 1_000_000) continue
    console.log(`→ downloading ${file.name} (once, ~${file.name.endsWith('.onnx') ? '310' : '27'} MB)`)
    run('curl', ['-sSfL', '-o', target, file.url])
  }
  return {
    model: join(modelDir, 'kokoro-v1.0.onnx'),
    voices: join(modelDir, 'voices-v1.0.bin'),
  }
}

/**
 * Trim is done in Python, where pitch is available. ffmpeg only does the two
 * jobs it is better at: levelling perceived loudness and encoding.
 *
 * MP3 rather than AAC because every decodeAudioData implementation accepts it,
 * including the desktop browsers used for development. 24 kHz mono at 48 kbps
 * is transparent for speech and lands at about 4 KB for a letter name.
 */
function encode(ffmpeg: string, src: string, dst: string): void {
  mkdirSync(dirname(dst), { recursive: true })
  run(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', src,
    '-af', `loudnorm=${ENGINE.loudness}`,
    '-ac', '1',
    '-ar', String(ENGINE.sampleRate),
    '-c:a', 'libmp3lame',
    '-b:a', ENGINE.bitrate,
    '-write_xing', '0',
    dst,
  ])
}

function durationOf(ffmpeg: string, file: string): number | null {
  const probe = join(dirname(ffmpeg), 'ffprobe')
  if (!existsSync(probe)) return null
  const out = capture(probe, [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', file,
  ])
  const value = Number.parseFloat(out.trim())
  return Number.isFinite(value) ? Number(value.toFixed(3)) : null
}

/** Removes directories left behind by clips that are no longer generated. */
function pruneEmptyDirs(dir: string): boolean {
  let empty = true
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (pruneEmptyDirs(child)) rmSync(child, { recursive: true })
      else empty = false
    } else {
      empty = false
    }
  }
  return empty
}

function main() {
  const inventory = buildInventory()
  const keyed = inventory.map((clip) => ({ ...clip, key: clipKey(clip) }))

  const manifestPath = join(outDir, 'manifest.json')
  const previous = existsSync(manifestPath) && !force
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : { engine: null, clips: {} }

  const stale = keyed.filter((clip): boolean => {
    const old = previous.clips?.[clip.id]
    const file = join(outDir, `${clip.id}.mp3`)
    return force || !old || old.key !== clip.key || !existsSync(file)
  })

  console.log(`inventory: ${keyed.length} clips, ${stale.length} to build`)
  if (checkOnly) {
    for (const clip of stale.slice(0, 40)) console.log(`  stale ${clip.id}`)
    if (stale.length > 40) console.log(`  ... and ${stale.length - 40} more`)
    return
  }
  if (stale.length === 0) {
    pruneEmptyDirs(outDir)
    console.log('✓ nothing to do')
    return
  }

  mkdirSync(rawDir, { recursive: true })
  const python = ensurePython()
  const { model, voices } = ensureModel()
  const ffmpeg = ffmpegPath()

  const jobsFile = join(cacheDir, 'jobs.json')
  // The cache key is the build's own bookkeeping; the worker never sees it.
  writeFileSync(jobsFile, JSON.stringify(stale.map(({ key: _key, ...clip }) => clip)))

  console.log(`→ synthesizing ${stale.length} clips with ${ENGINE.voice}`)
  const report: { id: string; phonemes: string; duration: number }[] = JSON.parse(capture(python, [
    join(voiceDir, 'synth.py'),
    '--jobs', jobsFile,
    '--model', model,
    '--voices', voices,
    '--out', rawDir,
    '--voice', ENGINE.voice,
    '--speed', String(ENGINE.speed),
  ], { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 }))

  console.log('→ encoding')
  const clips: Record<string, { key: string; bytes: number; duration: number | null; phonemes: string | null }> = { ...(previous.clips ?? {}) }
  let bytes = 0
  for (const clip of stale) {
    const src = join(rawDir, `${clip.id}.wav`)
    const dst = join(outDir, `${clip.id}.mp3`)
    encode(ffmpeg, src, dst)
    const size = statSync(dst).size
    bytes += size
    const row = report.find((r) => r.id === clip.id)
    clips[clip.id] = {
      key: clip.key,
      bytes: size,
      duration: durationOf(ffmpeg, dst) ?? row?.duration ?? null,
      phonemes: row?.phonemes ?? null,
    }
  }

  // Clips that left the inventory must leave the manifest and the disk too,
  // and a directory that held only them must go with them.
  for (const id of Object.keys(clips)) {
    if (keyed.some((c) => c.id === id)) continue
    delete clips[id]
    const orphan = join(outDir, `${id}.mp3`)
    if (existsSync(orphan)) rmSync(orphan)
  }
  pruneEmptyDirs(outDir)

  const total = Object.values(clips).reduce((sum: number, c) => sum + (c.bytes ?? 0), 0)
  const manifest = {
    version: 1,
    engine: ENGINE,
    generated: new Date().toISOString(),
    totalBytes: total,
    clips,
  }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 0)}\n`)

  console.log(
    `✓ ${stale.length} clips built (${(bytes / 1024).toFixed(0)} KB), ` +
    `${Object.keys(clips).length} total (${(total / 1024 / 1024).toFixed(2)} MB)`,
  )
  console.log(`  manifest: ${relative(repoRoot, manifestPath)}`)
}

main()
